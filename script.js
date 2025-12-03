import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

// Renderer
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x202020);

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xFFFFFF);

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 5);
camera.lookAt(0, 0, 0);

// Light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
scene.add(light);

// Sphere
const geometry = new THREE.SphereGeometry(1, 32, 32);
const material = new THREE.MeshStandardMaterial({ color: 0x0077ff });
const sphere = new THREE.Mesh(geometry, material);
sphere.position.y = 1; // lift it above the floor
scene.add(sphere);

// Floor
const floorGeometry = new THREE.PlaneGeometry(10, 10);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2; // horizontal
scene.add(floor);
let t = 0;
// Animation
function animate() {
  t = t + 1;
  camera.position.set(
    5 * Math.cos(t * 0.01),
    2,
    5 * Math.sin(t * 0.01)
  );
  camera.lookAt(0, 1, 0);
  //camera.rotation = new THREE.Euler(0, t * 0.01 + Math.PI / 2, 0);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// Resize
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});