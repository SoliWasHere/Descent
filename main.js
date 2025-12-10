import { createScene, setupLighting, setupResizeHandler } from './scene.js';
import { FloorManager } from './objects.js';
import { SphereManager } from './objects.js';
import { InputHandler } from './input.js';
import { CameraController } from './camera.js';
import { Setup } from './setup.js';
import { GameLogic } from './gamelogic.js';
import { PostProcessing } from './postprocessing.js';
import { GLOBALS } from './globals.js';

/*
// Import BufferGeometryUtils for merging geometries
import { BufferGeometryUtils } from 'https://unpkg.com/three@0.181.0/examples/jsm/utils/BufferGeometryUtils.js';

// Make it available on THREE
THREE.BufferGeometryUtils = BufferGeometryUtils;
*/

// FPS display
const fpsElement = document.getElementById("FPS");
let lastFPSUpdate = 0;
let frameCount = 0;
let currentFPS = 0;

// Main startup wrapped so we can delay animation start
function startGame() {
	// Initialize
	const canvas = document.getElementById("scene");
	const { renderer, scene, camera } = createScene(canvas);

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

	// Create game logic instance
	const gameLogic = new GameLogic(floorManager, sphereManager);
	GLOBALS.gameLogic = gameLogic;

	// Create physics engine instance
	const game = new Setup(scene, floorManager, sphereManager, inputHandler, cameraController, sunlight);
	GLOBALS.game = game;

	let timeOffset = 0;
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
			GLOBALS.time = currentTime;
		}

		postProcessing.render(scene, camera, time);

		// FPS calculation
		frameCount++;
		if (time - lastFPSUpdate >= 1000) {
			currentFPS = frameCount;
			frameCount = 0;
			lastFPSUpdate = time;

			if (fpsElement) {
				fpsElement.textContent = currentFPS.toFixed(0) + " FPS";
			}
		}

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

	// Start animation loop AFTER everything is loaded
	requestAnimationFrame(animate);
}

// Delay start until page fully loaded
window.onload = () => {
	startGame();
};
