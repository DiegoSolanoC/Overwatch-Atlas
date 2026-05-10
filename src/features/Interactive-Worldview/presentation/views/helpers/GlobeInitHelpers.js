/**
 * GlobeInitHelpers - Utilities for globe initialization
 * Extracted from GlobeView to reduce complexity
 */

import { createCelestialPlane, getMoonTexturePath, getMarsTexturePath, getOrbitTexturePath } from './GlobePlaneHelpers.js';
import { loadTexture } from './GlobeTextureHelpers.js';
import { EARTH_GLOBE_LIGHT_LAYER } from '../../../constants/GlobeLightingConstants.js';
import { EARTH_POLAR_TO_EQUATORIAL_RATIO } from '../../../constants/GlobePhysicalConstants.js';

function _createRadialGlowTexture({ size = 256 } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2;

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0.0, 'rgba(255, 250, 230, 1.0)');
    g.addColorStop(0.25, 'rgba(255, 230, 160, 0.85)');
    g.addColorStop(0.55, 'rgba(255, 200, 120, 0.35)');
    g.addColorStop(1.0, 'rgba(255, 200, 120, 0.0)');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
}

function _createRingGlowTexture({ size = 384 } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2;

    // Donut-like limb: dark center → faint airglow → brighter terminator band → soft outer falloff.
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0.0, 'rgba(255,255,255,0.0)');
    g.addColorStop(0.50, 'rgba(255,255,255,0.0)');
    g.addColorStop(0.58, 'rgba(255,248,235,0.14)');
    g.addColorStop(0.70, 'rgba(255,255,255,0.82)');
    g.addColorStop(0.80, 'rgba(255,245,225,0.42)');
    g.addColorStop(0.90, 'rgba(255,238,210,0.16)');
    g.addColorStop(1.0, 'rgba(255,255,255,0.0)');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
}

/**
 * Creates the Earth globe mesh with material
 * @param {THREE.TextureLoader} textureLoader - Texture loader instance
 * @param {THREE.WebGLRenderer} renderer - Renderer instance
 * @param {string} initialTexturePath - Initial texture path
 * @param {THREE.Texture} normalMap - Normal map texture
 * @param {Function} onTextureLoaded - Callback when texture loads
 * @param {Function} onError - Error callback
 * @returns {THREE.Mesh} - Globe mesh
 */
