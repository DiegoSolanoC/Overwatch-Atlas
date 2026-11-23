import { loadTexture } from './WorldviewGlobeTextures.js';
import { getGlobeQualitySnapshot } from '../../../worldview-shared-assets/constants/WorldviewQualitySettings.js';
import { loadEarthLandMaskTexture } from '../../../worldview-shared-assets/utils/EarthLandMask.js';

const PATTERN_WAVE_VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vWorldNormal;
void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** White in Alpha.png = land (city lights); pattern uses the inverse so waves only show on water. */
const PATTERN_WAVE_FRAGMENT_SHADER = `
uniform sampler2D uPatternMap;
uniform sampler2D uLandMask;
uniform float uLandThreshold;
uniform float uHasLandMask;
uniform vec3 uTintColor;
uniform float uTime;
uniform float uBaseOpacity;
uniform float uShadeBySun;
uniform vec3 uSunDirWorld;

varying vec2 vUv;
varying vec3 vWorldNormal;

void main() {
    // Ocean-only early out (same Alpha.png as city lights, inverted)
    float water = 1.0;
    if (uHasLandMask > 0.5) {
        float land = texture2D(uLandMask, vUv).r;
        water = 1.0 - smoothstep(uLandThreshold - 0.04, uLandThreshold + 0.04, land);
        if (water < 0.02) discard;
    }

    vec4 texColor = texture2D(uPatternMap, vUv);
    float waveSpeed = 0.2;
    float waveWidth = 0.5;
    float wavePos = fract(uTime * waveSpeed);
    float dist = abs(vUv.x - wavePos);
    if (dist > 0.5) dist = 1.0 - dist;
    float waveRaw = 1.0 - smoothstep(0.0, waveWidth, dist);
    float wave = 0.1 + waveRaw * 1.4;
    float finalOpacity = texColor.a * uBaseOpacity * wave * 3.0;
    float polarFade = 1.0 - smoothstep(0.75, 0.95, abs(vUv.y - 0.5) * 2.0);
    finalOpacity *= polarFade * water;
    if (finalOpacity < 0.004) discard;

    vec3 outRgb = uTintColor * texColor.rgb;
    gl_FragColor = vec4(outRgb, finalOpacity);
}
`;

function createPatternWaveMaterial(patternTexture, tintColor, opacity, doubleSided = false, shadeGlobeBySun = false, landMaskTexture = null) {
    const color = new THREE.Color(tintColor);
    const hasMask = !!(landMaskTexture && landMaskTexture.image);
    return new THREE.ShaderMaterial({
        uniforms: {
            uPatternMap: { value: patternTexture },
            uLandMask: { value: landMaskTexture || patternTexture },
            uLandThreshold: { value: 96 / 255 },
            uHasLandMask: { value: hasMask ? 1.0 : 0.0 },
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
 * Bind the shared (downscaled) equirect land/ocean Alpha map for pattern water masking.
 * @param {THREE.TextureLoader} textureLoader
 * @param {THREE.WebGLRenderer} [renderer]
 * @param {THREE.ShaderMaterial} material
 */
function bindLandMaskToMaterial(textureLoader, renderer, material) {
    if (!textureLoader || !material?.uniforms) return;

    loadEarthLandMaskTexture(textureLoader, renderer)
        .then((tex) => {
            material.uniforms.uLandMask.value = tex;
            material.uniforms.uHasLandMask.value = 1.0;
        })
        .catch((err) => {
            console.warn('WorldviewPatternOverlay: land mask failed; pattern stays unmasked', err);
            material.uniforms.uHasLandMask.value = 0.0;
        });
}

export function createGlobePatternOverlay(textureLoader, renderer, tintColor = 0x2196F3, opacity = 0.15, paletteKey = 'blue') {
    const segs = getGlobeQualitySnapshot().shellSegments || 64;
    const geometry = new THREE.SphereGeometry(1.008, segs, segs);
    const patternTexture = loadTexture(textureLoader, getPalettePatternPath(paletteKey), renderer, null, null);
    const material = createPatternWaveMaterial(patternTexture, tintColor, opacity, false, false, null);
    bindLandMaskToMaterial(textureLoader, renderer, material);
    return new THREE.Mesh(geometry, material);
}

export function createMapPatternOverlay(textureLoader, renderer, tintColor = 0x2196F3, opacity = 0.15, paletteKey = 'blue') {
    const geometry = new THREE.PlaneGeometry(2.0, 1.0);
    const patternTexture = loadTexture(textureLoader, getPalettePatternPath(paletteKey), renderer, null, null);
    const material = createPatternWaveMaterial(patternTexture, tintColor, opacity, true, false, null);
    bindLandMaskToMaterial(textureLoader, renderer, material);
    const plane = new THREE.Mesh(geometry, material);
    plane.position.set(0, 0, 0.01);
    return plane;
}

export function updatePatternWave(patternMesh, deltaTime) {
    if (patternMesh && patternMesh.material && patternMesh.material.uniforms) {
        patternMesh.material.uniforms.uTime.value += deltaTime;
    }
}

export function getPaletteAccentHex(paletteKey = 'blue') {
    const paletteAccents = {
        blue: 0x2196F3,
        gray: 0xffffff,
        crimson: 0xef5350,
        nulled: 0xb388ff
    };
    return paletteAccents[paletteKey] || 0x2196F3;
}

export function getPalettePatternPath(paletteKey = 'blue') {
    const patternPaths = {
        blue: 'src/assets/images/Background%20Pattern/Pattern Blue.png',
        gray: 'src/assets/images/Background%20Pattern/Pattern Dark.png',
        crimson: 'src/assets/images/Background%20Pattern/Pattern Crimson.png',
        nulled: 'src/assets/images/Background%20Pattern/Pattern Nulled.png'
    };
    return patternPaths[paletteKey] || 'src/assets/images/Background%20Pattern/Pattern Blue.png';
}
