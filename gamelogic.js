// gamelogic.js - Fixed version with proper collision handling
import { GLOBALS } from './globals.js';
import { createSineWaveMesh } from './floor.js';
import { CollisionManager } from './collisionmanager.js';
import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

export class GameLogic {
    constructor(floorManager, sphereManager) {
        this.floorManager = floorManager;
        this.sphereManager = sphereManager;
        this.currentFloorX = 0;
        this.floorCounts = 0;
        this.collisionManager = new CollisionManager();
        this.debugHelpers = [];
        
        // Create initial floor
        this.floorManager.createFloor(0, 0, 0);
    }

    createSineWavePlatform(x, y, z) {
        const result = createSineWaveMesh({
            length: 15,
            width: 5,
            height: 1,
            waveHeight: 2,
            frequency: 2,
            segments: 100,
            position: new THREE.Vector3(x, y, z)
        });

        GLOBALS.scene.add(result.mesh);
        this.collisionManager.addTriangles(result.triangles);

        // DEBUG: Visualize some triangles
        for (let i = 0; i < Math.min(20, result.triangles.length); i += 10) {
            const tri = result.triangles[i];
            const helper = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([tri.v0, tri.v1, tri.v2, tri.v0]),
                new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 })
            );
            GLOBALS.scene.add(helper);
            this.debugHelpers.push(helper);
        }

        // DEBUG: Print first few triangle positions
        console.log('First 3 triangles:');
        for (let i = 0; i < Math.min(3, result.triangles.length); i++) {
            const tri = result.triangles[i];
            console.log(
                `  Triangle ${i}:`,
                `v0=(${tri.v0.x.toFixed(1)}, ${tri.v0.y.toFixed(1)}, ${tri.v0.z.toFixed(1)})`,
                `v1=(${tri.v1.x.toFixed(1)}, ${tri.v1.y.toFixed(1)}, ${tri.v1.z.toFixed(1)})`,
                `v2=(${tri.v2.x.toFixed(1)}, ${tri.v2.y.toFixed(1)}, ${tri.v2.z.toFixed(1)})`
            );
        }
    }

    update() {
        const player = GLOBALS.player?.PhysicsObject;
        if (!player) return;

        // Check collisions with both regular floors AND triangle meshes
        this.floorManager.checkCollisions(player, 1/60);
        this.collisionManager.collideSphere(player, 0.5, 0.7, 1/60);

        // Debug: occasionally log sphere position
        if (Math.random() < 0.01) {
            const nearby = this.collisionManager.getNearbyTriangles(player.position, player.radius);
            console.log(
                `Sphere at (${player.position.x.toFixed(1)}, ${player.position.y.toFixed(1)}, ${player.position.z.toFixed(1)}),`,
                `nearby triangles: ${nearby.length}`
            );
        }

        // Spawn new floors as player moves forward
        if (player.position.x > this.currentFloorX + 5) {
            this.currentFloorX += 5;
            
            if (this.floorCounts % 10 === 0 && this.floorCounts !== 0) {
                // Every 10th floor is a sine wave
                this.createSineWavePlatform(this.currentFloorX, 0, 0);
            } else if (this.floorCounts % 5 === 0 && this.floorCounts !== 0) {
                // Every 5th floor (not 10th) is a regular floor
                this.floorManager.createFloor(
                    this.currentFloorX, 0, 0,
                    10, 1, 10,
                    0, 0, 0
                );
            } else {
                // Regular floors
                this.floorManager.createFloor(
                    this.currentFloorX, 0, 0,
                    10, 1, 10,
                    0, 0, 0
                );
            }
            this.floorCounts++;
        }
    }
}