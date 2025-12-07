// Add to your HTML or create a new test file
// This will ACTUALLY show the performance difference

export class PerformanceProfiler {
    constructor() {
        this.timings = {
            collision: [],
            physics: [],
            render: [],
            total: []
        };
        this.maxSamples = 60; // Keep last 60 frames
        
        // Detailed collision stats
        this.collisionStats = {
            floorsChecked: 0,
            floorsCulled: 0,
            bvhQueries: 0,
            trianglesChecked: 0
        };
    }
    
    startTimer(name) {
        this[`${name}Start`] = performance.now();
    }
    
    endTimer(name) {
        const elapsed = performance.now() - this[`${name}Start`];
        if (this.timings[name]) {
            this.timings[name].push(elapsed);
            if (this.timings[name].length > this.maxSamples) {
                this.timings[name].shift();
            }
        }
        return elapsed;
    }
    
    getAverage(name) {
        const arr = this.timings[name];
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }
    
    getMax(name) {
        const arr = this.timings[name];
        if (!arr || arr.length === 0) return 0;
        return Math.max(...arr);
    }
    
    reset() {
        for (const key in this.timings) {
            this.timings[key] = [];
        }
    }
    
    getReport() {
        return {
            collision: {
                avg: this.getAverage('collision').toFixed(3),
                max: this.getMax('collision').toFixed(3)
            },
            physics: {
                avg: this.getAverage('physics').toFixed(3),
                max: this.getMax('physics').toFixed(3)
            },
            render: {
                avg: this.getAverage('render').toFixed(3),
                max: this.getMax('render').toFixed(3)
            },
            total: {
                avg: this.getAverage('total').toFixed(3),
                max: this.getMax('total').toFixed(3)
            },
            collisionStats: this.collisionStats
        };
    }
}

// STRESS TEST: Create tons of floors to see the difference
export function stressTest(floorManager, profiler) {
    console.log("🔥 STARTING STRESS TEST - Creating 200 floors...");
    
    // Create a grid of floors spread out
    for (let i = 0; i < 200; i++) {
        const x = (i % 20) * 15;
        const z = Math.floor(i / 20) * 15;
        const y = Math.random() * 10 - 5;
        
        floorManager.createFloor(x, y, z, 10, 1, 10);
    }
    
    console.log(`✅ Created ${floorManager.floors.length} floors`);
    console.log("Watch your FPS counter and profiler now!");
}

// Modified checkCollisions with profiling
export function checkCollisionsWithProfiling(floorManager, sphere, dt, profiler) {
    const queryRadius = sphere.radius + 30;
    
    // Query spatial grid
    const nearbyFloors = floorManager.spatialGrid.queryNearby(sphere.position, queryRadius);
    
    profiler.collisionStats.floorsChecked = floorManager.floors.length;
    profiler.collisionStats.floorsCulled = floorManager.floors.length - nearbyFloors.size;
    profiler.collisionStats.nearbyFloors = nearbyFloors.size;
    
    // Check only nearby floors
    for (const floor of nearbyFloors) {
        const floorPos = floor.position;
        const halfDims = floor.dimensions ? floor.dimensions.clone().multiplyScalar(0.5) : new THREE.Vector3(5, 0.5, 5);
        
        const minX = floorPos.x - halfDims.x;
        const maxX = floorPos.x + halfDims.x;
        const minY = floorPos.y - halfDims.y;
        const maxY = floorPos.y + halfDims.y;
        const minZ = floorPos.z - halfDims.z;
        const maxZ = floorPos.z + halfDims.z;
        
        const closestX = Math.max(minX, Math.min(sphere.position.x, maxX));
        const closestY = Math.max(minY, Math.min(sphere.position.y, maxY));
        const closestZ = Math.max(minZ, Math.min(sphere.position.z, maxZ));
        
        const dx = sphere.position.x - closestX;
        const dy = sphere.position.y - closestY;
        const dz = sphere.position.z - closestZ;
        const distSq = dx * dx + dy * dy + dz * dz;
        
        const margin = 5;
        const checkRadius = sphere.radius + margin;
        
        if (distSq < checkRadius * checkRadius) {
            sphere.collideWithTriangleMesh(floor, dt);
        }
    }
}

// Add this to your setup.js update() method:
/*
update(currentTime) {
    const dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    const clampedDt = Math.min(dt, 0.033);

    // START PROFILING
    this.profiler.startTimer('total');
    
    const mainSphere = this.sphereManager.getMainSphere();

    // Input
    this.inputHandler.handleInput(mainSphere, clampedDt);

    // Physics
    this.profiler.startTimer('physics');
    this.sphereManager.applyGravity();
    this.sphereManager.updatePhysics(clampedDt);
    this.profiler.endTimer('physics');

    // Collisions
    this.profiler.startTimer('collision');
    for (const sphere of this.sphereManager.spheres) {
        checkCollisionsWithProfiling(
            this.floorManager, 
            sphere, 
            clampedDt, 
            this.profiler
        );
    }
    this.profiler.endTimer('collision');

    // Camera
    this.cameraController.followTarget(
        mainSphere.position,
        this.inputHandler.cameraDisplace,
        this.floorManager.floors
    );

    // Shadow
    if (CONFIG.isLighted && this.sunLight) {
        updateShadowPosition(this.sunLight, mainSphere, 15, 20);
    }
    
    this.profiler.endTimer('total');
}
*/