export function createGlobeMesh(textureLoader, renderer, initialTexturePath, normalMap, onTextureLoaded, onError) {
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    
    const earthTexture = loadTexture(
        textureLoader,
        initialTexturePath,
        renderer,
        (texture) => {
            console.log('Earth texture loaded successfully:', initialTexturePath);
            if (onTextureLoaded) {
                onTextureLoaded(texture);
            }
        },
        onError
    );
    
    const material = new THREE.MeshStandardMaterial({
        map: earthTexture,
        normalMap: normalMap,
        transparent: false,
        opacity: 1.0,
        metalness: 0.12,
        roughness: 0.62
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'earthSurface';
    /* Oblate spheroid: polar axis Y slightly shorter than equatorial XZ (WGS84). */
    mesh.scale.set(1, EARTH_POLAR_TO_EQUATORIAL_RATIO, 1);
    return mesh;
}

/**
 * Vertex shader for pattern wave effect
 */
const PATTERN_WAVE_VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vWorldNormal;
void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Fragment shader for pattern wave effect - horizontal wave that sweeps across
 * with glow effect at the center
 */
const PATTERN_WAVE_FRAGMENT_SHADER = `
uniform sampler2D uPatternMap;
uniform vec3 uTintColor;
uniform float uTime;
uniform float uBaseOpacity;
uniform float uShadeBySun;
uniform vec3 uSunDirWorld;

varying vec2 vUv;
varying vec3 vWorldNormal;

void main() {
    vec4 texColor = texture2D(uPatternMap, vUv);
    
    // Wave effect: sweeps from right to left
    // vUv.x goes from 0 to 1 across the texture
    float waveSpeed = 0.2;
    float waveWidth = 0.5;
    float wavePos = fract(uTime * waveSpeed);
    
    // Calculate distance from wave center (wrapping around)
    float dist = abs(vUv.x - wavePos);
    if (dist > 0.5) dist = 1.0 - dist;
    
    // Create wave intensity: 0.1 base, up to 1.5 at wave center for moderate wave
    float waveRaw = 1.0 - smoothstep(0.0, waveWidth, dist);
    float wave = 0.1 + waveRaw * 1.4;
    
    // Apply base opacity with wave modulation
    float finalOpacity = texColor.a * uBaseOpacity * wave * 3.0;

    // Dim pattern at the poles to hide where texture wraps
    // vUv.y goes from 0 (south pole) to 1 (north pole)
    float polarFade = 1.0 - smoothstep(0.75, 0.95, abs(vUv.y - 0.5) * 2.0);
    finalOpacity *= polarFade;

    // Output color with tint
    vec3 outRgb = uTintColor * texColor.rgb;

    gl_FragColor = vec4(outRgb, finalOpacity);
}
`;

/**
 * Creates a pattern wave shader material
 * @param {THREE.Texture} patternTexture - Pattern texture
 * @param {number} tintColor - Tint color hex
 * @param {number} opacity - Base opacity
 * @param {boolean} doubleSided - Whether material is double-sided
 * @param {boolean} [shadeGlobeBySun=false] - Globe only: dim additive pattern on night hemisphere
 * @returns {THREE.ShaderMaterial}
 */
function createPatternWaveMaterial(patternTexture, tintColor, opacity, doubleSided = false, shadeGlobeBySun = false) {
    const color = new THREE.Color(tintColor);
    
    return new THREE.ShaderMaterial({
        uniforms: {
            uPatternMap: { value: patternTexture },
            uTintColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
            uTime: { value: 0.0 },
            uBaseOpacity: { value: opacity },
            uShadeBySun: { value: shadeGlobeBySun ? 1.0 : 0.0 },
            uSunDirWorld: { value: new THREE.Vector3(0, 0, 1) }
        },
        vertexShader: PATTERN_WAVE_VERTEX_SHADER,
        fragmentShader: PATTERN_WAVE_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: doubleSided ? THREE.DoubleSide : THREE.FrontSide
    });
}

/**
 * Creates a pattern overlay sphere that wraps slightly outside the globe
 * @param {THREE.TextureLoader} textureLoader - Texture loader
 * @param {THREE.WebGLRenderer} renderer - Renderer
 * @param {number} [tintColor=0x2196F3] - Tint color (hex)
 * @param {number} [opacity=0.12] - Overlay opacity
 * @param {string} [paletteKey='blue'] - Palette key for pattern image
 * @returns {THREE.Mesh}
 */
export function createGlobePatternOverlay(textureLoader, renderer, tintColor = 0x2196F3, opacity = 0.15, paletteKey = 'blue') {
    const geometry = new THREE.SphereGeometry(1.008, 64, 64); // Larger than clouds (1.004) to sit on top
    
    const patternPath = getPalettePatternPath(paletteKey);
    const patternTexture = loadTexture(
        textureLoader,
        patternPath,
        renderer,
        null,
        null
    );
    
    const material = createPatternWaveMaterial(patternTexture, tintColor, opacity, false, false);
    
    return new THREE.Mesh(geometry, material);
}

/**
 * Creates a pattern overlay plane for the flat map
 * @param {THREE.TextureLoader} textureLoader - Texture loader
 * @param {THREE.WebGLRenderer} renderer - Renderer
 * @param {number} [tintColor=0x2196F3] - Tint color (hex)
 * @param {number} [opacity=0.12] - Overlay opacity
 * @param {string} [paletteKey='blue'] - Palette key for pattern image
 * @returns {THREE.Mesh}
 */
export function createMapPatternOverlay(textureLoader, renderer, tintColor = 0x2196F3, opacity = 0.15, paletteKey = 'blue') {
    const planeWidth = 2.0;
    const planeHeight = 1.0;
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    
    const patternPath = getPalettePatternPath(paletteKey);
    const patternTexture = loadTexture(
        textureLoader,
        patternPath,
        renderer,
        null,
        null
    );
    
    const material = createPatternWaveMaterial(patternTexture, tintColor, opacity, true);
    
    const plane = new THREE.Mesh(geometry, material);
    plane.position.set(0, 0, 0.01); // Slightly in front of map
    return plane;
}

/**
 * Update pattern wave animation - call this in your render loop
 * @param {THREE.Mesh} patternMesh - The pattern overlay mesh
 * @param {number} deltaTime - Time since last frame in seconds
 */
export function updatePatternWave(patternMesh, deltaTime) {
    if (patternMesh && patternMesh.material && patternMesh.material.uniforms) {
        patternMesh.material.uniforms.uTime.value += deltaTime;
    }
}

/**
 * Gets the accent color hex for a palette key
 * @param {string} paletteKey - Palette key (e.g., 'blue', 'gray', 'crimson', 'nulled')
 * @returns {number} Hex color
 */
export function getPaletteAccentHex(paletteKey = 'blue') {
    const paletteAccents = {
        blue: 0x2196F3,
        gray: 0xffffff,
        crimson: 0xef5350,
        nulled: 0xb388ff
    };
    return paletteAccents[paletteKey] || 0x2196F3;
}

/**
 * Gets the pattern image path for a palette key
 * @param {string} paletteKey - Palette key (e.g., 'blue', 'gray', 'crimson', 'nulled')
 * @returns {string} Path to pattern image
 */
export function getPalettePatternPath(paletteKey = 'blue') {
    const patternPaths = {
        blue: 'src/assets/images/Background%20Pattern/Pattern Blue.png',
        gray: 'src/assets/images/Background%20Pattern/Pattern Dark.png',
        crimson: 'src/assets/images/Background%20Pattern/Pattern Crimson.png',
        nulled: 'src/assets/images/Background%20Pattern/Pattern Nulled.png'
    };
    return patternPaths[paletteKey] || 'src/assets/images/Background%20Pattern/Pattern Blue.png';
}

/** Ring radius in the horizontal (XZ) plane; matches legacy 3D offset length (~84). */
const SUN_ANCHOR_RADIUS = new THREE.Vector3(-78, 14, -28).length();
/** Fallback azimuth on the equatorial ring (same horizontal bearing as old -78,0,-28). */
const SUN_BACKGROUND_FALLBACK_POSITION = new THREE.Vector3(-78, 0, -28).normalize().multiplyScalar(SUN_ANCHOR_RADIUS);
/** Matches `--breakpoint-mobile` / project mobile layout. */
const SUN_VIEWPORT_MOBILE_MAX_WIDTH = 768;
/** Pull sun toward origin (Earth) on small screens (lower = closer). */
const SUN_MOBILE_DISTANCE_SCALE = 0.52;

/** World +Y: manual dev yaw spins the sun anchor around the vertical axis. */
const _SUN_DEV_YAW_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * Random azimuth only: sun stays in the equatorial (XZ) plane (Y = 0) so light never comes from steep above/below.
 * @returns {THREE.Vector3}
 */
function createRandomSunAnchorBasePosition() {
    const theta = Math.random() * Math.PI * 2;
    const r = SUN_ANCHOR_RADIUS;
    return new THREE.Vector3(Math.cos(theta) * r, 0, Math.sin(theta) * r);
}

/**
 * Move sun sprite + light closer to the globe on mobile; restore desktop offset when wide.
 * @param {{sprite: THREE.Sprite, light: THREE.DirectionalLight}|null|undefined} sunBg
 */
/**
 * Put Earth globe / flat map subtree on the dedicated light layer so only Earth receives sun + earth hemisphere.
 * @param {THREE.Object3D|null} root
 */
export function assignEarthLightLayer(root) {
    if (!root) return;
    root.traverse((obj) => {
        if (obj.layers) obj.layers.set(EARTH_GLOBE_LIGHT_LAYER);
    });
}

/**
 * Sets `uSunDirWorld` on globe atmosphere shaders (procedural clouds, aurora, pattern) from the sun light.
 * Atlas clouds use MeshStandardMaterial and follow scene lights instead.
 * @param {THREE.DirectionalLight|null|undefined} light
 * @param {(THREE.Object3D|null|undefined)[]} meshes
 */
export function syncAtmosphereSunDirUniforms(light, meshes) {
    if (!light || !meshes || !meshes.length) return;
    const dir = light.position.clone().normalize();
    for (let i = 0; i < meshes.length; i++) {
        const mat = meshes[i] && meshes[i].material;
        if (mat && mat.uniforms && mat.uniforms.uSunDirWorld) {
            mat.uniforms.uSunDirWorld.value.copy(dir);
        }
    }
}

export function applySunBackgroundForViewport(sunBg) {
    if (!sunBg || !sunBg.sprite) return;
    const mobile = typeof window !== 'undefined' && window.innerWidth <= SUN_VIEWPORT_MOBILE_MAX_WIDTH;
    const base = sunBg.sunAnchorBase || SUN_BACKGROUND_FALLBACK_POSITION;
    const pos = base.clone();
    const yawDeg = Number(sunBg.sunDevYawDeg);
    if (Number.isFinite(yawDeg)) {
        pos.applyAxisAngle(_SUN_DEV_YAW_AXIS, THREE.MathUtils.degToRad(yawDeg));
    }
    if (mobile) pos.multiplyScalar(SUN_MOBILE_DISTANCE_SCALE);
    sunBg.sprite.position.copy(pos);
    if (sunBg.light) sunBg.light.position.copy(pos);
}

/**
 * Adds a simple "sun" background element for immersion.
 * Visual: additive sprite with radial gradient.
 * Lighting: subtle warm directional light.
 * @param {Object} params
 * @param {THREE.Scene} params.scene
 * @returns {{sprite: THREE.Sprite, light: THREE.DirectionalLight}|null}
 */
export function addSunBackground({ scene }) {
    if (!scene) return null;

    const tex = _createRadialGlowTexture({ size: 256 });
    if (!tex) return null;

    const mat = new THREE.SpriteMaterial({
        map: tex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending
    });

    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(10, 10, 1);
    sprite.renderOrder = -10;
    sprite.frustumCulled = false;
    scene.add(sprite);

    /* Primary key light — layer 1 only so Moon/Mars stay on self-lit world ambient (layer 0). */
    const light = new THREE.DirectionalLight(0xfffcfa, 3.15);
    light.name = 'SunDirectionalLight';
    light.layers.set(EARTH_GLOBE_LIGHT_LAYER);
    scene.add(light);
    scene.add(light.target);
    light.target.position.set(0, 0, 0);

    const result = {
        sprite,
        light,
        sunAnchorBase: createRandomSunAnchorBasePosition(),
        /** Manual spin (degrees, world Y); dev slider — see DevSunYawControl.js */
        sunDevYawDeg: 0
    };
    applySunBackgroundForViewport(result);
    return result;
}

/**
 * Creates a blurry rim/atmosphere glow around the globe using the same technique as the sun:
 * a single additive sprite with a donut-shaped radial gradient texture.
 * @param {Object} params
 * @param {number} params.color
 * @param {number} params.scale
 * @param {number} params.opacity
 * @returns {THREE.Sprite|null}
 */
export function createGlobeRimGlowSprite({ color = 0x6fd3ff, scale = 2.7, opacity = 0.75, intensity = 1.0 } = {}) {
    const tex = _createRingGlowTexture({ size: 384 });
    if (!tex) return null;

    const mat = new THREE.SpriteMaterial({
        map: tex,
        color: new THREE.Color(color),
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending
    });
    if (Number.isFinite(intensity) && intensity !== 1.0) {
        // Additive sprites can safely use >1.0 for a brighter "emissive" look.
        mat.color.multiplyScalar(intensity);
    }

    const sprite = new THREE.Sprite(mat);
    sprite.name = 'globeRimGlowSprite';
    sprite.scale.set(scale, scale, 1);
    sprite.renderOrder = 1;
    sprite.frustumCulled = false;
    sprite.userData.rimIntensity = (Number.isFinite(intensity) && intensity > 0) ? intensity : 1.0;
    return sprite;
}

/**
 * Thin sphere shell slightly outside the globe: polar aurora bands (object-space lat) + soft ripples.
 * Uses additive blending; animates via uTime in {@link GlobeView#updateAtmosphereEffects}.
 * @param {Object} [opts]
 * @param {number} [opts.radius] - Slightly > globe (1); sits outside surface/rim for visibility (default ~1.022)
 * @param {number} [opts.uIntensity] - Palette baseline strength (default ~0.42); veil boost multiplies in shader
 * @returns {THREE.Mesh|null}
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
 * Veil uniforms match the globe shell so {@link GlobeView} can drive both from one animation state.
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

/** 0 = neutral white clouds, 1 = full rim/palette color (keep low so atlases stay natural). */
const GLOBE_CLOUD_PALETTE_BLEND = 0.34;

function makeCloudTintColor(tintHex) {
    const c = new THREE.Color(0xffffff).lerp(new THREE.Color(tintHex), GLOBE_CLOUD_PALETTE_BLEND);
    c.multiplyScalar(0.92);
    return c;
}

/**
 * Updates cloud mesh tint to match palette (texture: Standard/Basic color; procedural: uTint).
 * @param {THREE.Mesh|null} mesh
 * @param {number} tintHex - e.g. rim key color 0x6fd3ff
 */
export function applyGlobeCloudPaletteTint(mesh, tintHex) {
    if (!mesh) return;
    mesh.userData.cloudTintHex = tintHex;
    if (!mesh.material) return;
    const tintCol = makeCloudTintColor(tintHex);
    const m = mesh.material;
    if (m.uniforms && m.uniforms.uTint) {
        m.uniforms.uTint.value.set(tintCol.r, tintCol.g, tintCol.b);
    } else if (m.color) {
        m.color.copy(tintCol);
    }
}

/**
 * Curated equirectangular (2:1) cloud atlases — one random path per page load.
 * Files live in `src/assets/images/Maps/Cloud Textures/` as `Cloud Map 1.png` … (spaces URL-encoded for loading).
 *
 * @type {{ path: string }[]}
 */
export const GLOBE_CLOUD_ATLAS_VARIANTS = [
    { path: `src/assets/images/Maps/Cloud%20Textures/${encodeURIComponent('Cloud Map 1.png')}` },
    { path: `src/assets/images/Maps/Cloud%20Textures/${encodeURIComponent('Cloud Map 2.png')}` },
    { path: `src/assets/images/Maps/Cloud%20Textures/${encodeURIComponent('Cloud Map 3.png')}` },
    { path: `src/assets/images/Maps/Cloud%20Textures/${encodeURIComponent('Cloud Map 4.png')}` },
    { path: `src/assets/images/Maps/Cloud%20Textures/${encodeURIComponent('Cloud Map 5.jpg')}` }
];

function cloudMeshShouldDisplay() {
    try {
        const m = window.globeController && window.globeController.sceneModel;
        if (m && typeof m.getGlobeWeatherEffectsVisible === 'function') {
            return m.getGlobeWeatherEffectsVisible() !== false;
        }
    } catch (_) { /* ignore */ }
    return true;
}

function makeGlobeCloudProceduralMaterial(opacity, tintHex) {
    const tintCol = makeCloudTintColor(tintHex);
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uOpacity: { value: opacity },
            uTint: { value: new THREE.Vector3(tintCol.r, tintCol.g, tintCol.b) },
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
            uniform float uOpacity;
            uniform vec3 uTint;
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
                float mu = abs(n.y);
                vec3 drift = vec3(uTime * 0.011, uTime * 0.017, uTime * 0.009);
                vec3 p = n * 2.95 + drift;
                float d = triNoise3(p) * 0.52 + triNoise3(p * 2.07 + vec3(3.1, 7.4, 2.8)) * 0.30
                    + triNoise3(p * 5.1 + vec3(11.0, 4.2, 6.9)) * 0.18;
                float deck = smoothstep(0.10, 0.38, mu) * (1.0 - smoothstep(0.72, 0.94, mu));
                deck = mix(0.42, 1.0, deck);
                float cov = smoothstep(0.38, 0.74, d) * deck;
                float ndl = max(0.0, dot(normalize(vWorldNormal), normalize(uSunDirWorld)));
                float sunMask = mix(0.025, 1.0, pow(ndl, 0.32));
                float alpha = cov * uOpacity * mix(0.12, 1.0, pow(ndl, 0.28));
                if (alpha < 0.012) discard;
                float lit = 0.82 + 0.18 * cov;
                vec3 albedo = vec3(0.93, 0.95, 1.0) * lit * uTint * sunMask;
                gl_FragColor = vec4(albedo, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.FrontSide
    });
}

function makeMapCloudProceduralMaterial(opacity, tintHex) {
    const tintCol = makeCloudTintColor(tintHex);
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uOpacity: { value: opacity },
            uTint: { value: new THREE.Vector3(tintCol.r, tintCol.g, tintCol.b) }
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
            uniform float uOpacity;
            uniform vec3 uTint;
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
                float mu = abs(vUv.y - 0.5) * 2.0;
                vec3 drift = vec3(uTime * 0.011, uTime * 0.017, uTime * 0.009);
                vec3 p = vec3(vUv.x * 8.0, vUv.y * 4.0, uTime * 0.02) + drift;
                float d = triNoise3(p) * 0.52 + triNoise3(p * 2.07 + vec3(3.1, 7.4, 2.8)) * 0.30
                    + triNoise3(p * 5.1 + vec3(11.0, 4.2, 6.9)) * 0.18;
                float deck = smoothstep(0.10, 0.38, mu) * (1.0 - smoothstep(0.72, 0.94, mu));
                deck = mix(0.42, 1.0, deck);
                float cov = smoothstep(0.38, 0.74, d) * deck;
                float alpha = cov * uOpacity;
                if (alpha < 0.015) discard;
                float lit = 0.82 + 0.18 * cov;
                vec3 albedo = vec3(0.93, 0.95, 1.0) * lit * uTint;
                gl_FragColor = vec4(albedo, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide
    });
}

