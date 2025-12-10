import { GLOBALS } from './globals.js';
import { FloorNode, FloorTree } from './floornode.js';
import { PhysicsObject } from './physics.js';
import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

export class GameLogic {
    constructor(floorManager, sphereManager) {
        this.floorManager = floorManager;
        this.sphereManager = sphereManager;
        
        this.floorTree = new FloorTree();
        this.branches = [];  // Track all active branch endpoints
        this.floorCount = 0;
        
        this.lookahead = 10;
        this.branchInterval = 15; // Create branch every N floors
        
        // Merge settings
        this.mergeDistance = 50; // Merge floors within this distance
        this.lastMergeX = 0;
        
        this.initializeFloors();
    }
    
    initializeFloors() {
        // Create root floor
        const rootFloor = this.floorManager.createFloor(
            5, 0, 0,
            10, 1, 10,
            0, 0, 0
        );
        
        this.currentNode = new FloorNode(rootFloor, null);
        this.currentNode.localLength = 10;
        
        this.floorTree.setRoot(this.currentNode);
        this.floorTree.addNode(this.currentNode);
        
        // Main branch starts here
        this.branches.push(this.currentNode);
        
        // Generate initial floors
        for (let i = 0; i < this.lookahead; i++) {
            this.generateNextFloor();
        }
    }
    
    generateNextFloor() {
        this.floorCount++;
        
        // Randomly pick a branch to extend
        const branchIndex = Math.floor(Math.random() * this.branches.length);
        let currentBranch = this.branches[branchIndex];
        
        // Main path pattern
        let length = 10;
        let offsetY = -1.5;
        let rotZ = -0.15;
        
        // Every N floors, create a branching point
        if (this.floorCount % this.branchInterval === 0 && this.branches.length < 3) {
            // Create main continuation
            const mainNode = currentBranch.createNext(
                this.floorManager,
                length,
                offsetY,
                rotZ,
                10, 10
            );
            this.floorTree.addNode(mainNode);
            
            // Create left branch - goes up and left
            const leftNode = currentBranch.createNext(
                this.floorManager,
                length,
                2,  // Go up
                0.3, // Turn left
                10, 10
            );
            leftNode.localPosition.z = -8; // Shift left in Z
            leftNode.updateFloorTransform();
            this.floorTree.addNode(leftNode);
            this.branches.push(leftNode);
            
            // Create right branch - goes down and right
            const rightNode = currentBranch.createNext(
                this.floorManager,
                length,
                -3, // Go down
                -0.3, // Turn right
                10, 10
            );
            rightNode.localPosition.z = 8; // Shift right in Z
            rightNode.updateFloorTransform();
            this.floorTree.addNode(rightNode);
            this.branches.push(rightNode);
            
            // Update the branch reference
            this.branches[branchIndex] = mainNode;
            
            console.log(`🌿 Created branch point! Total branches: ${this.branches.length}`);
        } else {
            // Normal floor generation
            const newNode = currentBranch.createNext(
                this.floorManager,
                length,
                offsetY,
                rotZ,
                10, 10
            );
            this.floorTree.addNode(newNode);
            
            // Update the branch endpoint
            this.branches[branchIndex] = newNode;
        }
        
        // Merge floors periodically
        if (this.floorCount % 10 === 0) {
            const playerX = GLOBALS.player?.PhysicsObject?.position.x || 0;
            if (playerX - this.lastMergeX > this.mergeDistance) {
                this.mergeNearbyFloors(playerX);
                this.lastMergeX = playerX;
            }
        }
    }
    
    /**
     * Merge continuous floors into single meshes
     */
    mergeNearbyFloors(referenceX) {
        // Find floors in merge window
        const mergeStart = referenceX - this.mergeDistance;
        const mergeEnd = referenceX + this.mergeDistance * 2;
        
        const floorsToMerge = this.floorManager.floors.filter(floor => {
            const x = floor.position.x;
            return x >= mergeStart && x < mergeEnd && floor.mesh.parent; // Still in scene
        });
        
        if (floorsToMerge.length < 3) return; // Need at least 3 to merge
        
        console.log(`🔨 Merging ${floorsToMerge.length} floors...`);
        
        // Group by approximate Y position (same "level")
        const levels = new Map();
        const tolerance = 5;
        
        for (const floor of floorsToMerge) {
            const y = Math.round(floor.position.y / tolerance) * tolerance;
            if (!levels.has(y)) {
                levels.set(y, []);
            }
            levels.get(y).push(floor);
        }
        
        // Merge each level
        for (const [level, floors] of levels) {
            if (floors.length < 2) continue;
            
            this.mergeLevelFloors(floors);
        }
    }
    
