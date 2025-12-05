//game.js
import { CONFIG } from './config.js';
import { updateShadowPosition } from './scene.js';

export class Game {
    constructor(scene, floorManager, sphereManager, inputHandler, cameraController, sunLight) {
        this.scene = scene;
        this.floorManager = floorManager;
        this.sphereManager = sphereManager;
        this.inputHandler = inputHandler;
        this.cameraController = cameraController;
        this.sunLight = sunLight; // Store it as instance property
        this.lastTime = performance.now();
        this.lastFloorSpawn = performance.now();
    }

    update(currentTime) {
        const dt = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        const mainSphere = this.sphereManager.getMainSphere();

        // Handle input
        this.inputHandler.handleInput(mainSphere, dt);

        // Spawn floor under ball
        /*
        if (currentTime - this.lastFloorSpawn >= CONFIG.floorSpawnInterval) {
            const pos = mainSphere.position;
            const floor = this.floorManager.createFloor(pos.x, pos.y, pos.z);
            this.lastFloorSpawn = currentTime;
        }
        */

        // Update physics
        this.sphereManager.applyGravity();
        this.sphereManager.updatePhysics(dt);

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