// meshcollision.js - Use physics.js methods directly
import * as THREE from "https://unpkg.com/three@0.181.0/build/three.module.js";

export class MeshCollider {
	constructor(mesh, options = {}) {
		this.mesh = mesh;
		this.geometry = mesh.geometry;
		this.friction = options.friction || 0.7;
		this.restitution = options.restitution || 0.5;

		this.triangles = this.extractTriangles();
		console.log(
			`MeshCollider created with ${this.triangles.length} triangles`,
		);
	}

	extractTriangles() {
		const triangles = [];
		const geometry = this.geometry;
		const positions = geometry.attributes.position.array;
		const indices = geometry.index ? geometry.index.array : null;

		if (indices) {
			for (let i = 0; i < indices.length; i += 3) {
				const i0 = indices[i] * 3;
				const i1 = indices[i + 1] * 3;
				const i2 = indices[i + 2] * 3;

				triangles.push({
					v0: new THREE.Vector3(
						positions[i0],
						positions[i0 + 1],
						positions[i0 + 2],
					),
					v1: new THREE.Vector3(
						positions[i1],
						positions[i1 + 1],
						positions[i1 + 2],
					),
					v2: new THREE.Vector3(
						positions[i2],
						positions[i2 + 1],
						positions[i2 + 2],
					),
				});
			}
		} else {
			for (let i = 0; i < positions.length; i += 9) {
				triangles.push({
					v0: new THREE.Vector3(
						positions[i],
						positions[i + 1],
						positions[i + 2],
					),
					v1: new THREE.Vector3(
						positions[i + 3],
						positions[i + 4],
						positions[i + 5],
					),
					v2: new THREE.Vector3(
						positions[i + 6],
						positions[i + 7],
						positions[i + 8],
					),
				});
			}
		}

		return triangles;
	}

	collideSphere(sphere, friction = 0.5, restitution = 0.7, dt = 0.016) {
		if (sphere.isStatic) return false;

		const nearby = this.getNearbyTriangles(
			sphere.position,
			sphere.radius,
			5,
		);

		if (nearby.length === 0) {
			if (Math.random() < 0.01) {
				console.log(
					`No nearby triangles for sphere at (${sphere.position.x.toFixed(1)}, ${sphere.position.y.toFixed(1)}, ${sphere.position.z.toFixed(1)})`,
				);
			}
			return false;
		}

		let deepestPenetration = -Infinity;
		let bestContact = null;
		let debugInfo = [];
		let detailedSample = null;

		for (let i = 0; i < nearby.length; i++) {
			const triangle = nearby[i];
			const closest = this.closestPointOnTriangle(
				sphere.position,
				triangle.v0,
				triangle.v1,
				triangle.v2,
			);

			const toSphere = new THREE.Vector3().subVectors(
				sphere.position,
				closest,
			);
			const distance = toSphere.length();
			const penetration = sphere.radius - distance;

			// Capture detailed info for first triangle
			if (i === 0) {
				detailedSample = {
					spherePos: sphere.position.clone(),
					sphereRadius: sphere.radius,
					triV0: triangle.v0.clone(),
					triV1: triangle.v1.clone(),
					triV2: triangle.v2.clone(),
					closestPoint: closest.clone(),
					distance: distance,
					penetration: penetration,
				};
			}

			debugInfo.push({
				penetration: penetration.toFixed(3),
				distance: distance.toFixed(3),
				normalY: triangle.normal.y.toFixed(3),
				closestY: closest.y.toFixed(3),
			});

			if (penetration > 0) {
				if (penetration > deepestPenetration) {
					deepestPenetration = penetration;

					const sphereToTriangle = new THREE.Vector3().subVectors(
						triangle.v0,
						sphere.position,
					);
					let normal = triangle.normal.clone();

					if (normal.dot(sphereToTriangle) > 0) {
						normal.negate();
					}

					bestContact = {
						point: closest,
						normal: normal,
						penetration: penetration,
						triangle: triangle,
					};
				}
			}
		}

		if (nearby.length > 0 && Math.random() < 0.05) {
			console.log(`=== DETAILED COLLISION CHECK ===`);
			console.log(
				`Sphere: pos=(${detailedSample.spherePos.x.toFixed(2)}, ${detailedSample.spherePos.y.toFixed(2)}, ${detailedSample.spherePos.z.toFixed(2)}), radius=${detailedSample.sphereRadius}`,
			);
			console.log(
				`Triangle v0=(${detailedSample.triV0.x.toFixed(2)}, ${detailedSample.triV0.y.toFixed(2)}, ${detailedSample.triV0.z.toFixed(2)})`,
			);
			console.log(
				`Triangle v1=(${detailedSample.triV1.x.toFixed(2)}, ${detailedSample.triV1.y.toFixed(2)}, ${detailedSample.triV1.z.toFixed(2)})`,
			);
			console.log(
				`Triangle v2=(${detailedSample.triV2.x.toFixed(2)}, ${detailedSample.triV2.y.toFixed(2)}, ${detailedSample.triV2.z.toFixed(2)})`,
			);
			console.log(
				`Closest point=(${detailedSample.closestPoint.x.toFixed(2)}, ${detailedSample.closestPoint.y.toFixed(2)}, ${detailedSample.closestPoint.z.toFixed(2)})`,
			);
			console.log(
				`Distance=${detailedSample.distance.toFixed(3)}, Penetration=${detailedSample.penetration.toFixed(3)}`,
			);
			console.log(
				`Checked ${nearby.length} triangles, ${debugInfo.filter((d) => parseFloat(d.penetration) > 0).length} penetrations`,
			);
		}

		if (bestContact) {
			sphere.position.addScaledVector(
				bestContact.normal,
				bestContact.penetration,
			);
			sphere.mesh.position.copy(sphere.position);

			const ra = bestContact.point.clone().sub(sphere.position);
			const velAtContact = sphere.velocity
				.clone()
				.add(
					new THREE.Vector3().crossVectors(
						sphere.angularVelocity,
						ra,
					),
				);

			const velAlongNormal = velAtContact.dot(bestContact.normal);

			if (velAlongNormal < 0) {
				const invMass = 1 / sphere.mass;
				const invInertia =
					sphere.momentOfInertia > 0 &&
					sphere.momentOfInertia !== Infinity
						? 1 / sphere.momentOfInertia
						: 0;

				const raCrossN = new THREE.Vector3().crossVectors(
					ra,
					bestContact.normal,
				);
				const angularTerm = raCrossN.lengthSq() * invInertia;
				const invEffectiveMass = invMass + angularTerm;

				const j =
					(-(1 + restitution) * velAlongNormal) / invEffectiveMass;
				const impulse = bestContact.normal.clone().multiplyScalar(j);

				sphere.velocity.addScaledVector(impulse, invMass);
				sphere.angularVelocity.add(
					raCrossN.multiplyScalar(j * invInertia),
				);

				const tangent = velAtContact
					.clone()
					.sub(
						bestContact.normal
							.clone()
							.multiplyScalar(velAlongNormal),
					);
				const tangentLen = tangent.length();

				if (tangentLen > 1e-6) {
					tangent.normalize();
					const raCrossT = new THREE.Vector3().crossVectors(
						ra,
						tangent,
					);
					const angularTermT = raCrossT.lengthSq() * invInertia;
					const invEffMassT = invMass + angularTermT;

					const jt = -velAtContact.dot(tangent) / invEffMassT;
					const frictionScalar = THREE.MathUtils.clamp(
						jt,
						-Math.abs(j) * friction,
						Math.abs(j) * friction,
					);

					const frictionImpulse = tangent
						.clone()
						.multiplyScalar(frictionScalar);
					sphere.velocity.addScaledVector(frictionImpulse, invMass);
					sphere.angularVelocity.add(
						raCrossT.multiplyScalar(frictionScalar * invInertia),
					);
				}
			}

			return true;
		}

		return false;
	}