/**
 * Picks a random cloud atlas (same as first load) and swaps the mesh material when ready.
 * @param {THREE.Mesh} mesh
 * @param {THREE.TextureLoader} textureLoader
 * @param {THREE.WebGLRenderer} renderer
 * @param {{ path: string }[]} variants
 * @param {number} opacity
 */
function startCloudAtlasRandomLoad(mesh, textureLoader, renderer, variants, opacity) {
    if (!mesh || !variants || !variants.length || !textureLoader || !renderer) return;
    const choice = variants[Math.floor(Math.random() * variants.length)];
    mesh.visible = false;
    loadTexture(
        textureLoader,
        choice.path,
        renderer,
        (tex) => {
            const old = mesh.material;
            if (old && old.dispose) old.dispose();
            tex.needsUpdate = true;
            const h = mesh.userData.cloudTintHex != null ? mesh.userData.cloudTintHex : 0xffffff;
            const tc = makeCloudTintColor(h);
            mesh.material = new THREE.MeshStandardMaterial({
                map: tex,
                alphaMap: tex,
                color: tc.clone(),
                transparent: true,
                opacity: Math.min(1, opacity),
                metalness: 0.02,
                roughness: 0.96,
                emissive: 0x000000,
                emissiveIntensity: 0,
                depthWrite: false,
                depthTest: true,
                side: THREE.FrontSide,
                fog: false
            });
            mesh.userData.proceduralClouds = false;
            mesh.userData.cloudAtlasPath = choice.path;
            mesh.visible = cloudMeshShouldDisplay();
        },
        () => {
            mesh.visible = cloudMeshShouldDisplay();
            console.warn('[globe clouds] Cloud albedo not loaded; using procedural layer:', choice.path);
        }
    );
}

