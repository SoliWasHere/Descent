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

        // Summon initial floor
        this.floorManager.createFloor(0, 0, 0, this.floorWidth, 1, 10);
    }

    update() {
        const playerX = GLOBALS.player.PhysicsObject.position.x;

        if (playerX > this.floorCounts * this.floorWidth) {
            this.floorCounts++;
            if (! (this.floorCounts%10 == 0) ) {

                // Convert degrees to radians
                const rad = this.degrees * (Math.PI / 180);

                // Calculate y offset so the next floor connects seamlessly
                const offset = -Math.tan(rad) * this.floorWidth;
                this.displace += offset;
                const rotation = this.degrees * (Math.PI / 180);

                this.floorManager.createFloor(
                    this.floorCounts * this.floorWidth, // x
                    this.displace,                       // y
                    0,                                   // z
                    this.floorWidth+0.155,                     // width
                    1,                                   // height
                    10,                                  // depth
                    0,                                   // rotationX
                    0,                                   // rotationY
                    -rotation + 0.00                   // rotationZ (example)
                );
            } else {
                // Convert degrees to radians
                const rad = this.degrees * (Math.PI / 180);

                // Calculate y offset so the next floor connects seamlessly
                
                const offset = -Math.tan(rad) * this.floorWidth;
                const rotation = 40 * (Math.PI / 180);

                this.floorManager.createFloor(
                    this.floorCounts * this.floorWidth, // x
                    this.displace,                       // y
                    0,                                   // z
                    this.floorWidth+0.155,                     // width
                    1,                                   // height
                    10,                                  // depth
                    0,                                   // rotationX
                    0,                                   // rotationY
                    rotation + 0.00                   // rotationZ (example)
                );
                this.displace += offset;
            }
        }
    }
}
