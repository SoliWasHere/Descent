import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

/**
 * Triangle primitive for collision detection
 */
class Triangle {
    constructor(v0, v1, v2, parent = null) {
        this.v0 = v0.clone();
        this.v1 = v1.clone();
        this.v2 = v2.clone();
        this.parent = parent;
        this.updateProperties();
    }
    
    updateProperties() {
        this.edge1 = new THREE.Vector3().subVectors(this.v1, this.v0);
        this.edge2 = new THREE.Vector3().subVectors(this.v2, this.v0);
        this.normal = new THREE.Vector3().crossVectors(this.edge1, this.edge2).normalize();
        this.centroid = new THREE.Vector3()
            .add(this.v0).add(this.v1).add(this.v2)
            .divideScalar(3);
        this.aabb = this.computeAABB();
    }
    
    computeAABB() {
        const min = new THREE.Vector3(
            Math.min(this.v0.x, this.v1.x, this.v2.x),
            Math.min(this.v0.y, this.v1.y, this.v2.y),
            Math.min(this.v0.z, this.v1.z, this.v2.z)
        );
        const max = new THREE.Vector3(
            Math.max(this.v0.x, this.v1.x, this.v2.x),
            Math.max(this.v0.y, this.v1.y, this.v2.y),
            Math.max(this.v0.z, this.v1.z, this.v2.z)
        );
        return new AABB(min, max);
    }
    
    closestPointToPoint(point) {
        const ab = this.edge1;
        const ac = this.edge2;
        const ap = new THREE.Vector3().subVectors(point, this.v0);
        
        const d1 = ab.dot(ap);
        const d2 = ac.dot(ap);
        
        if (d1 <= 0 && d2 <= 0) return this.v0.clone();
        
        const bp = new THREE.Vector3().subVectors(point, this.v1);
        const d3 = ab.dot(bp);
        const d4 = ac.dot(bp);
        if (d3 >= 0 && d4 <= d3) return this.v1.clone();
        
        const vc = d1 * d4 - d3 * d2;
        if (vc <= 0 && d1 >= 0 && d3 <= 0) {
            const v = d1 / (d1 - d3);
            return this.v0.clone().add(ab.clone().multiplyScalar(v));
        }
        
        const cp = new THREE.Vector3().subVectors(point, this.v2);
        const d5 = ab.dot(cp);
        const d6 = ac.dot(cp);
        if (d6 >= 0 && d5 <= d6) return this.v2.clone();
        
        const vb = d5 * d2 - d1 * d6;
        if (vb <= 0 && d2 >= 0 && d6 <= 0) {
            const w = d2 / (d2 - d6);
            return this.v0.clone().add(ac.clone().multiplyScalar(w));
        }
        
        const va = d3 * d6 - d5 * d4;
        if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
            const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
            return this.v1.clone().add(
                new THREE.Vector3().subVectors(this.v2, this.v1).multiplyScalar(w)
            );
        }
        
        const denom = 1.0 / (va + vb + vc);
        const v = vb * denom;
        const w = vc * denom;
        return this.v0.clone()
            .add(ab.clone().multiplyScalar(v))
            .add(ac.clone().multiplyScalar(w));
    }
}

/**
 * Axis-Aligned Bounding Box
 */
class AABB {
    constructor(min, max) {
        this.min = min.clone();
        this.max = max.clone();
        this.center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
    }
    
    expand(amount) {
        this.min.addScalar(-amount);
        this.max.addScalar(amount);
        this.center = new THREE.Vector3().addVectors(this.min, this.max).multiplyScalar(0.5);
    }
    
    intersectsSphere(center, radius) {
        const closestPoint = new THREE.Vector3(
            Math.max(this.min.x, Math.min(center.x, this.max.x)),
            Math.max(this.min.y, Math.min(center.y, this.max.y)),
            Math.max(this.min.z, Math.min(center.z, this.max.z))
        );
        const distanceSq = closestPoint.distanceToSquared(center);
        return distanceSq <= radius * radius;
    }
    
    static union(a, b) {
        return new AABB(
            new THREE.Vector3(
                Math.min(a.min.x, b.min.x),
                Math.min(a.min.y, b.min.y),
                Math.min(a.min.z, b.min.z)
            ),
            new THREE.Vector3(
                Math.max(a.max.x, b.max.x),
                Math.max(a.max.y, b.max.y),
                Math.max(a.max.z, b.max.z)
            )
        );
    }
}

/**
 * BVH Node
 */
