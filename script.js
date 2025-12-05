import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';
import { PhysicsObject, CollisionHelper } from './physics.js';
import { createRotatingMaterial } from './material.js';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    floorWidth: 12,
    floorHeight: 0.8,
    floorDepth: 12,
    floorFriction: 1,
    floorRestitution: 0.5,
    numSpheres: 1,
    sphereStartY: 50,
    gravity: -9.81,
    forceMagnitude: 1000, 
    cameraShiftSpeed: 20,
    floorSpawnInterval: 10, // milliseconds
};

// ============================================================================
// Scene Setup
// ============================================================================

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    10000
);
camera.position.set(-100, 0, -100);
camera.lookAt(0, 0, 0);

// ============================================================================
// Lighting
// ============================================================================

const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(10, 15, 10);
scene.add(sunLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

// ============================================================================
// Floor Management
// ============================================================================

/**
 * Array to store all floor objects
 * @type {PhysicsObject[]}
 */
const floors = [];

/**
 * Creates a flat floor at the specified position
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} z - Z coordinate
 * @returns {PhysicsObject} The created floor object
 */
function createFloor(x, y, z) {
    const floor = new PhysicsObject(
        new THREE.BoxGeometry(CONFIG.floorWidth, CONFIG.floorHeight, CONFIG.floorDepth),
        new THREE.MeshStandardMaterial({ 
            color: 0xFFFFFF,
            roughness: 0.8 
        }),
        0, // Static object
        new THREE.Vector3(x, y - 2, z),
        new THREE.Vector3(0, 0, 0)
    );

    // Set collider dimensions
    floor.width = CONFIG.floorWidth;
    floor.height = CONFIG.floorHeight;
    floor.depth = CONFIG.floorDepth;

    // Set material properties
    floor.friction = CONFIG.floorFriction;
    floor.restitution = CONFIG.floorRestitution;

    scene.add(floor.mesh);
    floors.push(floor);
    
    return floor;
}

// Create initial floor
createFloor(0, 0, 0);

// ============================================================================
// Sphere Setup
// ============================================================================

/**
 * Array of physics-enabled spheres
 * @type {PhysicsObject[]}
 */
const spheres = [];

// Create spheres
for (let i = 0; i < CONFIG.numSpheres; i++) {
    const sphere = new PhysicsObject(
        new THREE.SphereGeometry(1, 32, 32),
        createRotatingMaterial(),
        1,
        new THREE.Vector3((i - 1) * 2.5, CONFIG.sphereStartY, 0),
        new THREE.Vector3(0, 0, 0)
    );
    
    sphere.friction = 1;
    
    scene.add(sphere.mesh);
    spheres.push(sphere);
}

// Apply initial spin to first sphere
spheres[0].angularVelocity.set(0, 0, 0); 

// ============================================================================
// Input Handling
// ============================================================================

const keysHeld = {};
const cameraDisplace = [0, 0, 0];

/**
 * Processes continuous input from held keys
 * @param {number} dt - Delta time in seconds
 */
function handleInput(dt) {
    const sphere = spheres[0];
    const force = CONFIG.forceMagnitude * dt;

    // Sphere movement
    if (keysHeld['w']) sphere.applyForce(new THREE.Vector3(0, 0, -force));
    if (keysHeld['s']) sphere.applyForce(new THREE.Vector3(0, 0, force));
    if (keysHeld['a']) sphere.applyForce(new THREE.Vector3(-force, 0, 0));
    if (keysHeld['d']) sphere.applyForce(new THREE.Vector3(force, 0, 0));
 
    // Camera displacement
    const camShift = CONFIG.cameraShiftSpeed * dt;
    if (keysHeld['ArrowUp'])    cameraDisplace[1] += camShift;
    if (keysHeld['ArrowDown'])  cameraDisplace[1] -= camShift;
    if (keysHeld['ArrowLeft'])  cameraDisplace[0] -= camShift;
    if (keysHeld['ArrowRight']) cameraDisplace[0] += camShift;
}

window.addEventListener("keydown", (e) => keysHeld[e.key] = true);
window.addEventListener("keyup", (e) => keysHeld[e.key] = false);

// ============================================================================
// Animation Loop
// ============================================================================

let lastTime = performance.now();
let lastFloorSpawn = performance.now();

/**
 * Main animation loop - updates physics and renders the scene
 */
function animate() {
    const currentTime = performance.now();
    const dt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // Handle input
    handleInput(dt);

    // Spawn floor under ball every second
    if (currentTime - lastFloorSpawn >= CONFIG.floorSpawnInterval) {
        const pos = spheres[0].position;
        let floor2 = createFloor(pos.x, pos.y, pos.z); 
        floor2.rotateZ( ( Math.random() - 0.5) * Math.PI / 4);   
        lastFloorSpawn = currentTime;
    }

    // Update spheres
    
    for (const sphere of spheres) {
        // Apply gravity
        sphere.applyForce(new THREE.Vector3(0, CONFIG.gravity * sphere.mass, 0));
        
        // Update physics
        sphere.update(dt);
        
        // Check collision with all floors
        for (const floor of floors) {
            floor.bounceBox(sphere, dt);
        }
    }
    
    // Handle sphere-to-sphere collisions
    for (let i = 0; i < spheres.length; i++) {
        for (let j = i + 1; j < spheres.length; j++) {
            if (spheres[i].checkCollision(spheres[j])) {
                spheres[i].resolveCollision(spheres[j]);
            }
        }
    }
    
    // Camera follows first sphere
    const target = spheres[0].position;
    camera.lookAt(target);
    camera.position.set(
        target.x  + Math.sin(cameraDisplace[0]/20) * 50,
        target.y + 50 + cameraDisplace[1], 
        target.z + 0 + Math.cos(cameraDisplace[0]/20) * 50
    ); 
    
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

// Start animation
animate();

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handles window resize to maintain proper aspect ratio
 */
window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});