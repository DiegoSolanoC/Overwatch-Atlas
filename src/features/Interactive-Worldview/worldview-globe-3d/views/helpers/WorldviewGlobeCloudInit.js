/**
 * Cloud layers (procedural + atlas) for globe and flat map.
 */
import { loadTexture } from './WorldviewGlobeTextures.js';

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
