// gamelogic.js - Fixed version with proper collision handling
import { GLOBALS } from './globals.js';
import { createSineWaveMesh, createZigZagMesh } from './floor.js';
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
        position: new THREE.Vector3(x, y, z),
        travelAxis: 'x',
        waveAxis: 'z'
    });

    GLOBALS.scene.add(result.mesh);
    
    // CRITICAL: Force matrix update immediately after adding to scene
    result.mesh.updateMatrixWorld(true);
    
    // Transform triangles to world space
    const worldTriangles = result.triangles.map(tri => {
        const v0 = tri.v0.clone().applyMatrix4(result.mesh.matrixWorld);
        const v1 = tri.v1.clone().applyMatrix4(result.mesh.matrixWorld);
        const v2 = tri.v2.clone().applyMatrix4(result.mesh.matrixWorld);
        
        const edge1 = new THREE.Vector3().subVectors(v1, v0);
        const edge2 = new THREE.Vector3().subVectors(v2, v0);
        const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
        
        return {
            v0, v1, v2,
            normal,
            bounds: {
                minX: Math.min(v0.x, v1.x, v2.x),
                maxX: Math.max(v0.x, v1.x, v2.x),
                minY: Math.min(v0.y, v1.y, v2.y),
                maxY: Math.max(v0.y, v1.y, v2.y),
                minZ: Math.min(v0.z, v1.z, v2.z),
                maxZ: Math.max(v0.z, v1.z, v2.z)
            }
        };
    });
    
    this.collisionManager.addTriangles(worldTriangles);
    
    console.log(`Created sine wave at (${x}, ${y}, ${z})`);
    console.log('First world triangle v0:', worldTriangles[0].v0);
    console.log('First world triangle Y bounds:', worldTriangles[0].bounds.minY, 'to', worldTriangles[0].bounds.maxY);
}

createZigZagPlatform(x, y, z) {
    // Implementation for zig-zag platform creation

    const result = createZigZagMesh({
        position: new THREE.Vector3(x, y, z),
        travelAxis: 'x',
        zigzagAxis: 'x'
    });

    GLOBALS.scene.add(result.mesh);

    // CRITICAL: Force matrix update immediately after adding to scene
    result.mesh.updateMatrixWorld(true);

    // Transform triangles to world space
    const worldTriangles = result.triangles.map(tri => {
        const v0 = tri.v0.clone().applyMatrix4(result.mesh.matrixWorld);
        const v1 = tri.v1.clone().applyMatrix4(result.mesh.matrixWorld);
        const v2 = tri.v2.clone().applyMatrix4(result.mesh.matrixWorld);

        const edge1 = new THREE.Vector3().subVectors(v1, v0);
        const edge2 = new THREE.Vector3().subVectors(v2, v0);
        const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

        return {
            v0, v1, v2,
            normal,
            bounds: {
                minX: Math.min(v0.x, v1.x, v2.x),
                maxX: Math.max(v0.x, v1.x, v2.x),
                minY: Math.min(v0.y, v1.y, v2.y),
                maxY: Math.max(v0.y, v1.y, v2.y),
                minZ: Math.min(v0.z, v1.z, v2.z),
                maxZ: Math.max(v0.z, v1.z, v2.z)
            }
        };
    });

    this.collisionManager.addTriangles(worldTriangles);

    console.log(`Created zig-zag platform at (${x}, ${y}, ${z})`);
    console.log('First world triangle v0:', worldTriangles[0].v0);
    console.log('First world triangle Y bounds:', worldTriangles[0].bounds.minY, 'to', worldTriangles[0].bounds.maxY);
}

    update() {
        const player = GLOBALS.player?.PhysicsObject;
        if (!player) return;
        console.log(`Player position: (${player.position.x.toFixed(2)}, ${player.position.y.toFixed(2)}, ${player.position.z.toFixed(2)})`);

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
    // Sine wave at Y=0 so the top surface is around Y=0 to Y=2
    this.createZigZagPlatform(
        this.currentFloorX, 0, 0
    );
}
if (this.floorCounts % 5 === 0 && this.floorCounts !== 0) {
    this.floorManager.createFloor(
        this.currentFloorX, 0, 0,
        10, 1, 10,
        0, 0, 0
    );
} else {
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