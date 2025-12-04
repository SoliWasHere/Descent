import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

class PhysicsObject {
    constructor(geometry, material, mass = 1, position = new THREE.Vector3(), velocity = new THREE.Vector3()) {
        this.mesh = new THREE.Mesh(geometry, material);
        this.mass = mass;
        this.position = position.clone();
        this.velocity = velocity.clone();
        this.acceleration = new THREE.Vector3(0, 0, 0);
        this.isStatic = mass === 0;
        this.radius = 1;
        
        // Angular physics
        this.angularVelocity = new THREE.Vector3(0, 0, 0);
        this.angularAcceleration = new THREE.Vector3(0, 0, 0);
        this.momentOfInertia = (2/5) * this.mass * this.radius * this.radius;
        
        // For plane collisions
        this.normal = new THREE.Vector3(0, 1, 0);
        this.restitution = 0.7;
        this.friction = 0.3;
        
        // For box collisions
        this.width = 1;
        this.height = 1;
        this.depth = 1;
        
        this.mesh.position.copy(this.position);
    }

    rotate(x = 0, y = 0, z = 0) {
        this.mesh.rotation.set(x, y, z);
        this.updateNormal();
        return this;
    }

    setRotation(euler) {
        if (euler instanceof THREE.Euler) {
            this.mesh.rotation.copy(euler);
        } else {
            this.mesh.rotation.set(euler.x || 0, euler.y || 0, euler.z || 0);
        }
        this.updateNormal();
        return this;
    }

    rotateX(angle) {
        this.mesh.rotation.x = angle;
        this.updateNormal();
        return this;
    }

    rotateY(angle) {
        this.mesh.rotation.y = angle;
        this.updateNormal();
        return this;
    }

    rotateZ(angle) {
        this.mesh.rotation.z = angle;
        this.updateNormal();
        return this;
    }

    updateNormal() {
        this.normal.set(0, 1, 0);
        this.normal.applyEuler(this.mesh.rotation);
        this.normal.normalize();
    }

    update(dt) {
        if (this.isStatic) return;
        
        // Linear motion
        this.velocity.addScaledVector(this.acceleration, dt);
        this.position.addScaledVector(this.velocity, dt);
        this.mesh.position.copy(this.position);
        
        // Angular motion
        this.angularVelocity.addScaledVector(this.angularAcceleration, dt);
        
        const rotationAxis = this.angularVelocity.clone().normalize();
        const rotationAngle = this.angularVelocity.length() * dt;
        
        if (rotationAngle > 0.0001) {
            this.mesh.rotateOnWorldAxis(rotationAxis, rotationAngle);
        }
        
        // Reset accelerations
        this.acceleration.set(0, 0, 0);
        this.angularAcceleration.set(0, 0, 0);
    }

    applyForce(force) {
        if (this.isStatic) return;
        this.acceleration.addScaledVector(force, 1 / this.mass);
    }

    applyTorque(torque) {
        if (this.isStatic) return;
        this.angularAcceleration.addScaledVector(torque, 1 / this.momentOfInertia);
    }

    checkCollision(other) {
        const distance = this.position.distanceTo(other.position);
        return distance < (this.radius + other.radius);
    }

