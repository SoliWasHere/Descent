import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';
import earcut from 'https://cdn.skypack.dev/earcut@2.2.4';
import { PhysicsObject } from './physics.js';
import { CONFIG } from './config.js';
import { createRotatingMaterial } from './material.js';
import { GLOBALS } from './globals.js';

/**
 * Spatial Hash Grid - O(1) collision queries instead of O(n)
 */
class SpatialHashGrid {
    constructor(cellSize = 10) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }
    
    _getKey(x, y, z) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        const cellZ = Math.floor(z / this.cellSize);
        return `${cellX},${cellY},${cellZ}`;
    }
    
    insert(object, dimensions = new THREE.Vector3(10, 1, 10)) {
        const pos = object.position;
        const halfDims = dimensions.clone().multiplyScalar(0.5);
        
        // Calculate which cells this object spans
        const minX = Math.floor((pos.x - halfDims.x) / this.cellSize);
        const maxX = Math.floor((pos.x + halfDims.x) / this.cellSize);
        const minY = Math.floor((pos.y - halfDims.y) / this.cellSize);
        const maxY = Math.floor((pos.y + halfDims.y) / this.cellSize);
        const minZ = Math.floor((pos.z - halfDims.z) / this.cellSize);
        const maxZ = Math.floor((pos.z + halfDims.z) / this.cellSize);
        
        // Insert into all cells it spans
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const key = `${x},${y},${z}`;
                    
                    if (!this.grid.has(key)) {
                        this.grid.set(key, new Set());
                    }
                    
                    this.grid.get(key).add(object);
                }
            }
        }
    }
    
    queryNearby(position, radius) {
        const results = new Set();
        
        // Calculate which cells to check
        const minX = Math.floor((position.x - radius) / this.cellSize);
        const maxX = Math.floor((position.x + radius) / this.cellSize);
        const minY = Math.floor((position.y - radius) / this.cellSize);
        const maxY = Math.floor((position.y + radius) / this.cellSize);
        const minZ = Math.floor((position.z - radius) / this.cellSize);
        const maxZ = Math.floor((position.z + radius) / this.cellSize);
        
        // Collect objects from nearby cells
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const key = `${x},${y},${z}`;
                    const cell = this.grid.get(key);
                    
                    if (cell) {
                        cell.forEach(obj => results.add(obj));
                    }
                }
            }
        }
        
        return results;
    }
    
    clear() {
        this.grid.clear();
    }
    
    rebuild(objects) {
        this.clear();
        
        for (const obj of objects) {
            const dims = obj.dimensions || new THREE.Vector3(10, 1, 10);
            this.insert(obj, dims);
        }
    }
    
    getStats() {
        let totalObjects = 0;
        let maxObjectsPerCell = 0;
        let cellsUsed = this.grid.size;
        
        for (const [key, cell] of this.grid) {
            const count = cell.size;
            totalObjects += count;
            maxObjectsPerCell = Math.max(maxObjectsPerCell, count);
        }
        
        return {
            cellsUsed,
            totalObjects,
            maxObjectsPerCell,
            avgObjectsPerCell: cellsUsed > 0 ? totalObjects / cellsUsed : 0
        };
    }
}

export class FloorManager {
    constructor(scene) {
        this.scene = scene;
        this.floors = [];
        this.spatialGrid = new SpatialHashGrid(50); // 50 unit cells
        this.needsRebuild = false;
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
            new THREE.Vector3(x, y - 2 + 0.005, z),
            new THREE.Vector3(0, 0, 0)
        );

        floor.friction = CONFIG.floorFriction;
        floor.restitution = CONFIG.floorRestitution;
        floor.mesh.receiveShadow = true;
        floor.mesh.material.needsUpdate = true;

        floor.mesh.rotation.set(rx, ry, rz);
        floor.mesh.updateMatrixWorld(true);
        
        floor.buildTriangleMesh();

        // Store floor dimensions for culling
        floor.dimensions = new THREE.Vector3(sx, sy, sz);

        this.scene.add(floor.mesh);
        this.floors.push(floor);
        
        // Add to spatial grid
        this.spatialGrid.insert(floor, floor.dimensions);

