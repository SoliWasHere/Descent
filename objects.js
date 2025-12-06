import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';
import { PhysicsObject } from './physics.js';
import { CONFIG } from './config.js';
import { createRotatingMaterial } from './material.js';
import { GLOBALS } from './globals.js';

export class FloorManager {
    constructor(scene) {
        this.scene = scene;
        this.floors = [];
    }

    createFloor(x, y, z, sx = 10, sy = 1, sz = 10, rx = 0, ry = 0, rz = 0) {
        const floor = new PhysicsObject(
            new THREE.BoxGeometry(sx, sy, sz),
            new THREE.MeshStandardMaterial({
                color: 0xFFFFFF,
                roughness: 0.8 
            }),
            0,
            new THREE.Vector3(x, y - 2, z),
            new THREE.Vector3(0, 0, 0)
        );

        floor.width = sx;
        floor.height = sy;
        floor.depth = sz;
        floor.friction = CONFIG.floorFriction;
        floor.restitution = CONFIG.floorRestitution;

        floor.mesh.receiveShadow = true;

        floor.rotateX(rx);
        floor.rotateY(ry);
        floor.rotateZ(rz);

        this.scene.add(floor.mesh);
        this.floors.push(floor);
        
        return floor;
    }

    createInitialFloor() {
        this.createFloor(0, 0, 0);
    }

    checkCollisions(sphere, dt) {
        for (const floor of this.floors) {
            floor.bounceBox(sphere, dt);
        }
    }
}

export class SphereManager {
    constructor(scene) {
        this.scene = scene;
        this.spheres = [];
    }

    createSpheres() {
        const sphere = new PhysicsObject(
            new THREE.SphereGeometry(1, 24, 24),
            createRotatingMaterial(),
            1,
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, 0)
        );
            
        sphere.friction = 1;
        sphere.angularVelocity.set(0, 0, 0);

        sphere.mesh.castShadow = true; 
        sphere.mesh.receiveShadow = true;
            
        this.scene.add(sphere.mesh);
        this.spheres.push(sphere);
        GLOBALS.player.PhysicsObject = sphere;
    }

    applyGravity() {
        for (const sphere of this.spheres) {
            sphere.applyForce(new THREE.Vector3(0, CONFIG.gravity * sphere.mass, 0));
        }
    }

    updatePhysics(dt) {
        for (const sphere of this.spheres) {
            sphere.update(dt);
        }
    }

    handleSphereSphereCollisions() {
        for (let i = 0; i < this.spheres.length; i++) {
            for (let j = i + 1; j < this.spheres.length; j++) {
                if (this.spheres[i].checkCollision(this.spheres[j])) {
                    this.spheres[i].resolveCollision(this.spheres[j]);
                }
            }
        }
    }

    getMainSphere() {
        return this.spheres[0];
    }
}