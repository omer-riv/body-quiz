// The 3D body: loading its parts (public/body/, see scripts/build-body.py) and
// how each one is drawn: solid, as a ghost, lit up, or not at all.
import * as THREE from 'three';
import { LAYERS, baseName, type Layer, type PartInfo } from './structures';

export interface Part extends PartInfo {
  kind: string;
  mesh: THREE.Mesh;
  /** The box around it in the world, in metres. */
  box: THREE.Box3;
  material: THREE.MeshStandardMaterial;
  color: THREE.Color;
}

interface ManifestPart extends PartInfo {
  kind: string;
  v: [number, number];
  f: [number, number];
  wide?: boolean;
}
interface Manifest {
  credit: string;
  min: [number, number, number];
  size: [number, number, number];
  layers: Record<Layer, number>;
  parts: ManifestPart[];
}

export type Glow = 'hover' | 'pick' | 'right' | 'wrong';
const GLOW: Record<Glow, [color: number, strength: number]> = {
  hover: [0x4aa8ff, 0.3],
  pick: [0x1f9fe0, 0.45],
  right: [0x19c46e, 0.6],
  wrong: [0xff2a40, 0.6],
};

// The layers load in this order: the small ones first, so there is a body to
// look at while the muscles (most of the download) arrive.
const LOAD_ORDER: Layer[] = ['bone', 'organ', 'vessel', 'brain', 'skin', 'muscle'];

const KIND_COLORS: Record<string, string> = {
  bone: '#d8c9a3', muscle: '#8e2c28', artery: '#b8151b', vein: '#2a4690', brain: '#d4a9a0', skin: '#c79676', organ: '#b0705f',
};
// Neighbouring organs get clearly different colours, so each reads as its own thing.
const ORGAN_COLORS: [RegExp, string][] = [
  [/lung/, '#d98a94'], [/heart|valve|papillary/, '#9c1f27'], [/liver/, '#6b2a1c'], [/gallbladder/, '#4f8a3a'],
  [/stomach|esophagus/, '#cf8f78'], [/colon|rectum|appendix|taenia/, '#a8624f'], [/ileum|jejunum|duodenum/, '#dba083'],
  [/kidney|ureter/, '#7a2f2c'], [/adrenal/, '#c9a13f'], [/bladder|urethra/, '#cbb06a'], [/spleen/, '#5a2340'],
  [/pancrea/, '#d9b872'], [/trachea|bronch/, '#b9c4c9'], [/eyeball/, '#ecebe6'], [/thymus/, '#c7907c'],
  [/tooth/, '#efe9da'], [/cartilage/, '#b9c2b4'], [/intervertebral/, '#9fb0b3'], [/hairs|eyebrows/, '#2b1d16'],
  [/tendon|ligament|tract|linea alba|aponeurosis|retinaculum|membrane/, '#d9d2c0'],
  [/cerebellum/, '#c98f86'], [/pons|medulla|midbrain|colliculus/, '#c9b29a'], [/ventricle$|aqueduct/, '#6fa8c9'],
  [/prostate|seminal|testis|epididymis|deferent/, '#c9a48f'], [/penis|^ear$|labial/, '#c79676'], [/gingiva/, '#d9737d'],
];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000 - 0.5;
}

function colorOf(part: ManifestPart): THREE.Color {
  const base = baseName(part.name);
  const special = ORGAN_COLORS.find(([match]) => match.test(base));
  const color = new THREE.Color(special ? special[1] : KIND_COLORS[part.kind] ?? KIND_COLORS.organ);
  // A little variety between neighbours, the same on both sides of the body.
  const j = hash(base);
  if (part.layer === 'muscle' || part.layer === 'brain') color.offsetHSL(j * 0.02, j * 0.1, j * 0.09);
  else if (part.layer === 'bone') color.offsetHSL(j * 0.01, j * 0.04, j * 0.04);
  return color;
}

const ROUGHNESS: Record<Layer, number> = { skin: 0.62, muscle: 0.5, bone: 0.66, organ: 0.34, vessel: 0.3, brain: 0.42 };

// A ghost is a part drawn as a glassy outline: bright at its edges, clear face on.
function ghostMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { tint: { value: new THREE.Color(0x8fc4ff) }, strength: { value: 0.42 } },
    vertexShader: `
      varying vec3 vNormal; varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 tint; uniform float strength; varying vec3 vNormal; varying vec3 vView;
      void main() {
        float rim = 1.0 - abs(dot(normalize(vNormal), normalize(vView)));
        gl_FragColor = vec4(tint, 0.025 + strength * pow(rim, 2.6));
      }`,
  });
}

export class Body {
  readonly root = new THREE.Group();
  readonly parts = new Map<string, Part>();
  credit = '';
  /** Called whenever what is drawn changes. */
  onChange: () => void = () => {};

  private readonly ghost = ghostMaterial();
  private readonly layerOn = new Map<Layer, boolean>(LAYERS.map((l) => [l, l !== 'skin' && l !== 'muscle']));
  private readonly peeled = new Set<string>();
  private readonly glows = new Map<string, Glow>();
  private focus: Set<string> | null = null;

