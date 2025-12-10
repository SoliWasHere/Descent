import { GLOBALS } from './globals.js';
import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

export class GameLogic {
    constructor(floorManager, sphereManager) {
        this.floorManager = floorManager;
        this.sphereManager = sphereManager;
        this.floorCounts = 0;
        this.degrees = 10; // slope angle in degrees
        this.floorWidth = 10; // width of each floor along x
        this.displace = 0; // initial y offset
        this.lookahead = 10; // number of floors to generate ahead
        
        // Summon initial floor
        this.floorManager.createFloor(0, 0, 0, this.floorWidth, 1, 10);
        
        // Generate initial lookahead floors
        for (let i = 0; i < this.lookahead; i++) {
            this.generateNextFloor();
        }
    }
    
    generateNextFloor() {
        this.floorCounts++;
            
            let floor = this.floorManager.createFloor(
                this.floorCounts * this.floorWidth, // x
                0,                       // y
                0,                                   // z
                this.floorWidth + 0.155,            // width
                1,                                   // height
                10,                                  // depth
                0,                                   // rotationX
                0,                                   // rotationY
                0                     // rotationZ
            );
            floor.rotateY(-GLOBALS.time / 10000);
            //floor.rotateZ(-GLOBALS.time / 10000);
    }
    
    update() {
        const playerX = GLOBALS.player.PhysicsObject.position.x;
        const targetFloorCount = Math.floor(playerX / this.floorWidth) + this.lookahead;
        
        // Generate floors until we're lookahead steps ahead
        while (this.floorCounts < targetFloorCount) {
            this.generateNextFloor();
        }
    }
}