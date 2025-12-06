//setup.js
import { CONFIG } from './config.js';
import { updateShadowPosition } from './scene.js';

export class Setup {
    constructor(scene, floorManager, sphereManager, inputHandler, cameraController, sunLight) {
        this.scene = scene;
        this.floorManager = floorManager;
        this.sphereManager = sphereManager;
        this.inputHandler = inputHandler;
        this.cameraController = cameraController;
        this.sunLight = sunLight;
        this.lastTime = performance.now();
    }

update(currentTime) {
    const dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Clamp dt to prevent huge jumps (like when tab loses focus)
    const clampedDt = Math.min(dt, 0.033); // Max 33ms (30fps minimum)

    const mainSphere = this.sphereManager.getMainSphere();

    // Handle input
    this.inputHandler.handleInput(mainSphere, clampedDt);

    // Update physics
    this.sphereManager.applyGravity();
    this.sphereManager.updatePhysics(clampedDt);

    // Check collisions
    for (const sphere of this.sphereManager.spheres) {
        this.floorManager.checkCollisions(sphere, clampedDt);
    }
    this.sphereManager.handleSphereSphereCollisions();

    // Update camera
    this.cameraController.followTarget(
        mainSphere.position,
        this.inputHandler.cameraDisplace,
        this.floorManager.floors
    );

    // Update shadow
    if (CONFIG.isLighted && this.sunLight) {
        updateShadowPosition(this.sunLight, mainSphere, 15, 20);
    }
}
}