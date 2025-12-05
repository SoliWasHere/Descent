import * as THREE from "https://unpkg.com/three@0.181.0/build/three.module.js";
import { CONFIG } from "./config.js";

export function createScene(canvas) {
	// Renderer
	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: true,
	});
	renderer.setSize(window.innerWidth, window.innerHeight);

	if (CONFIG.isLighted) {
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.BasicShadowMap;
		//renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
	}
	// Scene
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x1d1e2c);

	// Camera
	const camera = new THREE.PerspectiveCamera(
		50,
		window.innerWidth / window.innerHeight,
		0.1,
		10000,
	);
	camera.position.set(-100, 0, -100);
	camera.lookAt(0, 0, 0);

	return {
		renderer,
		scene,
		camera,
	};
}

export function setupLighting(scene) {
	if (!CONFIG.isLighted) {
		const ambientLight = new THREE.AmbientLight(0xffffff, 15);
		scene.add(ambientLight);
	}

	if (CONFIG.isLighted) {
		const sunLight = new THREE.DirectionalLight(0xffffff, 4);
		sunLight.position.set(50, 100, 50); // Position light at an angle
		sunLight.castShadow = true; // Enable shadows!

		// Configure shadow camera to cover a larger area
		const shadowSize = CONFIG.shadowSize; // Adjust based on your scene size
		sunLight.shadow.camera.left = -shadowSize;
		sunLight.shadow.camera.right = shadowSize;
		sunLight.shadow.camera.top = shadowSize;
		sunLight.shadow.camera.bottom = -shadowSize;
		sunLight.shadow.camera.near = 0.5;
		sunLight.shadow.camera.far = 500;

		// Higher resolution shadows
		sunLight.shadow.mapSize.width = 2048;
		sunLight.shadow.mapSize.height = 2048;
		sunLight.shadow.bias = -0.0001; // Reduce shadow acne

		scene.add(sunLight);
		return sunLight;
	}
}

export function setupResizeHandler(renderer, camera) {
	window.addEventListener("resize", () => {
		renderer.setSize(window.innerWidth, window.innerHeight);
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
	});
}

export function updateShadowPosition(
	light,
	caster,
	height = 15,
	shadowSize = 20,
	angle = {
		x: 1,
		z: 1,
	},
) {
	// Normalize the angle vector
	const length = Math.sqrt(angle.x * angle.x + angle.z * angle.z);
	const nx = angle.x / length;
	const nz = angle.z / length;

	// Position the light above the object at an angle
	light.position.set(
		caster.position.x + nx * height,
		caster.position.y + height,
		caster.position.z + nz * height,
	);

	// Aim the light at the object
	light.target.position.set(
		caster.position.x,
		caster.position.y,
		caster.position.z,
	);
	light.target.updateMatrixWorld();

	// Use shadowSize from CONFIG if available
	shadowSize = CONFIG.shadowSize || shadowSize;

	// Adjust shadow camera
	light.shadow.camera.left = -shadowSize;
	light.shadow.camera.right = shadowSize;
	light.shadow.camera.top = shadowSize;
	light.shadow.camera.bottom = -shadowSize;
	light.shadow.camera.near = 0.5;
	light.shadow.camera.far = 50;

	// High resolution
	light.shadow.mapSize.width = Math.pow(2, 9) + 1;
	light.shadow.mapSize.height = Math.pow(2, 9) + 1;

	light.shadow.camera.updateProjectionMatrix();
}
