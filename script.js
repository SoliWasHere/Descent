import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';
import { PhysicsObject, CollisionHelper } from './physics.js';
import { createRotatingMaterial } from './material.js';

// ============================================================================
// Scene Setup
// ============================================================================

/**
 * Main canvas element for rendering
 * @type {HTMLCanvasElement}
 */
const canvas = document.getElementById("scene");

/**
 * WebGL renderer with antialiasing enabled
 * @type {THREE.WebGLRenderer}
 */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

/**
 * Main Three.js scene
 * @type {THREE.Scene}
 */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background

/**
 * Orthographic camera for isometric-style view
 * @type {THREE.PerspectiveCamera}
 */
const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.far = 10000;
camera.position.set(-100, 0, -100);
camera.lookAt(0, 0, 0);

// ============================================================================
// Lighting
// ============================================================================

/**
 * Main directional light simulating sunlight
 * @type {THREE.DirectionalLight}
 */
const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(10, 15, 10);
scene.add(sunLight);

/**
 * Ambient light for general scene illumination
 * @type {THREE.AmbientLight}
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

// ============================================================================
// Floor Setup
// ============================================================================

const floorWidth = 12;
const floorHeight = 0.8;
const floorDepth = 12;

/**
 * Static floor object (rectangular prism) tilted at 30 degrees
 * @type {PhysicsObject}
 */
const floor = new PhysicsObject(
    new THREE.BoxGeometry(floorWidth, floorHeight, floorDepth),
    new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(0xFFFFFF),
        roughness: 0.8 
    }),
    0, // Mass = 0 makes it static
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0)
);

// Set box collider dimensions
floor.width = floorWidth;
floor.height = floorHeight;
floor.depth = floorDepth;

// Tilt floor 30 degrees
floor.rotateX(-Math.PI / 6);

// Set material properties
floor.friction = 1;      // High friction for realistic rolling
floor.restitution = 0.5; // Moderate bounciness

scene.add(floor.mesh);

let cameraDisplace = [0,0,0];

// ============================================================================
// Sphere Setup
// ============================================================================

/**
 * Array of physics-enabled spheres
 * @type {PhysicsObject[]}
 */
const spheres = [];
const numSpheres = 4;

/**
 * Calculates the axis for backspin on a tilted surface.
 * Backspin is perpendicular to the downhill direction.
 * @param {THREE.Vector3} floorNormal - Normal vector of the tilted floor
 * @returns {THREE.Vector3} Normalized axis for backspin rotation
 */
function getBackspinAxis(floorNormal) {
    // Calculate downhill direction (gravity projected onto the plane)
    const gravity = new THREE.Vector3(0, -1, 0);
    const downhill = gravity.clone().addScaledVector(
        floorNormal, 
        -gravity.dot(floorNormal)
    );
    downhill.normalize();
    
    // Backspin axis is perpendicular to both downhill and normal
    const backspinAxis = new THREE.Vector3().crossVectors(downhill, floorNormal);
    backspinAxis.normalize();
    
    return backspinAxis;
}

// Create spheres
for (let i = 0; i < numSpheres; i++) {
    const sphere = new PhysicsObject(
        new THREE.SphereGeometry(1, 32, 32),
        createRotatingMaterial(),
        1, // Mass = 1
        new THREE.Vector3((i - 1) * 2.5, 50, 0), // Starting positions
        new THREE.Vector3(0, 0, 0) // Initial velocity
    );
    
    sphere.friction = 1; // High friction for realistic rolling
    
    scene.add(sphere.mesh);
    spheres.push(sphere);
}

// Apply initial spin to first sphere
spheres[0].angularVelocity.set(-6, 0, 0);

// ============================================================================
// Animation Loop
// ============================================================================

let lastTime = performance.now();

/**
 * Main animation loop. Updates physics and renders the scene.
 * Runs at monitor refresh rate (typically 60 FPS).
 */
function animate() {
    const currentTime = performance.now();
    const dt = (currentTime - lastTime) / 1000; // Delta time in seconds
    lastTime = currentTime;
    
    // Update all spheres
    for (let sphere of spheres) {
        // Apply gravity force
        sphere.applyForce(new THREE.Vector3(0, -9.81 * sphere.mass, 0));
        
        // Update physics simulation
        sphere.update(dt);
        
        // Check and resolve collision with floor
        floor.bounceBox(sphere, dt);
    }
    
    // Handle sphere-to-sphere collisions
    for (let i = 0; i < spheres.length; i++) {
        for (let j = i + 1; j < spheres.length; j++) {
            if (spheres[i].checkCollision(spheres[j])) {
                spheres[i].resolveCollision(spheres[j]);
            }
        }
    }
    
    // Optional: Camera follows first sphere
    // Uncomment to enable dynamic camera tracking
    const target = spheres[0].position;
    camera.lookAt(target);
    camera.position.set(
        target.x + cameraDisplace[0],
        target.y + cameraDisplace[1],
        target.z + 12 + cameraDisplace[2]
    ); 
    
    // Render the scene
    renderer.render(scene, camera);
    
    // Request next frame
    requestAnimationFrame(animate);
}

// Start animation loop
animate();

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handles window resize events to maintain proper aspect ratio and canvas size
 */
window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Update orthographic camera frustum
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = window.innerWidth / -40;
    camera.right = window.innerWidth / 40;
    camera.top = window.innerHeight / 40;
    camera.bottom = window.innerHeight / -40;
    camera.updateProjectionMatrix();
});

const keysHeld = {};

// Track when keys are pressed
window.addEventListener("keydown", (event) => {
    keysHeld[event.key] = true;
});

// Track when keys are released
window.addEventListener("keyup", (event) => {
    keysHeld[event.key] = false;
});
