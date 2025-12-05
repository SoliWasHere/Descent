// meshcollision.js
import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

/**
 * Mesh-based collision that works with your existing PhysicsObject system
 */
export class MeshCollider {
    constructor(mesh, options = {}) {
        this.mesh = mesh;
        this.geometry = mesh.geometry;
        this.friction = options.friction || 0.7;
        this.restitution = options.restitution || 0.5;
        
        // Extract triangles from geometry
        this.triangles = this.extractTriangles();
    }
    
    extractTriangles() {
        const triangles = [];
        const geometry = this.geometry;
        const positions = geometry.attributes.position.array;
        const indices = geometry.index ? geometry.index.array : null;
        
        if (indices) {
            // Indexed geometry
            for (let i = 0; i < indices.length; i += 3) {
                const i0 = indices[i] * 3;
                const i1 = indices[i + 1] * 3;
                const i2 = indices[i + 2] * 3;
                
                triangles.push({
                    v0: new THREE.Vector3(positions[i0], positions[i0 + 1], positions[i0 + 2]),
                    v1: new THREE.Vector3(positions[i1], positions[i1 + 1], positions[i1 + 2]),
                    v2: new THREE.Vector3(positions[i2], positions[i2 + 1], positions[i2 + 2])
                });
            }
        } else {
            // Non-indexed geometry
            for (let i = 0; i < positions.length; i += 9) {
                triangles.push({
                    v0: new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]),
                    v1: new THREE.Vector3(positions[i + 3], positions[i + 4], positions[i + 5]),
                    v2: new THREE.Vector3(positions[i + 6], positions[i + 7], positions[i + 8])
                });
            }
        }
        
        return triangles;
    }
    
    /**
     * Check collision with sphere (PhysicsObject) and resolve it
     * This adapts to your existing physics system
     */
    collideSphere(sphere, dt = 0.016) {
        if (sphere.isStatic) return;
        
        const worldMatrix = this.mesh.matrixWorld;
        let hasCollision = false;
        
        // Find closest collision
        let closestDistance = Infinity;
        let closestNormal = null;
        let closestPenetration = 0;
        
        for (const triangle of this.triangles) {
            // Transform triangle to world space
            const v0 = triangle.v0.clone().applyMatrix4(worldMatrix);
            const v1 = triangle.v1.clone().applyMatrix4(worldMatrix);
            const v2 = triangle.v2.clone().applyMatrix4(worldMatrix);
            
            // Find closest point on triangle
            const closest = this.closestPointOnTriangle(sphere.position, v0, v1, v2);
            const distance = sphere.position.distanceTo(closest);
            
            if (distance < sphere.radius) {
                const penetration = sphere.radius - distance;
                
                if (penetration > closestPenetration) {
                    closestPenetration = penetration;
                    closestDistance = distance;
                    
                    // Calculate triangle normal
                    const edge1 = new THREE.Vector3().subVectors(v1, v0);
                    const edge2 = new THREE.Vector3().subVectors(v2, v0);
                    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
                    
                    // Make sure normal points toward sphere
                    const toSphere = new THREE.Vector3().subVectors(sphere.position, closest);
                    if (normal.dot(toSphere) < 0) {
                        normal.negate();
                    }
                    
                    closestNormal = normal;
                    hasCollision = true;
                }
            }
        }
        
        // Resolve the deepest collision
        if (hasCollision && closestNormal) {
            // Use your existing bounceOffPlane method!
            const contactPoint = sphere.position.clone().addScaledVector(closestNormal, -sphere.radius);
            sphere.bounceOffPlane(contactPoint, closestNormal, this.restitution, dt);
        }
        
        return hasCollision;
    }
    
    /**
     * Find closest point on triangle to a given point
     * Using barycentric coordinate method
     */
    closestPointOnTriangle(point, v0, v1, v2) {
        const edge0 = new THREE.Vector3().subVectors(v1, v0);
        const edge1 = new THREE.Vector3().subVectors(v2, v0);
        const v0ToPoint = new THREE.Vector3().subVectors(point, v0);
        
        const a = edge0.dot(edge0);
        const b = edge0.dot(edge1);
        const c = edge1.dot(edge1);
        const d = edge0.dot(v0ToPoint);
        const e = edge1.dot(v0ToPoint);
        
        const det = a * c - b * b;
        let s = b * e - c * d;
        let t = b * d - a * e;
        
        if (s + t <= det) {
            if (s < 0) {
                if (t < 0) {
                    // Region 4
                    if (d < 0) {
                        t = 0;
                        s = (-d >= a ? 1 : -d / a);
                    } else {
                        s = 0;
                        t = (e >= 0 ? 0 : (-e >= c ? 1 : -e / c));
                    }
                } else {
                    // Region 3
                    s = 0;
                    t = (e >= 0 ? 0 : (-e >= c ? 1 : -e / c));
                }
            } else if (t < 0) {
                // Region 5
                t = 0;
                s = (d >= 0 ? 0 : (-d >= a ? 1 : -d / a));
            } else {
                // Region 0
                const invDet = 1 / det;
                s *= invDet;
                t *= invDet;
            }
        } else {
            if (s < 0) {
                // Region 2
                const tmp0 = b + d;
                const tmp1 = c + e;
                if (tmp1 > tmp0) {
                    const numer = tmp1 - tmp0;
                    const denom = a - 2 * b + c;
                    s = (numer >= denom ? 1 : numer / denom);
                    t = 1 - s;
                } else {
                    s = 0;
                    t = (tmp1 <= 0 ? 1 : (e >= 0 ? 0 : -e / c));
                }
            } else if (t < 0) {
                // Region 6
                const tmp0 = b + e;
                const tmp1 = a + d;
                if (tmp1 > tmp0) {
                    const numer = tmp1 - tmp0;
                    const denom = a - 2 * b + c;
                    t = (numer >= denom ? 1 : numer / denom);
                    s = 1 - t;
                } else {
                    t = 0;
                    s = (tmp1 <= 0 ? 1 : (d >= 0 ? 0 : -d / a));
                }
            } else {
                // Region 1
                const numer = c + e - b - d;
                if (numer <= 0) {
                    s = 0;
                } else {
                    const denom = a - 2 * b + c;
                    s = (numer >= denom ? 1 : numer / denom);
                }
                t = 1 - s;
            }
        }
        
        return new THREE.Vector3()
            .copy(v0)
            .addScaledVector(edge0, s)
            .addScaledVector(edge1, t);
    }
}