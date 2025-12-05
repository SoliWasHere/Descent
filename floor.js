import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';
import { PhysicsObject } from './physics.js';
import { CONFIG } from './config.js';

export class FloorManager {
    constructor(scene) {
        this.scene = scene;
        this.floors = [];
    }

    createFloor(x, y, z) {
        const floor = new PhysicsObject(
            new THREE.BoxGeometry(CONFIG.floorWidth, CONFIG.floorHeight, CONFIG.floorDepth),
            new THREE.MeshStandardMaterial({ 
                color: 0xFFFFFF,
                roughness: 0.8 
            }),
            0,
            new THREE.Vector3(x, y - 2, z),
            new THREE.Vector3(0, 0, 0)
        );

        floor.width = CONFIG.floorWidth;
        floor.height = CONFIG.floorHeight;
        floor.depth = CONFIG.floorDepth;
        floor.friction = CONFIG.floorFriction;
        floor.restitution = CONFIG.floorRestitution;

        floor.mesh.receiveShadow = true;

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