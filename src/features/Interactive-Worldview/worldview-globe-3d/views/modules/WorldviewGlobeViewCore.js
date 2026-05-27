/**
 * WorldviewGlobeView - Handles globe rendering, markers, and connection lines
 */
import { xyToPlanePosition } from '../../../worldview-shared-assets/utils/WorldviewGeometry.js';
import { mixin as globeSkyMixin } from './WorldviewGlobeSkyEffectsMixin.js';
import { mixin as globeWorldMarkersMixin } from './WorldviewGlobeWorldMarkersMixin.js';
import { configureTexture, loadTexture, changePlaneTexture } from '../helpers/WorldviewGlobeTextures.js';
import { applyCelestialMaterialTint } from '../helpers/WorldviewGlobePlanes.js';
import { createGlobeMesh, setupCelestialPlanes, createGlobeRimGlowSprite, createGlobeAuroraShell, createGlobeCloudLayer, GLOBE_CLOUD_ATLAS_VARIANTS, applyGlobeCloudPaletteTint, rerandomizeGlobeCloudAtlas } from '../helpers/WorldviewGlobeInit.js';
import { createGlobePatternOverlay, getPaletteAccentHex, updatePatternWave } from '../helpers/WorldviewPatternOverlay.js';
import { addSunBackground, assignEarthLightLayer, syncAtmosphereSunDirUniforms } from '../helpers/WorldviewSunBackground.js';
import { EARTH_POLAR_TO_EQUATORIAL_RATIO, EARTH_OBLIQUITY_DEG } from '../../../worldview-shared-assets/constants/WorldviewPhysicalConstants.js';
// THREE is loaded globally via script tag in index.html

/** Globe cloud / weather baseline opacity */
const GLOBE_CLOUD_BASE_OPACITY = 0.5;

export class WorldviewGlobeView {
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

        // Flat map is DOM-only ({@link WorldviewMapLiteLayer}); no WebGL earth map mesh.
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
        if (mapOn) {
            return;
        }

        const on = !!enabled;
        if (on) this._rerandomizeAuroraVeilState();
        if (this._auroraMesh) {
            this._auroraMesh.visible = on;
        }
        if (this._cloudLayer) {
            if (!on) {
                this._cloudLayer.visible = false;
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
}

Object.assign(WorldviewGlobeView.prototype, globeSkyMixin, globeWorldMarkersMixin);
