import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

/**
 * Represents a physics-enabled 3D object with collision detection and response.
 * Supports both spherical and box colliders with linear and angular motion.
 *
 * NOTE: This file focuses on fixing:
 *  - non-conserved momentum when one body is non-static
 *  - spheres penetrating floors/box faces when approaching edges or sides
 *  - jitter/teleportation by using proper closest-point sphere-box collision
 */
class PhysicsObject {
    constructor(geometry, material, mass = 1, position = new THREE.Vector3(), velocity = new THREE.Vector3()) {
        this.mesh = new THREE.Mesh(geometry, material);
        this.mass = mass;
        this.position = position.clone();
        this.velocity = velocity.clone();
        this.acceleration = new THREE.Vector3(0, 0, 0);
        this.isStatic = mass === 0;

        // Spherical collider properties
        this.radius = 1;

        // Angular physics properties
        this.angularVelocity = new THREE.Vector3(0, 0, 0);
        this.angularAcceleration = new THREE.Vector3(0, 0, 0);
        // For spheres this is fine; if geometry isn't sphere, momentOfInertia should be set externally
        this.momentOfInertia = (this.mass > 0) ? (2 / 5) * this.mass * this.radius * this.radius : Infinity;

        // Material properties
        this.normal = new THREE.Vector3(0, 1, 0);
        this.restitution = 0.7;
        this.friction = 0.3;

        // Box collider dimensions (if object is used as a box)
        this.width = 1;
        this.height = 1;
        this.depth = 1;

        this.mesh.position.copy(this.position);
    }

    // Rotation helpers (unchanged)
    rotate(x = 0, y = 0, z = 0) {
        this.mesh.rotation.set(x, y, z);
        this.updateNormal();
        return this;
    }
    setRotation(euler) {
        if (euler instanceof THREE.Euler) this.mesh.rotation.copy(euler);
        else this.mesh.rotation.set(euler.x || 0, euler.y || 0, euler.z || 0);
        this.updateNormal();
        return this;
    }
    rotateX(angle) { this.mesh.rotation.x = angle; this.updateNormal(); return this; }
    rotateY(angle) { this.mesh.rotation.y = angle; this.updateNormal(); return this; }
    rotateZ(angle) { this.mesh.rotation.z = angle; this.updateNormal(); return this; }
    updateNormal() {
        this.normal.set(0, 1, 0);
        this.normal.applyEuler(this.mesh.rotation).normalize();
    }

    // Physics update
    update(dt) {
        if (this.isStatic) return;

        // integrate linear motion
        this.velocity.addScaledVector(this.acceleration, dt);
        this.position.addScaledVector(this.velocity, dt);
        this.mesh.position.copy(this.position);

        // integrate angular motion
        this.angularVelocity.addScaledVector(this.angularAcceleration, dt);
        const angSpeed = this.angularVelocity.length();
        if (angSpeed > 1e-6) {
            const axis = this.angularVelocity.clone().normalize();
            this.mesh.rotateOnWorldAxis(axis, angSpeed * dt);
        }

        // reset frame forces
        this.acceleration.set(0, 0, 0);
        this.angularAcceleration.set(0, 0, 0);
    }

    applyForce(force) {
        if (this.isStatic) return;
        this.acceleration.addScaledVector(force, 1 / this.mass);
    }
    applyTorque(torque) {
        if (this.isStatic) return;
        // torque -> angular acceleration: alpha = torque / I
        if (this.momentOfInertia !== Infinity && this.momentOfInertia !== 0) {
            this.angularAcceleration.addScaledVector(torque, 1 / this.momentOfInertia);
        }
    }

    // ------------------ Sphere-Sphere collision (fixed to handle static masses and angular inertia) ------------------
    checkCollision(other) {
        const distance = this.position.distanceTo(other.position);
        return distance < (this.radius + other.radius);
    }

