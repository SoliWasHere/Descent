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
    width = 5,
    height = 1,
    waveHeight = 1,
    frequency = 0.25,
    segments = 100,
    travelAxis = 'y',  // 'x', 'y', or 'z' - direction platform travels
    waveAxis = 'x'     // 'x', 'y', or 'z' - direction of sine wave oscillation
) {
    const triangles = [];
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];

    // Create vertices in LOCAL space centered at origin
    const offsetTravel = -length / 2;
    
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const travelPos = t * length + offsetTravel;
        const wave = Math.sin(t * Math.PI * 2 * frequency) * waveHeight;
        
        let x = 0, y = 0, z = 0;
        
        // Set the travel position
        if (travelAxis === 'x') x = travelPos;
        else if (travelAxis === 'y') y = travelPos;
        else if (travelAxis === 'z') z = travelPos;
        
        // Add the wave oscillation
        if (waveAxis === 'x') x += wave;
        else if (waveAxis === 'y') y += wave;
        else if (waveAxis === 'z') z += wave;
        
        // Determine which axis gets the width
        // (the axis that's neither travel nor wave)
        let widthAxis;
        if (travelAxis === 'x' && waveAxis === 'y') widthAxis = 'z';
        else if (travelAxis === 'x' && waveAxis === 'z') widthAxis = 'y';
        else if (travelAxis === 'y' && waveAxis === 'x') widthAxis = 'z';
        else if (travelAxis === 'y' && waveAxis === 'z') widthAxis = 'x';
        else if (travelAxis === 'z' && waveAxis === 'x') widthAxis = 'y';
        else if (travelAxis === 'z' && waveAxis === 'y') widthAxis = 'x';
        else {
            console.error('Invalid axis combination:', travelAxis, waveAxis);
            widthAxis = 'z'; // fallback
        }
        
        // Create 4 vertices per segment
        for (let corner = 0; corner < 4; corner++) {
            let vx = x, vy = y, vz = z;
            
            const isWidthPositive = corner === 1 || corner === 3;
            const isHeightNegative = corner === 2 || corner === 3;
            
            // Apply width offset
            if (widthAxis === 'x') vx += (isWidthPositive ? width/2 : -width/2);
            else if (widthAxis === 'y') vy += (isWidthPositive ? width/2 : -width/2);
            else if (widthAxis === 'z') vz += (isWidthPositive ? width/2 : -width/2);
            
            // Height always goes "down" along negative direction of travel axis
            if (isHeightNegative) {
                if (travelAxis === 'x') vx -= height;
                else if (travelAxis === 'y') vy -= height;
                else if (travelAxis === 'z') vz -= height;
            }
            
            vertices.push(vx, vy, vz);
        }
    }

    // Helper to add a triangle
    const addTriangle = (i0, i1, i2) => {
        const v0 = new THREE.Vector3(vertices[i0 * 3], vertices[i0 * 3 + 1], vertices[i0 * 3 + 2]);
        const v1 = new THREE.Vector3(vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]);
        const v2 = new THREE.Vector3(vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]);
        triangles.push({ v0, v1, v2 });
        indices.push(i0, i1, i2);
    };

    // Connect segments
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

    // End caps
    addTriangle(0, 2, 1);
    addTriangle(1, 2, 3);
    const last = segments * 4;
    addTriangle(last + 0, last + 1, last + 2);
    addTriangle(last + 1, last + 3, last + 2);

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return { geometry, triangles };
}

export function createZigzagPlatform({
    length = 10,       // travel direction (X)
    width = 5,         // side-to-side (Z extent)
    height = 1,        // thickness (Y)
    zigzagAmount = 2,  // amplitude of Z-wave
    frequency = 0.25,  // wave frequency
    segments = 100     // resolution
} = {}) {

    const triangles = [];
    const vertices = [];
    const indices = [];

    // Platform runs from -length/2 to +length/2 in X
    const startX = -length / 2;
    const topY = height / 2;
    const bottomY = -height / 2;

    for (let i = 0; i <= segments; i++) {

        const t = i / segments;
        const x = startX + t * length;

        // Z-axis sine wave motion
        const zOffset = Math.sin(t * Math.PI * 2 * frequency) * zigzagAmount;
        const yOffset = 0;

        // Four vertices per slice:
        // 0: top-left     (x, topY,  -width/2 + zOffset)
        // 1: top-right    (x, topY,   width/2 + zOffset)
        // 2: bottom-left  (x, bottomY, -width/2 + zOffset)
        // 3: bottom-right (x, bottomY,  width/2 + zOffset)

        vertices.push(
            x, topY,    -width/2 + zOffset,
            x, topY,     width/2 + zOffset,
            x, bottomY, -width/2 + zOffset,
            x, bottomY,  width/2 + zOffset
        );
    }

    // Helper
    const addTri = (a, b, c) => {
        const v0 = new THREE.Vector3(...vertices.slice(a*3, a*3+3));
        const v1 = new THREE.Vector3(...vertices.slice(b*3, b*3+3));
        const v2 = new THREE.Vector3(...vertices.slice(c*3, c*3+3));
        triangles.push({ v0, v1, v2 });
        indices.push(a, b, c);
    };

    // Build triangles
    for (let i = 0; i < segments; i++) {
        const base = i * 4;
        const next = (i + 1) * 4;

        // Top surface
        addTri(base + 0, base + 1, next + 0);
        addTri(base + 1, next + 1, next + 0);

        // Bottom surface
        addTri(base + 2, next + 2, base + 3);
        addTri(base + 3, next + 2, next + 3);

        // Left side (-Z)
        addTri(base + 0, next + 0, base + 2);
        addTri(next + 0, next + 2, base + 2);

        // Right side (+Z)
        addTri(base + 1, base + 3, next + 1);
        addTri(next + 1, base + 3, next + 3);
    }

    // End caps
    addTri(0, 2, 1);
    addTri(1, 2, 3);
    const last = segments * 4;
    addTri(last + 0, last + 1, last + 2);
    addTri(last + 1, last + 3, last + 2);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return { geometry, triangles };
}

export function createZigZagMesh(options = {}) {
    const result = createZigzagPlatform(
        options.length || 10,
        options.width || 5,
        options.height || 1,
        options.zigzagAmount || 2,
        options.frequency || 0.25,
        options.segments || 100,
        options.travelAxis || 'x',
        options.zigzagAxis || 'z'
    );
    
    const material = new THREE.MeshStandardMaterial({
        color: options.color || 0x8844ff,
        roughness: 1,
        metalness: 0
    });
    
    const mesh = new THREE.Mesh(result.geometry, material);
    const position = options.position || new THREE.Vector3(0, 0, 0);
    mesh.position.copy(position);
    mesh.receiveShadow = true;
    
    return { mesh, triangles: result.triangles };  // Return LOCAL space triangles
}




export function createSineWaveMesh(options = {}) {
    const result = createSineWavePlatform(
        options.length || 10,
        options.width || 5,
        options.height || 1,
        options.waveHeight || 2,
        options.frequency || 1,
        options.segments || 100,
        options.travelAxis || 'y',  // Add this
        options.waveAxis || 'x'      // Add this
    );
    
    const material = new THREE.MeshStandardMaterial({
        color: options.color || 0x4444ff,
        roughness: 1,
        metalness: 0
    });
    
    const mesh = new THREE.Mesh(result.geometry, material);
    const position = options.position || new THREE.Vector3(0, 0, 0);
    mesh.position.copy(position);
    mesh.receiveShadow = true;
    
    return { mesh, triangles: result.triangles };  // Return LOCAL space triangles
}