    resolveCollision(other) {
        if (this.isStatic && other.isStatic) return;

        const normal = new THREE.Vector3().subVectors(this.position, other.position);
        const distance = normal.length();
        
        if (distance === 0) return;
        normal.divideScalar(distance);

        const overlap = (this.radius + other.radius) - distance;
        if (overlap > 0) {
            if (!this.isStatic && !other.isStatic) {
                const separation = normal.clone().multiplyScalar(overlap * 0.5);
                this.position.add(separation);
                other.position.sub(separation);
            } else if (!this.isStatic) {
                this.position.add(normal.clone().multiplyScalar(overlap));
            } else if (!other.isStatic) {
                other.position.sub(normal.clone().multiplyScalar(overlap));
            }
        }

        const relativeVelocity = new THREE.Vector3().subVectors(this.velocity, other.velocity);
        const velocityAlongNormal = relativeVelocity.dot(normal);

        if (velocityAlongNormal > 0) return;

        const restitution = 0.8;
        const impulseScalar = -(1 + restitution) * velocityAlongNormal / (1/this.mass + 1/other.mass);
        const impulse = normal.clone().multiplyScalar(impulseScalar);

        if (!this.isStatic) {
            this.velocity.addScaledVector(impulse, 1 / this.mass);
        }
        if (!other.isStatic) {
            other.velocity.addScaledVector(impulse, -1 / other.mass);
        }

        const tangent = relativeVelocity.clone().addScaledVector(normal, -velocityAlongNormal);
        const tangentSpeed = tangent.length();
        
        if (tangentSpeed > 0.001) {
            tangent.divideScalar(tangentSpeed);
            const frictionImpulse = Math.min(this.friction * Math.abs(impulseScalar), tangentSpeed);
            
            if (!this.isStatic) {
                this.velocity.addScaledVector(tangent, -frictionImpulse / this.mass);
                
                const contactPoint = normal.clone().multiplyScalar(this.radius);
                const torque = new THREE.Vector3().crossVectors(contactPoint, tangent.multiplyScalar(-frictionImpulse));
                this.applyTorque(torque);
            }
            if (!other.isStatic) {
                other.velocity.addScaledVector(tangent, frictionImpulse / other.mass);
                
                const contactPoint = normal.clone().multiplyScalar(-other.radius);
                const torque = new THREE.Vector3().crossVectors(contactPoint, tangent.multiplyScalar(frictionImpulse));
                other.applyTorque(torque);
            }
        }
    }

    // Get all 6 face normals and positions for a box
    getBoxFaces() {
        const faces = [];
        
        // Local space normals for each face
        const localNormals = [
            new THREE.Vector3(0, 1, 0),   // top
            new THREE.Vector3(0, -1, 0),  // bottom
            new THREE.Vector3(1, 0, 0),   // right
            new THREE.Vector3(-1, 0, 0),  // left
            new THREE.Vector3(0, 0, 1),   // front
            new THREE.Vector3(0, 0, -1)   // back
        ];
        
        const localOffsets = [
            new THREE.Vector3(0, this.height / 2, 0),   // top
            new THREE.Vector3(0, -this.height / 2, 0),  // bottom
            new THREE.Vector3(this.width / 2, 0, 0),    // right
            new THREE.Vector3(-this.width / 2, 0, 0),   // left
            new THREE.Vector3(0, 0, this.depth / 2),    // front
            new THREE.Vector3(0, 0, -this.depth / 2)    // back
        ];
        
        const dimensions = [
            { w: this.width, h: this.depth },   // top
            { w: this.width, h: this.depth },   // bottom
            { w: this.depth, h: this.height },  // right
            { w: this.depth, h: this.height },  // left
            { w: this.width, h: this.height },  // front
            { w: this.width, h: this.height }   // back
        ];
        
        for (let i = 0; i < 6; i++) {
            // Transform normal to world space
            const worldNormal = localNormals[i].clone();
            worldNormal.applyEuler(this.mesh.rotation);
            worldNormal.normalize();
            
            // Transform offset to world space
            const worldOffset = localOffsets[i].clone();
            worldOffset.applyEuler(this.mesh.rotation);
            
            const worldPosition = this.position.clone().add(worldOffset);
            
            faces.push({
                normal: worldNormal,
                position: worldPosition,
                width: dimensions[i].w,
                height: dimensions[i].h,
                index: i
            });
        }
        
        return faces;
    }

