import * as THREE from "https://unpkg.com/three@0.181.0/build/three.module.js";
import { PhysicsObject } from "./physics.js";
import { createRotatingMaterial } from "./material.js";
import { CONFIG } from "./config.js";
import { GLOBALS } from "./globals.js";

export class SphereManager {
	constructor(scene) {
		this.scene = scene;
		this.spheres = [];
	}

	createSpheres() {
		const sphere = new PhysicsObject(
			new THREE.SphereGeometry(1, 24, 24),
			createRotatingMaterial(),
			1,
			new THREE.Vector3(0, 1, 0),
			new THREE.Vector3(0, 0, 0),
		);

		sphere.friction = 1;
		sphere.angularVelocity.set(0, 0, 0);

		sphere.mesh.castShadow = true;
		sphere.mesh.receiveShadow = true;

		this.scene.add(sphere.mesh);
		this.spheres.push(sphere);
		GLOBALS.player.PhysicsObject = sphere;
	}

	applyGravity() {
		for (const sphere of this.spheres) {
			sphere.applyForce(
				new THREE.Vector3(0, CONFIG.gravity * sphere.mass, 0),
			);
		}
	}

	updatePhysics(dt) {
		for (const sphere of this.spheres) {
			sphere.update(dt);
		}
	}

	handleSphereSphereCollisions() {
		for (let i = 0; i < this.spheres.length; i++) {
			for (let j = i + 1; j < this.spheres.length; j++) {
				if (this.spheres[i].checkCollision(this.spheres[j])) {
					this.spheres[i].resolveCollision(this.spheres[j]);
				}
			}
		}
	}

	getMainSphere() {
		return this.spheres[0];
	}
}