  /** Loads the body layer by layer. progress goes from 0 to 1. */
  async load(onProgress: (progress: number) => void): Promise<void> {
    const manifest: Manifest = await (await fetch('./body/manifest.json')).json();
    this.credit = manifest.credit;
    const [sx, sy, sz] = manifest.size;
    const [mx, , mz] = manifest.min;
    // Positions are 0..1 over the body's box, in mm. The world is metres,
    // standing on y = 0 around the y axis.
    this.root.scale.set(sx / 1000, sy / 1000, sz / 1000);
    this.root.position.set((mx - (mx + sx / 2)) / 1000, 0, (mz - (mz + sz / 2)) / 1000);
    this.root.updateMatrixWorld(true);

    const total = Object.values(manifest.layers).reduce((a, b) => a + b, 0);
    let loaded = 0;
    for (const layer of LOAD_ORDER) {
      const buffer = await (await fetch(`./body/${layer}.bin`)).arrayBuffer();
      for (const info of manifest.parts) if (info.layer === layer) this.add(info, buffer);
      loaded += manifest.layers[layer];
      onProgress(loaded / total);
      this.onChange();
    }
  }

  private add(info: ManifestPart, buffer: ArrayBuffer): void {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Uint16Array(buffer, info.v[0], info.v[1] * 3), 3, true));
    const Index = info.wide ? Uint32Array : Uint16Array;
    geometry.setIndex(new THREE.BufferAttribute(new Index(buffer, info.f[0], info.f[1] * 3), 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    const color = colorOf(info);
    const material = new THREE.MeshStandardMaterial({ color, roughness: ROUGHNESS[info.layer], metalness: 0 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    this.root.add(mesh);
    mesh.updateMatrixWorld(true);
    const box = geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
    const part: Part = { id: info.id, name: info.name, layer: info.layer, kind: info.kind, mesh, box, material, color };
    mesh.userData.part = part;
    this.parts.set(info.id, part);
    this.apply(part);
  }

  // ---- What is shown -------------------------------------------------------

  isLayerOn(layer: Layer): boolean {
    return this.layerOn.get(layer)!;
  }
  setLayer(layer: Layer, on: boolean): void {
    this.layerOn.set(layer, on);
    this.refresh();
  }
  setLayers(on: readonly Layer[]): void {
    for (const layer of LAYERS) this.layerOn.set(layer, on.includes(layer));
    this.refresh();
  }

  /** Takes parts away, to see what is behind them. */
  peel(ids: readonly string[]): void {
    for (const id of ids) this.peeled.add(id);
    this.refresh();
  }
  get peeledCount(): number {
    return this.peeled.size;
  }
  restore(): void {
    this.peeled.clear();
    this.refresh();
  }

  /** Lights parts up. One glow at a time per kind: a new 'hover' replaces the last. */
  glow(kind: Glow, ids: readonly string[]): void {
    for (const [id, k] of this.glows) if (k === kind) this.glows.delete(id);
    for (const id of ids) this.glows.set(id, kind);
    this.refresh();
  }
  clearGlows(): void {
    this.glows.clear();
    this.refresh();
  }

  /** Shows these parts solid and everything else as a ghost, whatever the layers say. null ends it. */
  setFocus(ids: readonly string[] | null): void {
    this.focus = ids ? new Set(ids) : null;
    this.refresh();
  }

  /** Whether a part is drawn solid, so it can be tapped. */
  isSolid(part: Part): boolean {
    if (this.focus) return this.focus.has(part.id);
    return this.layerOn.get(part.layer)! && !this.peeled.has(part.id);
  }

  private refresh(): void {
    for (const part of this.parts.values()) this.apply(part);
    this.onChange();
  }

  private apply(part: Part): void {
    const { mesh, material } = part;
    const solid = this.isSolid(part);
    // What isn't solid mostly isn't drawn. The skin leaves a ghost, an outline
    // of the body to find your way by, and in focus the skeleton does too.
    const outline = part.kind === 'skin' || (this.focus !== null && part.layer === 'bone');
    const ghost = !solid && outline;
    mesh.visible = solid || ghost;
    if (!mesh.visible) return;
    mesh.material = solid ? material : this.ghost;
    mesh.renderOrder = solid ? 0 : 1;
    const glow = solid ? this.glows.get(part.id) : undefined;
    if (glow) {
      material.emissive.setHex(GLOW[glow][0]);
      material.emissiveIntensity = GLOW[glow][1];
    } else {
      material.emissive.setHex(0);
    }
  }

  // ---- Where things are ----------------------------------------------------

  /** The box around some parts, to point the camera at. */
  boxOf(ids: readonly string[]): THREE.Box3 {
    const box = new THREE.Box3();
    for (const id of ids) {
      const part = this.parts.get(id);
      if (part) box.union(part.box);
    }
    return box;
  }
}