    // Check if point is within face bounds
    isPointOnFace(point, face) {
        // Transform point to face's local 2D coordinate system
        const localPos = point.clone().sub(face.position);
        
        // Create a coordinate system for the face
        // We need two perpendicular vectors in the plane
        const up = new THREE.Vector3(0, 1, 0);
        let right = new THREE.Vector3().crossVectors(face.normal, up);
        
        // If normal is parallel to up, use a different reference
        if (right.length() < 0.001) {
            right = new THREE.Vector3().crossVectors(face.normal, new THREE.Vector3(1, 0, 0));
        }
        right.normalize();
        
        const forward = new THREE.Vector3().crossVectors(right, face.normal);
        forward.normalize();
        
        // Project point onto face coordinate system
        const x = localPos.dot(right);
        const y = localPos.dot(forward);
        
        // Check if within bounds
        return Math.abs(x) <= face.width / 2 && Math.abs(y) <= face.height / 2;
    }

bounceOffPlane(planePosition, planeNormal, planeRestitution = 0.7, dt = 0.016) {
    if (this.isStatic) return;
    
    const toSphere = new THREE.Vector3().subVectors(this.position, planePosition);
    const distanceToPlane = toSphere.dot(planeNormal);
    
    if (distanceToPlane >= this.radius) return;
    
    const penetration = this.radius - distanceToPlane;
    this.position.addScaledVector(planeNormal, penetration);
    
    const vn = this.velocity.dot(planeNormal);
    if (vn >= 0) return;
    
    const vNormal = planeNormal.clone().multiplyScalar(vn);
    const vTangent = this.velocity.clone().sub(vNormal);
    
    const e = Math.min(this.restitution, planeRestitution);
    const mu = this.friction;
    
    const m = this.mass;
    const I = this.momentOfInertia;
    const R = this.radius;
    
    const r = planeNormal.clone().multiplyScalar(-R);
    
    const vRoll = new THREE.Vector3().crossVectors(this.angularVelocity, r);
    const vSlip = vTangent.clone().sub(vRoll);
    const slipSpeed = vSlip.length();
    
    if (slipSpeed > 0.0001) {
        const slipDir = vSlip.clone().normalize();
        
        const j_noslip = m * slipSpeed / (1.0 + m * R * R / I);
        const j_normal = m * Math.abs(vn) * (1 + e);
        const j_max = mu * j_normal;
        const j = Math.min(j_noslip, j_max);
        
        const frictionDir = slipDir.clone().negate();
        
        vTangent.addScaledVector(frictionDir, j / m);
        
        // FLIPPED: J × r instead of r × J
        const J = frictionDir.clone().multiplyScalar(j);
        const deltaOmega = new THREE.Vector3().crossVectors(J, r).divideScalar(I);
        this.angularVelocity.add(deltaOmega);
    }
    
    vNormal.multiplyScalar(-e);
    this.velocity.copy(vNormal).add(vTangent);
    
    if (Math.abs(vNormal.length()) < 0.1 && penetration < 0.01) {
        this.velocity.multiplyScalar(0.95);
        this.angularVelocity.multiplyScalar(0.98);
    }
}

    bounceBox(sphere, dt = 0.016) {
        if (!this.isStatic) {
            console.warn("bounceBox() is intended for static box objects");
            return;
        }
        
        const faces = this.getBoxFaces();
        
        for (let face of faces) {
            const toSphere = new THREE.Vector3().subVectors(sphere.position, face.position);
            const distance = toSphere.dot(face.normal);
            
            if (distance < sphere.radius && distance > -sphere.radius) {
                if (this.isPointOnFace(sphere.position, face)) {
                    sphere.bounceOffPlane(face.position, face.normal, this.restitution, dt);
                    return;
                }
            }
        }
    }
}

// Helper class for collision detection
class CollisionHelper {
    static isOnBox(spherePos, boxObject, sphereRadius = 1) {
        const faces = boxObject.getBoxFaces();
        
        for (let face of faces) {
            const toSphere = new THREE.Vector3().subVectors(spherePos, face.position);
            const distance = toSphere.dot(face.normal);
            
            if (distance < sphereRadius && distance > -sphereRadius) {
                if (boxObject.isPointOnFace(spherePos, face)) {
                    return true;
                }
            }
        }
        
        return false;
    }
}

export { PhysicsObject, CollisionHelper };