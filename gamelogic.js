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
        this.displace =-Math.sin(
            ((Math.PI*2)/360)*10
        )*16;
    }

    update() {
        let offset = -Math.sin(
            ((Math.PI*2)/360)*10
        )*19;
        if (GLOBALS.player.PhysicsObject.position.x > this.floorCounts * 5) {
            this.floorCounts++;
            this.floorManager.createFloor(
                this.floorCounts * 5,
                0+this.displace,
                0,
                10,
                1,
                10,
                0,
                0,
                -10
            )
            this.displace=offset + this.displace;
            //console.log(displace);
        }
    }
}