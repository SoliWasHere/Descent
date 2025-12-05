export class CameraController {
    constructor(camera) {
        this.camera = camera;
    }

    followTarget(target, cameraDisplace) {
        this.camera.lookAt(target);
        this.camera.position.set(
            target.x + Math.sin(cameraDisplace[0] / 20) * 30, target.y +
            7 + cameraDisplace[1], target.z + Math.cos(cameraDisplace[
                0] / 20) * 30
        );
    }
}