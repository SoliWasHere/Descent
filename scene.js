import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';
import { CONFIG } from './config.js';

export function createScene(canvas) {
    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

   if (CONFIG.isLighted) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.VSMShadowMap;
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
    if (!CONFIG.isLighted) {
        const ambientLight = new THREE.AmbientLight(0xffffff, 15);
        scene.add(ambientLight);
        return null;
    }

    if (CONFIG.isLighted) {
        // Main directional sunlight - FIXED: doesn't move, always lights everything
        const sunLight = new THREE.DirectionalLight(0xffffff, 3);
        sunLight.position.set(100, 150, 100);
        sunLight.castShadow = true;
        
        // Make shadow frustum MUCH larger to cover whole scene
        const shadowSize = 100; // Increased from 30
        sunLight.shadow.camera.left = -shadowSize;
        sunLight.shadow.camera.right = shadowSize;
        sunLight.shadow.camera.top = shadowSize;
        sunLight.shadow.camera.bottom = -shadowSize;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 1000; // Increased from 500
        
        sunLight.shadow.mapSize.width = 2048; // Increased for better quality
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.bias = -0.0001;
        sunLight.shadow.normalBias = 0.02;
        
        scene.add(sunLight);
        
        // Add strong ambient light so everything has base illumination
        const ambientLight = new THREE.AmbientLight(0x606080, 1.2);
        scene.add(ambientLight);
        
        // Add hemisphere light for natural sky/ground lighting
        const hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0x404040, 0.8);
        scene.add(hemiLight);
        
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

export function updateShadowPosition(light, caster, height = 15, shadowSize = 20, angle = { x: 1, z: 1 }) {
    // Only update target, not light position (light stays stationary now)
    light.target.position.set(caster.position.x, caster.position.y, caster.position.z);
    light.target.updateMatrixWorld();
}