import { createScene, setupLighting, setupResizeHandler } from './scene.js';
import { FloorManager } from './floor.js';
import { SphereManager } from './sphere.js';
import { InputHandler } from './input.js';
import { CameraController } from './camera.js';
import { Game } from './game.js';
import { PostProcessing } from './postprocessing.js';

// Initialize
const canvas = document.getElementById("scene");
const { renderer, scene, camera } = createScene(canvas);
const sunlight = setupLighting(scene);

// Create post-processing
const postProcessing = new PostProcessing(renderer);

// Update resize handler to include post-processing
window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    postProcessing.resize(window.innerWidth, window.innerHeight);
});

// Create managers
const floorManager = new FloorManager(scene);
const sphereManager = new SphereManager(scene);
const inputHandler = new InputHandler();
const cameraController = new CameraController(camera);

// Setup game objects
floorManager.createInitialFloor();
sphereManager.createSpheres();

// Create game instance
// Create game instance - pass sunlight as the last parameter
const game = new Game(scene, floorManager, sphereManager, inputHandler, cameraController, sunlight);
// Animation loop
function animate(time) {
    const currentTime = performance.now();
    game.update(currentTime);
    postProcessing.render(scene, camera, time);
    requestAnimationFrame(animate);
}

animate(0);