//setup.js
import {
    CONFIG
} from './config.js';
import {
    updateShadowPosition
} from './scene.js';

export class Setup {
    constructor(scene, floorManager, sphereManager, inputHandler,
        cameraController, sunLight) {
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

        const mainSphere = this.sphereManager.getMainSphere();

        // Handle input
        this.inputHandler.handleInput(mainSphere, dt);

        // Update physics
        this.sphereManager.applyGravity();
        this.sphereManager.updatePhysics(dt);

        // CRITICAL: Update all world matrices before collision detection
        this.scene.updateMatrixWorld(true);

        // Check collisions
        for (const sphere of this.sphereManager.spheres) {
            this.floorManager.checkCollisions(sphere, dt);
        }
        this.sphereManager.handleSphereSphereCollisions();

        // Update camera
        this.cameraController.followTarget(
            mainSphere.position,
            this.inputHandler.cameraDisplace
        );

        // Update shadow position to follow main sphere
        if (CONFIG.isLighted && this.sunLight) {
            updateShadowPosition(this.sunLight, mainSphere, 15, 20);
        }
    }
}