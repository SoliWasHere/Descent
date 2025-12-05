import { GLOBALS } from './globals.js';
//gamelogic.js


export class GameLogic {
    constructor(floorManager, sphereManager) {
        this.floorManager = floorManager;
        this.sphereManager = sphereManager;
        this.currentFloorX = 0;
        this.floorCounts = 0;
        
        // Summon a cube at 0,0,0 of size 10
        this.floorManager.createFloor(0, 0, 0);
    }

    update() {
        //console.log(GLOBALS.player.PhysicsObject.position.x);
        if (GLOBALS.player.PhysicsObject.position.x > this.currentFloorX + 5) {
            this.currentFloorX += 5;
            if (this.floorCounts % 5 === 0 && this.floorCounts !== 0) {
                // Create a tilted floor every 5 floors
                const angle = Math.PI/2  /4 ; // Random angle between -0.2 and 0.2 radians
                this.floorManager.createFloor(this.currentFloorX, 0, 0,
                    10, 1, 10,
                    0, 0, angle
                );
            } else {
                // Create a normal floor
                this.floorManager.createFloor(this.currentFloorX, 0, 0,
                    10, 1, 10,
                    0, 0, 0
                );
            }
            this.floorCounts++;
            // Do something when the player's x position is greater than 5
        }
    }
}