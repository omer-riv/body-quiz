// The camera and the canvas: drawing the scene, turning and zooming it, flying
// to a place, and telling which part is under a finger.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Body, Part } from './body';

const TAP_DISTANCE = 8; // px a finger may wander and still be a tap
const TAP_TIME = 450; // ms

export class View {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.01, 60);
  readonly controls: OrbitControls;
  onTap: (part: Part | null) => void = () => {};
  onHover: (part: Part | null) => void = () => {};
  /** Turns the body slowly while nobody is touching it. */
  autoRotate = false;
  /** Screen space the UI covers, in px: the camera frames things in what is left. */
  inset = { top: 0, bottom: 0 };

  private readonly renderer: THREE.WebGLRenderer;
  private readonly pickTarget = new THREE.WebGLRenderTarget(1, 1);
  private readonly pickMaterials = new Map<string, THREE.MeshBasicMaterial>();
  private readonly pickIds: Part[] = [];
  private dirty = true;
  private flight: { from: THREE.Vector3; to: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; start: number; ms: number } | null = null;
  private hoverAt: { x: number; y: number } | null = null;
  private lastTouch = 0;

  constructor(readonly canvas: HTMLCanvasElement, private readonly body: Body) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.38;
    const key = new THREE.DirectionalLight(0xfff1e0, 2.4);
    key.position.set(-0.7, 0.8, 1);
    const rim = new THREE.DirectionalLight(0x7fb0ff, 1.5);
    rim.position.set(1, 0.3, -1);
    // The lights ride with the camera, so the side you look at is the lit one.
    this.camera.add(key, rim);
    this.scene.add(this.camera, body.root);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minDistance = 0.06;
    this.controls.maxDistance = 12;
    this.controls.zoomToCursor = true;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.addEventListener('change', () => (this.dirty = true));
    this.controls.addEventListener('start', () => (this.flight = null));

    body.onChange = () => (this.dirty = true);
    this.listen();
    this.resize();
    addEventListener('resize', () => this.resize());
    this.home(false);
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  invalidate(): void {
    this.dirty = true;
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.canvas.parentElement!;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  private frame(time: number): void {
    if (this.flight) {
      const f = this.flight;
      const t = Math.min(1, (time - f.start) / f.ms);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.camera.position.lerpVectors(f.from, f.to, e);
      this.controls.target.lerpVectors(f.fromTarget, f.toTarget, e);
      if (t >= 1) this.flight = null;
      this.dirty = true;
    }
    this.controls.autoRotate = this.autoRotate && !this.flight;
    this.controls.autoRotateSpeed = 0.9;
    this.controls.update();
    if (this.hoverAt) {
      const { x, y } = this.hoverAt;
      this.hoverAt = null;
      this.onHover(this.pick(x, y));
    }
    if (!this.dirty) return;
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
  }

  // ---- Flying --------------------------------------------------------------

  /** Frames a sphere, looking along -direction. half is the width and height to fit, where a sphere is too roomy. */
  flyTo(sphere: THREE.Sphere, direction?: THREE.Vector3, animate = true, half?: { w: number; h: number }): void {
    const dir = (direction ?? this.camera.position.clone().sub(this.controls.target)).clone().normalize();
    const { clientWidth: w, clientHeight: h } = this.canvas;
    const free = Math.max(0.35, 1 - (this.inset.top + this.inset.bottom) / h);
    const vFov = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const hFov = Math.atan(Math.tan(vFov) * (w / h));
    const fit = half
      ? Math.max(half.h / Math.tan(vFov * free), half.w / Math.tan(hFov)) * 1.06
      : Math.max(0.12, (sphere.radius * 1.25) / Math.sin(Math.min(vFov * free, hFov)));
    const distance = Math.min(fit, this.controls.maxDistance);
    // Shift the aim so the sphere sits in the middle of the space the UI leaves free.
    const shift = ((this.inset.bottom - this.inset.top) / h) * Math.tan(vFov) * distance;
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(up, dir).normalize();
    const camUp = new THREE.Vector3().crossVectors(dir, side).normalize();
    const target = sphere.center.clone().addScaledVector(camUp, -shift);
    const to = target.clone().addScaledVector(dir, distance);
    if (!animate) {
      this.camera.position.copy(to);
      this.controls.target.copy(target);
      this.controls.update();
      this.dirty = true;
      return;
    }
    this.flight = { from: this.camera.position.clone(), to, fromTarget: this.controls.target.clone(), toTarget: target, start: performance.now(), ms: 850 };
  }

  /** Flies to some parts, from the side of the body they are on. */
  flyToParts(ids: readonly string[], animate = true): void {
    const box = this.body.boxOf(ids);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const c = sphere.center;
    const back = c.z < -0.035;
    // Small things get room around them, to see where in the body they are.
    const half = { w: Math.max(size.x, size.z, 0.07) * 0.68, h: Math.max(size.y, 0.07) * 0.68 };
    this.flyTo(sphere, new THREE.Vector3(c.x * 2.2, 0.18, back ? -1 : 1), animate, half);
  }

  /** The whole body, from the front. */
  home(animate = true): void {
    this.flyTo(new THREE.Sphere(new THREE.Vector3(0, 0.84, 0), 0.9), new THREE.Vector3(0.25, 0.08, 1), animate, { w: 0.4, h: 0.88 });
  }

  // ---- Picking -------------------------------------------------------------

  // Draws the one pixel under the pointer with every solid part in its own flat
  // colour, and reads which colour came out. Exact, and no slower for 900 parts.
  pick(clientX: number, clientY: number): Part | null {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = this.renderer.getPixelRatio();
    const x = (clientX - rect.left) * ratio;
    const y = (clientY - rect.top) * ratio;
    const restore: [THREE.Mesh, THREE.Material | THREE.Material[], boolean][] = [];
    for (const part of this.body.parts.values()) {
      restore.push([part.mesh, part.mesh.material, part.mesh.visible]);
      const solid = part.mesh.visible && this.body.isSolid(part);
      part.mesh.visible = solid;
      if (solid) part.mesh.material = this.pickMaterial(part);
    }
    this.camera.setViewOffset(rect.width * ratio, rect.height * ratio, x, y, 1, 1);
    const clear = this.renderer.getClearColor(new THREE.Color());
    const alpha = this.renderer.getClearAlpha();
    this.renderer.setRenderTarget(this.pickTarget);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    const pixel = new Uint8Array(4);
    this.renderer.readRenderTargetPixels(this.pickTarget, 0, 0, 1, 1, pixel);
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(clear, alpha);
    this.camera.clearViewOffset();
    for (const [mesh, material, visible] of restore) {
      mesh.material = material;
      mesh.visible = visible;
    }
    const id = (pixel[0] << 16) | (pixel[1] << 8) | pixel[2];
    return id ? this.pickIds[id - 1] ?? null : null;
  }

  /** The part under a point, or else the one nearest to it within reach px: a finger is wider than a rib. */
  pickNear(clientX: number, clientY: number, reach: number): Part | null {
    const hit = this.pick(clientX, clientY);
    if (hit) return hit;
    for (const radius of [reach / 2, reach]) {
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const near = this.pick(clientX + Math.cos(angle) * radius, clientY + Math.sin(angle) * radius);
        if (near) return near;
      }
    }
    return null;
  }

  private pickMaterial(part: Part): THREE.MeshBasicMaterial {
    let material = this.pickMaterials.get(part.id);
    if (!material) {
      this.pickIds.push(part);
      const id = this.pickIds.length;
      material = new THREE.MeshBasicMaterial({ toneMapped: false, fog: false });
      material.color.setRGB(((id >> 16) & 255) / 255, ((id >> 8) & 255) / 255, (id & 255) / 255, THREE.LinearSRGBColorSpace);
      this.pickMaterials.set(part.id, material);
    }
    return material;
  }

  private listen(): void {
    const canvas = this.canvas;
    let down: { x: number; y: number; time: number; id: number } | null = null;
    let pointers = 0;
    canvas.addEventListener('pointerdown', (e) => {
      pointers++;
      if (e.pointerType !== 'mouse') this.lastTouch = performance.now();
      down = pointers === 1 ? { x: e.clientX, y: e.clientY, time: performance.now(), id: e.pointerId } : null;
    });
    const up = (e: PointerEvent) => {
      pointers = Math.max(0, pointers - 1);
      if (!down || down.id !== e.pointerId) return;
      const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) < TAP_DISTANCE && performance.now() - down.time < TAP_TIME;
      down = null;
      if (tap) this.onTap(this.pickNear(e.clientX, e.clientY, e.pointerType === 'mouse' ? 4 : 14));
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', () => {
      pointers = Math.max(0, pointers - 1);
      down = null;
    });
    // Hovering is for mice: a finger has no hover, and its taps send mouse moves after them.
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || e.buttons || performance.now() - this.lastTouch < 800) return;
      this.hoverAt = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerleave', () => {
      this.hoverAt = null;
      this.onHover(null);
    });
  }
}
