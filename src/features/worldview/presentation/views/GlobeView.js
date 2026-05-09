/**
 * GlobeView - Handles globe rendering, markers, and connection lines
 */
import { latLonToVector3, createArcBetweenPoints, xyToPlanePosition } from '../../utils/GeometryUtils.js?v=4';
import { configureTexture, loadTexture, changePlaneTexture } from './helpers/GlobeTextureHelpers.js';
import {
    createCelestialPlane,
    getMoonTexturePath,
    getMarsTexturePath,
    applyCelestialMaterialTint
} from './helpers/GlobePlaneHelpers.js';
import { createMarkerWithPin } from './helpers/GlobeMarkerHelpers.js';
import { createConnectionLine, createConnectionGlow } from './helpers/GlobeConnectionHelpers.js';
import { createGlobeMesh, setupCelestialPlanes, addSunBackground, assignEarthLightLayer, syncAtmosphereSunDirUniforms, createGlobeRimGlowSprite, createGlobeAuroraShell, createGlobeCloudLayer, GLOBE_CLOUD_ATLAS_VARIANTS, applyGlobeCloudPaletteTint, rerandomizeGlobeCloudAtlas, createGlobePatternOverlay, getPaletteAccentHex, updatePatternWave } from './helpers/GlobeInitHelpers.js';
import { EARTH_POLAR_TO_EQUATORIAL_RATIO, EARTH_OBLIQUITY_DEG } from '../../constants/GlobePhysicalConstants.js';
import { createEarthCityLightsPoints, disposeEarthCityLights } from './helpers/EarthLightsHelpers.js';

// THREE is loaded globally via script tag in index.html

const MISC_STAR_PNG = 'src/assets/images/Misc/Celestial%20Panels/Star.png';

/** Globe cloud / weather baseline opacity */
const GLOBE_CLOUD_BASE_OPACITY = 0.5;

export class GlobeView {
    constructor(sceneModel, dataModel) {
        this.sceneModel = sceneModel;
        this.dataModel = dataModel;
        // Cache textures to avoid reloading delays
        this.textureCache = new Map();
        // NOTE: EventMarkerManager removed - Globe no longer handles event markers

        this._rimGlowSprite = null;
        this._auroraMesh = null;
        /** Smoothed random veil size / intensity for aurora shader (see updateAtmosphereEffects). */
        this._auroraVeilAnim = null;
        this._cloudLayer = null;

        /** Shared Star.png for background starfield (~30%) and shooting star heads (deduped load). */
        this._miscStarPngPromise = null;

        // Shooting stars: additive line trail + small misc/Celestial Panels/Star.png head (billboard, spins)
        this._shootingStars = {
            group: null,
            pool: [],
            nextSpawnSec: 0,
            maxActive: 6,
            _poolBuilt: false
        };
        // Reused in updateShootingStars (avoid per-frame Vector3 allocations)
        this._ssCamDir = new THREE.Vector3();
        this._ssBendQuat = new THREE.Quaternion();

        /** Slow phase for starfield opacity shimmer (see updateAtmosphereEffects). */
        this._starfieldShimmerPhase = Math.random() * Math.PI * 2;

        /** Additive yellow city-light points on Earth (rebuilt when events refresh). */
        this._earthCityLights = null;
        /** Warm point lights at random city-light sites (same layer as Earth). */
        this._earthCityAccentLights = null;
    }

