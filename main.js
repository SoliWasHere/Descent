import { createScene, setupLighting, setupResizeHandler } from './scene.js';
import { FloorManager } from './floor.js';
import { SphereManager } from './sphere.js';
import { InputHandler } from './input.js';
import { CameraController } from './camera.js';
import { Setup } from './setup.js';
import { GameLogic } from './gamelogic.js';
import { PostProcessing } from './postprocessing.js';
import { GLOBALS } from './globals.js';

// Initialize
const canvas = document.getElementById("scene");
const { renderer, scene, camera } = createScene(canvas);
GLOBALS.renderer = renderer;
GLOBALS.scene = scene;
GLOBALS.camera = camera;

const sunlight = setupLighting(scene);
GLOBALS.sunlight = sunlight;

// Create post-processing
const postProcessing = new PostProcessing(renderer);
GLOBALS.postProcessing = postProcessing;

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

GLOBALS.floorManager = floorManager;
GLOBALS.sphereManager = sphereManager;
GLOBALS.inputHandler = inputHandler;
GLOBALS.cameraController = cameraController;

// Setup game objects
sphereManager.createSpheres();

// Create game logic instance (spawns the initial cube)
const gameLogic = new GameLogic(floorManager, sphereManager);
GLOBALS.gameLogic = gameLogic;

// Create game instance (physics engine)
const game = new Setup(scene, floorManager, sphereManager, inputHandler, cameraController, sunlight);
GLOBALS.game = game;

// Animation loop
function animate(time) {
    const currentTime = performance.now();
    
    // Update game logic
    gameLogic.update();
    
    // Update physics engine
    game.update(currentTime);
    
    postProcessing.render(scene, camera, time);
    requestAnimationFrame(animate);
}

animate(0);