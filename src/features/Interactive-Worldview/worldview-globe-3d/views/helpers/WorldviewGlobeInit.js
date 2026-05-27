/**
 * GlobeInitHelpers - Utilities for globe initialization
 */
import { createCelestialPlane, getMoonTexturePath, getMarsTexturePath, getOrbitTexturePath } from './WorldviewGlobePlanes.js';
import { loadTexture } from './WorldviewGlobeTextures.js';
import {
    createGlobePatternOverlay,
    createMapPatternOverlay,
    getPaletteAccentHex,
    getPalettePatternPath,
    updatePatternWave
} from './WorldviewPatternOverlay.js';
import {
    addSunBackground,
    applySunBackgroundForViewport,
    assignEarthLightLayer,
    syncAtmosphereSunDirUniforms
} from './WorldviewSunBackground.js';
import { EARTH_POLAR_TO_EQUATORIAL_RATIO } from '../../../worldview-shared-assets/constants/WorldviewPhysicalConstants.js';
import {
    createGlobeAuroraShell,
    createFlatMapAuroraShell
} from './WorldviewGlobeAuroraInit.js';
import {
    applyGlobeCloudPaletteTint,
    rerandomizeGlobeCloudAtlas,
    rerandomizeFlatMapCloudAtlas,
    createGlobeCloudLayer,
    createFlatMapCloudLayer,
    GLOBE_CLOUD_ATLAS_VARIANTS
} from './WorldviewGlobeCloudInit.js';

export {
    createGlobeAuroraShell,
    createFlatMapAuroraShell,
    applyGlobeCloudPaletteTint,
    rerandomizeGlobeCloudAtlas,
    rerandomizeFlatMapCloudAtlas,
    createGlobeCloudLayer,
    createFlatMapCloudLayer,
    GLOBE_CLOUD_ATLAS_VARIANTS
};


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
 * @param {Object} params.sceneModel - WorldviewSceneState instance
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
