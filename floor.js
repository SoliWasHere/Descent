import * as THREE from "https://unpkg.com/three@0.181.0/build/three.module.js";
import { PhysicsObject } from "./physics.js";
import { CONFIG } from "./config.js";

export class FloorManager {
	constructor(scene) {
		this.scene = scene;
		this.floors = [];
	}

	createFloor(x, y, z, sx = 10, sy = 1, sz = 10, rx = 0, ry = 0, rz = 0) {
		const floor = new PhysicsObject(
			new THREE.BoxGeometry(sx, sy, sz),
			new THREE.MeshStandardMaterial({
				color: 0xffffff,
				roughness: 0.8,
			}),
			0,
			new THREE.Vector3(x, y - 2, z),
			new THREE.Vector3(0, 0, 0),
		);

		floor.width = sx;
		floor.height = sy;
		floor.depth = sz;
		floor.friction = CONFIG.floorFriction;
		floor.restitution = CONFIG.floorRestitution;

		floor.mesh.receiveShadow = true;

		floor.rotateX(rx);
		floor.rotateY(ry);
		floor.rotateZ(rz);

		this.scene.add(floor.mesh);
		this.floors.push(floor);

		return floor;
	}

	createInitialFloor() {
		this.createFloor(0, 0, 0);
	}

	checkCollisions(sphere, dt) {
		for (const floor of this.floors) {
			floor.bounceBox(sphere, dt);
		}
	}
}

export function createSineWavePlatform(
	length = 10,
	width = 5,
	height = 1,
	waveHeight = 1,
	frequency = 0.25,
	segments = 100,
	travelAxis = "y", // 'x', 'y', or 'z' - direction platform travels
	waveAxis = "x", // 'x', 'y', or 'z' - direction of sine wave oscillation
) {
	const triangles = [];
	const geometry = new THREE.BufferGeometry();
	const vertices = [];
	const indices = [];

	// Create vertices in LOCAL space centered at origin
	const offsetTravel = -length / 2;

	for (let i = 0; i <= segments; i++) {
		const t = i / segments;
		const travelPos = t * length + offsetTravel;
		const wave = Math.sin(t * Math.PI * 2 * frequency) * waveHeight;

		let x = 0,
			y = 0,
			z = 0;

		// Set the travel position
		if (travelAxis === "x") x = travelPos;
		else if (travelAxis === "y") y = travelPos;
		else if (travelAxis === "z") z = travelPos;

		// Add the wave oscillation
		if (waveAxis === "x") x += wave;
		else if (waveAxis === "y") y += wave;
		else if (waveAxis === "z") z += wave;

		// Determine which axis gets the width
		// (the axis that's neither travel nor wave)
		let widthAxis;
		if (travelAxis === "x" && waveAxis === "y") widthAxis = "z";
		else if (travelAxis === "x" && waveAxis === "z") widthAxis = "y";
		else if (travelAxis === "y" && waveAxis === "x") widthAxis = "z";
		else if (travelAxis === "y" && waveAxis === "z") widthAxis = "x";
		else if (travelAxis === "z" && waveAxis === "x") widthAxis = "y";
		else if (travelAxis === "z" && waveAxis === "y") widthAxis = "x";
		else {
			console.error("Invalid axis combination:", travelAxis, waveAxis);
			widthAxis = "z"; // fallback
		}

		// Create 4 vertices per segment
		for (let corner = 0; corner < 4; corner++) {
			let vx = x,
				vy = y,
				vz = z;

			const isWidthPositive = corner === 1 || corner === 3;
			const isHeightNegative = corner === 2 || corner === 3;

			// Apply width offset
			if (widthAxis === "x")
				vx += isWidthPositive ? width / 2 : -width / 2;
			else if (widthAxis === "y")
				vy += isWidthPositive ? width / 2 : -width / 2;
			else if (widthAxis === "z")
				vz += isWidthPositive ? width / 2 : -width / 2;

			// Height always goes "down" along negative direction of travel axis
			if (isHeightNegative) {
				if (travelAxis === "x") vx -= height;
				else if (travelAxis === "y") vy -= height;
				else if (travelAxis === "z") vz -= height;
			}

			vertices.push(vx, vy, vz);
		}
	}

	// Helper to add a triangle
	const addTriangle = (i0, i1, i2) => {
		const v0 = new THREE.Vector3(
			vertices[i0 * 3],
			vertices[i0 * 3 + 1],
			vertices[i0 * 3 + 2],
		);
		const v1 = new THREE.Vector3(
			vertices[i1 * 3],
			vertices[i1 * 3 + 1],
			vertices[i1 * 3 + 2],
		);
		const v2 = new THREE.Vector3(
			vertices[i2 * 3],
			vertices[i2 * 3 + 1],
			vertices[i2 * 3 + 2],
		);
		triangles.push({
			v0,
			v1,
			v2,
		});
		indices.push(i0, i1, i2);
	};

	// Connect segments
	for (let i = 0; i < segments; i++) {
		const curr = i * 4;
		const next = (i + 1) * 4;

		// Top surface
		addTriangle(curr + 0, curr + 1, next + 0);
		addTriangle(curr + 1, next + 1, next + 0);

		// Bottom surface
		addTriangle(curr + 2, next + 2, curr + 3);
		addTriangle(curr + 3, next + 2, next + 3);

		// Left side
		addTriangle(curr + 0, next + 0, curr + 2);
		addTriangle(next + 0, next + 2, curr + 2);

		// Right side
		addTriangle(curr + 1, curr + 3, next + 1);
		addTriangle(next + 1, curr + 3, next + 3);
	}

	// End caps
	addTriangle(0, 2, 1);
	addTriangle(1, 2, 3);
	const last = segments * 4;
	addTriangle(last + 0, last + 1, last + 2);
	addTriangle(last + 1, last + 3, last + 2);

	geometry.setAttribute(
		"position",
		new THREE.Float32BufferAttribute(vertices, 3),
	);
	geometry.setIndex(indices);
	geometry.computeVertexNormals();

	return {
		geometry,
		triangles,
	};
}

