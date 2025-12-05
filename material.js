import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

function createRotatingMaterial() {
    const material = new THREE.MeshStandardMaterial({
        metalness: 0.3,
        roughness: 0.6
    });
    
    // Octahedron vertices (6 vertices at ±1 on each axis)
    const vertices = [
        new THREE.Vector3(1, 0, 0),   // 0: +X
        new THREE.Vector3(-1, 0, 0),  // 1: -X
        new THREE.Vector3(0, 1, 0),   // 2: +Y
        new THREE.Vector3(0, -1, 0),  // 3: -Y
        new THREE.Vector3(0, 0, 1),   // 4: +Z
        new THREE.Vector3(0, 0, -1)   // 5: -Z
    ];
    
    // Octahedron faces (8 triangles)
    const faces = [
        [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2],  // faces touching +X
        [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]   // faces touching -X
    ];
    
    // 2-coloring (alternating pattern)
    const faceColors = [0, 1, 0, 1, 1, 0, 1, 0];
    
    material.onBeforeCompile = (shader) => {
        shader.uniforms.color1 = { value: new THREE.Color(0x0077ff) };
        shader.uniforms.color2 = { value: new THREE.Color(0xffffff) };
        
        // Pass vertices as uniforms
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
        
        let uniformDecl = '';
        for (let i = 0; i < 6; i++) {
            uniformDecl += `uniform vec3 v${i};\n`;
        }
        
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>
            uniform vec3 color1;
            uniform vec3 color2;
            ${uniformDecl}
            varying vec3 vObjectPosition;`
        );
        
        // Generate code to find closest face
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
        
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            
            vec3 p = normalize(vObjectPosition);
            
            float maxDot = -1.0;
            float checker = 0.0;
            
            ${faceChecks}
            
            diffuseColor.rgb = mix(color1, color2, checker);`
        );
    };
    
    return material;
}

export { createRotatingMaterial };