class BVHNode {
    constructor() {
        this.aabb = null;
        this.left = null;
        this.right = null;
        this.triangles = [];
        this.isLeaf = false;
    }
}

/**
 * Bounding Volume Hierarchy
 */
class BVH {
    constructor(triangles) {
        this.root = this.build(triangles, 0);
    }
    
    build(triangles, depth) {
        const node = new BVHNode();
        
        if (triangles.length === 0) return node;
        
        let aabb = triangles[0].aabb;
        for (let i = 1; i < triangles.length; i++) {
            aabb = AABB.union(aabb, triangles[i].aabb);
        }
        node.aabb = aabb;
        
        if (triangles.length <= 4 || depth > 20) {
            node.isLeaf = true;
            node.triangles = triangles;
            return node;
        }
        
        const extent = new THREE.Vector3().subVectors(aabb.max, aabb.min);
        let axis = 0;
        if (extent.y > extent.x && extent.y > extent.z) axis = 1;
        else if (extent.z > extent.x && extent.z > extent.y) axis = 2;
        
        triangles.sort((a, b) => {
            if (axis === 0) return a.centroid.x - b.centroid.x;
            if (axis === 1) return a.centroid.y - b.centroid.y;
            return a.centroid.z - b.centroid.z;
        });
        
        const mid = Math.floor(triangles.length / 2);
        node.left = this.build(triangles.slice(0, mid), depth + 1);
        node.right = this.build(triangles.slice(mid), depth + 1);
        
        return node;
    }
    
    querySphere(node, center, radius, maxResults = 50) {
        const results = [];
        const stack = [{ node, distSq: 0 }];
        
        while (stack.length > 0) {
            stack.sort((a, b) => a.distSq - b.distSq);
            const { node: currentNode, distSq } = stack.pop();
            
            if (!currentNode || !currentNode.aabb) continue;
            
            if (results.length >= maxResults && distSq > radius * radius) {
                break;
            }
            
            if (!currentNode.aabb.intersectsSphere(center, radius)) continue;
            
            if (currentNode.isLeaf) {
                results.push(...currentNode.triangles);
                if (results.length >= maxResults * 2) {
                    results.sort((a, b) => {
                        return a.centroid.distanceToSquared(center) - 
                            b.centroid.distanceToSquared(center);
                    });
                    results.length = maxResults;
                }
            } else {
                if (currentNode.left) {
                    const leftDistSq = currentNode.left.aabb.center.distanceToSquared(center);
                    stack.push({ node: currentNode.left, distSq: leftDistSq });
                }
                if (currentNode.right) {
                    const rightDistSq = currentNode.right.aabb.center.distanceToSquared(center);
                    stack.push({ node: currentNode.right, distSq: rightDistSq });
                }
            }
        }
        
        return results;
    }
}

/**
 * Physics Object - OPTIMIZED
 */
class PhysicsObject {
    constructor(geometry, material, mass = 1, position = new THREE.Vector3(), velocity = new THREE.Vector3()) {
        this.mesh = new THREE.Mesh(geometry, material);
        this.mass = mass;
        this.position = position.clone();
        this.velocity = velocity.clone();
        this.acceleration = new THREE.Vector3(0, 0, 0);
        this.isStatic = mass === 0;
        
        this.radius = 1;
        
        this.angularVelocity = new THREE.Vector3(0, 0, 0);
        this.angularAcceleration = new THREE.Vector3(0, 0, 0);
        this.momentOfInertia = (this.mass > 0) ? (2 / 5) * this.mass * this.radius * this.radius : Infinity;
        
        this.restitution = 0;
        this.friction = 0.00;
        
        this.triangles = [];
        this.bvh = null;
        this.bvhBuilt = false;
        
        this.cachedWorldMatrix = null;
        this.floorNormal = null;
        this.useFloorNormal = false;
        
        this.mesh.position.copy(this.position);
    }
    
