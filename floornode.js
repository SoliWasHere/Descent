import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

/**
 * FloorNode - Relative coordinate system with anchor inheritance
 * Each node has its own local coordinate frame that's relative to its parent
 */
export class FloorNode {
    constructor(floorObject = null, parent = null) {
        this.floor = floorObject;      // Reference to PhysicsObject floor
        this.parent = parent;          // Parent FloorNode
        this.children = [];            // Child FloorNodes
        
        // LOCAL coordinate frame (relative to parent)
        this.localPosition = new THREE.Vector3(0, 0, 0);
        this.localRotation = new THREE.Euler(0, 0, 0);
        this.localLength = 10; // Length of this segment
        
        // ANCHORS - these stay constant even when parent transforms change
        this.anchoredRotationX = null; // If set, X rotation stays constant in world space
        this.anchoredRotationY = null; // If set, Y rotation stays constant in world space
        this.anchoredRotationZ = null; // If set, Z rotation stays constant in world space
        
        // Cache for world transform (computed as needed)
        this._worldPositionCache = null;
        this._worldRotationCache = null;
        this._cacheValid = false;
        
        if (parent) {
            parent.addChild(this);
        }
    }
    
    /**
     * Add a child node
     */
    addChild(childNode) {
        if (!this.children.includes(childNode)) {
            this.children.push(childNode);
            childNode.parent = this;
            childNode.invalidateCache();
        }
    }
    
    /**
     * Remove a child node
     */
    removeChild(childNode) {
        const index = this.children.indexOf(childNode);
        if (index > -1) {
            this.children.splice(index, 1);
            childNode.parent = null;
        }
    }
    
    /**
     * Invalidate world transform cache (call when local transform changes)
     */
    invalidateCache() {
        this._cacheValid = false;
        // Recursively invalidate children
        for (const child of this.children) {
            child.invalidateCache();
        }
    }
    
    /**
     * Get world position (computed from parent chain)
     */
    getWorldPosition() {
        if (this._cacheValid && this._worldPositionCache) {
            return this._worldPositionCache.clone();
        }
        
        if (!this.parent) {
            this._worldPositionCache = this.localPosition.clone();
        } else {
            const parentPos = this.parent.getWorldPosition();
            const parentRot = this.parent.getWorldRotation();
            
            // Rotate local position by parent's rotation, then add to parent position
            const rotatedLocal = this.localPosition.clone().applyEuler(parentRot);
            this._worldPositionCache = parentPos.add(rotatedLocal);
        }
        
        this._cacheValid = true;
        return this._worldPositionCache.clone();
    }
    
    /**
     * Get world rotation (with anchor support)
     */
    getWorldRotation() {
        if (this._cacheValid && this._worldRotationCache) {
            return this._worldRotationCache.clone();
        }
        
        let worldRot = new THREE.Euler(0, 0, 0);
        
        if (this.parent) {
            const parentRot = this.parent.getWorldRotation();
            worldRot.x = parentRot.x + this.localRotation.x;
            worldRot.y = parentRot.y + this.localRotation.y;
            worldRot.z = parentRot.z + this.localRotation.z;
        } else {
            worldRot.copy(this.localRotation);
        }
        
        // Apply anchors - override with constant world values
        if (this.anchoredRotationX !== null) worldRot.x = this.anchoredRotationX;
        if (this.anchoredRotationY !== null) worldRot.y = this.anchoredRotationY;
        if (this.anchoredRotationZ !== null) worldRot.z = this.anchoredRotationZ;
        
        this._worldRotationCache = worldRot;
        return worldRot.clone();
    }
    
    /**
     * Get end position in world space
     */
    getWorldEndPosition() {
        const worldPos = this.getWorldPosition();
        const worldRot = this.getWorldRotation();
        
        // End is localLength units along local X axis
        const localEnd = new THREE.Vector3(this.localLength, 0, 0);
        const rotatedEnd = localEnd.applyEuler(worldRot);
        
        return worldPos.add(rotatedEnd);
    }
    
    /**
     * Set local transform relative to parent
     */
    setLocal(position = null, rotation = null, length = null) {
        if (position) {
            this.localPosition.copy(position);
        }
        if (rotation) {
            if (rotation instanceof THREE.Euler) {
                this.localRotation.copy(rotation);
            } else {
                // Assume {x, y, z} object
                this.localRotation.set(
                    rotation.x || 0,
                    rotation.y || 0,
                    rotation.z || 0
                );
            }
        }
        if (length !== null) {
            this.localLength = length;
        }
        this.invalidateCache();
        return this;
    }
    
    /**
     * Set anchored rotation axes (in radians)
     * These rotations stay constant in world space
     */
    setAnchors(rotX = null, rotY = null, rotZ = null) {
        this.anchoredRotationX = rotX;
        this.anchoredRotationY = rotY;
        this.anchoredRotationZ = rotZ;
        this.invalidateCache();
        return this;
    }
    
    /**
     * Add rotation to local rotation (in radians)
     */
    rotate(x = 0, y = 0, z = 0) {
        this.localRotation.x += x;
        this.localRotation.y += y;
        this.localRotation.z += z;
        this.invalidateCache();
        return this;
    }
    
    /**
     * Translate in local space
     */
    translate(x = 0, y = 0, z = 0) {
        this.localPosition.x += x;
        this.localPosition.y += y;
        this.localPosition.z += z;
        this.invalidateCache();
        return this;
    }
    