/**
 * Re-roll cloud atlas and reset procedural fallback (same random selection as page load).
 * @param {THREE.Mesh|null} mesh
 * @param {Object} [opts]
 * @param {THREE.TextureLoader|null} [opts.textureLoader]
 * @param {THREE.WebGLRenderer|null} [opts.renderer]
 * @param {{ path: string }[]|null} [opts.cloudTextureVariants]
 * @param {number} [opts.opacity]
 * @param {function(number, number): THREE.Material} [opts.makeProcedural]
 */
function rerandomizeCloudAtlasMesh(mesh, {
    textureLoader = null,
    renderer = null,
    cloudTextureVariants = GLOBE_CLOUD_ATLAS_VARIANTS,
    opacity = 0.5,
    makeProcedural = makeGlobeCloudProceduralMaterial
} = {}) {
    if (!mesh) return;
    const tintHex = mesh.userData.cloudTintHex != null ? mesh.userData.cloudTintHex : 0xffffff;
    const old = mesh.material;
    if (old) {
        try {
            if (old.map) old.map.dispose();
            old.dispose();
        } catch (_) { /* ignore */ }
    }
    mesh.material = makeProcedural(opacity, tintHex);
    mesh.userData.proceduralClouds = true;
    delete mesh.userData.cloudAtlasPath;

    if (cloudTextureVariants && cloudTextureVariants.length && textureLoader && renderer) {
        startCloudAtlasRandomLoad(mesh, textureLoader, renderer, cloudTextureVariants, opacity);
    } else {
        mesh.visible = cloudMeshShouldDisplay();
    }
}

