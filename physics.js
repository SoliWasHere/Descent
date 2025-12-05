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
                tScene: {
                    value: this.renderTarget.texture
                },
                uTime: {
                    value: 0
                },
                uResolution: {
                    value: new THREE.Vector2(window.innerWidth,
                        window.innerHeight)
                }
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
                
                void main() {
                    vec2 uv = gl_FragCoord.xy / uResolution;
                    vec4 color = texture2D(tScene, uv);
                    
                    // Example: slight vignette effect
                    vec2 center = uv - 0.5;
                    float dist = length(center);
                    float vignette = smoothstep(0.8, 0.2, dist);
                    color.rgb *= vignette;
                    
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

        // Render full-screen quad using that texture
        this.renderer.setRenderTarget(null);
        this.materialPost.uniforms.uTime.value = time * 0.001;
        this.renderer.render(this.scenePost, this.cameraPost);
    }

    resize(width, height) {
        this.renderTarget.setSize(width, height);
        this.materialPost.uniforms.uResolution.value.set(width, height);
    }
}