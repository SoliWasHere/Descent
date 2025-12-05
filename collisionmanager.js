// collisionmanager.js - Global triangle collision manager
import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

export class CollisionManager {
    constructor() {
        this.triangles = [];
        console.log('CollisionManager initialized');
    }

    addTriangles(triangles) {
        // Triangles should already be in world space from createSineWavePlatform
        this.triangles.push(...triangles);
        console.log(`Added ${triangles.length} triangles. Total: ${this.triangles.length}`);
    }

    getNearbyTriangles(position, radius, margin = 2) {
        const searchRadius = radius + margin;
        return this.triangles.filter(tri => {
            // Quick AABB check first
            if (tri.bounds) {
                if (position.x + searchRadius < tri.bounds.minX || position.x - searchRadius > tri.bounds.maxX) return false;
                if (position.y + searchRadius < tri.bounds.minY || position.y - searchRadius > tri.bounds.maxY) return false;
                if (position.z + searchRadius < tri.bounds.minZ || position.z - searchRadius > tri.bounds.maxZ) return false;
            }
            
            // Check distance to triangle center
            const center = new THREE.Vector3()
                .add(tri.v0)
                .add(tri.v1)
                .add(tri.v2)
                .divideScalar(3);
            
            return center.distanceTo(position) < searchRadius + 5;
        });
    }

    collideSphere(sphere, friction = 0.5, restitution = 0.7, dt = 0.016) {
        if (sphere.isStatic) return false;

        const nearby = this.getNearbyTriangles(sphere.position, sphere.radius, 5);
        
        if (nearby.length === 0) return false;

        // Find deepest penetration
        let deepestPenetration = -Infinity;
        let bestContact = null;

        for (const triangle of nearby) {
            const closest = this.closestPointOnTriangle(
                sphere.position, 
                triangle.v0, 
                triangle.v1, 
                triangle.v2
            );
            
            const toSphere = new THREE.Vector3().subVectors(sphere.position, closest);
            const distance = toSphere.length();
            const penetration = sphere.radius - distance;

            if (penetration > 0 && penetration > deepestPenetration) {
                deepestPenetration = penetration;

                // Calculate normal
                let normal;
                if (distance > 1e-6) {
                    normal = toSphere.clone().normalize();
                } else {
                    // Use face normal if sphere center is exactly on triangle
                    normal = triangle.normal.clone();
                    // Ensure normal points toward sphere
                    if (normal.dot(new THREE.Vector3().subVectors(sphere.position, triangle.v0)) < 0) {
                        normal.negate();
                    }
                }

                bestContact = {
                    point: closest,
                    normal: normal,
                    penetration: penetration,
                    triangle: triangle
                };
            }
        }

        if (bestContact) {
            // Position correction
            sphere.position.addScaledVector(bestContact.normal, bestContact.penetration);
            sphere.mesh.position.copy(sphere.position);

            // Calculate velocity at contact point
            const ra = bestContact.point.clone().sub(sphere.position);
            const velAtContact = sphere.velocity.clone().add(
                new THREE.Vector3().crossVectors(sphere.angularVelocity, ra)
            );

            const velAlongNormal = velAtContact.dot(bestContact.normal);

            // Only apply impulse if moving into surface
            if (velAlongNormal < 0) {
                const invMass = 1 / sphere.mass;
                const invInertia = (sphere.momentOfInertia > 0 && sphere.momentOfInertia !== Infinity) 
                    ? 1 / sphere.momentOfInertia 
                    : 0;

                // Normal impulse
                const raCrossN = new THREE.Vector3().crossVectors(ra, bestContact.normal);
                const angularTerm = raCrossN.lengthSq() * invInertia;
                const invEffectiveMass = invMass + angularTerm;

                const j = -(1 + restitution) * velAlongNormal / invEffectiveMass;
                const impulse = bestContact.normal.clone().multiplyScalar(j);

                sphere.velocity.addScaledVector(impulse, invMass);
                sphere.angularVelocity.add(raCrossN.multiplyScalar(j * invInertia));

                // Friction impulse
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
                    const frictionScalar = THREE.MathUtils.clamp(
                        jt, 
                        -Math.abs(j) * friction, 
                        Math.abs(j) * friction
                    );

                    const frictionImpulse = tangent.clone().multiplyScalar(frictionScalar);
                    sphere.velocity.addScaledVector(frictionImpulse, invMass);
                    sphere.angularVelocity.add(raCrossT.multiplyScalar(frictionScalar * invInertia));
                }
            }

            return true;
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
                    if (d < 0) { 
                        t = 0; 
                        s = (-d >= a ? 1 : -d / a); 
                    } else { 
                        s = 0; 
                        t = (e >= 0 ? 0 : (-e >= c ? 1 : -e / c)); 
                    }
                } else {
                    s = 0; 
                    t = (e >= 0 ? 0 : (-e >= c ? 1 : -e / c));
                }
            } else if (t < 0) {
                t = 0; 
                s = (d >= 0 ? 0 : (-d >= a ? 1 : -d / a));
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

    clear() {
        this.triangles = [];
        console.log('CollisionManager cleared');
    }
}