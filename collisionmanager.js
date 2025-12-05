import * as THREE from "https://unpkg.com/three@0.181.0/build/three.module.js";

class BVHNode {
	constructor(triangles) {
		this.triangles = triangles;
		this.left = null;
		this.right = null;
		this.aabb = new THREE.Box3();

		triangles.forEach((tri) => {
			this.aabb.expandByPoint(tri.v0);
			this.aabb.expandByPoint(tri.v1);
			this.aabb.expandByPoint(tri.v2);
		});

		if (triangles.length > 10) {
			// Split along longest axis
			const size = new THREE.Vector3();
			this.aabb.getSize(size);
			const axis = ["x", "y", "z"][
				size.toArray().indexOf(Math.max(size.x, size.y, size.z))
			];

			triangles.sort((a, b) => {
				const centerA = a.v0
					.clone()
					.add(a.v1)
					.add(a.v2)
					.divideScalar(3)[axis];
				const centerB = b.v0
					.clone()
					.add(b.v1)
					.add(b.v2)
					.divideScalar(3)[axis];
				return centerA - centerB;
			});

			const mid = Math.floor(triangles.length / 2);
			this.left = new BVHNode(triangles.slice(0, mid));
			this.right = new BVHNode(triangles.slice(mid));
			this.triangles = null;
		}
	}

	querySphere(position, radius, results = []) {
		const sphere = new THREE.Sphere(position, radius);
		if (!sphere.intersectsBox(this.aabb)) return results;

		if (this.triangles) {
			results.push(...this.triangles);
		} else {
			this.left.querySphere(position, radius, results);
			this.right.querySphere(position, radius, results);
		}
		return results;
	}
}

export class MeshCollider {
	constructor(mesh) {
		this.mesh = mesh;
		this.originalTriangles = this.extractTriangles(mesh.geometry);
		this.bvh = new BVHNode(this.originalTriangles);
	}

	extractTriangles(geometry) {
		const pos = geometry.attributes.position;
		const index = geometry.index;
		const tris = [];

		if (!pos) return tris;

		const getVertex = (i) =>
			new THREE.Vector3().fromBufferAttribute(pos, i);

		if (!index) {
			for (let i = 0; i < pos.count; i += 3) {
				const v0 = getVertex(i),
					v1 = getVertex(i + 1),
					v2 = getVertex(i + 2);
				const normal = new THREE.Vector3()
					.subVectors(v1, v0)
					.cross(new THREE.Vector3().subVectors(v2, v0))
					.normalize();
				tris.push({
					v0,
					v1,
					v2,
					normal,
				});
			}
		} else {
			for (let i = 0; i < index.count; i += 3) {
				const v0 = getVertex(index.getX(i)),
					v1 = getVertex(index.getX(i + 1)),
					v2 = getVertex(index.getX(i + 2));
				const normal = new THREE.Vector3()
					.subVectors(v1, v0)
					.cross(new THREE.Vector3().subVectors(v2, v0))
					.normalize();
				tris.push({
					v0,
					v1,
					v2,
					normal,
				});
			}
		}
		return tris;
	}

	getWorldTriangles() {
		const m = this.mesh.matrixWorld;
		return this.originalTriangles.map((tri) => ({
			v0: tri.v0.clone().applyMatrix4(m),
			v1: tri.v1.clone().applyMatrix4(m),
			v2: tri.v2.clone().applyMatrix4(m),
			normal: tri.normal.clone().transformDirection(m).normalize(),
		}));
	}

	// -------------------
	// CCD collision sweep
	// -------------------
	sweepSphere(prevPos, nextPos, radius) {
		const direction = new THREE.Vector3().subVectors(nextPos, prevPos);
		const distance = direction.length();
		if (distance === 0) return null;
		direction.normalize();

		const candidates = this.bvh.querySphere(
			prevPos.clone().add(nextPos).multiplyScalar(0.5),
			distance / 2 + radius,
		);
		let hit = null;
		let minT = Infinity;

		for (let tri of candidates) {
			const result = this.sphereTriangleSweep(
				prevPos,
				direction,
				distance,
				radius,
				tri,
			);
			if (result && result.t < minT) {
				minT = result.t;
				hit = result;
			}
		}

		return hit;
	}

	sphereTriangleSweep(pos, dir, distance, radius, tri) {
		// Approximation: treat triangle as plane first
		const { v0, normal } = tri;
		const denom = normal.dot(dir);
		if (Math.abs(denom) < 1e-6) return null; // parallel

		const t = (radius - normal.dot(pos.clone().sub(v0))) / denom;
		if (t < 0 || t > distance) return null;

		const point = pos.clone().add(dir.clone().multiplyScalar(t));
		if (
			this.pointInTriangle(
				point.clone().sub(normal.clone().multiplyScalar(radius)),
				tri.v0,
				tri.v1,
				tri.v2,
			)
		) {
			return {
				t,
				normal: denom < 0 ? normal.clone() : normal.clone().negate(),
				contactPoint: point,
			};
		}
		return null;
	}

	// -------------------
	// Helpers
	// -------------------
	pointInTriangle(p, a, b, c) {
		const v0 = c.clone().sub(a),
			v1 = b.clone().sub(a),
			v2 = p.clone().sub(a);
		const dot00 = v0.dot(v0),
			dot01 = v0.dot(v1),
			dot02 = v0.dot(v2);
		const dot11 = v1.dot(v1),
			dot12 = v1.dot(v2);
		const denom = dot00 * dot11 - dot01 * dot01;
		if (denom === 0) return false;
		const u = (dot11 * dot02 - dot01 * dot12) / denom;
		const v = (dot00 * dot12 - dot01 * dot02) / denom;
		return u >= 0 && v >= 0 && u + v <= 1;
	}
}
