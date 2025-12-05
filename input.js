import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';
import { CONFIG } from './config.js';
import { GLOBALS } from './globals.js';

export class InputHandler {
    constructor() {
        this.keysHeld = {};
        this.cameraDisplace = [-10*Math.PI, 0, 0];
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener("keydown", (e) => this.keysHeld[e.key] = true);
        window.addEventListener("keyup", (e) => this.keysHeld[e.key] = false);
    }

    handleInput(sphere, dt) {
        const force = CONFIG.forceMagnitude * dt;

        // Get camera direction vectors
        const camera = GLOBALS.camera;
        const spherePos = sphere.position;
        
        // Calculate forward direction (from sphere to camera, projected onto XZ plane)
        const cameraDir = new THREE.Vector3(
            camera.position.x - spherePos.x,
            0, // Ignore Y component for horizontal movement
            camera.position.z - spherePos.z
        ).normalize();
        
        // Calculate right direction (perpendicular to forward on XZ plane)
        const rightDir = new THREE.Vector3(-cameraDir.z, 0, cameraDir.x).normalize();
        
        // Sphere movement relative to camera view
        if (this.keysHeld['w']) {
            // Move away from camera (into the screen)
            sphere.applyForce(cameraDir.clone().multiplyScalar(-force));
        }
        if (this.keysHeld['s']) {
            // Move towards camera (out of the screen)
            sphere.applyForce(cameraDir.clone().multiplyScalar(force));
        }
        if (this.keysHeld['a']) {
            // Move left relative to camera
            sphere.applyForce(rightDir.clone().multiplyScalar(force));
        }
        if (this.keysHeld['d']) {
            // Move right relative to camera
            sphere.applyForce(rightDir.clone().multiplyScalar(-force));
        }
     
        // Camera displacement
        const camShift = CONFIG.cameraShiftSpeed * dt;
        if (this.keysHeld['ArrowUp'])    this.cameraDisplace[1] += camShift;
        if (this.keysHeld['ArrowDown'])  this.cameraDisplace[1] -= camShift;
        if (this.keysHeld['ArrowLeft'])  this.cameraDisplace[0] -= camShift;
        if (this.keysHeld['ArrowRight']) this.cameraDisplace[0] += camShift;
    }
}