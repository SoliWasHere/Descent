import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';
import { CONFIG } from './config.js';

export function createScene(canvas) {
    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    if (!CONFIG.isLighted) {
        renderer.shadowMap.enabled = false; // disable shadows globally
    }
    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1d1e2c);

    // Camera
    const camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth / window.innerHeight,
        0.1,
        10000
    );
    camera.position.set(-100, 0, -100);
    camera.lookAt(0, 0, 0);

    return { renderer, scene, camera };
}

export function setupLighting(scene) {
    // Always add base ambient light so objects are visible
    if (!CONFIG.isLighted) {
    const ambientLight = new THREE.AmbientLight(0xffffff, 15);
    scene.add(ambientLight);
    }

    // Add directional light only if CONFIG.isLighted is true
    if (CONFIG.isLighted) {
        const sunLight = new THREE.DirectionalLight(0xffffff, 4);
        sunLight.position.set(0, 15, 0); // top sunlight
        sunLight.castShadow = false;
        scene.add(sunLight);
    }
}
 


export function setupResizeHandler(renderer, camera) {
    window.addEventListener("resize", () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });
}
