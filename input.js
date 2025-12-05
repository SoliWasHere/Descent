import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';
import { CONFIG } from './config.js';

export class InputHandler {
    constructor() {
        this.keysHeld = {};
        this.cameraDisplace = [0, 0, 0];
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener("keydown", (e) => this.keysHeld[e.key] = true);
        window.addEventListener("keyup", (e) => this.keysHeld[e.key] = false);
    }

    handleInput(sphere, dt) {
        const force = CONFIG.forceMagnitude * dt;

        // Sphere movement
        if (this.keysHeld['w']) sphere.applyForce(new THREE.Vector3(0, 0, -force));
        if (this.keysHeld['s']) sphere.applyForce(new THREE.Vector3(0, 0, force));
        if (this.keysHeld['a']) sphere.applyForce(new THREE.Vector3(-force, 0, 0));
        if (this.keysHeld['d']) sphere.applyForce(new THREE.Vector3(force, 0, 0));
     
        // Camera displacement
        const camShift = CONFIG.cameraShiftSpeed * dt;
        if (this.keysHeld['ArrowUp'])    this.cameraDisplace[1] += camShift;
        if (this.keysHeld['ArrowDown'])  this.cameraDisplace[1] -= camShift;
        if (this.keysHeld['ArrowLeft'])  this.cameraDisplace[0] -= camShift;
        if (this.keysHeld['ArrowRight']) this.cameraDisplace[0] += camShift;
    }
}
