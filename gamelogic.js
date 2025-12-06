import { GLOBALS } from './globals.js';
import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

export class GameLogic {
    constructor(floorManager, sphereManager) {
        this.floorManager = floorManager;
        this.sphereManager = sphereManager;
        this.currentFloorX = 0;
        this.floorCounts = 0;
        
        // Summon initial floor
        this.floorManager.createFloor(0, 0, 0); 
        
const outerSquare = [
    new THREE.Vector3(-10, -10, 0),
    new THREE.Vector3(-10, 10, 0),
    new THREE.Vector3(10, 10, 0),
    new THREE.Vector3(10, -10, 0)
];

const innerCircle = [];
for (let i = 0; i < 100; i++) {
    const angle = (i / 100) * Math.PI * 2;
    innerCircle.push(new THREE.Vector3(
        Math.cos(angle) * 5,
        Math.sin(angle) * 5,
        0
    ));
}

floorManager.createCustomShape(
    0, 0, 0,
    outerSquare,
    [innerCircle],
    t => 0,       // straight path
    t => 0,            // flat
    t => t*30,
    t => 0,
    t => 0,
    t => 0,
    0, 2, 100
);
    }

    update() {
    }
}