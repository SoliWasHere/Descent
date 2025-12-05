import {
    createScene,
    setupLighting,
    setupResizeHandler
} from './scene.js';
import {
    FloorManager
} from './floor.js';
import {
    SphereManager
} from './sphere.js';
import {
    InputHandler
} from './input.js';
import {
    CameraController
} from './camera.js';
import {
    Setup
} from './setup.js';
import {
    GameLogic
} from './gamelogic.js';
import {
    PostProcessing
} from './postprocessing.js';
import {
    GLOBALS
} from './globals.js';

// Initialize
const canvas = document.getElementById("scene");
const {
    renderer,
    scene,
    camera
} = createScene(canvas);
let isFocused = true;

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
const game = new Setup(scene, floorManager, sphereManager, inputHandler,
    cameraController, sunlight);
GLOBALS.game = game;

let timeOffset = 0; // Initialize to 0 instead of performance.now()
let lastTime = 0;
let isFirstFrame = true;

// Animation loop
function animate(time) {
    // Initialize timeOffset on first frame
    if (isFirstFrame) {
        timeOffset = time;
        isFirstFrame = false;
    }

    // Adjusted game time
    const currentTime = time - timeOffset;

    if (isFocused) {
        lastTime = currentTime; // store last valid time
        gameLogic.update();
        game.update(currentTime);
    }

    postProcessing.render(scene, camera, time);
    requestAnimationFrame(animate);
}

function pauseClock() {
    isFocused = false;
}

function resumeClock(currentRAFTime) {
    isFocused = true;
    // Re-align timeOffset so the game time does NOT jump
    timeOffset = currentRAFTime - lastTime;
}

window.addEventListener("blur", pauseClock);
window.addEventListener("focus", (e) => resumeClock(performance.now()));
document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseClock();
    else resumeClock(performance.now());
});

// Start animation loop - only call once!
requestAnimationFrame(animate);