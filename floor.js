import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';
import { PhysicsObject } from './physics.js';
import { CONFIG } from './config.js';

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

export function createSineWavePlatform(
    length = 10,
    width = 3,
    height = 1,
    waveHeight = 2,
    frequency = 1,
    segments = 50
) {
    const geometry = new THREE.BufferGeometry();
    
    const vertices = [];
    const indices = [];
    const uvs = [];
    
    // Create vertices along the sine wave
    // We'll create a rectangular strip that follows the sine wave
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = t * length;
        const sineY = Math.sin(t * Math.PI * 2 * frequency) * waveHeight;
        
        // Create two vertices at each segment (front and back of the width)
        for (let side = 0; side <= 1; side++) {
            const z = (side - 0.5) * width;
            
            // Top vertex
            vertices.push(x, sineY, z);
            uvs.push(t, side);
            
            // Bottom vertex
            vertices.push(x, sineY - height, z);
            uvs.push(t, side);
        }
    }
    
    // Create indices for the mesh
    for (let i = 0; i < segments; i++) {
        const base = i * 4;
        
        // Top face (2 triangles)
        indices.push(base + 0, base + 4, base + 2);
        indices.push(base + 2, base + 4, base + 6);
        
        // Bottom face (2 triangles)
        indices.push(base + 1, base + 3, base + 5);
        indices.push(base + 3, base + 7, base + 5);
        
        // Front face (z = -width/2)
        indices.push(base + 0, base + 1, base + 4);
        indices.push(base + 1, base + 5, base + 4);
        
        // Back face (z = width/2)
        indices.push(base + 2, base + 6, base + 3);
        indices.push(base + 3, base + 6, base + 7);
    }
    
    // End caps
    // Front cap (start)
    indices.push(0, 2, 1);
    indices.push(1, 2, 3);
    
    // Back cap (end)
    const lastBase = segments * 4;
    indices.push(lastBase + 0, lastBase + 1, lastBase + 2);
    indices.push(lastBase + 1, lastBase + 3, lastBase + 2);
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    return geometry;
}

export function createSineWaveMesh(options = {}) {
    const geometry = createSineWavePlatform(
        options.length || 15,
        options.width || 5,
        options.height || 1,
        options.waveHeight || 2,
        options.frequency || 2,
        options.segments || 100
    );
    
    const material = new THREE.MeshStandardMaterial({
        color: options.color || 0x4444ff,
        roughness: 0.8,
        side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
}