// collisionmanager.js - Global triangle collision manager
import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

export class CollisionManager {
    constructor() {
        this.triangles = [];
        console.log('CollisionManager initialized');
    }

    addTriangles(triangles) {
        // Triangles should already be in world space from createSineWavePlatform
        // But be defensive: ensure each triangle has a normalized normal and bounds
        const prepared = triangles.map(tri => {
            const v0 = tri.v0.clone();
            const v1 = tri.v1.clone();
            const v2 = tri.v2.clone();

            let normal = tri.normal ? tri.normal.clone() : new THREE.Vector3();
            if (!tri.normal) {
                normal.copy(new THREE.Vector3().subVectors(v1, v0).cross(new THREE.Vector3().subVectors(v2, v0)));
            }
            if (normal.lengthSq() > 1e-12) normal.normalize();

            const bounds = tri.bounds || {
                minX: Math.min(v0.x, v1.x, v2.x),
                maxX: Math.max(v0.x, v1.x, v2.x),
                minY: Math.min(v0.y, v1.y, v2.y),
                maxY: Math.max(v0.y, v1.y, v2.y),
                minZ: Math.min(v0.z, v1.z, v2.z),
                maxZ: Math.max(v0.z, v1.z, v2.z)
            };

            return { v0, v1, v2, normal, bounds };
        });

        this.triangles.push(...prepared);
        console.log(`Added ${prepared.length} triangles. Total: ${this.triangles.length}`);
    }

getNearbyTriangles(position, radius, margin = 2) {
    const searchRadius = radius + margin + 5;  // More generous margin
    return this.triangles.filter(tri => {
        if (tri.bounds) {
            if (position.x + searchRadius < tri.bounds.minX || position.x - searchRadius > tri.bounds.maxX) return false;
            if (position.y + searchRadius < tri.bounds.minY || position.y - searchRadius > tri.bounds.maxY) return false;
            if (position.z + searchRadius < tri.bounds.minZ || position.z - searchRadius > tri.bounds.maxZ) return false;
        }
        return true;  // Include if passes AABB
    });
}
collideSphere(sphere, friction = 0.5, restitution = 0.7, dt = 0.016) {
    if (sphere.isStatic) return false;

    let nearby = this.getNearbyTriangles(sphere.position, sphere.radius, 5);

    // Debug: if AABB filtering returns nothing, log and fall back to full scan once
    if (nearby.length === 0) {
        if (Math.random() < 0.5) {
            console.log(`No nearby triangles (AABB) for sphere at (${sphere.position.x.toFixed(1)}, ${sphere.position.y.toFixed(1)}, ${sphere.position.z.toFixed(1)}). Falling back to full-triangle scan.`);
        }
        // Fallback: use all triangles so we can tell whether the AABB filtering is too strict
        nearby = this.triangles.slice();
    }

    let deepestPenetration = -Infinity;
    let bestContact = null;
    let debugInfo = [];

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

        // Log every triangle check
        debugInfo.push({
            penetration: penetration.toFixed(3),
            distance: distance.toFixed(3),
            normalY: triangle.normal.y.toFixed(3),
            closestY: closest.y.toFixed(3)
        });

        if (penetration > 0) {
            if (penetration > deepestPenetration) {
                deepestPenetration = penetration;

                // Use the face normal, not the vector to sphere center
                const sphereToTriangle = new THREE.Vector3().subVectors(triangle.v0, sphere.position);
                let normal = triangle.normal.clone();
                
                // If the face normal points toward the sphere, flip it
                if (normal.dot(sphereToTriangle) > 0) {
                    normal.negate();
                }

                bestContact = {
                    point: closest,
                    normal: normal,
                    penetration: penetration,
                    triangle: triangle
                };
            }
        }
    }