    /**
     * Initialize globe with texture
     * @param {Function} onTextureLoaded - Callback when texture loads
     */
    initGlobe(onTextureLoaded) {
        const scene = this.sceneModel.getScene();
        const renderer = this.sceneModel.getRenderer();
        
        // Check saved palette preference to load correct texture
        const savedPalette = localStorage.getItem('colorPalette');
        const isGray = savedPalette === 'gray';
        const isCrimson = savedPalette === 'crimson';
        const isNulled = savedPalette === 'nulled';
        const paletteKey = isGray ? 'gray' : (isCrimson ? 'crimson' : (isNulled ? 'nulled' : 'blue'));
        const initialTexturePath = isGray
            ? 'src/assets/images/Maps/Earth%20Textures/MAP Black.png'
            : (isCrimson ? 'src/assets/images/Maps/Earth%20Textures/MAP Crimson.png' : (isNulled ? 'src/assets/images/Maps/Earth%20Textures/MAP Nulled.png' : 'src/assets/images/Maps/Earth%20Textures/MAP Blue.png'));
        console.log('Initializing globe with palette:', savedPalette || 'blue (default)', 'Texture:', initialTexturePath);
        if (this.sceneModel.setEarthMapTextureUrl) {
            this.sceneModel.setEarthMapTextureUrl(initialTexturePath);
        }
        
        const textureLoader = new THREE.TextureLoader();
        
        // Load normal map
        const normalMapPath = 'src/assets/images/Maps/Utility/MAP%20Normal.png';
        const normalMap = loadTexture(
            textureLoader,
            normalMapPath,
            renderer,
            (texture) => console.log('Normal map loaded successfully'),
            (err) => console.warn('Normal map not found, continuing without it:', err)
        );
        
        // Create globe mesh
        const earthMesh = createGlobeMesh(
            textureLoader,
            renderer,
            initialTexturePath,
            normalMap,
            (texture) => {
                const surf = this.sceneModel.getGlobeSurfaceMesh ? this.sceneModel.getGlobeSurfaceMesh() : this.sceneModel.getGlobe();
                if (surf && surf.material) {
                    surf.material.map = texture;
                    surf.material.normalMap = normalMap;
                    surf.material.needsUpdate = true;
                }
                this.textureCache.set(initialTexturePath, texture);
                if (onTextureLoaded) {
                    onTextureLoaded();
                }
            },
            (err) => {
                console.error('Error loading Earth texture:', err);
                const surf = this.sceneModel.getGlobeSurfaceMesh ? this.sceneModel.getGlobeSurfaceMesh() : this.sceneModel.getGlobe();
                if (surf && surf.material) {
                    surf.material.color.setHex(0x4a90e2);
                }
            }
        );

        /*
         * World-fixed axial tilt (obliquity): middle group only, never spun by controllers.
         * Inner `globe` is what getGlobe() returns — user drag + auto-rotate = spin about physical axis.
         */
        const globe = new THREE.Group();
        globe.name = 'earthGlobeRoot';
        globe.userData.earthSurfaceMesh = earthMesh;
        globe.add(earthMesh);

        const oblate = EARTH_POLAR_TO_EQUATORIAL_RATIO;

        // Cloud albedo: random `Cloud Map #` atlas per load, ~50% opacity, palette-tinted like rim
        const cloudTintHex = isGray ? 0xffffff : (isCrimson ? 0xff8a80 : (isNulled ? 0xd1b3ff : 0x6fd3ff));
        const cloudLayer = createGlobeCloudLayer({
            textureLoader,
            renderer,
            radius: 1.004,
            opacity: 0.5,
            tintHex: cloudTintHex,
            cloudTextureVariants: GLOBE_CLOUD_ATLAS_VARIANTS
        });
        if (cloudLayer) {
            this._cloudLayer = cloudLayer;
            cloudLayer.scale.set(1, oblate, 1);
            globe.add(cloudLayer);
        }

        // Pattern overlay on globe - tinted by palette (added AFTER clouds to sit on top)
        const patternTint = getPaletteAccentHex(paletteKey);
        const globePattern = createGlobePatternOverlay(textureLoader, renderer, patternTint, 0.3, paletteKey);
        if (globePattern) {
            this._globePatternOverlay = globePattern;
            globePattern.scale.set(1, oblate, 1);
            globe.add(globePattern);
        }

        // Polar auroras (additive shell, latitudinal bands in object space — track real poles as globe spins)
        const aurora = createGlobeAuroraShell({
            uIntensity: isGray ? 0.34 : (isCrimson ? 0.38 : (isNulled ? 0.36 : 0.42))
        });
        if (aurora) {
            this._auroraMesh = aurora;
            aurora.scale.set(1, oblate, 1);
            globe.add(aurora);
            this._seedAuroraVeilAnimIfNeeded();
        }

        // Rim glow: blue → light blue, gray → white, crimson → warm red, nulled → soft violet.
        const rimColor = isGray ? 0xffffff : (isCrimson ? 0xff8a80 : (isNulled ? 0xd1b3ff : 0x6fd3ff));
        const rimGlow = createGlobeRimGlowSprite({
            color: rimColor,
            scale: 2.15,
            opacity: 2.75,
            intensity: 1.5
        });
        if (rimGlow) {
            this._rimGlowSprite = rimGlow;
            rimGlow.renderOrder = 2;
            globe.add(rimGlow);
        }

        const axialTiltFixed = new THREE.Group();
        axialTiltFixed.name = 'earthAxialTilt';
        axialTiltFixed.rotation.x = THREE.MathUtils.degToRad(EARTH_OBLIQUITY_DEG);
        axialTiltFixed.add(globe);

        const earthAssembly = new THREE.Group();
        earthAssembly.name = 'earthAssembly';
        earthAssembly.add(axialTiltFixed);

        this.sceneModel.setGlobe(globe);
        scene.add(earthAssembly);
        assignEarthLightLayer(globe);

        // Flat map is DOM-only ({@link Map2DLiteLayer}); no WebGL earth map mesh.
        if (this.sceneModel.setEarthMapPlane) {
            this.sceneModel.setEarthMapPlane(null);
        } else {
            this.sceneModel.earthMapPlane = null;
        }
        if (this.sceneModel.setEarthMapTextureUrl) {
            this.sceneModel.setEarthMapTextureUrl(initialTexturePath);
        }

        // Add a background "sun" element (sprite + warm light); hidden in flat map view.
        const sunBackground = addSunBackground({ scene });
        if (sunBackground) {
            this.sceneModel.setSunBackground(sunBackground);
        }
        this._syncAtmosphereSunDirection();

        // Preload other Earth map textures for quick palette switching
        const allMapTextures = [
            'src/assets/images/Maps/Earth%20Textures/MAP Blue.png',
            'src/assets/images/Maps/Earth%20Textures/MAP Black.png',
            'src/assets/images/Maps/Earth%20Textures/MAP Crimson.png',
            'src/assets/images/Maps/Earth%20Textures/MAP Nulled.png'
        ];
        allMapTextures.forEach((path) => {
            if (path === initialTexturePath || this.textureCache.has(path)) return;
            loadTexture(textureLoader, path, renderer, (texture) => {
                this.textureCache.set(path, texture);
                console.log('Preloaded and cached alternate texture:', path);
            });
        });

        // Preload pattern textures for quick palette switching
        const allPatternTextures = [
            'src/assets/images/Background%20Pattern/Pattern Blue.png',
            'src/assets/images/Background%20Pattern/Pattern Dark.png',
            'src/assets/images/Background%20Pattern/Pattern Crimson.png',
            'src/assets/images/Background%20Pattern/Pattern Nulled.png'
        ];
        const currentPatternPath = window.GlobeInitHelpers?.getPalettePatternPath?.(paletteKey) || 'src/assets/images/Background%20Pattern/Pattern Blue.png';
        allPatternTextures.forEach((path) => {
            if (path === currentPatternPath || this.textureCache.has(path)) return;
            loadTexture(textureLoader, path, renderer, (texture) => {
                this.textureCache.set(path, texture);
                console.log('Preloaded and cached pattern texture:', path);
            });
        });
        
        // Create Moon and Mars planes
        setupCelestialPlanes({
            scene,
            textureLoader,
            renderer,
            palette: paletteKey,
            sceneModel: this.sceneModel
        });
    }

    /**
     * Update rim glow color when palette changes.
     * @param {string} palette - 'blue' | 'gray' | 'crimson' | 'nulled'
     */
    updateRimGlowPalette(palette) {
        const p = String(palette).toLowerCase();
        const color = p === 'gray' ? 0xffffff : (p === 'crimson' ? 0xff8a80 : (p === 'nulled' ? 0xd1b3ff : 0x6fd3ff));
        const s = this._rimGlowSprite;
        if (s && s.material && s.material.color) {
            s.material.color.setHex(color);
            const k = (s.userData && Number.isFinite(s.userData.rimIntensity)) ? s.userData.rimIntensity : 1.0;
            if (k !== 1.0) s.material.color.multiplyScalar(k);
        }
        const ai = p === 'gray' ? 0.34 : (p === 'crimson' ? 0.38 : (p === 'nulled' ? 0.36 : 0.42));
        const a = this._auroraMesh;
        if (a && a.material && a.material.uniforms && a.material.uniforms.uIntensity) {
            a.material.uniforms.uIntensity.value = ai;
        }
        applyGlobeCloudPaletteTint(this._cloudLayer, color);
        
        // Update pattern overlay texture and tint
        this.updateGlobePatternPalette(p);
    }

    /**
     * Update globe pattern overlay texture and tint when palette changes.
     * @param {string} palette - 'blue' | 'gray' | 'crimson' | 'nulled'
     */
    updateGlobePatternPalette(palette) {
        if (!this._globePatternOverlay || !window.GlobeInitHelpers?.getPalettePatternPath) {
            return;
        }

        const p = String(palette).toLowerCase();
        const patternPath = window.GlobeInitHelpers.getPalettePatternPath(p);
        const patternTint = getPaletteAccentHex(p);
        const tintColor = new THREE.Color(patternTint);

        const renderer = this.sceneModel.getRenderer();

        // Check if texture is already cached (like changeGlobeTexture does)
        if (this.textureCache.has(patternPath)) {
            const cachedTexture = this.textureCache.get(patternPath);
            console.log('Using cached pattern texture:', patternPath);
            if (this._globePatternOverlay && this._globePatternOverlay.material) {
                this._globePatternOverlay.material.uniforms.uPatternMap.value = cachedTexture;
                this._globePatternOverlay.material.uniforms.uTintColor.value.set(tintColor.r, tintColor.g, tintColor.b);
            }
            return;
        }

        const textureLoader = new THREE.TextureLoader();

        // Load new pattern texture and cache it
        loadTexture(
            textureLoader,
            patternPath,
            renderer,
            (texture) => {
                this.textureCache.set(patternPath, texture);
                if (this._globePatternOverlay && this._globePatternOverlay.material) {
                    this._globePatternOverlay.material.uniforms.uPatternMap.value = texture;
                    this._globePatternOverlay.material.uniforms.uTintColor.value.set(tintColor.r, tintColor.g, tintColor.b);
                    console.log('Globe pattern overlay texture updated to:', patternPath);
                }
            },
            (err) => {
                console.warn('Error loading pattern texture:', patternPath, err);
            }
        );
    }