    /**
     * Create next floor segment (at end of this one)
     * Returns a new FloorNode with its start at this node's end
     */
    createNext(floorManager, length = 10, offsetY = 0, rotZ = 0, width = 10, depth = 10) {
        const nextNode = new FloorNode(null, this);
        
        // Position at end of current segment
        nextNode.localPosition.set(this.localLength, offsetY, 0);
        nextNode.localRotation.set(0, 0, rotZ);
        nextNode.localLength = length;
        
        // Create floor geometry in world space
        const startWorld = this.getWorldEndPosition();
        const worldRot = nextNode.getWorldRotation();
        
        // Calculate midpoint for floor placement
        const midLocal = new THREE.Vector3(length / 2, 0, 0);
        const midRotated = midLocal.applyEuler(worldRot);
        const midWorld = startWorld.clone().add(midRotated);
        
        // Create the floor
        const floor = floorManager.createFloor(
            midWorld.x,
            midWorld.y,
            midWorld.z,
            length,  // width
            1,       // height
            depth,   // depth
            worldRot.x,
            worldRot.y,
            worldRot.z
        );
        
        nextNode.floor = floor;
        return nextNode;
    }
    
    /**
     * Update floor geometry to match current world transform
     */
    updateFloorTransform() {
        if (!this.floor) return;
        
        const startWorld = this.parent ? this.parent.getWorldEndPosition() : this.getWorldPosition();
        const worldRot = this.getWorldRotation();
        
        // Calculate midpoint
        const midLocal = new THREE.Vector3(this.localLength / 2, 0, 0);
        const midRotated = midLocal.applyEuler(worldRot);
        const midWorld = startWorld.clone().add(midRotated);
        
        // Update mesh transform
        this.floor.mesh.position.copy(midWorld);
        this.floor.mesh.rotation.copy(worldRot);
        this.floor.mesh.updateMatrixWorld(true);
        
        // Update physics object position
        this.floor.position.copy(midWorld);
        
        // Rebuild collision mesh
        this.floor.rebuildCollisionMesh();
    }
    
    /**
     * Recursively update all floor transforms in subtree
     */
    updateAllFloorTransforms() {
        this.updateFloorTransform();
        for (const child of this.children) {
            child.updateAllFloorTransforms();
        }
    }
    
    /**
     * Get depth in tree (root = 0)
     */
    getDepth() {
        let depth = 0;
        let current = this.parent;
        while (current) {
            depth++;
            current = current.parent;
        }
        return depth;
    }
    
    /**
     * Check if this is a leaf node
     */
    isLeaf() {
        return this.children.length === 0;
    }
    
    /**
     * Get all descendants
     */
    getAllDescendants() {
        const descendants = [];
        const stack = [...this.children];
        
        while (stack.length > 0) {
            const node = stack.pop();
            descendants.push(node);
            stack.push(...node.children);
        }
        
        return descendants;
    }
    
    /**
     * Debug: Add visual markers
     */
    addDebugMarkers(scene) {
        const startWorld = this.parent ? this.parent.getWorldEndPosition() : this.getWorldPosition();
        const endWorld = this.getWorldEndPosition();
        
        // Start marker (green)
        const startGeom = new THREE.SphereGeometry(0.5);
        const startMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const startMarker = new THREE.Mesh(startGeom, startMat);
        startMarker.position.copy(startWorld);
        scene.add(startMarker);
        
        // End marker (red)
        const endGeom = new THREE.SphereGeometry(0.5);
        const endMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const endMarker = new THREE.Mesh(endGeom, endMat);
        endMarker.position.copy(endWorld);
        scene.add(endMarker);
        
        // Connection line
        const lineGeom = new THREE.BufferGeometry().setFromPoints([startWorld, endWorld]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 2 });
        const line = new THREE.Line(lineGeom, lineMat);
        scene.add(line);
    }
}

/**
 * FloorTree - Manages the tree of floors
 */
export class FloorTree {
    constructor() {
        this.root = null;
        this.allNodes = [];
    }
    
    setRoot(node) {
        this.root = node;
        this.allNodes = [node];
    }
    
    addNode(node) {
        if (!this.allNodes.includes(node)) {
            this.allNodes.push(node);
        }
    }
    
    removeNode(node) {
        const index = this.allNodes.indexOf(node);
        if (index > -1) {
            this.allNodes.splice(index, 1);
        }
    }
    
    getLeafNodes() {
        return this.allNodes.filter(node => node.isLeaf());
    }
    
    getNodesAtDepth(depth) {
        return this.allNodes.filter(node => node.getDepth() === depth);
    }
    
    findNodeByFloor(floorObject) {
        return this.allNodes.find(node => node.floor === floorObject);
    }
    
    /**
     * Prune nodes beyond distance from reference point
     */
    pruneDistantNodes(referencePoint, maxDistance, floorManager) {
        const toRemove = [];
        
        for (const node of this.allNodes) {
            if (!node.floor) continue;
            
            const worldPos = node.getWorldPosition();
            const dist = worldPos.distanceTo(referencePoint);
            
            if (dist > maxDistance) {
                toRemove.push(node);
            }
        }
        
        // Remove nodes and their floors
        for (const node of toRemove) {
            if (node.parent) {
                node.parent.removeChild(node);
            }
            
            if (node.floor && floorManager) {
                floorManager.scene.remove(node.floor.mesh);
                const floorIndex = floorManager.floors.indexOf(node.floor);
                if (floorIndex > -1) {
                    floorManager.floors.splice(floorIndex, 1);
                }
            }
            
            this.removeNode(node);
        }
        
        if (toRemove.length > 0 && floorManager) {
            floorManager.needsRebuild = true;
        }
        
        return toRemove.length;
    }
}

export default FloorNode;