    /**
     * Merge floors at the same level into one mesh
     */
    mergeLevelFloors(floors) {
        // Collect geometries with transforms applied
        const geometries = [];
        
        for (const floor of floors) {
            if (!floor.mesh || !floor.mesh.geometry) continue;
            
            const geom = floor.mesh.geometry.clone();
            floor.mesh.updateMatrixWorld(true);
            geom.applyMatrix4(floor.mesh.matrixWorld);
            geometries.push(geom);
        }
        
        if (geometries.length < 2) return;
        
        // Check if BufferGeometryUtils is available
        if (!THREE.BufferGeometryUtils) {
            console.warn('BufferGeometryUtils not available, skipping merge');
            return;
        }
        
        try {
            // Merge all geometries
            const mergedGeometry = THREE.BufferGeometryUtils.mergeGeometries(geometries, false);
            
            if (!mergedGeometry) {
                console.warn('Merge failed, skipping');
                return;
            }
            
            // Create merged floor as PhysicsObject
            const material = new THREE.MeshStandardMaterial({
                color: 0xFFFFFF,
                roughness: 0.8,
                flatShading: true,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 4
            });
            
            const mergedMesh = new THREE.Mesh(mergedGeometry, material);
            mergedMesh.receiveShadow = true;
            mergedMesh.castShadow = true;
            
            // Import PhysicsObject
            
            const mergedFloor = new PhysicsObject(
                mergedGeometry,
                material,
                0, // mass = 0 (static)
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 0)
            );
            
            mergedFloor.mesh = mergedMesh;
            mergedFloor.friction = 1;
            mergedFloor.restitution = 1;
            mergedFloor.mesh.receiveShadow = true;
            
            // Build collision mesh
            mergedFloor.buildTriangleMesh();
            
            // Add to scene
            this.floorManager.scene.add(mergedMesh);
            
            // Remove old floors
            for (const floor of floors) {
                this.floorManager.scene.remove(floor.mesh);
                const index = this.floorManager.floors.indexOf(floor);
                if (index > -1) {
                    this.floorManager.floors.splice(index, 1);
                }
                
                // Clean up geometry
                if (floor.mesh.geometry) floor.mesh.geometry.dispose();
                if (floor.mesh.material) floor.mesh.material.dispose();
            }
            
            // Add merged floor to manager
            this.floorManager.floors.push(mergedFloor);
            this.floorManager.needsRebuild = true;
            
            console.log(`✅ Merged ${floors.length} floors into 1`);
            
        } catch (error) {
            console.error('Error merging floors:', error);
        }
    }
    
    update() {
        const playerX = GLOBALS.player.PhysicsObject.position.x;
        
        // Find furthest branch endpoint
        let maxX = -Infinity;
        for (const branch of this.branches) {
            const endPos = branch.getWorldEndPosition();
            if (endPos.x > maxX) {
                maxX = endPos.x;
            }
        }
        
        const distanceToEnd = maxX - playerX;
        const minLookaheadDistance = this.lookahead * 10;
        
        // Generate more floors if needed
        while (distanceToEnd < minLookaheadDistance) {
            this.generateNextFloor();
        }
        
        // Clean up distant floors
        if (this.floorCount % 50 === 0) {
            const playerPos = GLOBALS.player.PhysicsObject.position;
            const removed = this.floorTree.pruneDistantNodes(
                playerPos,
                150,
                this.floorManager
            );
            
            if (removed > 0) {
                console.log(`🧹 Cleaned up ${removed} distant floors`);
            }
        }
    }
}

// ============================================
// Alternative: Simple branching without FloorNode
// ============================================

export class SimpleBranchingGameLogic {
    constructor(floorManager, sphereManager) {
        this.floorManager = floorManager;
        this.sphereManager = sphereManager;
        
        this.mainPath = { x: 0, y: 0, count: 0 };
        this.branches = []; // { x, y, z, count, direction }
        
        this.lookahead = 10;
        
        this.initialize();
    }
    
    initialize() {
        // Create initial floor
        this.floorManager.createFloor(0, 0, 0, 10, 1, 10);
        
        for (let i = 0; i < this.lookahead; i++) {
            this.generateNext();
        }
    }
    
    generateNext() {
        this.mainPath.count++;
        
        // Main path continues downward
        const degrees = 10;
        const rad = degrees * (Math.PI / 180);
        const drop = -Math.tan(rad) * 10;
        
        this.mainPath.y += drop;
        this.mainPath.x += 10;
        
        this.floorManager.createFloor(
            this.mainPath.x,
            this.mainPath.y,
            0,
            10, 1, 10,
            0, 0, -rad
        );
        
        // Create branch every 15 floors
        if (this.mainPath.count % 15 === 0 && this.branches.length < 3) {
            // Left branch
            this.branches.push({
                x: this.mainPath.x,
                y: this.mainPath.y,
                z: -15,
                count: 0,
                direction: 'left'
            });
            
            // Right branch  
            this.branches.push({
                x: this.mainPath.x,
                y: this.mainPath.y,
                z: 15,
                count: 0,
                direction: 'right'
            });
            
            console.log(`🌿 Created branches! Total: ${this.branches.length}`);
        }
        
        // Extend each branch
        for (const branch of this.branches) {
            if (branch.count < 5) { // Each branch gets 5 floors
                branch.count++;
                branch.x += 10;
                branch.y += branch.direction === 'left' ? 1 : -2;
                
                const branchRot = branch.direction === 'left' ? 0.1 : -0.2;
                
                this.floorManager.createFloor(
                    branch.x,
                    branch.y,
                    branch.z,
                    10, 1, 10,
                    0, 0, branchRot
                );
            }
        }
    }
    
    update() {
        const playerX = GLOBALS.player.PhysicsObject.position.x;
        const targetCount = Math.floor(playerX / 10) + this.lookahead;
        
        while (this.mainPath.count < targetCount) {
            this.generateNext();
        }
    }
}