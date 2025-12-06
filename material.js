import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

function createRotatingMaterial() {
    const material = new THREE.MeshStandardMaterial({
        metalness: 0.0,
        roughness: 1.0,
        flatShading: true
    });

    // Octahedron vertices
    const vertices = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1)
    ];

    // Faces
    const faces = [
        [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2],
        [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]
    ];

    // Alternating color pattern
    const faceColors = [0, 1, 0, 1, 1, 0, 1, 0];

    material.onBeforeCompile = (shader) => {
        shader.uniforms.color1 = { value: new THREE.Color(0x0077ff) };
        shader.uniforms.color2 = { value: new THREE.Color(0xffffff) };

        // Threshold control uniform
        shader.uniforms.uThreshold = { value: 0.35 };

        // Pass vertices
        for (let i = 0; i < 6; i++) {
            shader.uniforms[`v${i}`] = { value: vertices[i] };
        }

        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>
            varying vec3 vObjectPosition;`
        );

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vObjectPosition = position;`
        );

        // Generate vertex uniform declarations
        let uniformDecl = '';
        for (let i = 0; i < 6; i++) {
            uniformDecl += `uniform vec3 v${i};\n`;
        }

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>
            uniform vec3 color1;
            uniform vec3 color2;
            uniform float uThreshold;
            ${uniformDecl}
            varying vec3 vObjectPosition;`
        );

        // Build face detection GLSL
        let faceChecks = '';
        faces.forEach((face, idx) => {
            const [a, b, c] = face;
            const color = faceColors[idx];
            faceChecks += `
            {
                vec3 center = normalize(v${a} + v${b} + v${c});
                float d = dot(p, center);
                if (d > maxDot) {
                    maxDot = d;
                    checker = ${color}.0;
                }
            }`;
        });

        // Insert final shading logic
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <opaque_fragment>',
            `#include <opaque_fragment>

            vec3 p = normalize(vObjectPosition);
            float maxDot = -1.0;
            float checker = 0.0;
            ${faceChecks}

            // Existing lighting result
            vec3 lighting = gl_FragColor.rgb;

            // Perceptual brightness
            float luminance = dot(lighting, vec3(0.299, 0.587, 0.114));

            // Two-step lighting:
            float bright = luminance > uThreshold ? 1.0 : 0.0;

            // Dark = 0.10, Light = 1.0
            float steppedLight = mix(0.40, 1.0, bright);

            // Face-based color selection
            vec3 baseColor = mix(color1, color2, checker);

            // Final output
            gl_FragColor.rgb = baseColor * steppedLight;
        `
        );
    };

    return material;
}

export { createRotatingMaterial };