export function rerandomizeGlobeCloudAtlas(mesh, opts = {}) {
    return rerandomizeCloudAtlasMesh(mesh, { ...opts, makeProcedural: makeGlobeCloudProceduralMaterial });
}

export function rerandomizeFlatMapCloudAtlas(mesh, opts = {}) {
    return rerandomizeCloudAtlasMesh(mesh, { ...opts, makeProcedural: makeMapCloudProceduralMaterial });
}

/**
 * Slightly larger sphere above the Earth: cloud albedo layer (same UV as MAP.png).
 * NASA Blue Marble–style atlases (three.js `earth_clouds_*`); procedural fallback if load fails.
 * @param {Object} [opts]
 * @param {THREE.TextureLoader} [opts.textureLoader]
 * @param {THREE.WebGLRenderer} [opts.renderer]
 * @param {number} [opts.radius] - Default ~1.004
 * @param {number} [opts.opacity] - Overall transparency (~0.5 recommended)
 * @param {number} [opts.tintHex] - Multiplies cloud color (match rim / palette), e.g. 0x6fd3ff
 * @param {{ path: string }[]|null} [opts.cloudTextureVariants]
 * @param {string|null} [opts.cloudTexturePath] - Single atlas (ignored if cloudTextureVariants has length)
 * @returns {THREE.Mesh|null}
 */