    // Log collision attempts
    if (nearby.length > 0 && Math.random() < 0.1) {
        console.log(`Sphere at Y=${sphere.position.y.toFixed(2)}, checked ${nearby.length} triangles, penetrations:`, 
            debugInfo.filter(d => parseFloat(d.penetration) > 0));
        if (bestContact) {
            console.log(`  COLLISION! Normal: (${bestContact.normal.x.toFixed(2)}, ${bestContact.normal.y.toFixed(2)}, ${bestContact.normal.z.toFixed(2)}), pen: ${bestContact.penetration.toFixed(3)}`);
        }
    }
if (bestContact) {
    console.log(`COLLISION! Normal: (${bestContact.normal.x.toFixed(2)}, ${bestContact.normal.y.toFixed(2)}, ${bestContact.normal.z.toFixed(2)})`);
    console.log(`  Triangle vertices: v0.y=${bestContact.triangle.v0.y.toFixed(2)}, v1.y=${bestContact.triangle.v1.y.toFixed(2)}, v2.y=${bestContact.triangle.v2.y.toFixed(2)}`);
        sphere.position.addScaledVector(bestContact.normal, bestContact.penetration);
        sphere.mesh.position.copy(sphere.position);

        const ra = bestContact.point.clone().sub(sphere.position);
        const velAtContact = sphere.velocity.clone().add(
            new THREE.Vector3().crossVectors(sphere.angularVelocity, ra)
        );

        const velAlongNormal = velAtContact.dot(bestContact.normal);

        if (velAlongNormal < 0) {
            const invMass = 1 / sphere.mass;
            const invInertia = (sphere.momentOfInertia > 0 && sphere.momentOfInertia !== Infinity) 
                ? 1 / sphere.momentOfInertia 
                : 0;

            const raCrossN = new THREE.Vector3().crossVectors(ra, bestContact.normal);
            const angularTerm = raCrossN.lengthSq() * invInertia;
            const invEffectiveMass = invMass + angularTerm;

            const j = -(1 + restitution) * velAlongNormal / invEffectiveMass;
            const impulse = bestContact.normal.clone().multiplyScalar(j);

            sphere.velocity.addScaledVector(impulse, invMass);
            sphere.angularVelocity.add(raCrossN.multiplyScalar(j * invInertia));

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
    // Compute edges
    const edge0 = new THREE.Vector3().subVectors(v1, v0);
    const edge1 = new THREE.Vector3().subVectors(v2, v0);
    const v0ToPoint = new THREE.Vector3().subVectors(v0, point);
    
    const a = edge0.dot(edge0);
    const b = edge0.dot(edge1);
    const c = edge1.dot(edge1);
    const d = edge0.dot(v0ToPoint);
    const e = edge1.dot(v0ToPoint);
    
    const det = a * c - b * b;
    let s = b * e - c * d;
    let t = b * d - a * e;
    
    // Check which region the projection falls into
    if (s + t <= det) {
        if (s < 0) {
            if (t < 0) {
                // Region 4 - closest to v0
                if (d < 0) {
                    t = 0;
                    s = (-d >= a) ? 1 : -d / a;
                } else {
                    s = 0;
                    t = (e >= 0) ? 0 : ((-e >= c) ? 1 : -e / c);
                }
            } else {
                // Region 3 - closest to edge v0-v2
                s = 0;
                t = (e >= 0) ? 0 : ((-e >= c) ? 1 : -e / c);
            }
        } else if (t < 0) {
            // Region 5 - closest to edge v0-v1
            t = 0;
            s = (d >= 0) ? 0 : ((-d >= a) ? 1 : -d / a);
        } else {
            // Region 0 - inside triangle
            const invDet = 1 / det;
            s *= invDet;
            t *= invDet;
        }
    } else {
        if (s < 0) {
            // Region 2 - closest to edge v1-v2
            const tmp0 = b + d;
            const tmp1 = c + e;
            if (tmp1 > tmp0) {
                const numer = tmp1 - tmp0;
                const denom = a - 2 * b + c;
                s = (numer >= denom) ? 1 : numer / denom;
                t = 1 - s;
            } else {
                s = 0;
                t = (tmp1 <= 0) ? 1 : ((e >= 0) ? 0 : -e / c);
            }
        } else if (t < 0) {
            // Region 6 - closest to edge v0-v1
            const tmp0 = b + e;
            const tmp1 = a + d;
            if (tmp1 > tmp0) {
                const numer = tmp1 - tmp0;
                const denom = a - 2 * b + c;
                t = (numer >= denom) ? 1 : numer / denom;
                s = 1 - t;
            } else {
                t = 0;
                s = (tmp1 <= 0) ? 1 : ((d >= 0) ? 0 : -d / a);
            }
        } else {
            // Region 1 - closest to edge v1-v2
            const numer = c + e - b - d;
            if (numer <= 0) {
                s = 0;
            } else {
                const denom = a - 2 * b + c;
                s = (numer >= denom) ? 1 : numer / denom;
            }
            t = 1 - s;
        }
    }
    
    // Construct the closest point: v0 + s * edge0 + t * edge1
    return new THREE.Vector3()
        .copy(v0)
        .addScaledVector(edge0, s)
        .addScaledVector(edge1, t);
}
}