    buildTriangleMesh() {
        this.triangles = [];
        
        const geometry = this.mesh.geometry;
        const positionAttribute = geometry.attributes.position;
        const index = geometry.index;
        
        if (!positionAttribute) return;
        
        let worldMatrix;
        if (this.isStatic && this.cachedWorldMatrix) {
            worldMatrix = this.cachedWorldMatrix;
        } else {
            this.mesh.updateMatrixWorld(true);
            worldMatrix = this.mesh.matrixWorld;
            
            if (this.isStatic) {
                this.cachedWorldMatrix = worldMatrix.clone();
            }
        }
        
        if (index) {
            for (let i = 0; i < index.count; i += 3) {
                const i0 = index.getX(i);
                const i1 = index.getX(i + 1);
                const i2 = index.getX(i + 2);
                
                const v0 = new THREE.Vector3().fromBufferAttribute(positionAttribute, i0).applyMatrix4(worldMatrix);
                const v1 = new THREE.Vector3().fromBufferAttribute(positionAttribute, i1).applyMatrix4(worldMatrix);
                const v2 = new THREE.Vector3().fromBufferAttribute(positionAttribute, i2).applyMatrix4(worldMatrix);
                
                this.triangles.push(new Triangle(v0, v1, v2, this));
            }
        } else {
            for (let i = 0; i < positionAttribute.count; i += 3) {
                const v0 = new THREE.Vector3().fromBufferAttribute(positionAttribute, i).applyMatrix4(worldMatrix);
                const v1 = new THREE.Vector3().fromBufferAttribute(positionAttribute, i + 1).applyMatrix4(worldMatrix);
                const v2 = new THREE.Vector3().fromBufferAttribute(positionAttribute, i + 2).applyMatrix4(worldMatrix);
                
                this.triangles.push(new Triangle(v0, v1, v2, this));
            }
        }
        
        if (this.isStatic && this.triangles.length > 0) {
            const avgNormal = new THREE.Vector3();
            for (const tri of this.triangles) {
                avgNormal.add(tri.normal);
            }
            avgNormal.normalize();
            
            let isFlat = true;
            const threshold = 0.999;
            
            for (const tri of this.triangles) {
                if (tri.normal.dot(avgNormal) < threshold) {
                    isFlat = false;
                    break;
                }
            }
            
            if (isFlat) {
                this.floorNormal = avgNormal;
                this.useFloorNormal = true;
            }
        }
        
        if (this.isStatic && this.triangles.length > 0 && !this.bvhBuilt) {
            this.bvh = new BVH(this.triangles);
            this.bvhBuilt = true;
        }
    }
    
    update(dt) {
        if (this.isStatic) return;
        
        this.velocity.addScaledVector(this.acceleration, dt);
        this.position.addScaledVector(this.velocity, dt);
        
        this.mesh.position.copy(this.position);
        
        this.angularVelocity.addScaledVector(this.angularAcceleration, dt);
        const angSpeed = this.angularVelocity.length();
        if (angSpeed > 1e-6) {
            const axis = this.angularVelocity.clone().normalize();
            this.mesh.rotateOnWorldAxis(axis, angSpeed * dt);
        }
        
        this.acceleration.set(0, 0, 0);
        this.angularAcceleration.set(0, 0, 0);
    }
    
    applyForce(force) {
        if (this.isStatic) return;
        this.acceleration.addScaledVector(force, 1 / this.mass);
    }
    
    applyTorque(torque) {
        if (this.isStatic) return;
        if (this.momentOfInertia !== Infinity && this.momentOfInertia !== 0) {
            this.angularAcceleration.addScaledVector(torque, 1 / this.momentOfInertia);
        }
    }
    
    collideWithTriangleMesh(triangleMesh, dt) {
        if (!triangleMesh.bvh || triangleMesh.triangles.length === 0) return;
        
        this.discreteCollision(triangleMesh, dt);
    }

    discreteCollision(triangleMesh, dt) {
        const candidateTriangles = triangleMesh.bvh.querySphere(
            triangleMesh.bvh.root,
            this.position,
            this.radius * 1.5
        );
        
        if (candidateTriangles.length === 0) return;
        
        const contacts = [];
        
        for (const tri of candidateTriangles) {
            const closest = tri.closestPointToPoint(this.position);
            const dist = this.position.distanceTo(closest);
            
            if (dist < this.radius + 0.01) {
                const penetration = this.radius - dist;
                let normal;
                
                if (dist > 1e-6) {
                    normal = new THREE.Vector3().subVectors(this.position, closest).normalize();
                } else {
                    normal = tri.normal.clone();
                }
                
                contacts.push({
                    point: closest,
                    normal: normal,
                    penetration: penetration,
                    triangle: tri
                });
            }
        }
        
        if (contacts.length === 0) return;
        
        let deepest = contacts[0];
        for (let i = 1; i < contacts.length; i++) {
            if (contacts[i].penetration > deepest.penetration) {
                deepest = contacts[i];
            }
        }
        
        this.handleCollisionResponse(deepest, triangleMesh);
    }