export function createGlobeCloudLayer({
    textureLoader = null,
    renderer = null,
    radius = 1.004,
    opacity = 0.5,
    tintHex = 0xffffff,
    cloudTextureVariants = null,
    cloudTexturePath = null
} = {}) {
    const geometry = new THREE.SphereGeometry(radius, 64, 64);
    const proceduralMat = makeGlobeCloudProceduralMaterial(opacity, tintHex);

    const mesh = new THREE.Mesh(geometry, proceduralMat);
    mesh.name = 'globeCloudLayer';
    mesh.renderOrder = 0;
    mesh.frustumCulled = false;
    mesh.userData.proceduralClouds = true;
    mesh.userData.cloudTintHex = tintHex;

    const variants =
        cloudTextureVariants && cloudTextureVariants.length
            ? cloudTextureVariants
            : cloudTexturePath
              ? [{ path: cloudTexturePath }]
              : [];

    if (variants.length && textureLoader && renderer) {
        startCloudAtlasRandomLoad(mesh, textureLoader, renderer, variants, opacity);
    }

    return mesh;
}

/**
 * Cloud layer for the 2:1 flat map plane (same equirectangular UVs as {@link createEarthMapPlane}).
 * @param {Object} [opts] - Same shape as {@link createGlobeCloudLayer} except no radius.
 */