    /**
     * Random veil size + boost on load (and first frame if not seeded).
     * Avoids every reload starting at the same strength / always ramping from zero.
     */
    /**
     * New random veil / boost and time phase (same idea as a fresh load).
     */
    _rerandomizeAuroraVeilState() {
        this._auroraVeilAnim = null;
        const a = this._auroraMesh;
        if (a && a.material && a.material.uniforms && a.material.uniforms.uTime) {
            a.material.uniforms.uTime.value = Math.random() * 400;
        }
        this._seedAuroraVeilAnimIfNeeded();
    }

    _primaryAuroraForVeil() {
        if (this._auroraMesh && this._auroraMesh.material && this._auroraMesh.material.uniforms) {
            return this._auroraMesh;
        }
        return null;
    }

    /** Copy veil/time uniforms so map aurora is not stuck at uVeilExpand=0 before first frame. */
    /**
     * Aligns shader-based overlays with the sun (procedural clouds / aurora / pattern) and city lights;
     * atlas clouds use scene lights instead.
     */
    _syncAtmosphereSunDirection() {
        const sunBg = this.sceneModel.getSunBackground ? this.sceneModel.getSunBackground() : this.sceneModel.sunBackground;
        const light = sunBg && sunBg.light;
        syncAtmosphereSunDirUniforms(light, [
            this._cloudLayer,
            this._auroraMesh,
            this._globePatternOverlay,
            this._earthCityLights
        ]);
    }

    /** Call after the sun light moves (e.g. viewport resize) so `uSunDirWorld` stays in sync. */
    syncSunDirectionToShaders() {
        this._syncAtmosphereSunDirection();
    }

    /**
     * Toggle aurora + clouds from scene preference; turning on re-randomizes like reload.
     * @param {boolean} enabled
     */
    setWeatherEffectsVisible(enabled) {
        const mapOn = this.sceneModel.getMapViewEnabled?.() ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        console.log('[GlobeView] setWeatherEffectsVisible called with:', enabled, 'mapOn:', mapOn);
        if (mapOn) {
            console.log('[GlobeView] Skipping weather effects - map mode is on');
            return;
        }

        const on = !!enabled;
        console.log('[GlobeView] Setting weather effects visible:', on);
        if (on) this._rerandomizeAuroraVeilState();
        if (this._auroraMesh) {
            this._auroraMesh.visible = on;
            console.log('[GlobeView] Aurora mesh visibility set to:', on);
        }
        if (this._cloudLayer) {
            if (!on) {
                this._cloudLayer.visible = false;
                console.log('[GlobeView] Cloud layer hidden');
            } else {
                const renderer = this.sceneModel.getRenderer();
                const textureLoader = new THREE.TextureLoader();
                rerandomizeGlobeCloudAtlas(this._cloudLayer, {
                    textureLoader,
                    renderer,
                    cloudTextureVariants: GLOBE_CLOUD_ATLAS_VARIANTS,
                    opacity: GLOBE_CLOUD_BASE_OPACITY
                });
                this._syncAtmosphereSunDirection();
                console.log('[GlobeView] Cloud layer shown and rerandomized');
            }
        }
        this._setShootingStarsWeatherVisible(on);
    }

    /**
     * Shooting stars follow the weather toggle (same UX as aurora/clouds).
     * @param {boolean} on
     */
    _setShootingStarsWeatherVisible(on) {
        const g = this._shootingStars.group;
        if (g) {
            g.visible = !!on;
        }
        if (!on && this._shootingStars.pool.length) {
            for (const s of this._shootingStars.pool) {
                s.active = false;
                s.line.visible = false;
                s.headMesh.visible = false;
                s.lineMat.opacity = 0;
                s.headMat.opacity = 0;
            }
        }
        if (on) {
            const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
            this._shootingStars.nextSpawnSec = isMobile
                ? (8 + Math.random() * 8)
                : (3 + Math.random() * 4);
        }
    }

    _seedAuroraVeilAnimIfNeeded() {
        const primary = this._primaryAuroraForVeil();
        if (this._auroraVeilAnim || !primary || !primary.material || !primary.material.uniforms) {
            return;
        }
        const u = primary.material.uniforms;
        if (!u.uVeilExpand || !u.uVeilBoost) return;

        const st = {
            size: Math.random() * 0.98,
            targetSize: Math.random() * 0.98,
            boost: Math.random() * 1.25,
            targetBoost: Math.random() < 0.14
                ? 1.12 + Math.random() * 0.5
                : Math.random() * 1.25,
            nextPickSec: 4 + Math.random() * 10
        };
        this._auroraVeilAnim = st;
        u.uVeilExpand.value = st.size;
        u.uVeilBoost.value = st.boost;
    }

    /**
     * Advance atmosphere shaders (aurora motion). Safe to call every frame.
     * @param {number} deltaSeconds
     */
    updateAtmosphereEffects(deltaSeconds) {
        const dt = Number.isFinite(deltaSeconds) ? deltaSeconds : 0;
        const weatherOn = typeof this.sceneModel.getGlobeWeatherEffectsVisible !== 'function'
            || this.sceneModel.getGlobeWeatherEffectsVisible();

        for (const c of [this._cloudLayer]) {
            if (c && weatherOn && c.material && c.material.uniforms && c.material.uniforms.uTime) {
                c.material.uniforms.uTime.value += dt;
            }
        }

        const primary = this._primaryAuroraForVeil();
        const auroraTargets = [this._auroraMesh].filter(Boolean);
        if (weatherOn && primary && primary.material && primary.material.uniforms) {
            const u = primary.material.uniforms;
            if (u.uTime) u.uTime.value += dt;
            if (u.uVeilExpand && u.uVeilBoost) {
                this._seedAuroraVeilAnimIfNeeded();
                const st = this._auroraVeilAnim;
                if (st) {
                    st.nextPickSec -= dt;
                    if (st.nextPickSec <= 0) {
                        st.nextPickSec = 14 + Math.random() * 22;
                        st.targetSize = Math.random() * 0.98;
                        if (Math.random() < 0.14) {
                            st.targetBoost = 1.12 + Math.random() * 0.5;
                        } else {
                            st.targetBoost = Math.random() * 1.25;
                        }
                    }

                    const tSize = 1 - Math.exp(-0.28 * dt);
                    const tBoost = 1 - Math.exp(-0.42 * dt);
                    st.size += (st.targetSize - st.size) * Math.min(1, tSize);
                    st.boost += (st.targetBoost - st.boost) * Math.min(1, tBoost);

                    u.uVeilExpand.value = st.size;
                    u.uVeilBoost.value = st.boost;
                }
            }

            for (const a of auroraTargets) {
                if (a === primary) continue;
                if (!a.material || !a.material.uniforms) continue;
                const um = a.material.uniforms;
                if (um.uTime && u.uTime) um.uTime.value = u.uTime.value;
                if (um.uVeilExpand && u.uVeilExpand) um.uVeilExpand.value = u.uVeilExpand.value;
                if (um.uVeilBoost && u.uVeilBoost) um.uVeilBoost.value = u.uVeilBoost.value;
            }
        }

        // Starfield: gentle opacity breathe (aurora-like slow drift).
        const starRoot = this.sceneModel.getStars();
        if (starRoot && starRoot.name === 'starfield' && starRoot.userData.starfieldMats) {
            const mats = starRoot.userData.starfieldMats;
            this._starfieldShimmerPhase += dt;
            const shimmer =
                0.055 * Math.sin(this._starfieldShimmerPhase * 0.33) +
                0.05 * Math.sin(this._starfieldShimmerPhase * 0.19 + 1.05);
            const mul = 0.93 + shimmer;
            if (mats.classic && mats.classic.userData.baseOpacity != null) {
                mats.classic.opacity = mats.classic.userData.baseOpacity * mul;
            }
            if (mats.textured && mats.textured.userData.baseOpacity != null) {
                mats.textured.opacity = mats.textured.userData.baseOpacity * mul;
            }
        }
    }

