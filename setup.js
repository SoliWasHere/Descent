import { CONFIG } from './config.js';
import { updateShadowPosition } from './scene.js';
import { 
    PerformanceProfiler, 
    createPerformanceUI, 
    updatePerformanceUI,
    setupTestingShortcuts,
    checkCollisionsWithProfiling 
} from './debug.js';

export class Setup {
    constructor(scene, floorManager, sphereManager, inputHandler, cameraController, sunLight) {
        this.scene = scene;
        this.floorManager = floorManager;
        this.sphereManager = sphereManager;
        this.inputHandler = inputHandler;
        this.cameraController = cameraController;
        this.sunLight = sunLight;
        this.lastTime = performance.now();
        
        // Add performance profiler
        this.profiler = new PerformanceProfiler();
        this.perfDiv = createPerformanceUI();
        
        // Setup testing shortcuts (P, T, C keys)
        setupTestingShortcuts(floorManager, this.profiler);
        
        // Update UI every 100ms
        this.lastUIUpdate = 0;
        
        console.log("📊 Performance profiler enabled!");
        console.log("Press P to toggle stats, T for stress test, C for comparison");
    }

    update(currentTime) {
        const dt = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        const clampedDt = Math.min(dt, 0.033);

        // START TOTAL FRAME PROFILING
        this.profiler.startTimer('total');
        
        const mainSphere = this.sphereManager.getMainSphere();

        // Input (not profiled - negligible)
        this.inputHandler.handleInput(mainSphere, clampedDt);

        // PROFILE: Physics update
        this.profiler.startTimer('physics');
        this.sphereManager.applyGravity();
        this.sphereManager.updatePhysics(clampedDt);
        this.profiler.endTimer('physics');

        // PROFILE: Collision detection
        this.profiler.startTimer('collision');
        for (const sphere of this.sphereManager.spheres) {
            checkCollisionsWithProfiling(
                this.floorManager, 
                sphere, 
                clampedDt, 
                this.profiler
            );
        }
        this.profiler.endTimer('collision');

        // Camera update (not profiled - negligible)
        this.cameraController.followTarget(
            mainSphere.position,
            this.inputHandler.cameraDisplace,
            this.floorManager.floors
        );

        // Shadow update (not profiled - negligible)
        if (CONFIG.isLighted && this.sunLight) {
            updateShadowPosition(this.sunLight, mainSphere, 15, 20);
        }

        if (currentTime % 2000 < 20) { // Every 2 seconds
            this.floorManager.cleanupDistantFloors(mainSphere.position, 150);
        }
        
        // END TOTAL FRAME PROFILING
        this.profiler.endTimer('total');
        
        // Update UI display (throttled to 10 FPS for readability)
        if (currentTime - this.lastUIUpdate > 100) {
            updatePerformanceUI(this.perfDiv, this.profiler);
            this.lastUIUpdate = currentTime;
        }
    }
}