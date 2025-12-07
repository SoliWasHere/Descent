import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

export class CameraController {
    constructor(camera) {
        this.camera = camera;
        this.currentPosition = new THREE.Vector3();
        this.currentLookAt = new THREE.Vector3();
        this.lerpFactor = 1; // Smoothness (0.05 = very smooth, 0.2 = responsive)
        this.raycaster = new THREE.Raycaster();
    }

    followTarget(target, cameraDisplace, floors = []) {
        // Calculate desired camera position
        const desiredPosition = new THREE.Vector3(
            target.x + Math.sin(cameraDisplace[0] / 20) * 30,
            target.y + 7 + cameraDisplace[1],
            target.z + Math.cos(cameraDisplace[0] / 20) * 30
        );

        // Check for occlusion and adjust camera position if needed
        const adjustedPosition = this.checkOcclusion(target, desiredPosition, floors);

        // Lerp camera position for smooth movement
        if (this.currentPosition.lengthSq() === 0) {
            // First frame - snap to position
            this.currentPosition.copy(adjustedPosition);
            this.currentLookAt.copy(target);
        } else {
            // Smooth interpolation
            this.currentPosition.lerp(adjustedPosition, this.lerpFactor);
            this.currentLookAt.lerp(target, this.lerpFactor);
        }

        // Apply position and look at
        this.camera.position.copy(this.currentPosition);
        this.camera.lookAt(this.currentLookAt);
    }

    /**
     * Check if anything is blocking the view between camera and target
     * If blocked, move camera closer to target
     */
    checkOcclusion(target, desiredCameraPos, floors) {
        // Direction from target to camera
        const direction = new THREE.Vector3().subVectors(desiredCameraPos, target);
        const distance = direction.length();
        direction.normalize();

        // Cast ray from target to desired camera position
        this.raycaster.set(target, direction);
        this.raycaster.far = distance;

        // Collect all meshes to check
        const meshes = [];
        for (const floor of floors) {
            if (floor.mesh) {
                meshes.push(floor.mesh);
            }
        }

        // Check for intersections
        const intersects = this.raycaster.intersectObjects(meshes, false);

        if (intersects.length > 0) {
            // Something is blocking the view
            const firstHit = intersects[0];
            const hitDistance = firstHit.distance;
            
            // Move camera to just before the obstruction
            const safeDistance = Math.max(hitDistance - 1, 2); // At least 2 units from target
            const adjustedPosition = target.clone().add(direction.multiplyScalar(safeDistance));
            
            return adjustedPosition;
        }

        // No obstruction - use desired position
        return desiredCameraPos;
    }

    /**
     * Set the lerp factor (smoothness)
     * @param {number} factor - 0.05 (very smooth) to 0.3 (very responsive)
     */
    setLerpFactor(factor) {
        this.lerpFactor = Math.max(0.01, Math.min(1, factor));
    }

    /**
     * Instantly snap camera to target (useful for scene transitions)
     */
    snapToTarget(target, cameraDisplace) {
        const position = new THREE.Vector3(
            target.x + Math.sin(cameraDisplace[0] / 20) * 30,
            target.y + 7 + cameraDisplace[1],
            target.z + Math.cos(cameraDisplace[0] / 20) * 30
        );
        
        this.currentPosition.copy(position);
        this.currentLookAt.copy(target);
        this.camera.position.copy(position);
        this.camera.lookAt(target);
    }
}