export function createFlatMapCloudLayer({
    textureLoader = null,
    renderer = null,
    opacity = 0.5,
    tintHex = 0xffffff,
    cloudTextureVariants = null,
    cloudTexturePath = null
} = {}) {
    const geometry = new THREE.PlaneGeometry(2.0, 1.0, 1, 1);
    const proceduralMat = makeMapCloudProceduralMaterial(opacity, tintHex);

    const mesh = new THREE.Mesh(geometry, proceduralMat);
    mesh.name = 'flatMapCloudLayer';
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;
    mesh.userData.proceduralClouds = true;
    mesh.userData.cloudTintHex = tintHex;

    const variants =
        cloudTextureVariants && cloudTextureVariants.length
            ? cloudTextureVariants
            : cloudTexturePath
              ? [{ path: cloudTexturePath }]
              : [];

    if (variants.length && textureLoader && renderer) {
        startCloudAtlasRandomLoad(mesh, textureLoader, renderer, variants, opacity);
    }

    return mesh;
}

/**
 * Creates the Earth flat map plane mesh with the same texture as the globe.
 * Uses a 2:1 aspect ratio so equirectangular lat/lon projection aligns.
 * @param {THREE.TextureLoader} textureLoader
 * @param {THREE.WebGLRenderer} renderer
 * @param {string} texturePath
 * @param {Function} onTextureLoaded - Optional callback when texture loads
 * @param {Function} onError - Optional error callback
 * @returns {THREE.Mesh}
 */
export function createEarthMapPlane(textureLoader, renderer, texturePath, onTextureLoaded = null, onError = null) {
    // 2:1 aspect ratio for equirectangular world maps
    const planeWidth = 2.0;
    const planeHeight = 1.0;
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

    const earthTexture = loadTexture(
        textureLoader,
        texturePath,
        renderer,
        (texture) => {
            if (onTextureLoaded) onTextureLoaded(texture);
        },
        onError
    );

    const material = new THREE.MeshStandardMaterial({
        map: earthTexture,
        side: THREE.DoubleSide,
        transparent: false,
        opacity: 1.0,
        depthWrite: true,
        metalness: 0.12,
        roughness: 0.62
    });

    const plane = new THREE.Mesh(geometry, material);
    plane.position.set(0, 0, 0);
    plane.visible = false;
    // PlaneGeometry faces +Z by default, which matches camera at +Z looking at origin.
    return plane;
}

/**
 * Sets up Moon and Mars planes for the globe
 * @param {Object} params - Parameters
 * @param {THREE.Scene} params.scene - Scene to add planes to
 * @param {THREE.TextureLoader} params.textureLoader - Texture loader instance
 * @param {THREE.WebGLRenderer} params.renderer - Renderer instance
 * @param {'blue'|'gray'|'crimson'|'nulled'} [params.palette] - Active color palette
 * @param {boolean} [params.isGray] - Legacy: if true and palette omitted, use gray
 * @param {Object} params.sceneModel - SceneModel instance
 * @returns {Object} - moonPlane, marsPlane, orbitPlane and rigs
 */
