// Placeholder scene: proves Three.js, WebGL and the deploy all work end to end.
import * as THREE from 'three';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0.4, 5);

scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x1a1020, 1.2));
const key = new THREE.DirectionalLight(0xffffff, 2);
key.position.set(3, 4, 5);
scene.add(key);

const heart = new THREE.Mesh(
  new THREE.TorusKnotGeometry(0.8, 0.28, 220, 32),
  new THREE.MeshStandardMaterial({ color: 0xd9465a, roughness: 0.35, metalness: 0.1 }),
);
heart.position.y = 0.5;
scene.add(heart);

function resize() {
  const { innerWidth: w, innerHeight: h } = window;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

renderer.setAnimationLoop((t) => {
  const beat = 1 + 0.06 * Math.max(0, Math.sin(t / 180)) ** 8;
  heart.scale.setScalar(beat);
  heart.rotation.y = t / 2400;
  heart.rotation.x = Math.sin(t / 3000) * 0.3;
  renderer.render(scene, camera);
});