    resolveCollision(other) {
        if (this.isStatic && other.isStatic) return;

        const normal = new THREE.Vector3().subVectors(this.position, other.position);
        const dist = normal.length();
        if (dist === 0) {
            // avoid singularity: nudge along arbitrary axis (use world up rotated by one of the objects)
            normal.set(0, 1, 0).applyEuler(this.mesh.rotation);
            dist = normal.length();
            if (dist === 0) return;
        }
        normal.divideScalar(dist); // normalize

        // position correction (baumgarte style) with slop to avoid teleport
        const penetration = (this.radius + other.radius) - dist;
        const slop = 0.001;
        const percent = 0.8; // push 80% of penetration
        if (penetration > slop) {
            const invMassA = this.isStatic ? 0 : 1 / this.mass;
            const invMassB = other.isStatic ? 0 : 1 / other.mass;
            const invSum = invMassA + invMassB;
            if (invSum > 0) {
                const correction = normal.clone().multiplyScalar((penetration - slop) / invSum * percent);
                if (!this.isStatic) this.position.addScaledVector(correction, invMassA);
                if (!other.isStatic) other.position.addScaledVector(correction, -invMassB);
                this.mesh.position.copy(this.position);
                other.mesh.position.copy(other.position);
            }
        }

        // relative velocity at contact
        const ra = normal.clone().multiplyScalar(-this.radius);
        const rb = normal.clone().multiplyScalar(other.radius);
        const velA = this.velocity.clone().add(new THREE.Vector3().crossVectors(this.angularVelocity, ra));
        const velB = other.velocity.clone().add(new THREE.Vector3().crossVectors(other.angularVelocity, rb));
        const relativeVelocity = velA.clone().sub(velB);

        const velAlongNormal = relativeVelocity.dot(normal);
        // If velocities are separating, still we've already corrected positions; no impulse needed
        if (velAlongNormal > 0) return;

        const restitution = Math.min(this.restitution, other.restitution);

        const invMassA = this.isStatic ? 0 : 1 / this.mass;
        const invMassB = other.isStatic ? 0 : 1 / other.mass;

        // rotational contribution to effective mass
        const raCrossN = new THREE.Vector3().crossVectors(ra, normal);
        const rbCrossN = new THREE.Vector3().crossVectors(rb, normal);
        const invIA = (this.momentOfInertia === Infinity || this.momentOfInertia === 0) ? 0 : 1 / this.momentOfInertia;
        const invIB = (other.momentOfInertia === Infinity || other.momentOfInertia === 0) ? 0 : 1 / other.momentOfInertia;
        const angularTerm = (raCrossN.lengthSq() * invIA) + (rbCrossN.lengthSq() * invIB);

        const invEffectiveMass = invMassA + invMassB + angularTerm;
        if (invEffectiveMass === 0) return;

        const j = -(1 + restitution) * velAlongNormal / invEffectiveMass;
        const impulse = normal.clone().multiplyScalar(j);

        if (!this.isStatic) {
            this.velocity.addScaledVector(impulse, invMassA);
            const dOmegaA = new THREE.Vector3().crossVectors(ra, impulse).multiplyScalar(invIA);
            this.angularVelocity.add(dOmegaA);
        }
        if (!other.isStatic) {
            other.velocity.addScaledVector(impulse, -invMassB);
            const dOmegaB = new THREE.Vector3().crossVectors(rb, impulse.clone().negate()).multiplyScalar(invIB);
            other.angularVelocity.add(dOmegaB);
        }

        // friction (tangent) — Coulomb friction limited by mu * j
        const tangent = relativeVelocity.clone().sub(normal.clone().multiplyScalar(relativeVelocity.dot(normal)));
        const tLen = tangent.length();
        if (tLen > 1e-6) {
            tangent.divideScalar(tLen);
            const raCrossT = new THREE.Vector3().crossVectors(ra, tangent);
            const rbCrossT = new THREE.Vector3().crossVectors(rb, tangent);
            const angularTermT = (raCrossT.lengthSq() * invIA) + (rbCrossT.lengthSq() * invIB);
            const invEffMassT = invMassA + invMassB + angularTermT;
            const jt = -relativeVelocity.dot(tangent) / (invEffMassT || 1);
            const maxFriction = Math.min(this.friction, other.friction) * j;
            const frictionImpulseScalar = THREE.MathUtils.clamp(jt, -Math.abs(maxFriction), Math.abs(maxFriction));
            const frictionImpulse = tangent.clone().multiplyScalar(frictionImpulseScalar);

            if (!this.isStatic) {
                this.velocity.addScaledVector(frictionImpulse, invMassA);
                this.angularVelocity.add(new THREE.Vector3().crossVectors(ra, frictionImpulse).multiplyScalar(invIA));
            }
            if (!other.isStatic) {
                other.velocity.addScaledVector(frictionImpulse, -invMassB);
                other.angularVelocity.add(new THREE.Vector3().crossVectors(rb, frictionImpulse.clone().negate()).multiplyScalar(invIB));
            }
        }
    }