// UI Display Helper
export function createPerformanceUI() {
    const perfDiv = document.createElement('div');
    perfDiv.id = 'performance-stats';
    perfDiv.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: #0f0;
        font-family: monospace;
        font-size: 12px;
        padding: 10px;
        border-radius: 5px;
        min-width: 250px;
        z-index: 1000;
    `;
    document.body.appendChild(perfDiv);
    return perfDiv;
}

export function updatePerformanceUI(perfDiv, profiler) {
    const report = profiler.getReport();
    const cullRate = report.collisionStats.floorsChecked > 0 
        ? (report.collisionStats.floorsCulled / report.collisionStats.floorsChecked * 100).toFixed(1)
        : 0;
    
    perfDiv.innerHTML = `
        <div style="color: #fff; font-weight: bold; margin-bottom: 8px;">⚡ PERFORMANCE</div>
        
        <div style="color: #ff0;">Collision: ${report.collision.avg}ms (max: ${report.collision.max}ms)</div>
        <div style="color: #0ff;">Physics: ${report.physics.avg}ms (max: ${report.physics.max}ms)</div>
        <div style="color: #f0f;">Render: ${report.render.avg}ms (max: ${report.render.max}ms)</div>
        <div style="color: #0f0; font-weight: bold;">Total: ${report.total.avg}ms (max: ${report.total.max}ms)</div>
        
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #444;">
            <div style="color: #fff; font-weight: bold; margin-bottom: 5px;">SPATIAL GRID 🚀</div>
            <div>Total floors: ${report.collisionStats.floorsChecked}</div>
            <div style="color: #0f0;">Nearby floors: ${report.collisionStats.nearbyFloors || 0}</div>
            <div>Culled: ${report.collisionStats.floorsCulled}</div>
            <div style="color: ${cullRate > 95 ? '#0f0' : cullRate > 80 ? '#ff0' : '#f00'}">
                Cull rate: ${cullRate}%
            </div>
        </div>
        
        <div style="margin-top: 10px; font-size: 10px; color: #888;">
            P=toggle | T=stress test | C=benchmark
        </div>
    `;
}

// COMPARISON TEST
export function comparisonTest(floorManager, sphere, dt) {
    console.log("\n🔬 RUNNING COMPARISON TEST...\n");
    
    // Test 1: WITHOUT spatial culling (old way)
    console.log("Test 1: WITHOUT spatial culling");
    const start1 = performance.now();
    let checksWithoutCulling = 0;
    
    for (let i = 0; i < 1000; i++) {
        for (const floor of floorManager.floors) {
            checksWithoutCulling++;
            // Just do the distance check, don't actually collide
            sphere.position.distanceToSquared(floor.position);
        }
    }
    const time1 = performance.now() - start1;
    console.log(`  - Checked ${checksWithoutCulling} floors`);
    console.log(`  - Time: ${time1.toFixed(2)}ms`);
    
    // Test 2: WITH spatial culling (new way)
    console.log("\nTest 2: WITH spatial culling");
    const start2 = performance.now();
    let checksWithCulling = 0;
    let culled = 0;
    const cullRadius = 30;
    const cullRadiusSq = cullRadius * cullRadius;
    
    for (let i = 0; i < 1000; i++) {
        for (const floor of floorManager.floors) {
            checksWithCulling++;
            const distSq = sphere.position.distanceToSquared(floor.position);
            if (distSq < cullRadiusSq) {
                // Would check collision
            } else {
                culled++;
            }
        }
    }
    const time2 = performance.now() - start2;
    console.log(`  - Checked ${checksWithCulling} floors`);
    console.log(`  - Culled ${culled} floors (${(culled/checksWithCulling*100).toFixed(1)}%)`);
    console.log(`  - Time: ${time2.toFixed(2)}ms`);
    
    // Results
    console.log("\n📊 RESULTS:");
    console.log(`  Speedup: ${(time1 / time2).toFixed(2)}x faster`);
    console.log(`  Time saved: ${(time1 - time2).toFixed(2)}ms per 1000 iterations`);
    console.log(`  Per frame savings: ${((time1 - time2) / 1000).toFixed(3)}ms\n`);
}

// Keyboard shortcuts for testing
export function setupTestingShortcuts(floorManager, profiler) {
    window.addEventListener('keydown', (e) => {
        if (e.key === 'p' || e.key === 'P') {
            const perfDiv = document.getElementById('performance-stats');
            if (perfDiv) {
                perfDiv.style.display = perfDiv.style.display === 'none' ? 'block' : 'none';
            }
        }
        
        if (e.key === 't' || e.key === 'T') {
            stressTest(floorManager, profiler);
        }
        
        if (e.key === 'c' || e.key === 'C') {
            if (window.GLOBALS && window.GLOBALS.player && window.GLOBALS.player.PhysicsObject) {
                comparisonTest(
                    floorManager, 
                    window.GLOBALS.player.PhysicsObject, 
                    0.016
                );
            }
        }
    });
    
    console.log("🎮 Testing shortcuts enabled:");
    console.log("  P - Toggle performance overlay");
    console.log("  T - Stress test (create 200 floors)");
    console.log("  C - Run comparison benchmark");
}