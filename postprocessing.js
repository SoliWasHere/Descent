import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';

export class PostProcessing {
    constructor(renderer) {
        this.renderer = renderer;
        this.renderTarget = new THREE.WebGLRenderTarget(
            window.innerWidth, 
            window.innerHeight
        );
        
        this.scenePost = new THREE.Scene();
        this.cameraPost = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        this.materialPost = new THREE.ShaderMaterial({
            uniforms: {
                tScene: { value: this.renderTarget.texture },
                uTime: { value: 0 },
                uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                uDitherStrength: { value: 0.08 }, // More visible dithering
                uPixelSize: { value: 1.0 } // Can increase for blockier look
            },
            vertexShader: `
                void main() {
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tScene;
                uniform float uTime;
                uniform vec2 uResolution;
                uniform float uDitherStrength;
                uniform float uPixelSize;
                
                // Bayer matrix for ordered dithering (8x8 for better quality)
                float bayer8(vec2 pos) {
                    mat4 m1 = mat4(
                        0.0, 32.0, 8.0, 40.0,
                        48.0, 16.0, 56.0, 24.0,
                        12.0, 44.0, 4.0, 36.0,
                        60.0, 28.0, 52.0, 20.0
                    );
                    mat4 m2 = mat4(
                        3.0, 35.0, 11.0, 43.0,
                        51.0, 19.0, 59.0, 27.0,
                        15.0, 47.0, 7.0, 39.0,
                        63.0, 31.0, 55.0, 23.0
                    );
                    
                    vec2 p = floor(mod(pos, 8.0));
                    int x = int(p.x);
                    int y = int(p.y);
                    
                    if (y < 4) {
                        if (x == 0) return m1[0][y];
                        if (x == 1) return m1[1][y];
                        if (x == 2) return m1[2][y];
                        if (x == 3) return m1[3][y];
                        if (x == 4) return m2[0][y];
                        if (x == 5) return m2[1][y];
                        if (x == 6) return m2[2][y];
                        if (x == 7) return m2[3][y];
                    } else {
                        y -= 4;
                        if (x == 0) return m1[0][y] + 2.0;
                        if (x == 1) return m1[1][y] + 2.0;
                        if (x == 2) return m1[2][y] + 2.0;
                        if (x == 3) return m1[3][y] + 2.0;
                        if (x == 4) return m2[0][y] + 2.0;
                        if (x == 5) return m2[1][y] + 2.0;
                        if (x == 6) return m2[2][y] + 2.0;
                        if (x == 7) return m2[3][y] + 2.0;
                    }
                    
                    return 0.0;
                }
                
                void main() {
                    // Optional pixelation effect
                    vec2 pixelatedUV = floor(gl_FragCoord.xy / uPixelSize) * uPixelSize / uResolution;
                    vec2 uv = gl_FragCoord.xy / uResolution;
                    
                    // Use regular UV for now (change to pixelatedUV for pixel art look)
                    vec4 color = texture2D(tScene, uv);
                    
                    // Apply ordered dithering
                    float dither = (bayer8(gl_FragCoord.xy) / 64.0) - 0.5;
                    color.rgb += dither * uDitherStrength;
                    
                    // Vignette effect (more pronounced)
                    vec2 center = uv - 0.5;
                    float dist = length(center);
                    float vignette = smoothstep(0.8, 0.3, dist);
                    color.rgb *= vignette;
                    
                    // Optional: slight scanline effect for retro look
                    float scanline = sin(gl_FragCoord.y * 0.5) * 0.02;
                    color.rgb -= scanline;
                    
                    gl_FragColor = color;
                }
            `
        });
        
        const quad = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2), 
            this.materialPost
        );
        this.scenePost.add(quad);
    }

    render(scene, camera, time) {
        // Render main scene to texture
        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.render(scene, camera);
        
        // Render full-screen quad with post-processing effects
        this.renderer.setRenderTarget(null);
        this.materialPost.uniforms.uTime.value = time * 0.001;
        this.renderer.render(this.scenePost, this.cameraPost);
    }

    resize(width, height) {
        this.renderTarget.setSize(width, height);
        this.materialPost.uniforms.uResolution.value.set(width, height);
    }
    
    // Optional: methods to control effects
    setDitherStrength(strength) {
        this.materialPost.uniforms.uDitherStrength.value = strength;
    }
    
    setPixelSize(size) {
        this.materialPost.uniforms.uPixelSize.value = size;
    }
}