    /**
     * Update pattern wave animation for both globe and map overlays
     * @param {number} deltaSeconds - Time since last frame
     */
    updatePatternWave(deltaSeconds) {
        const dt = Number.isFinite(deltaSeconds) ? deltaSeconds : 0;
        const mapOn = this.sceneModel.getMapViewEnabled?.() ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        if (!mapOn) {
            updatePatternWave(this._globePatternOverlay, dt);
        }
    }

    /**
     * Change globe texture
     * @param {string} texturePath - Path to the texture file
     * @param {Function} onTextureLoaded - Optional callback when texture loads
     */
    changeGlobeTexture(texturePath, onTextureLoaded) {
        const globe = this.sceneModel.getGlobe();
        if (!globe) {
            console.error('Globe not found');
            return;
        }
        const surface = this.sceneModel.getGlobeSurfaceMesh ? this.sceneModel.getGlobeSurfaceMesh() : globe;
        if (!surface || !surface.material) {
            console.error('Globe surface mesh not found');
            return;
        }

        const applyEarthMapTexture = () => {
            if (this.sceneModel.setEarthMapTextureUrl) {
                this.sceneModel.setEarthMapTextureUrl(texturePath);
            }
            window.globeController?.map2dLite?.refreshTexturesFromScene?.();
        };

        // Check if texture is already cached
        if (this.textureCache.has(texturePath)) {
            const cachedTexture = this.textureCache.get(texturePath);
            console.log('Using cached texture:', texturePath);
            surface.material.map = cachedTexture;
            surface.material.needsUpdate = true;
            applyEarthMapTexture();
            if (onTextureLoaded) {
                onTextureLoaded();
            }
            return;
        }

        const renderer = this.sceneModel.getRenderer();
        const textureLoader = new THREE.TextureLoader();
        
        loadTexture(textureLoader, texturePath, renderer, (texture) => {
                console.log('Globe texture changed to:', texturePath);
                this.textureCache.set(texturePath, texture);
                surface.material.map = texture;
                surface.material.needsUpdate = true;
                applyEarthMapTexture();
                if (onTextureLoaded) {
                    onTextureLoaded();
                }
        });
    }

    /**
     * Change Moon plane texture based on color palette
     * @param {string} texturePath - Path to the texture file
     */
    changeMoonTexture(texturePath) {
        const moonPlane = this.sceneModel.getMoonPlane ? this.sceneModel.getMoonPlane() : this.sceneModel.moonPlane;
        const renderer = this.sceneModel.getRenderer();
        const textureLoader = new THREE.TextureLoader();
        changePlaneTexture(moonPlane, texturePath, textureLoader, renderer, true);
    }

    /**
     * Change Mars plane texture based on color palette
     * @param {string} texturePath - Path to the texture file
     */
    changeMarsTexture(texturePath) {
        const marsPlane = this.sceneModel.getMarsPlane ? this.sceneModel.getMarsPlane() : this.sceneModel.marsPlane;
        const renderer = this.sceneModel.getRenderer();
        const textureLoader = new THREE.TextureLoader();
        changePlaneTexture(marsPlane, texturePath, textureLoader, renderer, true);
    }

    /**
     * Moon/Mars use one texture each; palette is a material tint (no per-palette PNG swap).
     * @param {'blue'|'gray'|'crimson'|'nulled'} paletteName
     */
    applyCelestialPaletteTint(paletteName) {
        const moonPlane = this.sceneModel.getMoonPlane?.() ?? this.sceneModel.moonPlane;
        const marsPlane = this.sceneModel.getMarsPlane?.() ?? this.sceneModel.marsPlane;
        const orbitPlane = this.sceneModel.getOrbitPlane?.() ?? this.sceneModel.orbitPlane;
        const p =
            paletteName === 'gray'
                ? 'gray'
                : paletteName === 'crimson'
                  ? 'crimson'
                  : paletteName === 'nulled'
                    ? 'nulled'
                    : 'blue';
        if (moonPlane?.material) applyCelestialMaterialTint(moonPlane.material, p);
        if (marsPlane?.material) applyCelestialMaterialTint(marsPlane.material, p);
        if (orbitPlane?.material) applyCelestialMaterialTint(orbitPlane.material, p);
    }

    /**
     * Random glow: 0–100% strength and hue among yellow / green / blue / white / purple.
     * @param {{ forSpritePoints?: boolean }} [opts] - If true, vertex colors stay near white at low strength so Star.png albedo stays visible (PointsMaterial multiplies map × color).
     * @returns {{ r: number, g: number, b: number, strength: number }}
     */
    _pickStarGlowColor(opts = {}) {
        const palettes = [
            [1.0, 0.88, 0.35],
            [0.34, 0.95, 0.52],
            [0.38, 0.74, 1.0],
            [1.0, 1.0, 1.0],
            [0.68, 0.4, 0.98]
        ];
        const p = palettes[(Math.random() * palettes.length) | 0];
        const strength = Math.random();
        if (opts.forSpritePoints) {
            const t = strength;
            const k = 0.92;
            return {
                r: 1 + (p[0] - 1) * t * k,
                g: 1 + (p[1] - 1) * t * k,
                b: 1 + (p[2] - 1) * t * k,
                strength
            };
        }
        const core = 0.08;
        return {
            r: core + (p[0] - core) * strength,
            g: core + (p[1] - core) * strength,
            b: core + (p[2] - core) * strength,
            strength
        };
    }

