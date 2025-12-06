import { GLOBALS } from './globals.js';
import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

export class GameLogic {
    constructor(floorManager, sphereManager) {
        this.floorManager = floorManager;
        this.sphereManager = sphereManager;
        this.currentFloorX = 0;
        this.floorCounts = 0;
        
        // Summon initial floor
        //this.floorManager.createFloor(0, 0, 0);
        
        // Example: Create a sine wave floor
        let a = 1; 
        let b = 5;
        const quadPoints = [
            new THREE.Vector3(-5/a, 0, -5/b),
            new THREE.Vector3(-5/a, 0, 5/b),
            new THREE.Vector3(5/a, 0, 5/b),
            new THREE.Vector3(5/a, 0, -5/b)
        ];
        
        a = this.floorManager.createCustomFloor(
            0, -3, 0,  // position offset
            quadPoints,
            t => t*10,           // funcX: linear progression
            t => Math.pow(t, 4),  // funcY: quadratic progression
            t => 0,                // funcZ: no z offset
            -2.3, 2.3, 1000               // a=0, b=1, t=50 steps
        );
    }

    update() {
    }
}