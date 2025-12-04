import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

function createRotatingMaterial() {
    const material = new THREE.ShaderMaterial({
        uniforms: {
            color1: { value: new THREE.Color(0x0077ff) },
            color2: { value: new THREE.Color(0xffffff) },
            scale: { value: 8.0 } // number of squares
        },
        vertexShader: `
            varying vec3 vPosition;
            
            void main() {
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color1;
            uniform vec3 color2;
            uniform float scale;
            varying vec3 vPosition;
            
            void main() {
                // Normalize the position to get point on unit sphere
                vec3 p = normalize(vPosition);
                
                // Convert to spherical coordinates
                float theta = atan(p.z, p.x); // azimuth
                float phi = asin(p.y); // elevation
                
                // Create checker pattern
                float u = floor(theta / 3.14159265359 * scale);
                float v = floor(phi / 3.14159265359 * scale);
                float checker = mod(u + v, 2.0);
                
                vec3 color = mix(color1, color2, checker);
                gl_FragColor = vec4(color, 1.0);
            }
        `,
        lights: true
    });
    
    return material;
}

export { createRotatingMaterial };