/**
 * WorldviewGlobeView - Handles globe rendering, markers, and connection lines
 */
import { xyToPlanePosition } from '../../../worldview-shared-assets/utils/WorldviewGeometry.js';
import { mixin as globeSkyMixin } from './WorldviewGlobeSkyEffectsMixin.js';
import { mixin as globeWorldMarkersMixin } from './WorldviewGlobeWorldMarkersMixin.js';
import { configureTexture, loadTexture, changePlaneTexture } from '../helpers/WorldviewGlobeTextures.js';
import { applyCelestialMaterialTint } from '../helpers/WorldviewGlobePlanes.js';
import { createGlobeMesh, setupCelestialPlanes, createGlobeRimGlowSprite, createGlobeAuroraShell, createGlobeCloudLayer, GLOBE_CLOUD_ATLAS_VARIANTS, applyGlobeCloudPaletteTint, rerandomizeGlobeCloudAtlas } from '../helpers/WorldviewGlobeInit.js';
import { createGlobePatternOverlay, getPaletteAccentHex, getPalettePatternPath, updatePatternWave } from '../helpers/WorldviewPatternOverlay.js';
import { addSunBackground, assignEarthLightLayer, syncAtmosphereSunDirUniforms } from '../helpers/WorldviewSunBackground.js';
import { EARTH_POLAR_TO_EQUATORIAL_RATIO, EARTH_OBLIQUITY_DEG } from '../../../worldview-shared-assets/constants/WorldviewPhysicalConstants.js';
import { getGlobeQualitySnapshot } from '../../../worldview-shared-assets/constants/WorldviewQualitySettings.js';
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

        /** Palette earth crossfade (opacity tween). */
        this._paletteFadeToken = 0;
        this._paletteFadeRaf = null;
        /** @type {THREE.Mesh|null} temporary earth overlay used during palette crossfade */
        this._paletteEarthOverlay = null;
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
        const qualityEarly = getGlobeQualitySnapshot();
        
        // Load normal map (skip on low — Lambert path does not use it; saves ~VRAM)
        const normalMapPath = 'src/assets/images/Maps/Utility/MAP%20Normal.png';
        const normalMap = qualityEarly.earthUseStandardMaterial
            ? loadTexture(
                textureLoader,
                normalMapPath,
                renderer,
                (texture) => console.log('Normal map loaded successfully'),
                (err) => console.warn('Normal map not found, continuing without it:', err)
            )
            : null;
        
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

        const quality = getGlobeQualitySnapshot();

        // Cloud albedo: random `Cloud Map #` atlas per load, ~50% opacity, palette-tinted like rim
        if (quality.cloudsEnabled) {
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
        }

        // Pattern overlay on globe - tinted by palette (added AFTER clouds to sit on top)
        if (quality.patternWaveEnabled) {
            const patternTint = getPaletteAccentHex(paletteKey);
            const globePattern = createGlobePatternOverlay(textureLoader, renderer, patternTint, 0.3, paletteKey);
            if (globePattern) {
                this._globePatternOverlay = globePattern;
                globePattern.scale.set(1, oblate, 1);
                globe.add(globePattern);
            }
        }

        // Polar auroras (additive shell, latitudinal bands in object space — track real poles as globe spins)
        if (quality.auroraEnabled) {
            const aurora = createGlobeAuroraShell({
                uIntensity: isGray ? 0.34 : (isCrimson ? 0.38 : (isNulled ? 0.36 : 0.42))
            });
            if (aurora) {
                this._auroraMesh = aurora;
                aurora.scale.set(1, oblate, 1);
                globe.add(aurora);
                this._seedAuroraVeilAnimIfNeeded();
            }
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
        /*
         * Globe container fills under the dock overlay, so geometric center sits too low
         * in the visible band. Nudge the assembly up so Earth reads centered above the dock.
         */
        earthAssembly.position.y = 0.28;
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

        // Soft-warm other earth maps after first paint (idle) so palette swaps are ready sooner.
        this._schedulePaletteTextureWarm(textureLoader, renderer, initialTexturePath);

        // Create Moon and Mars planes
        setupCelestialPlanes({
            scene,
            textureLoader,
            renderer,
            palette: paletteKey,
            sceneModel: this.sceneModel
        });
    }

    _gpuUploadTexture(texture) {
        const renderer = this.sceneModel.getRenderer();
        if (!renderer || !texture) return;
        try {
            if (typeof renderer.initTexture === 'function') renderer.initTexture(texture);
        } catch (_) { /* ignore */ }
    }

    /**
     * Prefetch earth (+ pattern) maps and upload to GPU — call when palette menu opens or after init.
     * @param {string[]} [paths]
     */
    warmPaletteTextures(paths = null) {
        const renderer = this.sceneModel.getRenderer();
        if (!renderer) return;
        const textureLoader = new THREE.TextureLoader();
        const earthPaths = paths || [
            'src/assets/images/Maps/Earth%20Textures/MAP Blue.png',
            'src/assets/images/Maps/Earth%20Textures/MAP Black.png',
            'src/assets/images/Maps/Earth%20Textures/MAP Crimson.png',
            'src/assets/images/Maps/Earth%20Textures/MAP Nulled.png',
            getPalettePatternPath('blue'),
            getPalettePatternPath('gray'),
            getPalettePatternPath('crimson'),
            getPalettePatternPath('nulled')
        ];
        earthPaths.forEach((path) => {
            if (this.textureCache.has(path)) {
                this._gpuUploadTexture(this.textureCache.get(path));
                return;
            }
            loadTexture(textureLoader, path, renderer, (texture) => {
                this.textureCache.set(path, texture);
                this._gpuUploadTexture(texture);
            });
        });
    }

    _schedulePaletteTextureWarm(textureLoader, renderer, skipPath) {
        const rest = [
            'src/assets/images/Maps/Earth%20Textures/MAP Blue.png',
            'src/assets/images/Maps/Earth%20Textures/MAP Black.png',
            'src/assets/images/Maps/Earth%20Textures/MAP Crimson.png',
            'src/assets/images/Maps/Earth%20Textures/MAP Nulled.png',
            getPalettePatternPath('blue'),
            getPalettePatternPath('gray'),
            getPalettePatternPath('crimson'),
            getPalettePatternPath('nulled')
        ].filter((p) => p !== skipPath);

        // Parallel warm — palette swaps should not wait on a serial idle chain
        rest.forEach((path) => {
            if (this.textureCache.has(path)) {
                this._gpuUploadTexture(this.textureCache.get(path));
                return;
            }
            const kick = typeof requestIdleCallback === 'function'
                ? (cb) => requestIdleCallback(cb, { timeout: 900 })
                : (cb) => setTimeout(cb, 80);
            kick(() => {
                if (this.textureCache.has(path)) {
                    this._gpuUploadTexture(this.textureCache.get(path));
                    return;
                }
                loadTexture(textureLoader, path, renderer, (texture) => {
                    this.textureCache.set(path, texture);
                    this._gpuUploadTexture(texture);
                });
            });
        });
    }

    _disposePaletteEarthOverlay() {
        const overlay = this._paletteEarthOverlay;
        if (!overlay) return;
        if (overlay.parent) overlay.parent.remove(overlay);
        if (overlay.material) {
            // Keep shared map textures in the cache; only dispose the cloned material
            overlay.material.map = null;
            overlay.material.dispose?.();
        }
        this._paletteEarthOverlay = null;
    }

    _tweenMaterialOpacity(material, from, to, ms) {
        return new Promise((resolve) => {
            if (!material) {
                resolve();
                return;
            }
            const token = ++this._paletteFadeToken;
            if (this._paletteFadeRaf) {
                cancelAnimationFrame(this._paletteFadeRaf);
                this._paletteFadeRaf = null;
            }
            material.transparent = true;
            material.opacity = from;
            material.needsUpdate = true;
            const t0 = performance.now();
            const step = (now) => {
                if (token !== this._paletteFadeToken) {
                    resolve();
                    return;
                }
                const u = Math.min(1, (now - t0) / Math.max(1, ms));
                const eased = u * u * (3 - 2 * u);
                material.opacity = from + (to - from) * eased;
                if (u < 1) {
                    this._paletteFadeRaf = requestAnimationFrame(step);
                } else {
                    this._paletteFadeRaf = null;
                    material.opacity = to;
                    resolve();
                }
            };
            this._paletteFadeRaf = requestAnimationFrame(step);
        });
    }

    /** Independent opacity tween (does not cancel sibling palette FX). */
    _tweenOpacityParallel(material, from, to, ms) {
        return new Promise((resolve) => {
            if (!material) {
                resolve();
                return;
            }
            material.transparent = true;
            material.opacity = from;
            material.needsUpdate = true;
            const t0 = performance.now();
            const step = (now) => {
                const u = Math.min(1, (now - t0) / Math.max(1, ms));
                const eased = u * u * (3 - 2 * u);
                material.opacity = from + (to - from) * eased;
                if (u < 1) {
                    requestAnimationFrame(step);
                } else {
                    material.opacity = to;
                    resolve();
                }
            };
            requestAnimationFrame(step);
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
        if (!this._globePatternOverlay?.material?.uniforms) {
            return;
        }

        const p = String(palette).toLowerCase();
        const patternPath = getPalettePatternPath(p);
        const patternTint = getPaletteAccentHex(p);
        const tintColor = new THREE.Color(patternTint);
        const uniforms = this._globePatternOverlay.material.uniforms;

        // Tint flips immediately with the UI; map swaps when ready
        uniforms.uTintColor.value.set(tintColor.r, tintColor.g, tintColor.b);

        if (this.textureCache.has(patternPath)) {
            const cachedTexture = this.textureCache.get(patternPath);
            this._gpuUploadTexture(cachedTexture);
            uniforms.uPatternMap.value = cachedTexture;
            return;
        }

        const renderer = this.sceneModel.getRenderer();
        const textureLoader = new THREE.TextureLoader();
        loadTexture(
            textureLoader,
            patternPath,
            renderer,
            (texture) => {
                this.textureCache.set(patternPath, texture);
                this._gpuUploadTexture(texture);
                if (this._globePatternOverlay?.material?.uniforms) {
                    this._globePatternOverlay.material.uniforms.uPatternMap.value = texture;
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
     * Change globe texture with a dual-layer crossfade (old map stays fully visible;
     * new map fades in on top). Avoids the dark dip that made the world feel late vs UI.
     * @param {string} texturePath - Path to the texture file
     * @param {Function} onTextureLoaded - Optional callback when texture loads
     */
    changeGlobeTexture(texturePath, onTextureLoaded) {
        const globe = this.sceneModel.getGlobe();
        if (!globe) {
            console.error('Globe not found');
            return;
        }
        const surface = this.sceneModel.getGlobeSurfaceMesh
            ? this.sceneModel.getGlobeSurfaceMesh()
            : (globe.userData?.earthSurfaceMesh || globe);
        if (!surface || !surface.material) {
            console.error('Globe surface mesh not found');
            return;
        }

        const mat = surface.material;
        if (mat.map && this.textureCache.get(texturePath) === mat.map) {
            if (onTextureLoaded) onTextureLoaded();
            return;
        }

        const applyEarthMapTexture = () => {
            if (this.sceneModel.setEarthMapTextureUrl) {
                this.sceneModel.setEarthMapTextureUrl(texturePath);
            }
            window.globeController?.map2dLite?.refreshTexturesFromScene?.();
        };

        /* Flat map should start its flash/reveal in the same beat as the globe. */
        const mapOn = this.sceneModel.getMapViewEnabled?.()
            ? this.sceneModel.getMapViewEnabled()
            : !!this.sceneModel.isMapView;
        if (mapOn) {
            applyEarthMapTexture();
        }

        /**
         * Notable palette beat: brief bright flash → longer reveal.
         * Covers any texture-load lag so the globe never feels "late" vs CSS.
         */
        const runPaletteReveal = async (texture) => {
            if (!texture || !surface.material) return;
            this._disposePaletteEarthOverlay();
            this._gpuUploadTexture(texture);

            const parent = surface.parent || globe;

            // Flash plate (additive soft white) — starts immediately
            const flashMat = new THREE.MeshBasicMaterial({
                color: 0xfff4e8,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const flash = new THREE.Mesh(surface.geometry, flashMat);
            flash.name = 'earthPaletteFlash';
            flash.scale.copy(surface.scale).multiplyScalar(1.002);
            flash.position.copy(surface.position);
            flash.quaternion.copy(surface.quaternion);
            flash.renderOrder = (surface.renderOrder || 0) + 6;
            flash.layers.mask = surface.layers.mask;
            parent.add(flash);

            const overlayMat = surface.material.clone();
            overlayMat.map = texture;
            overlayMat.transparent = true;
            overlayMat.opacity = 0;
            overlayMat.depthWrite = false;
            overlayMat.needsUpdate = true;

            const overlay = new THREE.Mesh(surface.geometry, overlayMat);
            overlay.name = 'earthPaletteCrossfade';
            overlay.scale.copy(surface.scale);
            overlay.position.copy(surface.position);
            overlay.quaternion.copy(surface.quaternion);
            overlay.renderOrder = (surface.renderOrder || 0) + 5;
            overlay.layers.mask = surface.layers.mask;
            parent.add(overlay);
            this._paletteEarthOverlay = overlay;

            // Concurrent soft flash + reveal — feels like one beat, not flash-then-wait
            await Promise.all([
                this._tweenOpacityParallel(flashMat, 0, 0.32, 70)
                    .then(() => this._tweenOpacityParallel(flashMat, 0.32, 0, 200)),
                this._tweenOpacityParallel(overlayMat, 0, 1, 240)
            ]);

            if (flash.parent) flash.parent.remove(flash);
            flashMat.dispose?.();

            if (this._paletteEarthOverlay !== overlay) {
                return;
            }

            mat.map = texture;
            mat.transparent = false;
            mat.opacity = 1;
            mat.needsUpdate = true;
            applyEarthMapTexture();
            this._disposePaletteEarthOverlay();
            if (onTextureLoaded) onTextureLoaded();
        };

        if (this.textureCache.has(texturePath)) {
            void runPaletteReveal(this.textureCache.get(texturePath));
            return;
        }

        /* Hold a soft waiting glow on the current earth until the new map uploads. */
        const waitGlowMat = new THREE.MeshBasicMaterial({
            color: 0xffe8c8,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const waitGlow = new THREE.Mesh(surface.geometry, waitGlowMat);
        waitGlow.name = 'earthPaletteWaitGlow';
        waitGlow.scale.copy(surface.scale).multiplyScalar(1.002);
        waitGlow.position.copy(surface.position);
        waitGlow.quaternion.copy(surface.quaternion);
        waitGlow.renderOrder = (surface.renderOrder || 0) + 4;
        waitGlow.layers.mask = surface.layers.mask;
        (surface.parent || globe).add(waitGlow);
        void this._tweenOpacityParallel(waitGlowMat, 0, 0.18, 100);

        const renderer = this.sceneModel.getRenderer();
        const textureLoader = new THREE.TextureLoader();
        loadTexture(textureLoader, texturePath, renderer, (texture) => {
            this.textureCache.set(texturePath, texture);
            this._gpuUploadTexture(texture);
            if (waitGlow.parent) waitGlow.parent.remove(waitGlow);
            waitGlowMat.dispose?.();
            void runPaletteReveal(texture);
        }, () => {
            if (waitGlow.parent) waitGlow.parent.remove(waitGlow);
            waitGlowMat.dispose?.();
            console.warn('changeGlobeTexture: failed to load', texturePath);
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