        return floor;
    }

    createCustomFloor(
        x, y, z, 
        points, 
        funcX, funcY, funcZ, 
        rotX, rotY, rotZ, 
        a, b, t
    ) {
        if (points.length < 2) {
            console.error("createCustomFloor requires at least 2 points");
            return;
        }

        if (points.length > 3) {
            const v1 = new THREE.Vector3().subVectors(points[1], points[0]);
            const v2 = new THREE.Vector3().subVectors(points[2], points[0]);
            const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
            
            for (let i = 3; i < points.length; i++) {
                const vi = new THREE.Vector3().subVectors(points[i], points[0]);
                const dot = Math.abs(vi.dot(normal));
                if (dot > 0.001) {
                    console.error("Points are not coplanar!");
                    return;
                }
            }
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

            const angleX = rotX(param);
            const angleY = rotY(param);
            const angleZ = rotZ(param);

            const rotationMatrix = new THREE.Matrix4();
            rotationMatrix.makeRotationFromEuler(new THREE.Euler(angleX, angleY, angleZ, 'XYZ'));

            let tangentOffset = new THREE.Vector3(0, 0, 0);
            if (i === 0) {
                tangentOffset = startTangent.clone().multiplyScalar(-capOffset);
            } else if (i === actualT - 1) {
                tangentOffset = endTangent.clone().multiplyScalar(capOffset);
            }

            for (let j = 0; j < points.length; j++) {
                const rotatedPoint = points[j].clone().applyMatrix4(rotationMatrix);
                
                vertices.push(
                    rotatedPoint.x + offsetX + tangentOffset.x,
                    rotatedPoint.y + offsetY + tangentOffset.y + 0.005,
                    rotatedPoint.z + offsetZ + tangentOffset.z
                );
            }
        }

        const numPoints = points.length;

        for (let i = 0; i < actualT - 1; i++) {
            const base = i * numPoints;
            const next = (i + 1) * numPoints;

            for (let j = 0; j < numPoints; j++) {
                const j1 = (j + 1) % numPoints;
                
                indices.push(base + j, base + j1, next + j1);
                indices.push(base + j, next + j1, next + j);
            }
        }

        if (numPoints === 3) {
            indices.push(0, 1, 2);
        } else if (numPoints > 3) {
            for (let j = 1; j < numPoints - 1; j++) {
                indices.push(0, j, j + 1);
            }
        }

        const last = (actualT - 1) * numPoints;
        if (numPoints === 3) {
            indices.push(last + 0, last + 2, last + 1);
        } else if (numPoints > 3) {
            for (let j = 1; j < numPoints - 1; j++) {
                indices.push(last + 0, last + j + 1, last + j);
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        
        if (numPoints === 2) {
            const normals = [];
            
            for (let i = 0; i < actualT; i++) {
                const base = i * 2;
                
                const p0 = new THREE.Vector3(
                    vertices[base * 3], 
                    vertices[base * 3 + 1], 
                    vertices[base * 3 + 2]
                );
                const p1 = new THREE.Vector3(
                    vertices[(base + 1) * 3], 
                    vertices[(base + 1) * 3 + 1], 
                    vertices[(base + 1) * 3 + 2]
                );
                
                let tangent;
                if (i < actualT - 1) {
                    const nextBase = (i + 1) * 2;
                    const pNext = new THREE.Vector3(
                        vertices[nextBase * 3],
                        vertices[nextBase * 3 + 1],
                        vertices[nextBase * 3 + 2]
                    );
                    tangent = new THREE.Vector3().subVectors(pNext, p0).normalize();
                } else {
                    const prevBase = (i - 1) * 2;
                    const pPrev = new THREE.Vector3(
                        vertices[prevBase * 3],
                        vertices[prevBase * 3 + 1],
                        vertices[prevBase * 3 + 2]
                    );
                    tangent = new THREE.Vector3().subVectors(p0, pPrev).normalize();
                }
                
                const ribbonDir = new THREE.Vector3().subVectors(p1, p0).normalize();
                const normal = new THREE.Vector3().crossVectors(ribbonDir, tangent).normalize();
                
                for (let j = 0; j < 2; j++) {
                    normals.push(normal.x, normal.y, normal.z);
                }
            }
            
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        } else {
            geometry.computeVertexNormals();
        }

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

        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox;
        floor.dimensions = new THREE.Vector3(
            bbox.max.x - bbox.min.x,
            bbox.max.y - bbox.min.y,
            bbox.max.z - bbox.min.z
        );

        this.scene.add(floor.mesh);
        this.floors.push(floor);
        
        // Add to spatial grid
        this.spatialGrid.insert(floor, floor.dimensions);
        
        return floor;
    }

    createCustomShape(x, y, z, outerPoints, innerPoints = [], funcX, funcY, funcZ, rotX, rotY, rotZ, a, b, t) {
        if (outerPoints.length < 3) {
            console.error("createCustomShape requires at least 3 outer points");
            return;
        }

        const validateCoplanar = (points) => {
            if (points.length <= 3) return true;
            const v1 = new THREE.Vector3().subVectors(points[1], points[0]);
            const v2 = new THREE.Vector3().subVectors(points[2], points[0]);
            const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
            
            for (let i = 3; i < points.length; i++) {
                const vi = new THREE.Vector3().subVectors(points[i], points[0]);
                if (Math.abs(vi.dot(normal)) > 0.001) return false;
            }
            return true;
        };

        if (!validateCoplanar(outerPoints)) {
            console.error("Outer points are not coplanar!");
            return;
        }

        for (const innerLoop of innerPoints) {
            if (!validateCoplanar(innerLoop)) {
                console.error("Inner points are not coplanar!");
                return;
            }
            if (innerLoop.length < 3) {
                console.error("Each inner loop requires at least 3 points");
                return;
            }
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
            
            if (i === 0 || i === t - 1 || !prevPos || currentPos.distanceTo(prevPos) >= minDistance) {
                sampledParams.push(param);
                prevPos = currentPos;
            }
        }

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

        let vertexOffset = 0;
        const outerStartIdx = vertexOffset;
        
        for (let i = 0; i < actualT; i++) {
            const param = sampledParams[i];
            const offsetX = funcX(param);
            const offsetY = funcY(param);
            const offsetZ = funcZ(param);
            const angleX = rotX(param);
            const angleY = rotY(param);
            const angleZ = rotZ(param);

            const rotationMatrix = new THREE.Matrix4();
            rotationMatrix.makeRotationFromEuler(new THREE.Euler(angleX, angleY, angleZ, 'XYZ'));

            let tangentOffset = new THREE.Vector3(0, 0, 0);
            if (i === 0) tangentOffset = startTangent.clone().multiplyScalar(-capOffset);
            else if (i === actualT - 1) tangentOffset = endTangent.clone().multiplyScalar(capOffset);

            for (let j = 0; j < outerPoints.length; j++) {
                const rotatedPoint = outerPoints[j].clone().applyMatrix4(rotationMatrix);
                vertices.push(
                    rotatedPoint.x + offsetX + tangentOffset.x,
                    rotatedPoint.y + offsetY + tangentOffset.y + 0.005,
                    rotatedPoint.z + offsetZ + tangentOffset.z
                );
            }
        }
        vertexOffset += actualT * outerPoints.length;

        const innerStartIndices = [];
        for (const innerLoop of innerPoints) {
            innerStartIndices.push(vertexOffset);
            
            for (let i = 0; i < actualT; i++) {
                const param = sampledParams[i];
                const offsetX = funcX(param);
                const offsetY = funcY(param);
                const offsetZ = funcZ(param);
                const angleX = rotX(param);
                const angleY = rotY(param);
                const angleZ = rotZ(param);

                const rotationMatrix = new THREE.Matrix4();
                rotationMatrix.makeRotationFromEuler(new THREE.Euler(angleX, angleY, angleZ, 'XYZ'));

                let tangentOffset = new THREE.Vector3(0, 0, 0);
                if (i === 0) tangentOffset = startTangent.clone().multiplyScalar(-capOffset);
                else if (i === actualT - 1) tangentOffset = endTangent.clone().multiplyScalar(capOffset);

                for (let j = 0; j < innerLoop.length; j++) {
                    const rotatedPoint = innerLoop[j].clone().applyMatrix4(rotationMatrix);
                    vertices.push(
                        rotatedPoint.x + offsetX + tangentOffset.x,
                        rotatedPoint.y + offsetY + tangentOffset.y + 0.005,
                        rotatedPoint.z + offsetZ + tangentOffset.z
                    );
                }
            }
            vertexOffset += actualT * innerLoop.length;
        }

        for (let i = 0; i < actualT - 1; i++) {
            const base = outerStartIdx + i * outerPoints.length;
            const next = base + outerPoints.length;

            for (let j = 0; j < outerPoints.length; j++) {
                const j1 = (j + 1) % outerPoints.length;
                indices.push(base + j, base + j1, next + j1);
                indices.push(base + j, next + j1, next + j);
            }
        }

        for (let h = 0; h < innerPoints.length; h++) {
            const innerLoop = innerPoints[h];
            const innerStart = innerStartIndices[h];
            
            for (let i = 0; i < actualT - 1; i++) {
                const base = innerStart + i * innerLoop.length;
                const next = base + innerLoop.length;

                for (let j = 0; j < innerLoop.length; j++) {
                    const j1 = (j + 1) % innerLoop.length;
                    indices.push(base + j, next + j1, base + j1);
                    indices.push(base + j, next + j, next + j1);
                }
            }
        }

        const startCapIndices = this._triangulateCapWithHoles(
            outerPoints,
            innerPoints,
            outerStartIdx,
            innerStartIndices,
            false
        );
        indices.push(...startCapIndices);

        const endOuterStart = outerStartIdx + (actualT - 1) * outerPoints.length;
        const endInnerStarts = innerStartIndices.map((idx, i) => 
            idx + (actualT - 1) * innerPoints[i].length
        );
        const endCapIndices = this._triangulateCapWithHoles(
            outerPoints,
            innerPoints,
            endOuterStart,
            endInnerStarts,
            true
        );
        indices.push(...endCapIndices);

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const shape = new PhysicsObject(
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

        shape.friction = CONFIG.floorFriction;
        shape.restitution = CONFIG.floorRestitution;
        shape.mesh.receiveShadow = true;
        shape.mesh.castShadow = true;
        shape.mesh.material.needsUpdate = true;

        shape.mesh.updateMatrixWorld(true);
        shape.buildTriangleMesh();

        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox;
        shape.dimensions = new THREE.Vector3(
            bbox.max.x - bbox.min.x,
            bbox.max.y - bbox.min.y,
            bbox.max.z - bbox.min.z
        );

        this.scene.add(shape.mesh);
        this.floors.push(shape);
        
        // Add to spatial grid
        this.spatialGrid.insert(shape, shape.dimensions);
        
        return shape;
    }

    _triangulateCapWithHoles(outerPoints, innerPointArrays, outerStartIdx, innerStartIndices, reversed) {
        const indices = [];
        
        const v1 = new THREE.Vector3().subVectors(outerPoints[1], outerPoints[0]);
        const v2 = new THREE.Vector3().subVectors(outerPoints[2], outerPoints[0]);
        const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
        
        const uAxis = v1.clone().normalize();
        const vAxis = new THREE.Vector3().crossVectors(normal, uAxis).normalize();
        
        const project2D = (point) => {
            const relative = new THREE.Vector3().subVectors(point, outerPoints[0]);
            return [relative.dot(uAxis), relative.dot(vAxis)];
        };
        
        const coords = [];
        const holes = [];
        
        for (const point of outerPoints) {
            coords.push(...project2D(point));
        }
        
        for (const innerLoop of innerPointArrays) {
            holes.push(coords.length / 2);
            for (const point of innerLoop) {
                coords.push(...project2D(point));
            }
        }
        
        let triangleIndices;
        if (typeof earcut !== 'undefined') {
            triangleIndices = earcut(coords, holes);
        } else {
            triangleIndices = [];
            for (let i = 1; i < outerPoints.length - 1; i++) {
                triangleIndices.push(0, i, i + 1);
            }
        }
        
        let currentOffset = outerStartIdx;
        const vertexMap = [];
        
        for (let i = 0; i < outerPoints.length; i++) {
            vertexMap.push(currentOffset + i);
        }
        
        for (let h = 0; h < innerPointArrays.length; h++) {
            const innerStart = innerStartIndices[h];
            for (let i = 0; i < innerPointArrays[h].length; i++) {
                vertexMap.push(innerStart + i);
            }
        }
        
        for (let i = 0; i < triangleIndices.length; i += 3) {
            const i0 = vertexMap[triangleIndices[i]];
            const i1 = vertexMap[triangleIndices[i + 1]];
            const i2 = vertexMap[triangleIndices[i + 2]];
            
            if (reversed) {
                indices.push(i0, i2, i1);
            } else {
                indices.push(i0, i1, i2);
            }
        }
        
        return indices;
    }

    // SPATIAL GRID OPTIMIZED: O(1) instead of O(n)
    checkCollisions(sphere, dt) {
        // Rebuild grid if needed
        if (this.needsRebuild) {
            this.rebuildSpatialGrid();
        }
        
        const sphereRadius = sphere.radius;
        const spherePos = sphere.position;
        
        // Query radius: sphere radius + safety margin
        const queryRadius = sphereRadius + 30;
        
        // Get only nearby floors from spatial grid (FAST!)
        const nearbyFloors = this.spatialGrid.queryNearby(spherePos, queryRadius);
        
        // Now do accurate AABB check only on nearby floors
        for (const floor of nearbyFloors) {
            const floorPos = floor.position;
            const halfDims = floor.dimensions ? floor.dimensions.clone().multiplyScalar(0.5) : new THREE.Vector3(5, 0.5, 5);
            
            // AABB min/max
            const minX = floorPos.x - halfDims.x;
            const maxX = floorPos.x + halfDims.x;
            const minY = floorPos.y - halfDims.y;
            const maxY = floorPos.y + halfDims.y;
            const minZ = floorPos.z - halfDims.z;
            const maxZ = floorPos.z + halfDims.z;
            
            // Closest point on AABB to sphere
            const closestX = Math.max(minX, Math.min(spherePos.x, maxX));
            const closestY = Math.max(minY, Math.min(spherePos.y, maxY));
            const closestZ = Math.max(minZ, Math.min(spherePos.z, maxZ));
            
            // Distance from sphere to closest point
            const dx = spherePos.x - closestX;
            const dy = spherePos.y - closestY;
            const dz = spherePos.z - closestZ;
            const distSq = dx * dx + dy * dy + dz * dz;
            
            // Only check collision if sphere is close to AABB
            const margin = 5;
            const checkRadius = sphereRadius + margin;
            
            if (distSq < checkRadius * checkRadius) {
                sphere.collideWithTriangleMesh(floor, dt);
            }
        }
    }
    
    rebuildSpatialGrid() {
        console.log(`🔨 Rebuilding spatial grid with ${this.floors.length} floors...`);
        const start = performance.now();
        
        this.spatialGrid.rebuild(this.floors);
        
        const elapsed = performance.now() - start;
        const stats = this.spatialGrid.getStats();
        
        console.log(`✅ Grid rebuilt in ${elapsed.toFixed(2)}ms`);
        console.log(`   Cells used: ${stats.cellsUsed}`);
        console.log(`   Avg objects/cell: ${stats.avgObjectsPerCell.toFixed(1)}`);
        console.log(`   Max objects/cell: ${stats.maxObjectsPerCell}`);
        
        this.needsRebuild = false;
    }
    
    cleanupDistantFloors(referencePoint, maxDistance = 150) {
        const initialCount = this.floors.length;
        
        this.floors = this.floors.filter(floor => {
            const dist = floor.position.distanceTo(referencePoint);
            
            if (dist > maxDistance) {
                this.scene.remove(floor.mesh);
                
                if (floor.mesh.geometry) floor.mesh.geometry.dispose();
                if (floor.mesh.material) {
                    if (Array.isArray(floor.mesh.material)) {
                        floor.mesh.material.forEach(m => m.dispose());
                    } else {
                        floor.mesh.material.dispose();
                    }
                }
                
                return false;
            }
            
            return true;
        });
        
        const removed = initialCount - this.floors.length;
        if (removed > 0) {
            console.log(`🧹 Cleaned up ${removed} distant floors (${this.floors.length} remaining)`);
            this.needsRebuild = true;
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
            new THREE.Vector3(0, 15, 0),
            new THREE.Vector3(5, 15, 0)
        );
            
        sphere.friction = 1;
        sphere.velocity.set(10, 5, 0);
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

    getMainSphere() {
        return this.spheres[0];
    }
}