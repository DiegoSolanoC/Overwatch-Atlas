/**
 * Aurora shell meshes for globe and flat map.
 */

export function createGlobeAuroraShell({ radius = 1.022, uIntensity = 0.42 } = {}) {
    const geometry = new THREE.SphereGeometry(radius, 72, 72);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uIntensity: { value: uIntensity },
            uVeilExpand: { value: 0 },
            uVeilBoost: { value: 1.0 },
            uSunDirWorld: { value: new THREE.Vector3(0, 0, 1) }
        },
        vertexShader: `
            varying vec3 vObjNormal;
            varying vec3 vWorldNormal;
            void main() {
                vObjNormal = normal;
                vWorldNormal = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uIntensity;
            uniform float uVeilExpand;
            uniform float uVeilBoost;
            uniform vec3 uSunDirWorld;
            varying vec3 vObjNormal;
            varying vec3 vWorldNormal;

            float hash11(float x) {
                return fract(sin(x) * 43758.5453123);
            }

            float triNoise3(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                float n0 = i.x + i.y * 57.0 + 113.0 * i.z;
                return mix(
                    mix(mix(hash11(n0 + 0.0), hash11(n0 + 1.0), f.x),
                        mix(hash11(n0 + 57.0), hash11(n0 + 58.0), f.x), f.y),
                    mix(mix(hash11(n0 + 113.0), hash11(n0 + 114.0), f.x),
                        mix(hash11(n0 + 170.0), hash11(n0 + 171.0), f.x), f.y),
                    f.z);
            }

            void main() {
                vec3 n = normalize(vObjNormal);
                float pole = abs(n.y);
                float ve = clamp(uVeilExpand, 0.0, 1.0);
                // ve=0: off (no aurora). Higher: wider polar veil (up to full cap at ve=1).
                float innerP = mix(0.878, 0.52, ve);
                float outerP = mix(0.952, 0.68, ve);
                float cap0 = mix(0.974, 0.90, ve);
                float cap1 = mix(0.999, 0.997, ve);
                float band = smoothstep(innerP, outerP, pole) * (1.0 - smoothstep(cap0, cap1, pole));
                if (band < 0.002) discard;

                vec3 drift = vec3(uTime * 0.025, uTime * 0.018, uTime * 0.022);
                vec3 q = n * 4.2 + drift;
                float g0 = triNoise3(q);
                float g1 = triNoise3(q * 2.15 + vec3(13.7, 8.3, 21.1));
                float g2 = triNoise3(q * 4.6 + vec3(5.1, 19.2, 3.4));
                float grain = g0 * 0.52 + g1 * 0.32 + g2 * 0.16;

                float ang = atan(n.x, n.z);
                float angWarp = (grain - 0.5) * 0.6 + (g1 - 0.5) * 0.28;
                float curtains = sin((ang + angWarp) * 7.0 + uTime * 0.35 + g2 * 1.8) * 0.5 + 0.5;
                float ripples = sin(pole * (22.0 + 7.0 * g0) - uTime * 0.85 + grain * 4.5) * 0.5 + 0.5;
                float pulse = sin(uTime * 0.5 + pole * (10.0 + 5.0 * g1) + grain * 2.2) * 0.12 + 0.88;

                float bright = 0.62 + 0.52 * grain;
                float strength = band * (0.30 + 0.52 * curtains * ripples) * pulse * bright * uIntensity * uVeilBoost;
                float veilPresence = smoothstep(0.0, 0.028, ve);
                strength *= veilPresence;

                float ndl = max(0.0, dot(normalize(vWorldNormal), normalize(uSunDirWorld)));
                // Favor the night hemisphere (shell normal away from sun); dim subsolar day side.
                // Floor on the bright side so polar geometry / high ndl still leaves a hint of banding.
                float night = clamp(1.0 - ndl, 0.0, 1.0);
                strength *= mix(0.26, 1.0, pow(night, 0.42));

                vec3 col = vec3(0.10, 0.90, 0.40);
                float fr0 = mix(0.918, 0.91, ve);
                float fr1 = mix(0.984, 0.975, ve);
                float fringe = smoothstep(fr0, fr1, pole);
                col = mix(col, vec3(0.30, 0.95, 0.72), fringe * 0.4);
                col *= mix(vec3(0.9, 0.95, 1.0), vec3(1.05, 1.0, 0.92), grain * 0.35 + g2 * 0.15);

                gl_FragColor = vec4(col * strength, 1.0);
            }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'globeAuroraShell';
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;
    return mesh;
}

/**
 * Equirectangular flat map (2:1 plane): aurora bands at top/bottom using UV latitude + additive blend.
 * Veil uniforms match the globe shell so {@link WorldviewGlobeView} can drive both from one animation state.
 * @param {Object} [opts]
 * @param {number} [opts.uIntensity]
 * @returns {THREE.Mesh|null}
 */
export function createFlatMapAuroraShell({ uIntensity = 0.42 } = {}) {
    const geometry = new THREE.PlaneGeometry(2.0, 1.0, 64, 32);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uIntensity: { value: uIntensity },
            uVeilExpand: { value: 0 },
            uVeilBoost: { value: 1.0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uIntensity;
            uniform float uVeilExpand;
            uniform float uVeilBoost;
            varying vec2 vUv;

            float hash11(float x) {
                return fract(sin(x) * 43758.5453123);
            }

            float triNoise3(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                float n0 = i.x + i.y * 57.0 + 113.0 * i.z;
                return mix(
                    mix(mix(hash11(n0 + 0.0), hash11(n0 + 1.0), f.x),
                        mix(hash11(n0 + 57.0), hash11(n0 + 58.0), f.x), f.y),
                    mix(mix(hash11(n0 + 113.0), hash11(n0 + 114.0), f.x),
                        mix(hash11(n0 + 170.0), hash11(n0 + 171.0), f.x), f.y),
                    f.z);
            }

            void main() {
                /* Wider polar caps than the globe shader: flat map framing often crops the very top/bottom. */
                float pole = abs(vUv.y - 0.5) * 2.0;
                float ve = clamp(uVeilExpand, 0.0, 1.0);
                float innerP = mix(0.38, 0.22, ve);
                float outerP = mix(0.62, 0.40, ve);
                float cap0 = mix(0.92, 0.78, ve);
                float cap1 = mix(0.998, 0.96, ve);
                float band = smoothstep(innerP, outerP, pole) * (1.0 - smoothstep(cap0, cap1, pole));
                if (band < 0.002) discard;

                vec3 drift = vec3(uTime * 0.025, uTime * 0.018, uTime * 0.022);
                vec3 q = vec3(vUv.x * 8.4, vUv.y * 4.2, 0.0) + drift;
                float g0 = triNoise3(q);
                float g1 = triNoise3(q * 2.15 + vec3(13.7, 8.3, 21.1));
                float g2 = triNoise3(q * 4.6 + vec3(5.1, 19.2, 3.4));
                float grain = g0 * 0.52 + g1 * 0.32 + g2 * 0.16;

                float ang = vUv.x * 6.283185307 * 2.0;
                float angWarp = (grain - 0.5) * 0.6 + (g1 - 0.5) * 0.28;
                float curtains = sin((ang + angWarp) * 7.0 + uTime * 0.35 + g2 * 1.8) * 0.5 + 0.5;
                float ripples = sin(pole * (22.0 + 7.0 * g0) - uTime * 0.85 + grain * 4.5) * 0.5 + 0.5;
                float pulse = sin(uTime * 0.5 + pole * (10.0 + 5.0 * g1) + grain * 2.2) * 0.12 + 0.88;

                float bright = 0.66 + 0.52 * grain;
                float strength = band * (0.36 + 0.52 * curtains * ripples) * pulse * bright * uIntensity * uVeilBoost;
                float veilPresence = smoothstep(0.0, 0.02, ve) * 0.92 + 0.08;
                strength *= veilPresence;

                vec3 col = vec3(0.10, 0.90, 0.40);
                float fr0 = mix(0.85, 0.78, ve);
                float fr1 = mix(0.96, 0.92, ve);
                float fringe = smoothstep(fr0, fr1, pole);
                col = mix(col, vec3(0.30, 0.95, 0.72), fringe * 0.4);
                col *= mix(vec3(0.9, 0.95, 1.0), vec3(1.05, 1.0, 0.92), grain * 0.35 + g2 * 0.15);

                gl_FragColor = vec4(col * strength, 1.0);
            }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'flatMapAuroraShell';
    mesh.renderOrder = 4;
    mesh.frustumCulled = false;
    return mesh;
}