    //Copy and pasted... No idea how it works... 
    //TODO: STUDY
	closestPointOnTriangle(point, v0, v1, v2) {
		const edge0 = new THREE.Vector3().subVectors(v1, v0);
		const edge1 = new THREE.Vector3().subVectors(v2, v0);
		const v0ToPoint = new THREE.Vector3().subVectors(point, v0);

		const a = edge0.dot(edge0);
		const b = edge0.dot(edge1);
		const c = edge1.dot(edge1);
		const d = edge0.dot(v0ToPoint);
		const e = edge1.dot(v0ToPoint);

		const det = a * c - b * b;
		let s = b * e - c * d;
		let t = b * d - a * e;

		if (s + t <= det) {
			if (s < 0) {
				if (t < 0) {
					if (d < 0) {
						t = 0;
						s = -d >= a ? 1 : -d / a;
					} else {
						s = 0;
						t = e >= 0 ? 0 : -e >= c ? 1 : -e / c;
					}
				} else {
					s = 0;
					t = e >= 0 ? 0 : -e >= c ? 1 : -e / c;
				}
			} else if (t < 0) {
				t = 0;
				s = d >= 0 ? 0 : -d >= a ? 1 : -d / a;
			} else {
				s *= 1 / det;
				t *= 1 / det;
			}
		} else {
			if (s < 0) {
				const tmp0 = b + d;
				const tmp1 = c + e;
				if (tmp1 > tmp0) {
					const numer = tmp1 - tmp0;
					const denom = a - 2 * b + c;
					s = numer >= denom ? 1 : numer / denom;
					t = 1 - s;
				} else {
					s = 0;
					t = tmp1 <= 0 ? 1 : e >= 0 ? 0 : -e / c;
				}
			} else if (t < 0) {
				const tmp0 = b + e;
				const tmp1 = a + d;
				if (tmp1 > tmp0) {
					const numer = tmp1 - tmp0;
					const denom = a - 2 * b + c;
					t = numer >= denom ? 1 : numer / denom;
					s = 1 - t;
				} else {
					t = 0;
					s = tmp1 <= 0 ? 1 : d >= 0 ? 0 : -d / a;
				}
			} else {
				const numer = c + e - b - d;
				s =
					numer <= 0
						? 0
						: numer >= a - 2 * b + c
							? 1
							: numer / (a - 2 * b + c);
				t = 1 - s;
			}
		}

		return new THREE.Vector3()
			.copy(v0)
			.addScaledVector(edge0, s)
			.addScaledVector(edge1, t);
	}
}
