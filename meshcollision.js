// meshcollision.js - Use physics.js methods directly
import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

export class MeshCollider {
    constructor(mesh, options = {}) {
        this.mesh = mesh;
        this.geometry = mesh.geometry;
        this.friction = options.friction || 0.7;
        this.restitution = options.restitution || 0.5;
        
        this.triangles = this.extractTriangles();
        console.log(`MeshCollider created with ${this.triangles.length} triangles`);
    }
    
    extractTriangles() {
        const triangles = [];
        const geometry = this.geometry;
        const positions = geometry.attributes.position.array;
        const indices = geometry.index ? geometry.index.array : null;
        
        if (indices) {
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
    
collideSphere(sphere, dt = 0.016) {
    if (sphere.isStatic) return false;
    
    const worldMatrix = this.mesh.matrixWorld;
    
    // Find the deepest penetration
    let deepestPenetration = -Infinity;
    let bestContact = null;
    let debugInfo = { topHits: 0, sideHits: 0, bottomHits: 0, totalChecked: 0, penetrations: [] };
    
    for (const triangle of this.triangles) {
        const v0 = triangle.v0.clone().applyMatrix4(worldMatrix);
        const v1 = triangle.v1.clone().applyMatrix4(worldMatrix);
        const v2 = triangle.v2.clone().applyMatrix4(worldMatrix);
        
        debugInfo.totalChecked++;
        
        const closest = this.closestPointOnTriangle(sphere.position, v0, v1, v2);
        const toSphere = new THREE.Vector3().subVectors(sphere.position, closest);
        const distance = toSphere.length();
        const penetration = sphere.radius - distance;
        
        // Better face classification
        const edge1 = new THREE.Vector3().subVectors(v1, v0);
        const edge2 = new THREE.Vector3().subVectors(v2, v0);
        const faceNormal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
        
        const isTopFace = faceNormal.y > 0.7;
        const isBottomFace = faceNormal.y < -0.7;
        
        if (penetration > 0) {
            debugInfo.penetrations.push({
                pen: penetration.toFixed(3),
                dist: distance.toFixed(3),
                type: isTopFace ? 'TOP' : (isBottomFace ? 'BOT' : 'SIDE')
            });
            
            if (isTopFace) debugInfo.topHits++;
            else if (isBottomFace) debugInfo.bottomHits++;
            else debugInfo.sideHits++;
            
            if (penetration > deepestPenetration) {
                deepestPenetration = penetration;
                
                let normal;
                if (distance > 1e-6) {
                    normal = toSphere.clone().normalize();
                } else {
                    normal = faceNormal.clone();
                    if (normal.dot(new THREE.Vector3().subVectors(sphere.position, v0)) < 0) {
                        normal.negate();
                    }
                }
                
                bestContact = {
                    point: closest,
                    normal: normal,
                    penetration: penetration,
                    faceType: isTopFace ? 'TOP' : (isBottomFace ? 'BOT' : 'SIDE')
                };
            }
        }
    }
    
    if (bestContact) {
        console.log(`Collision at sphere Y=${sphere.position.y.toFixed(2)}: top=${debugInfo.topHits}, bottom=${debugInfo.bottomHits}, side=${debugInfo.sideHits}, best=${bestContact.faceType}, pen=${bestContact.penetration.toFixed(3)}`);
        if (debugInfo.penetrations.length < 10) {
            console.log('  Penetrations:', debugInfo.penetrations);
        }
        
        // Manual collision resolution
        sphere.position.addScaledVector(bestContact.normal, bestContact.penetration);
        sphere.mesh.position.copy(sphere.position);
        
        const ra = bestContact.point.clone().sub(sphere.position);
        const velAtContact = sphere.velocity.clone().add(
            new THREE.Vector3().crossVectors(sphere.angularVelocity, ra)
        );
        
        const velAlongNormal = velAtContact.dot(bestContact.normal);
        
        if (velAlongNormal < 0) {
            const e = Math.min(sphere.restitution, this.restitution);
            const invMass = 1 / sphere.mass;
            const invInertia = (sphere.momentOfInertia > 0 && sphere.momentOfInertia !== Infinity) 
                ? 1 / sphere.momentOfInertia : 0;
            
            const raCrossN = new THREE.Vector3().crossVectors(ra, bestContact.normal);
            const angularTerm = raCrossN.lengthSq() * invInertia;
            const invEffectiveMass = invMass + angularTerm;
            
            const j = -(1 + e) * velAlongNormal / invEffectiveMass;
            const impulse = bestContact.normal.clone().multiplyScalar(j);
            
            sphere.velocity.addScaledVector(impulse, invMass);
            sphere.angularVelocity.add(raCrossN.multiplyScalar(j * invInertia));
            
            // Friction
            const tangent = velAtContact.clone().sub(
                bestContact.normal.clone().multiplyScalar(velAlongNormal)
            );
            const tangentLen = tangent.length();
            
            if (tangentLen > 1e-6) {
                tangent.normalize();
                const raCrossT = new THREE.Vector3().crossVectors(ra, tangent);
                const angularTermT = raCrossT.lengthSq() * invInertia;
                const invEffMassT = invMass + angularTermT;
                
                const jt = -velAtContact.dot(tangent) / invEffMassT;
                const mu = Math.min(sphere.friction, this.friction);
                const frictionScalar = THREE.MathUtils.clamp(jt, -Math.abs(j) * mu, Math.abs(j) * mu);
                
                const frictionImpulse = tangent.clone().multiplyScalar(frictionScalar);
                sphere.velocity.addScaledVector(frictionImpulse, invMass);
                sphere.angularVelocity.add(raCrossT.multiplyScalar(frictionScalar * invInertia));
            }
        }
        
        return true;
    } else if (Math.random() < 0.01) {
        // Occasionally log when no collision detected
        console.log(`No collision at sphere Y=${sphere.position.y.toFixed(2)}, checked ${debugInfo.totalChecked} triangles`);
    }
    
    return false;
}
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
                    if (d < 0) { t = 0; s = (-d >= a ? 1 : -d / a); }
                    else { s = 0; t = (e >= 0 ? 0 : (-e >= c ? 1 : -e / c)); }
                } else {
                    s = 0; t = (e >= 0 ? 0 : (-e >= c ? 1 : -e / c));
                }
            } else if (t < 0) {
                t = 0; s = (d >= 0 ? 0 : (-d >= a ? 1 : -d / a));
            } else {
                s *= 1 / det;
                t *= 1 / det;
            }
        } else {
            if (s < 0) {
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
                const numer = c + e - b - d;
                s = (numer <= 0) ? 0 : ((numer >= (a - 2 * b + c)) ? 1 : numer / (a - 2 * b + c));
                t = 1 - s;
            }
        }
        
        return new THREE.Vector3()
            .copy(v0)
            .addScaledVector(edge0, s)
            .addScaledVector(edge1, t);
    }
}