export function setupCelestialPlanes({ scene, textureLoader, renderer, palette, isGray, sceneModel }) {
    const paletteKey =
        palette != null && String(palette).length
            ? String(palette).toLowerCase()
            : (isGray ? 'gray' : 'blue');
    const moonTexturePath = getMoonTexturePath(paletteKey);
    const moonPlane = createCelestialPlane({
        texturePath: moonTexturePath,
        paletteKey,
        textureLoader,
        renderer,
        size: 0.4,
        position: new THREE.Vector3(1.5, 0.3, 0),
        visible: false
    });
    moonPlane.userData.isCelestialVisualMesh = true;

    const moonRig = new THREE.Group();
    moonRig.name = 'moonCelestialRig';
    moonRig.userData.isCelestialScaleRig = true;
    moonRig.position.copy(moonPlane.position);
    moonRig.quaternion.copy(moonPlane.quaternion);
    moonRig.scale.copy(moonPlane.scale);
    moonPlane.position.set(0, 0, 0);
    moonPlane.quaternion.set(0, 0, 0, 1);
    moonPlane.scale.set(1, 1, 1);
    moonRig.add(moonPlane);

    if (sceneModel.setMoonPlane) {
        sceneModel.setMoonPlane(moonPlane);
    } else {
        sceneModel.moonPlane = moonPlane;
    }
    if (sceneModel.setMoonRig) {
        sceneModel.setMoonRig(moonRig);
    } else {
        sceneModel.moonRig = moonRig;
    }
    scene.add(moonRig);
    console.log('Moon rig created at:', moonRig.position, 'rotation:', moonRig.quaternion);

    const marsTexturePath = getMarsTexturePath(paletteKey);
    const marsPlane = createCelestialPlane({
        texturePath: marsTexturePath,
        paletteKey,
        textureLoader,
        renderer,
        size: 0.4,
        position: new THREE.Vector3(1.5, -0.3, 0),
        visible: false
    });
    marsPlane.userData.isCelestialVisualMesh = true;

    const marsRig = new THREE.Group();
    marsRig.name = 'marsCelestialRig';
    marsRig.userData.isCelestialScaleRig = true;
    marsRig.position.copy(marsPlane.position);
    marsRig.quaternion.copy(marsPlane.quaternion);
    marsRig.scale.copy(marsPlane.scale);
    marsPlane.position.set(0, 0, 0);
    marsPlane.quaternion.set(0, 0, 0, 1);
    marsPlane.scale.set(1, 1, 1);
    marsRig.add(marsPlane);

    if (sceneModel.setMarsPlane) {
        sceneModel.setMarsPlane(marsPlane);
    } else {
        sceneModel.marsPlane = marsPlane;
    }
    if (sceneModel.setMarsRig) {
        sceneModel.setMarsRig(marsRig);
    } else {
        sceneModel.marsRig = marsRig;
    }
    scene.add(marsRig);
    console.log('Mars rig created at:', marsRig.position, 'rotation:', marsRig.quaternion);

    const orbitTexturePath = getOrbitTexturePath();
    const orbitPlane = createCelestialPlane({
        texturePath: orbitTexturePath,
        paletteKey,
        textureLoader,
        renderer,
        size: 0.4,
        position: new THREE.Vector3(1.5, -0.75, 0),
        visible: false
    });
    orbitPlane.userData.isCelestialVisualMesh = true;

    const orbitRig = new THREE.Group();
    orbitRig.name = 'orbitCelestialRig';
    orbitRig.userData.isCelestialScaleRig = true;
    orbitRig.position.copy(orbitPlane.position);
    orbitRig.quaternion.copy(orbitPlane.quaternion);
    orbitRig.scale.copy(orbitPlane.scale);
    orbitPlane.position.set(0, 0, 0);
    orbitPlane.quaternion.set(0, 0, 0, 1);
    orbitPlane.scale.set(1, 1, 1);
    orbitRig.add(orbitPlane);

    if (sceneModel.setOrbitPlane) {
        sceneModel.setOrbitPlane(orbitPlane);
    } else {
        sceneModel.orbitPlane = orbitPlane;
    }
    if (sceneModel.setOrbitRig) {
        sceneModel.setOrbitRig(orbitRig);
    } else {
        sceneModel.orbitRig = orbitRig;
    }
    scene.add(orbitRig);
    console.log('Orbit rig created at:', orbitRig.position, 'rotation:', orbitRig.quaternion);

    return { moonPlane, marsPlane, orbitPlane, moonRig, marsRig, orbitRig };
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.GlobeInitHelpers) {
        window.GlobeInitHelpers = {};
    }
    window.GlobeInitHelpers.createGlobeMesh = createGlobeMesh;
    window.GlobeInitHelpers.createEarthMapPlane = createEarthMapPlane;
    window.GlobeInitHelpers.setupCelestialPlanes = setupCelestialPlanes;
    window.GlobeInitHelpers.assignEarthLightLayer = assignEarthLightLayer;
    window.GlobeInitHelpers.syncAtmosphereSunDirUniforms = syncAtmosphereSunDirUniforms;
    window.GlobeInitHelpers.addSunBackground = addSunBackground;
    window.GlobeInitHelpers.applySunBackgroundForViewport = applySunBackgroundForViewport;
    window.GlobeInitHelpers.createGlobeRimGlowSprite = createGlobeRimGlowSprite;
    window.GlobeInitHelpers.createGlobeAuroraShell = createGlobeAuroraShell;
    window.GlobeInitHelpers.createFlatMapAuroraShell = createFlatMapAuroraShell;
    window.GlobeInitHelpers.createGlobeCloudLayer = createGlobeCloudLayer;
    window.GlobeInitHelpers.createFlatMapCloudLayer = createFlatMapCloudLayer;
    window.GlobeInitHelpers.GLOBE_CLOUD_ATLAS_VARIANTS = GLOBE_CLOUD_ATLAS_VARIANTS;
    window.GlobeInitHelpers.applyGlobeCloudPaletteTint = applyGlobeCloudPaletteTint;
    window.GlobeInitHelpers.rerandomizeGlobeCloudAtlas = rerandomizeGlobeCloudAtlas;
    window.GlobeInitHelpers.rerandomizeFlatMapCloudAtlas = rerandomizeFlatMapCloudAtlas;
    window.GlobeInitHelpers.createGlobePatternOverlay = createGlobePatternOverlay;
    window.GlobeInitHelpers.createMapPatternOverlay = createMapPatternOverlay;
    window.GlobeInitHelpers.getPaletteAccentHex = getPaletteAccentHex;
    window.GlobeInitHelpers.getPalettePatternPath = getPalettePatternPath;
    window.GlobeInitHelpers.updatePatternWave = updatePatternWave;
}