    // ------------------ Box utility (unchanged) ------------------
    getBoxFaces() {
        const faces = [];
        const localNormals = [
            new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)
        ];
        const localOffsets = [
            new THREE.Vector3(0, this.height / 2, 0), new THREE.Vector3(0, -this.height / 2, 0),
            new THREE.Vector3(this.width / 2, 0, 0), new THREE.Vector3(-this.width / 2, 0, 0),
            new THREE.Vector3(0, 0, this.depth / 2), new THREE.Vector3(0, 0, -this.depth / 2)
        ];
        const dimensions = [
            { w: this.width, h: this.depth }, { w: this.width, h: this.depth },
            { w: this.depth, h: this.height }, { w: this.depth, h: this.height },
            { w: this.width, h: this.height }, { w: this.width, h: this.height }
        ];
        for (let i = 0; i < 6; i++) {
            const worldNormal = localNormals[i].clone().applyEuler(this.mesh.rotation).normalize();
            const worldOffset = localOffsets[i].clone().applyEuler(this.mesh.rotation);
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

    isPointOnFace(point, face) {
        // Convert point into face local coordinates properly via face basis
        const localPos = point.clone().sub(face.position);
        const up = new THREE.Vector3(0, 1, 0);
        let right = new THREE.Vector3().crossVectors(face.normal, up);
        if (right.length() < 0.001) right = new THREE.Vector3().crossVectors(face.normal, new THREE.Vector3(1, 0, 0));
        right.normalize();
        const forward = new THREE.Vector3().crossVectors(right, face.normal).normalize();
        const x = localPos.dot(right);
        const y = localPos.dot(forward);
        return Math.abs(x) <= face.width / 2 + 1e-6 && Math.abs(y) <= face.height / 2 + 1e-6;
    }

    // ------------------ Plane bounce (kept but made safer) ------------------
    bounceOffPlane(planePosition, planeNormal, planeRestitution = 0.7, dt = 0.016) {
        if (this.isStatic) return;

        const toSphere = new THREE.Vector3().subVectors(this.position, planePosition);
        const distanceToPlane = toSphere.dot(planeNormal);

        if (distanceToPlane >= this.radius) return;

        // Projected point might be outside box face; caller must ensure plane is valid contact
        const penetration = this.radius - distanceToPlane;
        this.position.addScaledVector(planeNormal, penetration);
        this.mesh.position.copy(this.position);

        const vn = this.velocity.dot(planeNormal);
        // If moving away after position correction, skip impulse
        if (vn >= 0) return;

        const vNormal = planeNormal.clone().multiplyScalar(vn);
        const vTangent = this.velocity.clone().sub(vNormal);

        const e = Math.min(this.restitution, planeRestitution);
        const m = this.mass;

        // rolling/slip friction handling (simplified, robust)
        const vRoll = new THREE.Vector3().crossVectors(this.angularVelocity, planeNormal).multiplyScalar(this.radius);
        const vSlip = vTangent.clone().sub(vRoll);
        const slipSpeed = vSlip.length();
        const mu = this.friction;

        // normal bounce
        const newVn = -e * vn;
        this.velocity.copy(planeNormal.clone().multiplyScalar(newVn).add(vTangent));

        // friction impulse approximation (apply small tangential reduction)
        if (slipSpeed > 1e-4 && mu > 1e-6) {
            const slipDir = vSlip.clone().normalize();
            const j_noslip = m * slipSpeed / (1.0 + (m * this.radius * this.radius) / this.momentOfInertia);
            const j_normal = m * Math.abs(vn) * (1 + e);
            const j_max = mu * j_normal;
            const j = Math.min(j_noslip, j_max);
            this.velocity.addScaledVector(slipDir, -j / m);
            // angular update
            const r = planeNormal.clone().multiplyScalar(-this.radius);
            const J = slipDir.clone().multiplyScalar(-j);
            const deltaOmega = new THREE.Vector3().crossVectors(r, J).divideScalar(this.momentOfInertia);
            this.angularVelocity.add(deltaOmega);
        }
    }

    // ------------------ Sphere vs Box collision using closest-point (replaces bounceBox) ------------------
    /**
     * Robust sphere vs box collision resolution.
     * This should be used when the box is static (floor/wall) or dynamic.
     * It computes closest point on box to sphere center in box local-space, resolves penetration,
     * computes impulse (including angular effects for spheres and boxes if they have momentOfInertia).
     * @param {PhysicsObject} sphere - the sphere object (this method called on box)
     * @param {number} [dt=0.016]
     */
    collideSphereBox(sphere, dt = 0.016) {
        // compute box orientation quaternion and its inverse
        const boxQ = this.mesh.quaternion.clone();
        const invBoxQ = boxQ.clone().conjugate();

        // sphere position in box local space
        const localSpherePos = sphere.position.clone().sub(this.position).applyQuaternion(invBoxQ);

        const hx = this.width / 2;
        const hy = this.height / 2;
        const hz = this.depth / 2;

        // closest point in local space
        const closestLocal = new THREE.Vector3(
            THREE.MathUtils.clamp(localSpherePos.x, -hx, hx),
            THREE.MathUtils.clamp(localSpherePos.y, -hy, hy),
            THREE.MathUtils.clamp(localSpherePos.z, -hz, hz)
        );

        // world space closest point
        const closestWorld = closestLocal.clone().applyQuaternion(boxQ).add(this.position);

        // vector from closest point to sphere center
        const diff = sphere.position.clone().sub(closestWorld);
        const dist = diff.length();
        const radius = sphere.radius;

        if (dist >= radius || dist === 0 && (closestLocal.x === localSpherePos.x && closestLocal.y === localSpherePos.y && closestLocal.z === localSpherePos.z)) {
            // No penetration OR exactly inside but closest point equals sphere center projection (corner case handled below).
            // If dist === 0 and closest point equals sphere center projection, we will pick a face normal instead below.
            if (dist >= radius) return;
        }

        // Choose contact normal robustly
        let normal;
        if (dist > 1e-6) {
            normal = diff.clone().divideScalar(dist);
        } else {
            // sphere center exactly on closest point (rare). Choose a face normal that points outward.
            // Determine which axis of localSpherePos is outside the box extents most and use that.
            const dx = Math.abs(localSpherePos.x) - hx;
            const dy = Math.abs(localSpherePos.y) - hy;
            const dz = Math.abs(localSpherePos.z) - hz;
            if (dx >= dy && dx >= dz) normal = new THREE.Vector3(Math.sign(localSpherePos.x), 0, 0);
            else if (dy >= dx && dy >= dz) normal = new THREE.Vector3(0, Math.sign(localSpherePos.y), 0);
            else normal = new THREE.Vector3(0, 0, Math.sign(localSpherePos.z));
            // rotate normal to world space
            normal.applyQuaternion(boxQ).normalize();
        }

        const penetration = radius - dist;
        if (penetration <= 0) return;

        // position correction using inverse mass weighting
        const invMassA = sphere.isStatic ? 0 : 1 / sphere.mass;
        const invMassB = this.isStatic ? 0 : 1 / this.mass;
        const invSum = invMassA + invMassB;
        if (invSum === 0) return;
        const percent = 0.8;
        const slop = 0.001;
        const correctionMagnitude = Math.max(penetration - slop, 0) / invSum * percent;
        const correction = normal.clone().multiplyScalar(correctionMagnitude);
        if (!sphere.isStatic) sphere.position.addScaledVector(correction, invMassA);
        if (!this.isStatic) this.position.addScaledVector(correction, -invMassB);
        sphere.mesh.position.copy(sphere.position);
        this.mesh.position.copy(this.position);

        // contact point in world space relative to centers
        const contactPoint = closestWorld.clone();
        const ra = contactPoint.clone().sub(sphere.position);
        const rb = contactPoint.clone().sub(this.position);

        // velocities at contact (include angular)
        const velA = sphere.velocity.clone().add(new THREE.Vector3().crossVectors(sphere.angularVelocity, ra));
        const velB = this.velocity ? this.velocity.clone().add(new THREE.Vector3().crossVectors(this.angularVelocity, rb)) : new THREE.Vector3();
        const relativeVel = velA.clone().sub(velB);

        const velAlongNormal = relativeVel.dot(normal);

        // restitution check - only apply impulse if approaching (or always apply small bounce if penetration)
        const e = Math.min(sphere.restitution, this.restitution);

        // compute effective mass including rotational term
        const invIA = (sphere.momentOfInertia === Infinity || sphere.momentOfInertia === 0) ? 0 : 1 / sphere.momentOfInertia;
        const invIB = (this.momentOfInertia === Infinity || this.momentOfInertia === 0) ? 0 : 1 / this.momentOfInertia;
        const raCrossN = new THREE.Vector3().crossVectors(ra, normal);
        const rbCrossN = new THREE.Vector3().crossVectors(rb, normal);
        const angularTerm = raCrossN.lengthSq() * invIA + rbCrossN.lengthSq() * invIB;
        const invEffectiveMass = invMassA + invMassB + angularTerm;
        if (invEffectiveMass === 0) return;

        // If separating strongly, skip impulse but penetration was corrected above
        if (velAlongNormal > 0 && penetration < slop) return;

        const j = -(1 + e) * velAlongNormal / invEffectiveMass;
        const impulse = normal.clone().multiplyScalar(j);

        if (!sphere.isStatic) {
            sphere.velocity.addScaledVector(impulse, invMassA);
            sphere.angularVelocity.add(new THREE.Vector3().crossVectors(ra, impulse).multiplyScalar(invIA));
        }
        if (!this.isStatic) {
            this.velocity.addScaledVector(impulse, -invMassB);
            this.angularVelocity.add(new THREE.Vector3().crossVectors(rb, impulse.clone().negate()).multiplyScalar(invIB));
        }

        // tangential (friction) impulse
        const tangent = relativeVel.clone().sub(normal.clone().multiplyScalar(relativeVel.dot(normal)));
        const tLen = tangent.length();
        if (tLen > 1e-6) {
            tangent.divideScalar(tLen);
            const raCrossT = new THREE.Vector3().crossVectors(ra, tangent);
            const rbCrossT = new THREE.Vector3().crossVectors(rb, tangent);
            const angularTermT = raCrossT.lengthSq() * invIA + rbCrossT.lengthSq() * invIB;
            const invEffMassT = invMassA + invMassB + angularTermT || 1;
            const jt = -relativeVel.dot(tangent) / invEffMassT;
            const mu = Math.min(sphere.friction, this.friction);
            const maxFriction = Math.abs(j) * mu;
            const frictionScalar = THREE.MathUtils.clamp(jt, -maxFriction, maxFriction);
            const frictionImpulse = tangent.clone().multiplyScalar(frictionScalar);

            if (!sphere.isStatic) {
                sphere.velocity.addScaledVector(frictionImpulse, invMassA);
                sphere.angularVelocity.add(new THREE.Vector3().crossVectors(ra, frictionImpulse).multiplyScalar(invIA));
            }
            if (!this.isStatic) {
                this.velocity.addScaledVector(frictionImpulse, -invMassB);
                this.angularVelocity.add(new THREE.Vector3().crossVectors(rb, frictionImpulse.clone().negate()).multiplyScalar(invIB));
            }
        }
    }

    // Old bounceBox wrapper kept for compatibility but now forwards to robust method
    bounceBox(sphere, dt = 0.016) {
        // Prefer using collideSphereBox which handles edge/corner cases.
        this.collideSphereBox(sphere, dt);
    }
}

// ------------------ CollisionHelper (unchanged apart from using new method names) ------------------
class CollisionHelper {
    static isOnBox(spherePos, boxObject, sphereRadius = 1) {
        const invQ = boxObject.mesh.quaternion.clone().conjugate();
        const local = spherePos.clone().sub(boxObject.position).applyQuaternion(invQ);
        const hx = boxObject.width / 2, hy = boxObject.height / 2, hz = boxObject.depth / 2;
        const clamped = new THREE.Vector3(
            THREE.MathUtils.clamp(local.x, -hx, hx),
            THREE.MathUtils.clamp(local.y, -hy, hy),
            THREE.MathUtils.clamp(local.z, -hz, hz)
        );
        const closestWorld = clamped.applyQuaternion(boxObject.mesh.quaternion).add(boxObject.position);
        const dist = closestWorld.distanceTo(spherePos);
        return dist <= sphereRadius + 1e-6;
    }
}

export { PhysicsObject, CollisionHelper };
