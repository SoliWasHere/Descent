import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';
import earcut from 'https://cdn.skypack.dev/earcut@2.2.4';
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

createCustomFloor(
    x,
    y, 
    z, 
    points, 
    funcX, 
    funcY, 
    funcZ, 
    rotX, 
    rotY, 
    rotZ, 
    a, 
    b, 
    t
) {
        if (points.length < 2) {
        console.error("createCustomFloor requires at least 2 points");
        return;
    }

    // Verify points are coplanar (for >3 points)
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
    
    // Adaptive sampling
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

    // Calculate tangents for end caps
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

    // Generate vertices with rotation
    for (let i = 0; i < sampledParams.length; i++) {
        const param = sampledParams[i];
        const offsetX = funcX(param);
        const offsetY = funcY(param);
        const offsetZ = funcZ(param);

        // Get rotation angles for this parameter
        const angleX = rotX(param);
        const angleY = rotY(param);
        const angleZ = rotZ(param);

        // Create rotation matrix
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationFromEuler(new THREE.Euler(angleX, angleY, angleZ, 'XYZ'));

        let tangentOffset = new THREE.Vector3(0, 0, 0);
        if (i === 0) {
            tangentOffset = startTangent.clone().multiplyScalar(-capOffset);
        } else if (i === actualT - 1) {
            tangentOffset = endTangent.clone().multiplyScalar(capOffset);
        }

        // Apply rotation to each point
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

    // Generate indices for the sides
    for (let i = 0; i < actualT - 1; i++) {
        const base = i * numPoints;
        const next = (i + 1) * numPoints;

        for (let j = 0; j < numPoints; j++) {
            const j1 = (j + 1) % numPoints;
            
            // Two triangles per quad
            indices.push(base + j, base + j1, next + j1);
            indices.push(base + j, next + j1, next + j);
        }
    }

    // Start cap (triangulate the polygon)
    if (numPoints === 2) {
        // For 2 points, no cap needed (it's a ribbon)
    } else if (numPoints === 3) {
        indices.push(0, 1, 2);
    } else {
        // Fan triangulation from first vertex
        for (let j = 1; j < numPoints - 1; j++) {
            indices.push(0, j, j + 1);
        }
    }

    // End cap (triangulate the polygon, reversed winding)
    const last = (actualT - 1) * numPoints;
    if (numPoints === 2) {
        // For 2 points, no cap needed
    } else if (numPoints === 3) {
        indices.push(last + 0, last + 2, last + 1);
    } else {
        // Fan triangulation from first vertex, reversed
        for (let j = 1; j < numPoints - 1; j++) {
            indices.push(last + 0, last + j + 1, last + j);
        }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    
    // For ribbons (2 points), we need custom normals
    if (numPoints === 2) {
        const normals = [];
        
        for (let i = 0; i < actualT; i++) {
            const base = i * 2;
            
            // Get the two points of this segment
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
            
            // Calculate tangent (direction along the ribbon)
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
            
            // Ribbon direction (from point 0 to point 1)
            const ribbonDir = new THREE.Vector3().subVectors(p1, p0).normalize();
            
            // Normal is perpendicular to both tangent and ribbon direction
            const normal = new THREE.Vector3().crossVectors(ribbonDir, tangent).normalize();
            
            // Add the same normal for both points
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

    this.scene.add(floor.mesh);
    this.floors.push(floor);
    
    return floor;
}

/**
 * Creates a custom extruded shape with both interior and exterior surfaces
 * 
 * @param {number} x, y, z - Position offset
 * @param {Array<THREE.Vector3>} outerPoints - Points defining the outer boundary (coplanar)
 * @param {Array<Array<THREE.Vector3>>} innerPoints - Array of inner hole boundaries (each is coplanar with outer)
 * @param {Function} funcX, funcY, funcZ - Path functions
 * @param {Function} rotX, rotY, rotZ - Rotation functions
 * @param {number} a, b, t - Parameter range and sampling
 * 
 * Example: A tunnel with a hole in the middle:
 *   outerPoints = square boundary
 *   innerPoints = [circular hole]
 * 
 * This creates BOTH surfaces - the sphere collides with the outer surface from outside,
 * and the inner surface from inside!
 */
createCustomShape(x, y, z, outerPoints, innerPoints, funcX, funcY, funcZ, rotX, rotY, rotZ, a, b, t) {
    if (outerPoints.length < 3) {
        console.error("createCustomShape requires at least 3 outer points");
        return;
    }

    // Validate all point arrays are coplanar
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
    }

    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];

    // Adaptive sampling (same as before)
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

    console.log(`Adaptive sampling: reduced from ${t} to ${sampledParams.length} vertices`);
    const actualT = sampledParams.length;

    // Calculate tangents for caps
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

    // Track vertex offsets for each section
    let vertexOffset = 0;
    const outerStartIdx = vertexOffset;
    
    // OUTER SURFACE VERTICES
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

    // INNER SURFACES VERTICES (for each hole)
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

    // GENERATE INDICES FOR OUTER SURFACE
    for (let i = 0; i < actualT - 1; i++) {
        const base = outerStartIdx + i * outerPoints.length;
        const next = base + outerPoints.length;

        for (let j = 0; j < outerPoints.length; j++) {
            const j1 = (j + 1) % outerPoints.length;
            
            // Front-facing triangles (normal points outward)
            indices.push(base + j, base + j1, next + j1);
            indices.push(base + j, next + j1, next + j);
        }
    }

    // GENERATE INDICES FOR INNER SURFACES
    for (let h = 0; h < innerPoints.length; h++) {
        const innerLoop = innerPoints[h];
        const innerStart = innerStartIndices[h];
        
        for (let i = 0; i < actualT - 1; i++) {
            const base = innerStart + i * innerLoop.length;
            const next = base + innerLoop.length;

            for (let j = 0; j < innerLoop.length; j++) {
                const j1 = (j + 1) % innerLoop.length;
                
                // Back-facing triangles (normal points inward - REVERSED WINDING)
                indices.push(base + j, next + j1, base + j1);
                indices.push(base + j, next + j, next + j1);
            }
        }
    }

    // GENERATE START CAP (with holes)
    // This requires polygon triangulation with holes - using earcut or similar
    const startCapIndices = triangulatePolygonWithHoles(
        outerPoints,
        innerPoints,
        outerStartIdx,
        innerStartIndices.map((idx, i) => ({ start: idx, count: innerPoints[i].length }))
    );
    indices.push(...startCapIndices);

    // GENERATE END CAP (with holes, reversed winding)
    const endOuterStart = outerStartIdx + (actualT - 1) * outerPoints.length;
    const endInnerStarts = innerStartIndices.map((idx, i) => 
        idx + (actualT - 1) * innerPoints[i].length
    );
    const endCapIndices = triangulatePolygonWithHoles(
        outerPoints,
        innerPoints,
        endOuterStart,
        endInnerStarts.map((idx, i) => ({ start: idx, count: innerPoints[i].length })),
        true // reversed winding
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
            side: THREE.DoubleSide, // CRITICAL for interior surfaces!
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

    this.scene.add(shape.mesh);
    this.floors.push(shape);
    
    return shape;
}
// Add to objects.js

// Import earcut at the top of your file:
// import earcut from 'https://cdn.skypack.dev/earcut@2.2.4';

/**
 * Creates a custom extruded shape with both interior and exterior surfaces
 * Perfect for creating tunnels, pipes, and complex hollow geometries
 * 
 * @param {number} x, y, z - Position offset
 * @param {Array<THREE.Vector3>} outerPoints - Points defining the outer boundary (coplanar)
 * @param {Array<Array<THREE.Vector3>>} innerPoints - Array of inner hole boundaries (each is coplanar with outer)
 * @param {Function} funcX, funcY, funcZ - Path functions: t => value
 * @param {Function} rotX, rotY, rotZ - Rotation functions: t => radians
 * @param {number} a, b, t - Parameter range [a, b] and initial sampling count
 */
createCustomShape(x, y, z, outerPoints, innerPoints = [], funcX, funcY, funcZ, rotX, rotY, rotZ, a, b, t) {
    if (outerPoints.length < 3) {
        console.error("createCustomShape requires at least 3 outer points");
        return;
    }

    // Validate all point arrays are coplanar
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

    // Adaptive sampling
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

    console.log(`Adaptive sampling: reduced from ${t} to ${sampledParams.length} vertices`);
    const actualT = sampledParams.length;

    // Calculate tangents for caps
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

    // Track vertex offsets for each section
    let vertexOffset = 0;
    const outerStartIdx = vertexOffset;
    
    // Generate OUTER SURFACE vertices
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

    // Generate INNER SURFACES vertices (for each hole)
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

    // Generate indices for OUTER SURFACE
    for (let i = 0; i < actualT - 1; i++) {
        const base = outerStartIdx + i * outerPoints.length;
        const next = base + outerPoints.length;

        for (let j = 0; j < outerPoints.length; j++) {
            const j1 = (j + 1) % outerPoints.length;
            
            // Front-facing triangles (normal points outward)
            indices.push(base + j, base + j1, next + j1);
            indices.push(base + j, next + j1, next + j);
        }
    }

    // Generate indices for INNER SURFACES
    for (let h = 0; h < innerPoints.length; h++) {
        const innerLoop = innerPoints[h];
        const innerStart = innerStartIndices[h];
        
        for (let i = 0; i < actualT - 1; i++) {
            const base = innerStart + i * innerLoop.length;
            const next = base + innerLoop.length;

            for (let j = 0; j < innerLoop.length; j++) {
                const j1 = (j + 1) % innerLoop.length;
                
                // Back-facing triangles (normal points inward - REVERSED WINDING)
                indices.push(base + j, next + j1, base + j1);
                indices.push(base + j, next + j, next + j1);
            }
        }
    }

    // Generate START CAP (with holes using earcut)
    const startCapIndices = this._triangulateCapWithHoles(
        outerPoints,
        innerPoints,
        outerStartIdx,
        innerStartIndices,
        false // normal winding
    );
    indices.push(...startCapIndices);

    // Generate END CAP (with holes, reversed winding)
    const endOuterStart = outerStartIdx + (actualT - 1) * outerPoints.length;
    const endInnerStarts = innerStartIndices.map((idx, i) => 
        idx + (actualT - 1) * innerPoints[i].length
    );
    const endCapIndices = this._triangulateCapWithHoles(
        outerPoints,
        innerPoints,
        endOuterStart,
        endInnerStarts,
        true // reversed winding
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
            side: THREE.DoubleSide, // CRITICAL for interior surfaces!
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

    this.scene.add(shape.mesh);
    this.floors.push(shape);
    
    return shape;
}

/**
 * Helper function to triangulate a polygon with holes using earcut
 * @private
 */
_triangulateCapWithHoles(outerPoints, innerPointArrays, outerStartIdx, innerStartIndices, reversed) {
    const indices = [];
    
    // Calculate basis vectors for projection to 2D
    const v1 = new THREE.Vector3().subVectors(outerPoints[1], outerPoints[0]);
    const v2 = new THREE.Vector3().subVectors(outerPoints[2], outerPoints[0]);
    const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
    
    // Create orthonormal basis
    const uAxis = v1.clone().normalize();
    const vAxis = new THREE.Vector3().crossVectors(normal, uAxis).normalize();
    
    // Project all points to 2D
    const project2D = (point) => {
        const relative = new THREE.Vector3().subVectors(point, outerPoints[0]);
        return [relative.dot(uAxis), relative.dot(vAxis)];
    };
    
    // Prepare data for earcut
    const coords = [];
    const holes = [];
    
    // Add outer ring
    for (const point of outerPoints) {
        coords.push(...project2D(point));
    }
    
    // Add inner rings (holes)
    for (const innerLoop of innerPointArrays) {
        holes.push(coords.length / 2); // Mark where this hole starts
        for (const point of innerLoop) {
            coords.push(...project2D(point));
        }
    }
    
    // Triangulate using earcut
    let triangleIndices;
    if (typeof earcut !== 'undefined') {
        triangleIndices = earcut(coords, holes);
    } else {
        console.warn("earcut not available, using fallback triangulation");
        // Fallback: simple fan triangulation (ignores holes)
        triangleIndices = [];
        for (let i = 1; i < outerPoints.length - 1; i++) {
            triangleIndices.push(0, i, i + 1);
        }
    }
    
    // Map back to actual vertex indices
    let currentOffset = outerStartIdx;
    const vertexMap = [];
    
    // Map outer vertices
    for (let i = 0; i < outerPoints.length; i++) {
        vertexMap.push(currentOffset + i);
    }
    
    // Map inner vertices
    for (let h = 0; h < innerPointArrays.length; h++) {
        const innerStart = innerStartIndices[h];
        for (let i = 0; i < innerPointArrays[h].length; i++) {
            vertexMap.push(innerStart + i);
        }
    }
    
    // Add triangles with correct winding order
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