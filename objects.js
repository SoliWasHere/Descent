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
                roughness: 0.8,
                flatShading: true,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 4
            }),
            0,
            new THREE.Vector3(x, y - 2 + 0.005, z), // Tiny Y offset to reduce z-fighting
            new THREE.Vector3(0, 0, 0)
        );

        floor.friction = CONFIG.floorFriction;
        floor.restitution = CONFIG.floorRestitution;
        floor.mesh.receiveShadow = true;
        floor.mesh.material.needsUpdate = true;

        floor.mesh.rotation.set(rx, ry, rz);
        floor.mesh.updateMatrixWorld(true);
        
        floor.buildTriangleMesh();

        this.scene.add(floor.mesh);
        this.floors.push(floor);
        
        return floor;
    }

    createCustomFloor(x, y, z, points, funcX, funcY, funcZ, a, b, t) {
        if (points.length !== 4) {
            console.error("createCustomFloor requires exactly 4 points for the quadrilateral");
            return;
        }

        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];

        const step = (b - a) / (t - 1);
        const minDistance = 0.1;
        
        const sampledParams = [];
        let prevPos = null;
        
        for (let i = 0; i < t; i++) {
            const param = a + step * i;
            const offsetX = funcX(param);
            const offsetY = funcY(param);
            const offsetZ = funcZ(param);
            
            const currentPos = new THREE.Vector3(offsetX, offsetY, offsetZ);
            
            if (i === 0 || i === t - 1) {
                sampledParams.push(param);
                prevPos = currentPos;
            } else if (prevPos) {
                const dist = currentPos.distanceTo(prevPos);
                if (dist >= minDistance) {
                    sampledParams.push(param);
                    prevPos = currentPos;
                }
            }
        }

        console.log(`Adaptive sampling: reduced from ${t} to ${sampledParams.length} vertices`);

        const actualT = sampledParams.length;

        const startTangent = new THREE.Vector3(
            funcX(sampledParams[1]) - funcX(sampledParams[0]),
            funcY(sampledParams[1]) - funcY(sampledParams[0]),
            funcZ(sampledParams[1]) - funcZ(sampledParams[0])
        ).normalize();

        const endTangent = new THREE.Vector3(
            funcX(sampledParams[actualT - 1]) - funcX(sampledParams[actualT - 2]),
            funcY(sampledParams[actualT - 1]) - funcY(sampledParams[actualT - 2]),
            funcZ(sampledParams[actualT - 1]) - funcZ(sampledParams[actualT - 2])
        ).normalize();

        const capOffset = 0.001;

        for (let i = 0; i < sampledParams.length; i++) {
            const param = sampledParams[i];
            const offsetX = funcX(param);
            const offsetY = funcY(param);
            const offsetZ = funcZ(param);

            let tangentOffset = new THREE.Vector3(0, 0, 0);
            if (i === 0) {
                tangentOffset = startTangent.clone().multiplyScalar(-capOffset);
            } else if (i === actualT - 1) {
                tangentOffset = endTangent.clone().multiplyScalar(capOffset);
            }

            for (let j = 0; j < 4; j++) {
                vertices.push(
                    points[j].x + offsetX + tangentOffset.x,
                    points[j].y + offsetY + tangentOffset.y + 0.005, // Small Y offset
                    points[j].z + offsetZ + tangentOffset.z
                );
            }
        }

        for (let i = 0; i < actualT - 1; i++) {
            const base = i * 4;
            const next = (i + 1) * 4;

            indices.push(base + 0, base + 1, next + 1);
            indices.push(base + 0, next + 1, next + 0);

            indices.push(base + 1, base + 2, next + 2);
            indices.push(base + 1, next + 2, next + 1);

            indices.push(base + 2, base + 3, next + 3);
            indices.push(base + 2, next + 3, next + 2);

            indices.push(base + 3, base + 0, next + 0);
            indices.push(base + 3, next + 0, next + 3);
        }

        indices.push(0, 1, 2);
        indices.push(0, 2, 3);

        const last = (actualT - 1) * 4;
        indices.push(last + 0, last + 2, last + 1);
        indices.push(last + 0, last + 3, last + 2);

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const floor = new PhysicsObject(
            geometry,
            new THREE.MeshStandardMaterial({
                color: 0xFFFFFF,
                roughness: 0.8,
                flatShading: true,
                side: THREE.DoubleSide,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 4
            }),
            0,
            new THREE.Vector3(x, y, z),
            new THREE.Vector3(0, 0, 0)
        );

        floor.friction = CONFIG.floorFriction;
        floor.restitution = CONFIG.floorRestitution;
        floor.mesh.receiveShadow = true;
        floor.mesh.castShadow = true;
        floor.mesh.material.needsUpdate = true;

        floor.mesh.updateMatrixWorld(true);
        
        floor.buildTriangleMesh();

        this.scene.add(floor.mesh);
        this.floors.push(floor);
        
        return floor;
    }

    createInitialFloor() {
        this.createFloor(0, 0, 0);
    }

    checkCollisions(sphere, dt) {
        for (const floor of this.floors) {
            sphere.collideWithTriangleMesh(floor, dt);
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
        // Sphere-sphere collision
    }

    getMainSphere() {
        return this.spheres[0];
    }
}