    /**
     * Random positions on the same sky shell as the original starfield.
     * Per-star tint + glow strength (additive-friendly vertex colors, slightly larger when brighter).
     * @param {number} count
     * @param {{ forSpritePoints?: boolean }} [opts] - Pass for Star.png layer (tints without crushing the sprite).
     * @returns {{positions: Float32Array, sizes: Float32Array, colors: Float32Array}}
     */
    _createStarShellAttributes(count, opts = {}) {
        const positions = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const colors = new Float32Array(count * 3);
        const forSprite = opts.forSpritePoints === true;
        for (let i = 0; i < count; i++) {
            const radius = 50 + Math.random() * 50;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);

            const glow = this._pickStarGlowColor(forSprite ? { forSpritePoints: true } : {});
            const sizeSpread = Math.random() * 2.5 + 0.5;
            sizes[i] = forSprite
                ? sizeSpread * (0.92 + 0.35 * glow.strength)
                : sizeSpread * (0.78 + 0.42 * glow.strength);

            colors[i * 3] = glow.r;
            colors[i * 3 + 1] = glow.g;
            colors[i * 3 + 2] = glow.b;
        }
        return { positions, sizes, colors };
    }

    /**
     * Single load of misc/Celestial Panels/Star.png for starfield sprites + shooting star heads.
     * @returns {Promise<THREE.Texture|null>}
     */
    _ensureMiscStarPng() {
        if (!this._miscStarPngPromise) {
            this._miscStarPngPromise = new Promise((resolve) => {
                const renderer = this.sceneModel.getRenderer();
                const textureLoader = new THREE.TextureLoader();
                if (renderer) {
                    loadTexture(
                        textureLoader,
                        MISC_STAR_PNG,
                        renderer,
                        (tex) => resolve(tex),
                        () => resolve(null)
                    );
                } else {
                    textureLoader.load(
                        MISC_STAR_PNG,
                        (tex) => {
                            tex.minFilter = THREE.LinearFilter;
                            tex.magFilter = THREE.LinearFilter;
                            tex.generateMipmaps = false;
                            resolve(tex);
                        },
                        undefined,
                        () => resolve(null)
                    );
                }
            });
        }
        return this._miscStarPngPromise;
    }

    /**
     * Background starfield: ~70% classic points, ~30% same shell with Star.png (additive, vertex-tinted).
     */
    addStarfield() {
        const scene = this.sceneModel.getScene();
        if (!scene) return;

        const starCount = 2000;
        const texturedFraction = 0.3;
        const texturedCount = Math.round(starCount * texturedFraction);
        const classicCount = Math.max(0, starCount - texturedCount);

        const cl = this._createStarShellAttributes(classicCount);
        const classicGeom = new THREE.BufferGeometry();
        classicGeom.setAttribute('position', new THREE.BufferAttribute(cl.positions, 3));
        classicGeom.setAttribute('size', new THREE.BufferAttribute(cl.sizes, 1));
        classicGeom.setAttribute('color', new THREE.BufferAttribute(cl.colors, 3));

        const classicBaseOp = 0.8;
        const classicMat = new THREE.PointsMaterial({
            size: 0.15,
            vertexColors: true,
            transparent: true,
            opacity: classicBaseOp,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending
        });
        classicMat.userData.baseOpacity = classicBaseOp;

        const classicPoints = new THREE.Points(classicGeom, classicMat);
        classicPoints.name = 'starfield-classic';

        const starFieldGroup = new THREE.Group();
        starFieldGroup.name = 'starfield';
        starFieldGroup.userData.starfieldMats = { classic: classicMat, textured: null };
        starFieldGroup.add(classicPoints);
        scene.add(starFieldGroup);
        this.sceneModel.setStars(starFieldGroup);

        if (texturedCount <= 0) return;

        this._ensureMiscStarPng().then((tex) => {
            if (!tex) return;
            if (starFieldGroup.userData.starPngLayerAdded) return;
            starFieldGroup.userData.starPngLayerAdded = true;

            const tg = this._createStarShellAttributes(texturedCount, { forSpritePoints: true });
            const texturedGeom = new THREE.BufferGeometry();
            texturedGeom.setAttribute('position', new THREE.BufferAttribute(tg.positions, 3));
            texturedGeom.setAttribute('size', new THREE.BufferAttribute(tg.sizes, 1));
            texturedGeom.setAttribute('color', new THREE.BufferAttribute(tg.colors, 3));

            const texturedBaseOp = 0.78;
            const texturedMat = new THREE.PointsMaterial({
                map: tex,
                // Larger than classic points so Star.png reads as a shape (PointsMaterial ignores per-vertex size).
                size: 0.62,
                vertexColors: true,
                transparent: true,
                opacity: texturedBaseOp,
                sizeAttenuation: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                alphaTest: 0.01
            });
            texturedMat.userData.baseOpacity = texturedBaseOp;

            const texturedPoints = new THREE.Points(texturedGeom, texturedMat);
            texturedPoints.name = 'starfield-textured';
            texturedPoints.renderOrder = 1;
            starFieldGroup.add(texturedPoints);
            if (starFieldGroup.userData.starfieldMats) {
                starFieldGroup.userData.starfieldMats.textured = texturedMat;
            }
        });
    }

    /**
     * Starfield + sun sprite + sun light are for the 3D globe only; turn off in flat map view.
     * @param {boolean} visible
     */
    setGlobeSkyVisible(visible) {
        const v = !!visible;
        const stars = this.sceneModel.getStars();
        if (stars) {
            stars.visible = v;
        }
        const sunBg = this.sceneModel.getSunBackground();
        if (sunBg) {
            if (sunBg.sprite) sunBg.sprite.visible = v;
            if (sunBg.light) sunBg.light.visible = v;
        }
        const earthAmb = this.sceneModel.earthAmbientLayer1;
        if (earthAmb) {
            earthAmb.intensity = v ? 0.002 : 0.72;
        }
    }

    /**
     * Toggle combined globe lighting: Sun background, ambient contrast, and city lights dots.
     * @param {boolean} visible
     */
    setGlobeLightingVisible(visible) {
        const v = !!visible;
        console.log('[GlobeView] setGlobeLightingVisible called with:', visible, 'actual:', v);

        // 1. Sun background (sprite + light source)
        const sunBg = this.sceneModel.getSunBackground();
        if (sunBg) {
            if (sunBg.sprite) {
                sunBg.sprite.visible = v;
                console.log('[GlobeView] Sun sprite visibility set to:', v);
            }
            if (sunBg.light) {
                sunBg.light.visible = v;
                console.log('[GlobeView] Sun light visibility set to:', v);
            }
        }

        // 2. City lights dots
        if (this._earthCityLights) {
            this._earthCityLights.visible = v;
            console.log('[GlobeView] City lights visibility set to:', v);
        }
        if (this._earthCityAccentLights) {
            this._earthCityAccentLights.forEach(light => {
                light.visible = v;
            });
            console.log('[GlobeView] City accent lights visibility set to:', v);
        }

        // 3. Earth ambient contrast (if sun is off, we need more ambient light to see globe)
        const earthAmb = this.sceneModel.earthAmbientLayer1;
        if (earthAmb) {
            earthAmb.intensity = v ? 0.002 : 0.72;
            console.log('[GlobeView] Earth ambient intensity set to:', earthAmb.intensity);
        }

        // 4. Pattern overlay: disable sun shading when lighting is off so wave is visible everywhere
        if (this._globePatternOverlay && this._globePatternOverlay.material && this._globePatternOverlay.material.uniforms) {
            this._globePatternOverlay.material.uniforms.uShadeBySun.value = v ? 1.0 : 0.0;
            console.log('[GlobeView] Pattern overlay uShadeBySun set to:', v ? 1.0 : 0.0);
        }
    }

    /**
     * Flat map is DOM-only; keep globe-side overlays in sync when toggling modes.
     * @param {boolean} mapEnabled
     */
    configureMapViewPresentation(mapEnabled) {
        const mapOn = !!mapEnabled;
        if (this._globePatternOverlay) this._globePatternOverlay.visible = !mapOn;
        if (this._cloudLayer) this._cloudLayer.visible = !mapOn;
        if (this._auroraMesh) this._auroraMesh.visible = !mapOn;
    }

    /**
     * Add a small pool of shooting stars: streak (line) plus a spinning Star.png at the leading tip.
     */
    addShootingStars() {
        const scene = this.sceneModel.getScene();
        if (!scene) return;
        if (this._shootingStars._poolBuilt) return;
        this._shootingStars._poolBuilt = true;

        this._ensureMiscStarPng().then((tex) => {
            if (!tex) {
                console.warn('Shooting star texture not available, using solid fallback head.');
            }
            this._createShootingStarsGroup(tex || null);
        });
    }

    /**
     * @param {THREE.Texture|null} mapTexture
     */
    _createShootingStarsGroup(mapTexture) {
        if (this._shootingStars.group) return;
        const scene = this.sceneModel.getScene();
        if (!scene) return;

        const group = new THREE.Group();
        group.name = 'shooting-stars';
        group.renderOrder = -10;

        const isMobile = window.innerWidth <= 768;
        const poolSize = isMobile ? 4 : 6;
        this._shootingStars.maxActive = poolSize;
        const trailPointCount = isMobile ? 14 : 22;

        const makeStar = () => {
            const lineGeom = new THREE.BufferGeometry();
            const arr = new Float32Array(trailPointCount * 3);
            lineGeom.setAttribute('position', new THREE.BufferAttribute(arr, 3));
            const lineMat = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                depthTest: true
            });
            const line = new THREE.Line(lineGeom, lineMat);
            line.visible = false;
            line.frustumCulled = false;
            line.renderOrder = -10;
            group.add(line);

            const headGeom = new THREE.PlaneGeometry(1, 1);
            const headMat = new THREE.MeshBasicMaterial({
                map: mapTexture || null,
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                depthTest: true,
                side: THREE.DoubleSide
            });
            if (!mapTexture) {
                headMat.color.setRGB(0.78, 0.9, 1.0);
            }
            const headMesh = new THREE.Mesh(headGeom, headMat);
            headMesh.visible = false;
            headMesh.frustumCulled = false;
            headMesh.renderOrder = -9;
            group.add(headMesh);

            const trailPts = [];
            for (let i = 0; i < trailPointCount; i++) {
                trailPts.push(new THREE.Vector3());
            }
            return {
                line,
                lineGeom,
                lineMat,
                trailPointCount,
                trailPts,
                headMesh,
                headMat,
                active: false,
                age: 0,
                duration: 1,
                speed: 20,
                head: new THREE.Vector3(),
                dir: new THREE.Vector3(),
                curvatureRadPerSec: 0,
                curvatureDriftRadPerSec2: 0,
                spinAngle: 0,
                spinRadPerSec: 6,
                baseScale: 0.65,
                glowStrength: 1
            };
        };

        for (let i = 0; i < poolSize; i++) {
            this._shootingStars.pool.push(makeStar());
        }

        this._shootingStars.nextSpawnSec = isMobile
            ? (8 + Math.random() * 8)
            : (3 + Math.random() * 4);

        this._shootingStars.group = group;
        scene.add(group);
        if (typeof this.sceneModel.getGlobeWeatherEffectsVisible === 'function'
            && !this.sceneModel.getGlobeWeatherEffectsVisible()) {
            group.visible = false;
        }
    }

    _spawnShootingStar() {
        const camera = this.sceneModel.getCamera();
        if (!camera) return;
        if (!this._shootingStars.group || this._shootingStars.pool.length === 0) return;

        // Find an inactive slot
        const star = this._shootingStars.pool.find(s => !s.active);
        if (!star) return;

        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        camDir.normalize();

        const mapView = this.sceneModel.getMapViewEnabled
            ? this.sceneModel.getMapViewEnabled()
            : !!this.sceneModel.isMapView;

        // Globe: sky cap = from camera toward world origin (matches starfield shell). Map: use view axis (lookAt is not toward origin).
        let spawnBase;
        if (mapView) {
            spawnBase = camDir.clone();
        } else {
            spawnBase = camera.position.clone();
            if (spawnBase.lengthSq() < 1e-8) return;
            spawnBase.normalize().negate();
        }

        // Build a screen-plane basis (right/up) from view direction for streak motion and spread.
        const worldUp = new THREE.Vector3(0, 1, 0);
        let right = new THREE.Vector3().crossVectors(camDir, worldUp);
        if (right.lengthSq() < 1e-6) {
            right = new THREE.Vector3(1, 0, 0);
        } else {
            right.normalize();
        }
        const up = new THREE.Vector3().crossVectors(right, camDir).normalize();

        // Spawn on the shell facing the camera (behind the globe), with small angular spread.
        const spread = 0.35;
        const spawnDir = spawnBase.clone()
            .addScaledVector(right, (Math.random() * 2 - 1) * spread)
            .addScaledVector(up, (Math.random() * 2 - 1) * spread)
            .normalize();

        const radius = 70 + Math.random() * 25;
        star.head.copy(spawnDir).multiplyScalar(radius);

        // Movement direction: across the screen plane.
        const ang = Math.random() * Math.PI * 2;
        star.dir.copy(right).multiplyScalar(Math.cos(ang)).addScaledVector(up, Math.sin(ang)).normalize();

        // Parameters
        star.active = true;
        star.age = 0;
        star.duration = 0.7 + Math.random() * 0.7;
        star.speed = 18 + Math.random() * 18;

        for (let i = 0; i < star.trailPointCount; i++) {
            star.trailPts[i].copy(star.head);
        }

        // Gentle in-view-plane bend only (see updateShootingStars: rotate around view axis).
        const curveMag = 0.18 + Math.random() * 0.55;
        star.curvatureRadPerSec = (Math.random() < 0.5 ? -1 : 1) * curveMag;
        star.curvatureDriftRadPerSec2 = (Math.random() * 2 - 1) * 0.35;

        const isMobile = window.innerWidth <= 768;
        star.baseScale = (isMobile ? 0.4 : 0.5) + Math.random() * 0.22;

        const glow = this._pickStarGlowColor();
        star.glowStrength = glow.strength;
        star.lineMat.color.setRGB(glow.r, glow.g, glow.b);
        star.headMat.color.setRGB(glow.r, glow.g, glow.b);
        const headMul = 0.9 + 0.32 * glow.strength;
        star.headMesh.scale.setScalar(star.baseScale * headMul);

        star.spinAngle = Math.random() * Math.PI * 2;
        star.spinRadPerSec = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 9);

        star.line.visible = true;
        star.headMesh.visible = true;
        star.lineMat.opacity = 0.001;
        star.headMat.opacity = 0.001;
        this._updateShootingStarGeometry(star, 0.001);
    }

    _updateShootingStarGeometry(star, alpha) {
        const pos = star.lineGeom.attributes.position.array;
        const n = star.trailPointCount;
        for (let i = 0; i < n; i++) {
            const p = star.trailPts[i];
            pos[i * 3] = p.x;
            pos[i * 3 + 1] = p.y;
            pos[i * 3 + 2] = p.z;
        }
        star.lineGeom.attributes.position.needsUpdate = true;
        const g = typeof star.glowStrength === 'number' ? star.glowStrength : 1;
        star.lineMat.opacity = alpha;
        // Slightly brighter head when glow is strong (additive read)
        star.headMat.opacity = alpha * (0.78 + 0.22 * g);
    }

    updateShootingStars(deltaSec) {
        // Respect page visibility (prevents "catch-up" spawns)
        if (this.sceneModel && this.sceneModel.isPageVisible === false) return;
        if (this.sceneModel && typeof this.sceneModel.getGlobeWeatherEffectsVisible === 'function'
            && !this.sceneModel.getGlobeWeatherEffectsVisible()) {
            return;
        }

        const mapView = this.sceneModel.getMapViewEnabled
            ? this.sceneModel.getMapViewEnabled()
            : !!this.sceneModel.isMapView;
        if (mapView) {
            if (this._shootingStars.group) this._shootingStars.group.visible = false;
            for (const s of this._shootingStars.pool) {
                if (!s.active) continue;
                s.active = false;
                s.line.visible = false;
                s.headMesh.visible = false;
                s.lineMat.opacity = 0;
                s.headMat.opacity = 0;
            }
            return;
        }
        if (this._shootingStars.group) this._shootingStars.group.visible = true;

        if (!this._shootingStars.group) return;
        const dt = Number.isFinite(deltaSec) ? Math.max(0, deltaSec) : 0;
        if (dt <= 0) return;

        const camera = this.sceneModel.getCamera();
        const camDir = this._ssCamDir;
        const bendQuat = this._ssBendQuat;

        // Update active stars
        for (const s of this._shootingStars.pool) {
            if (!s.active) continue;
            s.age += dt;
            const t = s.age / s.duration;
            if (t >= 1) {
                s.active = false;
                s.line.visible = false;
                s.headMesh.visible = false;
                s.lineMat.opacity = 0;
                s.headMat.opacity = 0;
                continue;
            }

            // 2D parabolic arcs in the image plane: velocity stays ⟂ view (no in/out of screen).
            // Bend by rotating dir around the camera view axis only (screen-plane parabola, slight curve).
            if (camera) {
                camera.getWorldDirection(camDir);

                let along = s.dir.dot(camDir);
                if (Math.abs(along) > 1e-6) {
                    s.dir.addScaledVector(camDir, -along);
                    s.dir.normalize();
                }

                s.curvatureRadPerSec += s.curvatureDriftRadPerSec2 * dt;
                s.curvatureRadPerSec = Math.max(-1.35, Math.min(1.35, s.curvatureRadPerSec));

                const bend = s.curvatureRadPerSec * dt;
                bendQuat.setFromAxisAngle(camDir, bend);
                s.dir.applyQuaternion(bendQuat);
                s.dir.normalize();

                along = s.dir.dot(camDir);
                if (Math.abs(along) > 1e-6) {
                    s.dir.addScaledVector(camDir, -along);
                    s.dir.normalize();
                }
            }

            s.head.addScaledVector(s.dir, s.speed * dt);

            const pts = s.trailPts;
            const n = s.trailPointCount;
            for (let i = 0; i < n - 1; i++) {
                pts[i].copy(pts[i + 1]);
            }
            pts[n - 1].copy(s.head);

            s.spinAngle += s.spinRadPerSec * dt;

            let a = 1;
            if (t < 0.12) {
                a = t / 0.12;
            } else {
                a = Math.pow(1 - t, 1.15);
            }
            const alpha = 0.85 * a;

            if (s.head.length() > 140) {
                s.active = false;
                s.line.visible = false;
                s.headMesh.visible = false;
                s.lineMat.opacity = 0;
                s.headMat.opacity = 0;
                continue;
            }

            s.headMesh.position.copy(s.head);
            if (camera) {
                s.headMesh.lookAt(camera.position);
                s.headMesh.rotateZ(s.spinAngle);
            }
            this._updateShootingStarGeometry(s, alpha);
        }

        // Spawn timer
        this._shootingStars.nextSpawnSec -= dt;
        if (this._shootingStars.nextSpawnSec <= 0) {
            // Keep at most N active
            const activeCount = this._shootingStars.pool.reduce((n, s) => n + (s.active ? 1 : 0), 0);
            if (activeCount < this._shootingStars.maxActive) {
                this._spawnShootingStar();
            }

            const isMobile = window.innerWidth <= 768;
            this._shootingStars.nextSpawnSec = isMobile
                ? (8 + Math.random() * 10)
                : (3 + Math.random() * 7);
        }
    }

    /**
     * Initialize Moon and Mars 2D planes (positioned at center, Moon above, Mars below)
     */
    initCelestialPlanes() {
        const scene = this.sceneModel.getScene();
        const renderer = this.sceneModel.getRenderer();
        const textureLoader = new THREE.TextureLoader();
        const saved = localStorage.getItem('colorPalette');
        const paletteKey = saved === 'gray' ? 'gray' : (saved === 'crimson' ? 'crimson' : (saved === 'nulled' ? 'nulled' : 'blue'));

        // Create Moon plane
        const moonPlane = createCelestialPlane({
            texturePath: getMoonTexturePath(paletteKey),
            paletteKey,
            textureLoader,
            renderer,
            size: 1.5,
            position: new THREE.Vector3(0, 0.6, 0),
            visible: true
        });
        this.sceneModel.setMoonPlane(moonPlane);
        scene.add(moonPlane);
        
        // Create Mars plane
        const marsPlane = createCelestialPlane({
            texturePath: getMarsTexturePath(paletteKey),
            paletteKey,
            textureLoader,
            renderer,
            size: 1.5,
            position: new THREE.Vector3(0, -0.6, 0),
            visible: true
        });
        this.sceneModel.setMarsPlane(marsPlane);
        scene.add(marsPlane);
        
        console.log('Moon and Mars planes created and added to scene');
    }


    /**
     * Add city markers
     * Only creates markers for cities that have transport connections
     */
    addCityMarkers() {
        const globe = this.sceneModel.getGlobe();
        const cities = this.dataModel.getAllCities();
        const markers = this.sceneModel.getMarkers();
        
        // Get all transport connections to check which cities have connections
        const trainConnections = this.dataModel.getTrainConnections();
        const secondaryConnections = this.dataModel.getSecondaryConnections();
        const allConnections = [...trainConnections, ...secondaryConnections];
        
        // Create a set of city names that have connections (either as "from" or "to")
        const citiesWithConnections = new Set();
        allConnections.forEach(conn => {
            citiesWithConnections.add(conn.from);
            citiesWithConnections.add(conn.to);
        });

        cities.forEach(city => {
            // Only create markers for cities that have transport connections
            if (!citiesWithConnections.has(city.name)) {
                return; // Skip cities without connections
            }

            createMarkerWithPin({
                location: city,
                radius: 0.004,
                color: 0xffd700,
                pinColor: 0xffd700,
                elevation: 1.02,
                userData: {
                city: city.name,
                lat: city.lat,
                lon: city.lon,
                isMarker: true
                },
                parent: globe,
                markersArray: markers,
                pinVisible: false  // Only event pins show; avoids loose pins at cities that also have events (e.g. Honolulu, The Hague)
            });
        });
    }

    /**
     * Yellow “city light” points on the globe: transport hubs + Earth events (see EarthLightsData.js).
     */
    addEarthCityLights() {
        this.refreshEarthCityLights();
    }

    /**
     * Recompute city lights from current {@link DataModel} (including events).
     * Async: loads continent mask (Alpha.png) to skip ocean placement.
     * @returns {Promise<void>}
     */
    async refreshEarthCityLights() {
        const globe = this.sceneModel.getGlobe();
        if (!globe) return;
        if (this._earthCityLights) {
            globe.remove(this._earthCityLights);
            disposeEarthCityLights(this._earthCityLights);
            this._earthCityLights = null;
        }
        if (this._earthCityAccentLights && this._earthCityAccentLights.length) {
            for (const L of this._earthCityAccentLights) {
                globe.remove(L);
            }
            this._earthCityAccentLights = null;
        }
        try {
            const pts = await createEarthCityLightsPoints(this.dataModel);
            if (pts && pts.instancedMesh) {
                this._earthCityLights = pts.instancedMesh;
                globe.add(pts.instancedMesh);
                const accent = pts.accentPointLights || [];
                this._earthCityAccentLights = accent;
                for (const L of accent) {
                    globe.add(L);
                }
            }
        } catch (e) {
            console.warn('GlobeView: earth city lights failed', e);
        }
        this._syncAtmosphereSunDirection();
    }
    
    // NOTE: All event filter methods removed - Globe no longer handles event filters
    // Event System Load Out handles all event UI separately

    /**
     * Add seaport markers
     * Red markers for ports with routes, green markers for ports without routes
     */
    addSeaportMarkers() {
        const globe = this.sceneModel.getGlobe();
        // Use allSeaports (before filtering) to show ports without connections too
        const seaports = this.dataModel.allSeaports || this.dataModel.getAllSeaports();
        const seaportConnections = this.dataModel.getSeaportConnections();
        
        // Create a set of port names that have connections (either as "from" or "to")
        const portsWithConnections = new Set();
        seaportConnections.forEach(conn => {
            portsWithConnections.add(conn.from);
            portsWithConnections.add(conn.to);
        });

        seaports.forEach(seaport => {
            const hasConnections = portsWithConnections.has(seaport.name);
            const markerColor = hasConnections ? 0xff0000 : 0x00ff00; // Red or green
            
            createMarkerWithPin({
                location: seaport,
                radius: 0.010,
                color: markerColor,
                pinColor: markerColor,
                elevation: 1.02,
                userData: {
                isSeaportMarker: true,
                    seaportName: seaport.name
                },
                parent: globe,
                markersArray: this.sceneModel.getMarkers(),
                visible: false,  // Hide port markers (debug only)
                pinVisible: false  // No loose seaport pins
            });
        });
    }

    /**
     * Add connection lines (main routes)
     * @param {Function} onRouteCurveCreated - Callback when route curve is created
     */
    addConnectionLines(onRouteCurveCreated) {
        const globe = this.sceneModel.getGlobe();
        const connections = this.dataModel.getTrainConnections();
        const cities = this.dataModel.getAllCities();

        connections.forEach(connection => {
            const fromCity = cities.find(c => c.name === connection.from);
            const toCity = cities.find(c => c.name === connection.to);
            
            if (!fromCity || !toCity) {
                console.warn(`Connection not found: ${connection.from} to ${connection.to}`);
                return;
            }
            
            const curvePoints = createArcBetweenPoints(fromCity.lat, fromCity.lon, toCity.lat, toCity.lon, 1.02, 50, true);
            const curve = new THREE.CatmullRomCurve3(curvePoints);
            
            if (onRouteCurveCreated) {
                onRouteCurveCreated({
                    curve: curve,
                    from: connection.from,
                    to: connection.to,
                    fromLat: fromCity.lat,
                    fromLon: fromCity.lon,
                    toLat: toCity.lat,
                    toLon: toCity.lon,
                    isMainRoute: true
                });
            }
            
            // Main core line - golden
            const tubeGeometry = new THREE.TubeGeometry(curve, 50, 0.002, 8, false);
            const tubeMaterial = new THREE.MeshBasicMaterial({
                color: 0xffd700,
                transparent: true,
                opacity: 0.95
            });
            const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
            tube.userData.isConnectionLine = true;
            globe.add(tube);
            
            // Create gradient glow
            createConnectionGlow(curve, globe, 0.002, 50, 2);
        });
    }

    /**
     * Add secondary connection lines
     */
    addSecondaryConnectionLines() {
        const globe = this.sceneModel.getGlobe();
        const secondaryConnections = this.dataModel.getSecondaryConnections();
        const cities = this.dataModel.getAllCities();

        secondaryConnections.forEach(connection => {
            const fromCity = cities.find(c => c.name === connection.from);
            const toCity = cities.find(c => c.name === connection.to);
            
            if (!fromCity || !toCity) {
                console.warn(`Secondary connection not found: ${connection.from} to ${connection.to}`);
                return;
            }
            
            createConnectionLine({
                fromLocation: { lat: fromCity.lat, lon: fromCity.lon, from: connection.from },
                toLocation: { lat: toCity.lat, lon: toCity.lon, to: connection.to },
                radius: 1.02,
                segments: 50,
                useArc: false,
                parent: globe,
                lineConfig: {
                    radius: 0.0015,
                color: 0xffffff,
                    opacity: 0.7,
                    userDataKey: 'isSecondaryLine'
                }
            });
        });
    }

    /**
     * Add seaport connection lines
     * @param {Function} onBoatRouteCurveCreated - Callback when boat route curve is created
     */
    addSeaportConnectionLines(onBoatRouteCurveCreated) {
        const globe = this.sceneModel.getGlobe();
        const seaportConnections = this.dataModel.getSeaportConnections();
        const seaports = this.dataModel.getAllSeaports();

        seaportConnections.forEach(connection => {
            const fromPort = seaports.find(p => p.name === connection.from);
            const toPort = seaports.find(p => p.name === connection.to);
            
            if (!fromPort || !toPort) {
                console.warn(`Seaport connection not found: ${connection.from} to ${connection.to}`);
                return;
            }
            
            // Special case: Mumbai to Anchorage - force long way (through Africa/Pacific)
            const forceLongWay = (connection.from === 'Mumbai' && connection.to === 'Anchorage') ||
                                 (connection.from === 'Anchorage' && connection.to === 'Mumbai');
            
            createConnectionLine({
                fromLocation: { lat: fromPort.lat, lon: fromPort.lon, from: connection.from },
                toLocation: { lat: toPort.lat, lon: toPort.lon, to: connection.to },
                radius: 1.0,
                segments: 50,
                useArc: false,
                forceLongWay,
                parent: globe,
                onCurveCreated: onBoatRouteCurveCreated,
                lineConfig: {
                    radius: 0.002,
                color: 0xff0000,
                    opacity: 0.8,
                    userDataKey: 'isSeaportConnectionLine',
                    visible: false // Hide seaport connection lines
                }
            });
        });
    }

    /**
     * Add satellite markers (for future rocket connections)
     * @param {Array} satellites - Array of satellite objects
     */
    addSatelliteMarkers(satellites) {
        const markers = this.sceneModel.getMarkers();

        satellites.forEach(satellite => {
            const data = satellite.userData;
            if (!data || !data.isSatellite) return;
            
            // Create marker for satellite (smaller than city markers)
            const markerGeometry = new THREE.SphereGeometry(0.003, 12, 12);
            const markerMaterial = new THREE.MeshBasicMaterial({
                color: 0x9b59b6 // Purple to match orbit lines
            });
            
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.userData = {
                satellite: data.name,
                satelliteType: data.type,
                isSatelliteMarker: true,
                parentSatellite: satellite
            };
            
            // Hide satellite markers (they were showing as dots)
            marker.visible = false;
            
            // Marker will be positioned relative to satellite (follows it)
            satellite.add(marker);
            markers.push(marker);
        });
    }
}