    /**
     * REAL FIX: Don't let velocity reflection cause bouncing
     */
    handleCollisionResponse(contact, triangleMesh) {
        let effectiveNormal = contact.normal;
        
        if (triangleMesh.useFloorNormal && triangleMesh.floorNormal) {
            effectiveNormal = triangleMesh.floorNormal;
        }
        
        // Correct position - push sphere out completely
        if (contact.penetration > 0.0001) {
            this.position.addScaledVector(effectiveNormal, contact.penetration);
        }
        
        const velAlongNormal = this.velocity.dot(effectiveNormal);
        
        // CRITICAL: Only modify velocity if CLEARLY moving into surface
        // Use a larger threshold to prevent oscillation
        if (velAlongNormal < -0.01) {
            const vNormal = effectiveNormal.clone().multiplyScalar(velAlongNormal);
            const vTangent = this.velocity.clone().sub(vNormal);
            
            const restitution = Math.min(this.restitution, triangleMesh.restitution);
            const friction = Math.min(this.friction, triangleMesh.friction);
            
            // Reflect normal component
            let newNormalSpeed = -velAlongNormal * restitution;
            
            // Apply friction
            if (friction > 0.001) {
                const vRoll = new THREE.Vector3().crossVectors(
                    this.angularVelocity, 
                    effectiveNormal
                ).multiplyScalar(this.radius);
                
                const vSlip = vTangent.clone().sub(vRoll);
                const slipSpeed = vSlip.length();
                
                if (slipSpeed > 0.0001) {
                    const slipDir = vSlip.clone().normalize();
                    const normalImpulse = Math.abs(velAlongNormal) * (1 + restitution);
                    const maxFriction = friction * normalImpulse;
                    
                    const inertiaFactor = 1.0 + (this.radius * this.radius) / 
                                                (this.momentOfInertia / this.mass);
                    const frictionImpulse = Math.min(slipSpeed / inertiaFactor, maxFriction);
                    
                    vTangent.addScaledVector(slipDir, -frictionImpulse);
                    
                    const torque = new THREE.Vector3().crossVectors(
                        effectiveNormal.clone().multiplyScalar(-this.radius),
                        slipDir.clone().multiplyScalar(-frictionImpulse * this.mass)
                    );
                    this.angularVelocity.add(torque.divideScalar(this.momentOfInertia));
                }
            }
            
            // Rebuild velocity
            this.velocity.copy(vTangent);
            this.velocity.addScaledVector(effectiveNormal, newNormalSpeed);
        }
    }

    rotateX(angle) {
        this.mesh.rotateX(angle);
        this.mesh.updateMatrixWorld(true);
        this.rebuildCollisionMesh();
    }

    rotateY(angle) {
        this.mesh.rotateY(angle);
        this.mesh.updateMatrixWorld(true);
        this.rebuildCollisionMesh();
    }

    rotateZ(angle) {
        this.mesh.rotateZ(angle);
        this.mesh.updateMatrixWorld(true);
        this.rebuildCollisionMesh();
    }

    rotate(x, y, z) {
        this.mesh.rotation.x += x;
        this.mesh.rotation.y += y;
        this.mesh.rotation.z += z;
        this.mesh.updateMatrixWorld(true);
        this.rebuildCollisionMesh();
    }

    translateX(distance) {
        this.mesh.translateX(distance);
        this.position.copy(this.mesh.position);
        this.mesh.updateMatrixWorld(true);
        this.rebuildCollisionMesh();
    }

    translateY(distance) {
        this.mesh.translateY(distance);
        this.position.copy(this.mesh.position);
        this.mesh.updateMatrixWorld(true);
        this.rebuildCollisionMesh();
    }

    translateZ(distance) {
        this.mesh.translateZ(distance);
        this.position.copy(this.mesh.position);
        this.mesh.updateMatrixWorld(true);
        this.rebuildCollisionMesh();
    }

    translate(x, y, z) {
        this.mesh.translateX(x);
        this.mesh.translateY(y);
        this.mesh.translateZ(z);
        this.position.copy(this.mesh.position);
        this.mesh.updateMatrixWorld(true);
        this.rebuildCollisionMesh();
    }

    rebuildCollisionMesh() {
        this.triangles = [];
        this.bvh = null;
        this.bvhBuilt = false;
        this.floorNormal = null;
        this.useFloorNormal = false;
        this.cachedWorldMatrix = null;
        
        this.buildTriangleMesh();
    }
}

export { PhysicsObject, Triangle, AABB, BVH, BVHNode };