// floor.js - Simple sine wave platform generation
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
    segments = 50,
    position = new THREE.Vector3(0, 0, 0)
) {
    const triangles = [];
    
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    
    // Create vertices in LOCAL space first (no position offset yet)
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = t * length;
        const y = Math.sin(t * Math.PI * 2 * frequency) * waveHeight;
        
        // LOCAL space vertices
        vertices.push(x, y, -width / 2);
        vertices.push(x, y, width / 2);
        vertices.push(x, y - height, -width / 2);
        vertices.push(x, y - height, width / 2);
    }
    
    // Helper to add a triangle (converts to world space with position offset)
    const addTriangle = (i0, i1, i2) => {
        // Get local space vertices
        const v0 = new THREE.Vector3(vertices[i0 * 3], vertices[i0 * 3 + 1], vertices[i0 * 3 + 2]);
        const v1 = new THREE.Vector3(vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]);
        const v2 = new THREE.Vector3(vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]);
        
        // Transform to WORLD space
        v0.add(position);
        v1.add(position);
        v2.add(position);
        
        const edge1 = new THREE.Vector3().subVectors(v1, v0);
        const edge2 = new THREE.Vector3().subVectors(v2, v0);
        const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
        
        const minX = Math.min(v0.x, v1.x, v2.x);
        const maxX = Math.max(v0.x, v1.x, v2.x);
        const minY = Math.min(v0.y, v1.y, v2.y);
        const maxY = Math.max(v0.y, v1.y, v2.y);
        const minZ = Math.min(v0.z, v1.z, v2.z);
        const maxZ = Math.max(v0.z, v1.z, v2.z);
        
        triangles.push({
            v0, v1, v2,
            normal,
            bounds: { minX, maxX, minY, maxY, minZ, maxZ }
        });
        
        indices.push(i0, i1, i2);
    };
    
    // Connect rectangles
    for (let i = 0; i < segments; i++) {
        const curr = i * 4;
        const next = (i + 1) * 4;
        
        // Top surface
        addTriangle(curr + 0, curr + 1, next + 0);
        addTriangle(curr + 1, next + 1, next + 0);
        
        // Bottom surface
        addTriangle(curr + 2, next + 2, curr + 3);
        addTriangle(curr + 3, next + 2, next + 3);
        
        // Left side
        addTriangle(curr + 0, next + 0, curr + 2);
        addTriangle(next + 0, next + 2, curr + 2);
        
        // Right side
        addTriangle(curr + 1, curr + 3, next + 1);
        addTriangle(next + 1, curr + 3, next + 3);
    }
    
    // Front end cap
    addTriangle(0, 2, 1);
    addTriangle(1, 2, 3);
    
    // Back end cap
    const last = segments * 4;
    addTriangle(last + 0, last + 1, last + 2);
    addTriangle(last + 1, last + 3, last + 2);
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    return { geometry, triangles };
}

export function createSineWaveMesh(options = {}) {
    const position = options.position || new THREE.Vector3(0, 0, 0);
    
    const result = createSineWavePlatform(
        options.length || 15,
        options.width || 5,
        options.height || 1,
        options.waveHeight || 2,
        options.frequency || 2,
        options.segments || 100,
        position
    );
    
    const material = new THREE.MeshStandardMaterial({
        color: options.color || 0x4444ff,
        roughness: 1,
        metalness: 0
    });
    
    const mesh = new THREE.Mesh(result.geometry, material);
    mesh.position.copy(position); // Position the mesh in world space
    mesh.receiveShadow = true;
    
    return { mesh, triangles: result.triangles };
}