export function createZigzagPlatform(
	length = 10,
	width = 5,
	height = 1,
	zigzagAmount = 2,
	frequency = 0.25,
	segments = 100,

	travelAxis = "y",
	zigzagAxis = "x",
	heightAxis = "z",
) {
	const axes = ["x", "y", "z"];

	// If zigzagAxis == travelAxis → choose another axis
	if (zigzagAxis === travelAxis) {
		zigzagAxis = axes.find((a) => a !== travelAxis);
	}

	// Width axis is the leftover axis
	const widthAxis = axes.find((a) => a !== travelAxis && a !== zigzagAxis);

	const vertices = [];
	const indices = [];
	const triangles = [];

	const offsetTravel = -length / 2;

	for (let i = 0; i <= segments; i++) {
		const t = i / segments;
		const travelPos = offsetTravel + t * length;
		const wiggle = Math.sin(t * Math.PI * 2 * frequency) * zigzagAmount;

		let base = {
			x: 0,
			y: 0,
			z: 0,
		};
		base[travelAxis] = travelPos;
		base[zigzagAxis] += wiggle;

		for (let c = 0; c < 4; c++) {
			const v = {
				...base,
			};

			const widthDir = c === 1 || c === 3 ? +1 : -1;
			const heightDir = c === 2 || c === 3 ? -1 : 0;

			v[widthAxis] += (widthDir * width) / 2;
			v[heightAxis] += heightDir * height;

			vertices.push(v.x, v.y, v.z);
		}
	}

	const addTri = (a, b, c) => {
		indices.push(a, b, c);

		const i0 = a * 3,
			i1 = b * 3,
			i2 = c * 3;
		const v0 = new THREE.Vector3(
			vertices[i0],
			vertices[i0 + 1],
			vertices[i0 + 2],
		);
		const v1 = new THREE.Vector3(
			vertices[i1],
			vertices[i1 + 1],
			vertices[i1 + 2],
		);
		const v2 = new THREE.Vector3(
			vertices[i2],
			vertices[i2 + 1],
			vertices[i2 + 2],
		);

		const normal = new THREE.Vector3()
			.subVectors(v1, v0)
			.cross(new THREE.Vector3().subVectors(v2, v0))
			.normalize();

		triangles.push({
			v0,
			v1,
			v2,
			normal,
		});
	};

	for (let i = 0; i < segments; i++) {
		const c = i * 4;
		const n = (i + 1) * 4;

		// Top
		addTri(c + 0, c + 1, n + 0);
		addTri(c + 1, n + 1, n + 0);

		// Bottom
		addTri(c + 2, n + 2, c + 3);
		addTri(c + 3, n + 2, n + 3);

		// Side 1
		addTri(c + 0, n + 0, c + 2);
		addTri(n + 0, n + 2, c + 2);

		// Side 2
		addTri(c + 1, c + 3, n + 1);
		addTri(n + 1, c + 3, n + 3);
	}

	// End caps
	addTri(0, 2, 1);
	addTri(1, 2, 3);

	const last = segments * 4;
	addTri(last + 0, last + 1, last + 2);
	addTri(last + 1, last + 3, last + 2);

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute(
		"position",
		new THREE.Float32BufferAttribute(vertices, 3),
	);
	geometry.setIndex(indices);
	geometry.computeVertexNormals();

	return {
		geometry,
		triangles,
	};
}

export function createZigZagMesh(options = {}) {
	const result = createZigzagPlatform(
		options.length || 10,
		options.width || 5,
		options.height || 1,
		options.zigzagAmount || 2,
		options.frequency || 0.25,
		options.segments || 100,
		options.travelAxis || "x",
		options.zigzagAxis || "z",
		options.heightAxis || "y",
	);

	const material = new THREE.MeshStandardMaterial({
		color: options.color || 0x8844ff,
		roughness: 1,
		metalness: 0,
	});

	const mesh = new THREE.Mesh(result.geometry, material);
	const position = options.position || new THREE.Vector3(0, 0, 0);
	mesh.position.copy(position);
	mesh.receiveShadow = true;

	return {
		mesh,
		triangles: result.triangles,
	}; // Return LOCAL space triangles
}

export function createSineWaveMesh(options = {}) {
	const result = createSineWavePlatform(
		options.length || 10,
		options.width || 5,
		options.height || 1,
		options.waveHeight || 2,
		options.frequency || 1,
		options.segments || 100,
	);

	const material = new THREE.MeshStandardMaterial({
		color: options.color || 0x4444ff,
		roughness: 1,
		metalness: 0,
	});

	const mesh = new THREE.Mesh(result.geometry, material);
	const position = options.position || new THREE.Vector3(0, 0, 0);
	mesh.position.copy(position);
	mesh.receiveShadow = true;

	return {
		mesh,
		triangles: result.triangles,
	}; // Return LOCAL space triangles
}
