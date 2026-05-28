/**
 * GlobeController - Main controller that orchestrates the globe application
 */
import { WorldviewLocationCatalog } from '../../worldview-domain-state/models/WorldviewLocationCatalog.js';
import { WorldviewTransportState } from '../../worldview-domain-state/models/WorldviewTransportState.js';
import { WorldviewSceneState } from '../../worldview-domain-state/models/WorldviewSceneState.js';
import { WorldviewGlobeView } from '../../worldview-globe-3d/views/WorldviewGlobeView.js';
import { WorldviewTransportView } from '../../worldview-globe-3d/views/WorldviewTransportView.js';
import { WorldviewHudView } from '../../worldview-globe-3d/views/WorldviewHudView.js';
import { WorldviewRouteController } from './WorldviewRouteController.js';
import { WorldviewTransportController } from './WorldviewTransportController.js';
import { WorldviewInteractionController } from './WorldviewInteractionController.js';
import { WorldviewAutoRotateController } from './WorldviewAutoRotateController.js';
import { WorldviewCelestialPanels } from './WorldviewCelestialPanels.js';
import { applyCurrentPaletteToTransportVehicles } from '../../worldview-shared-assets/utils/TransportPaletteColors.js';
import {
    maybeInstallDevSunYawControl,
    updateSunSliderVisibility
} from '../../worldview-shared-assets/debug/WorldviewDevSunControl.js';
import { WorldviewMapLiteLayer } from '../../worldview-map-2d/WorldviewMapLiteLayer.js';
import { applyWebglLayersHiddenForActiveMap, ensureGlobeWorldBuilt } from './WorldviewGlobeBootstrap.js';
export class WorldviewGlobeController {
    constructor() {
        // Initialize models
        this.dataModel = new WorldviewLocationCatalog();
        this.isCleanedUp = false; // Flag to prevent animation loop from continuing after cleanup
        this.transportModel = new WorldviewTransportState();
        this.sceneModel = new WorldviewSceneState();
        
        // Initialize views
        this.globeView = new WorldviewGlobeView(this.sceneModel, this.dataModel);
        this.transportView = new WorldviewTransportView(this.sceneModel, this.transportModel);
        this.uiView = new WorldviewHudView(this.sceneModel, this.dataModel, this.globeView);
        
        // Initialize controllers
        this.routeController = new WorldviewRouteController(this.transportModel);
        this.transportController = new WorldviewTransportController(
            this.sceneModel,
            this.transportModel,
            this.routeController,
            this.transportView,
            this.globeView,
            this.dataModel
        );
        this.interactionController = new WorldviewInteractionController(this.sceneModel, this.uiView);
        
        // Specialized controllers
        this.autoRotateController = new WorldviewAutoRotateController(this.sceneModel);
        this.planeManager = new WorldviewCelestialPanels(this.sceneModel, this.dataModel);

        if (typeof window !== 'undefined') {
            window.applyCurrentPaletteToTransportVehicles = applyCurrentPaletteToTransportVehicles;
        }
        
        // Animation state
        this.animationId = null;
        this.trainSpawnInterval = null;
        this.lastFrameTime = performance.now();
        this.isTabVisible = true;
        /** @type {ResizeObserver|null} */
        this._globeResizeObserver = null;
        /** Layout changed (#globe-container / dock); resize WebGL in animate() so setSize and render share one rAF. */
        this._globeLayoutDirty = false;
        /** @type {import('../map/Map2DLiteLayer.js').Map2DLiteLayer|null} */
        this.map2dLite = null;
        /** Coalesced rAF for {@link #syncMapLiteWebGlImmediate} while DOM map is active (main globe loop is paused). */
        this._mapLiteSyncRafId = null;
        /** `#globe-container` — needed when leaving map before globe meshes exist. */
        this._globeContainer = null;
        /** True right after earth + celestial rigs are created ({@link GlobeView#initGlobe}); rest of world build may still be running. */
        this._globeWorldBuilt = false;
    }

    /**
     * Build WebGL earth, celestial planes, routes, transport, markers (runs once). Map-first loads defer this to rAF
     * so the DOM map can paint first; desktop runs it synchronously during init.
     * @param {HTMLElement} container
     */
    _ensureGlobeWorldBuilt(container) {
        ensureGlobeWorldBuilt(this, container, maybeInstallDevSunYawControl);
    }

    /** When map mode is on, keep WebGL roots invisible (canvas may already be hidden). */
    _applyWebglLayersHiddenForActiveMap() {
        applyWebglLayersHiddenForActiveMap(this.sceneModel);
    }

    /**
     * Initialize the globe application
     */
    async init() {
        const container = document.getElementById('globe-container');
        if (!container) {
            console.error('Globe container not found');
            return;
        }

        // Load data
        try {
            await this.dataModel.loadData();
            // NOTE: EventManager sync removed - Globe no longer syncs event data
            // Event System Load Out handles all event data separately
        } catch (error) {
            console.error('Failed to load data:', error);
            return;
        }

        this._globeContainer = container;

        // Initialize scene (WebGL context + camera; earth mesh comes later via _ensureGlobeWorldBuilt)
        this.sceneModel.initScene(container);
        this.map2dLite = new WorldviewMapLiteLayer({
            container,
            sceneModel: this.sceneModel,
            dataModel: this.dataModel
        });

        const shouldDefaultToMapView = false; // Always default to globe view, not map view

        this.interactionController.setupControls(container);
        if (shouldDefaultToMapView && this.interactionController && typeof this.interactionController.resetCameraToDefault === 'function') {
            this.interactionController.resetCameraToDefault();
        }

        this.uiView.setupAutoRotateToggle();
        this.uiView.setupHyperloopToggle(() => {
            this.onHyperloopToggled();
        });

        // NOTE: Event pagination removed - Globe no longer handles event pagination
        // Event System Load Out handles all event UI separately

        window.addEventListener('resize', () => {
            this._globeLayoutDirty = true;
            const mapOn = this.sceneModel.getMapViewEnabled?.()
                ? this.sceneModel.getMapViewEnabled()
                : !!this.sceneModel.isMapView;
            if (mapOn && this.map2dLite?.isVisible?.()) {
                this.requestMapLiteSync();
            }
        });

        if (typeof ResizeObserver !== 'undefined') {
            this._globeResizeObserver = new ResizeObserver(() => {
                if (this.isCleanedUp) return;
                this._globeLayoutDirty = true;
            });
            this._globeResizeObserver.observe(container);
        }

        this.setupPageVisibilityTracking();

        if (shouldDefaultToMapView) {
            this.setMapViewEnabled(true);
            if (this.map2dLite?.syncMarkers) {
                void this.map2dLite.syncMarkers({ mode: 'instant' });
            }
            this.syncMapLiteWebGlImmediate();
            requestAnimationFrame(() => {
                this._ensureGlobeWorldBuilt(container);
            });
        } else {
            this._ensureGlobeWorldBuilt(container);
        }
    }

    /**
     * Setup page visibility tracking
     */
    setupPageVisibilityTracking() {
        document.addEventListener('visibilitychange', () => {
            const isVisible = !document.hidden;
            this.sceneModel.setPageVisible(isVisible);
            this.isTabVisible = isVisible;
            
            if (!isVisible) {
                // Pause ALL spawning when tab is hidden to prevent accumulation
                if (this.trainSpawnInterval) {
                    clearInterval(this.trainSpawnInterval);
                    this.trainSpawnInterval = null;
                }
                // Clear plane and boat intervals from TransportController
                if (this.transportController.planeSpawnInterval) {
                    clearInterval(this.transportController.planeSpawnInterval);
                    this.transportController.planeSpawnInterval = null;
                }
                if (this.transportController.boatSpawnInterval) {
                    clearInterval(this.transportController.boatSpawnInterval);
                    this.transportController.boatSpawnInterval = null;
                }
            } else {
                // Tab became visible - restart spawning with fresh intervals
                // Reset last frame time to prevent catch-up animation
                this.lastFrameTime = performance.now();
                
                // Restart spawning (they check isPageVisible internally, so safe to restart)
                const inMap = this.sceneModel.getMapViewEnabled?.() ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
                if (!inMap) {
                    if (!this.trainSpawnInterval) {
                        this.transportController.spawnTrainsRandomly();
                        this.trainSpawnInterval = this.transportController.trainSpawnInterval;
                    }
                    if (!this.transportController.planeSpawnInterval) {
                        this.transportController.spawnPlanesRandomly();
                    }
                    if (!this.transportController.boatSpawnInterval) {
                        this.transportController.spawnBoatsRandomly();
                    }
                }
            }
        });
        
        // Prevent spawning when window loses focus (but keep transport visible)
        window.addEventListener('blur', () => {
            // Set page visible to false to prevent spawning (spawn functions check isPageVisible)
            this.sceneModel.setPageVisible(false);
        });
        
        // Resume spawning when window regains focus
        window.addEventListener('focus', () => {
            // Set page visible to true to resume spawning
            this.sceneModel.setPageVisible(true);
        });
    }

    /**
     * One-shot sync for DOM map mode: WebGL canvas/camera resize when layout is dirty, DOM map layout, UI.
     * Does not run {@link WorldviewCelestialPanels#updatePlanePositions} — map celestial thumbnails use camera frustum + rig squash
     * scale only ({@link Map2DLiteLayer}), not live WebGL rig world positions.
     * Main {@link #animate} loop does not run while {@link Map2DLiteLayer} is visible — call this from map interactions instead.
     */
    syncMapLiteWebGlImmediate() {
        const mapOn = this.sceneModel.getMapViewEnabled?.()
            ? this.sceneModel.getMapViewEnabled()
            : !!this.sceneModel.isMapView;
        if (!mapOn || !this.map2dLite?.isVisible?.() || this.isCleanedUp) {
            return;
        }
        if (this._globeLayoutDirty && this.interactionController) {
            this._globeLayoutDirty = false;
            this.interactionController.onWindowResize();
        }
        this.map2dLite.onContainerResize();
        this.uiView.updateLabelPosition();
        this.uiView.checkAndAutoShowImage();
    }

    /**
     * Coalesce map sync to one rAF (pan/zoom fires many pointer events per frame).
     */
    requestMapLiteSync() {
        if (this.isCleanedUp) return;
        const mapOn = this.sceneModel.getMapViewEnabled?.()
            ? this.sceneModel.getMapViewEnabled()
            : !!this.sceneModel.isMapView;
        if (!mapOn || !this.map2dLite?.isVisible?.()) return;
        if (this._mapLiteSyncRafId != null) return;
        this._mapLiteSyncRafId = requestAnimationFrame(() => {
            this._mapLiteSyncRafId = null;
            this.syncMapLiteWebGlImmediate();
        });
    }

    /**
     * Main animation loop
     */
    animate() {
        // Stop animation if cleanup has been called
        if (this.isCleanedUp) {
            return;
        }

        const scene = this.sceneModel.getScene();
        const camera = this.sceneModel.getCamera();
        const renderer = this.sceneModel.getRenderer();
        const globe = this.sceneModel.getGlobe();
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;

        const domLiteMap = isMapView && this.map2dLite && this.map2dLite.isVisible();
        if (domLiteMap) {
            this.syncMapLiteWebGlImmediate();
            return;
        }

        this.animationId = requestAnimationFrame(() => this.animate());

        if (!scene || !camera || !renderer || !globe || this.isCleanedUp) return;
        
        // Delta time tracking to prevent catch-up when tab regains focus
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        
        // If tab was hidden for more than 1 second, reset to prevent catch-up
        // This prevents vehicles from spawning all at once when tab regains focus
        if (deltaTime > 1000) {
            this.lastFrameTime = currentTime;
            // Skip this frame to prevent massive catch-up
            return;
        }
        
        this.lastFrameTime = currentTime;

        if (this._globeLayoutDirty && this.interactionController) {
            this._globeLayoutDirty = false;
            this.interactionController.onWindowResize();
        }

        // Update Moon/Mars plane positions to stay on camera's right side
        this.planeManager.updatePlanePositions(camera);

        if (!isMapView) {
            // Auto-rotate - if viewing event, recenter to it; otherwise normal rotation
            this.autoRotateController.updateAutoRotate(globe, camera);

            // Apply rotation momentum
            const velocity = this.sceneModel.getRotationVelocity();
            if (Math.abs(velocity.x) > 0.001 || Math.abs(velocity.y) > 0.001) {
                globe.rotation.x += velocity.x;
                globe.rotation.y += velocity.y;
                globe.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, globe.rotation.x));
                
                // Damping
                this.sceneModel.setRotationVelocity({
                    x: velocity.x * 0.95,
                    y: velocity.y * 0.95
                });
            }
        } else {
            // Map view: stop any leftover rotation momentum
            const velocity = this.sceneModel.getRotationVelocity();
            if (Math.abs(velocity.x) > 0.001 || Math.abs(velocity.y) > 0.001) {
                this.sceneModel.setRotationVelocity({ x: 0, y: 0 });
            }
            // Keep the map plane fixed (no billboard/lookAt), camera pans instead.
        }

        // Map view: no transport, trails, or satellite motion (lite mode).
        if (!isMapView) {
            if (this.sceneModel.getHyperloopVisible()) {
                this.transportController.updateTrains();
                this.transportController.updatePlanes();
                this.transportController.updateBoats();
                this.transportView.updateTrailSegments();
                this.transportView.updateBoatTrailSegments();
            }
            this.transportController.updateSatellites();
        }

        // Update label position
        this.uiView.updateLabelPosition();

        // Update pulse rings for event markers
        if (this.interactionController) {
            // updateMarkerPulse() ends by calling updatePulseRings(); avoid doing rings twice per frame.
            this.interactionController.updateMarkerPulse();
            this.interactionController.updateStationPinLines();
        }

        // Globe-only VFX (hidden in map view — skip uniform updates / logic)
        if (!isMapView) {
            if (this.globeView && typeof this.globeView.updateShootingStars === 'function') {
                this.globeView.updateShootingStars(deltaTime / 1000);
            }

            if (this.globeView && typeof this.globeView.updateAtmosphereEffects === 'function') {
                this.globeView.updateAtmosphereEffects(deltaTime / 1000);
            }
        }

        // Pattern wave animation (works for both globe and map view)
        if (this.globeView && typeof this.globeView.updatePatternWave === 'function') {
            this.globeView.updatePatternWave(deltaTime / 1000);
        }
        
        // Check and auto-show image if conditions are met
        this.uiView.checkAndAutoShowImage();

        // Render
        renderer.render(scene, camera);
    }

    /**
     * Toggle Earth view mode between globe and flat map.
     * Keeps event coordinates the same; markers are recreated onto the correct surface.
     * @param {boolean} enabled
     */
    setMapViewEnabled(enabled) {
        const isEnabled = !!enabled;

        if (!isEnabled && !this.sceneModel.getGlobe()) {
            if (this._globeContainer) {
                this._ensureGlobeWorldBuilt(this._globeContainer);
            } else {
                console.warn('GlobeController: cannot show globe — container not set');
                return;
            }
        }

        const globe = this.sceneModel.getGlobe();
        this.sceneModel.setMapViewEnabled(isEnabled);

        // Expose mode to CSS so we can hide/show mode-specific controls (e.g. auto-rotate).
        document.body.classList.toggle('map-view-enabled', isEnabled);

        const renderer = this.sceneModel.getRenderer();
        const canvas = renderer && renderer.domElement;
        const moonRig = this.sceneModel.getMoonRig ? this.sceneModel.getMoonRig() : this.sceneModel.moonRig;
        const marsRig = this.sceneModel.getMarsRig ? this.sceneModel.getMarsRig() : this.sceneModel.marsRig;
        const orbitRig = this.sceneModel.getOrbitRig ? this.sceneModel.getOrbitRig() : this.sceneModel.orbitRig;

        if (isEnabled) {
            if (globe) globe.visible = false;
            if (moonRig) moonRig.visible = false;
            if (marsRig) marsRig.visible = false;
            if (orbitRig) orbitRig.visible = false;
            if (canvas) {
                canvas.style.visibility = 'hidden';
                canvas.style.pointerEvents = 'none';
            }
            if (this.map2dLite) {
                this.map2dLite.show();
            }
        } else {
            if (this.map2dLite) {
                this.map2dLite.hide();
            }
            if (canvas) {
                canvas.style.visibility = '';
                canvas.style.pointerEvents = '';
            }
            if (globe) globe.visible = true;
            if (moonRig) moonRig.visible = true;
            if (marsRig) marsRig.visible = true;
            if (orbitRig) orbitRig.visible = true;
            // Recreate globe markers when switching back from map to globe
            if (window.globeEventMarkerManager && typeof window.globeEventMarkerManager.addEventMarkers === 'function') {
                void window.globeEventMarkerManager.addEventMarkers(false);
            }
        }

        if (this.globeView && typeof this.globeView.setGlobeSkyVisible === 'function') {
            this.globeView.setGlobeSkyVisible(!isEnabled);
        }

        // Satellites: reparent ISS/Mars Ship for map visibility (no decor / no map transport lines in lite map)
        if (this.transportController && typeof this.transportController.setSatellitesMapViewEnabled === 'function') {
            this.transportController.setSatellitesMapViewEnabled(isEnabled);
        }

        // Clear active transports & reservations so spawners repopulate cleanly on the current surface.
        const clearReservations = (obj) => {
            if (!obj) return;
            Object.keys(obj).forEach(k => delete obj[k]);
        };
        clearReservations(this.transportModel.getRouteReservations());
        clearReservations(this.transportModel.getBoatRouteReservations());

        const removeAll = (arr) => {
            if (!arr) return;
            for (let i = arr.length - 1; i >= 0; i--) {
                const o = arr[i];
                if (o && o.parent) o.parent.remove(o);
                arr.splice(i, 1);
            }
        };
        removeAll(this.transportModel.getTrains());
        removeAll(this.transportModel.getBoats());
        removeAll(this.transportModel.getPlanes());
        removeAll(this.transportModel.getPlaneTrails());
        removeAll(this.transportModel.getBoatTrails());

        // Reset camera to default framing for current mode
        if (this.interactionController && typeof this.interactionController.resetCameraToDefault === 'function') {
            this.interactionController.resetCameraToDefault();
        }

        // NOTE: Event slide and marker refresh removed - Globe no longer handles events
        // Event System Load Out handles all event UI separately

        // Restore globe-only states when switching back to globe (delay to ensure globe is ready)
        if (!isEnabled) {
            requestAnimationFrame(() => {
                // Restore weather and lighting state
                if (this.globeView) {
                    if (typeof this.globeView.setWeatherEffectsVisible === 'function') {
                        const weatherVisible = this.sceneModel.getGlobeWeatherEffectsVisible ? this.sceneModel.getGlobeWeatherEffectsVisible() : true;
                        this.globeView.setWeatherEffectsVisible(weatherVisible);
                    }
                    if (typeof this.globeView.setGlobeLightingVisible === 'function') {
                        const lightingVisible = this.sceneModel.getGlobeLightingVisible ? this.sceneModel.getGlobeLightingVisible() : true;
                        this.globeView.setGlobeLightingVisible(lightingVisible);
                    }
                }
                // Restore rotation state
                if (this.sceneModel.getAutoRotateEnabled && this.sceneModel.getAutoRotateEnabled()) {
                    this.sceneModel.setAutoRotate(true);
                }
                // Update sun slider visibility
                updateSunSliderVisibility(this);
            });
        } else {
            // Update sun slider visibility when switching to map mode
            updateSunSliderVisibility(this);
        }
        
        // Update all transport markers visibility for new view mode
        if (this.transportView && typeof this.transportView.updateAllTransportMarkersVisibility === 'function') {
            this.transportView.updateAllTransportMarkersVisibility();
        }

        if (this.globeView && typeof this.globeView.configureMapViewPresentation === 'function') {
            this.globeView.configureMapViewPresentation(isEnabled);
        }
        if (this.planeManager && typeof this.planeManager.syncCelestialVisualMeshesForViewMode === 'function') {
            this.planeManager.syncCelestialVisualMeshesForViewMode();
        }
        if (!isEnabled) {
            if (this._mapLiteSyncRafId != null) {
                cancelAnimationFrame(this._mapLiteSyncRafId);
                this._mapLiteSyncRafId = null;
            }
            if (this.animationId != null) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
            this.planeManager.updatePlaneVisibility();
            this.animate();
        } else {
            this.syncMapLiteWebGlImmediate();
        }
    }

    /**
     * @param {THREE.Mesh} plane
     * @param {boolean} show
     */
    animatePlaneScale(plane, show) {
        this.planeManager.animatePlaneScale(plane, show);
    }



    /**
     * Update plane visibility - delegates to WorldviewCelestialPanels
     * This method is kept for backward compatibility with GlobeView and InteractionController
     */
    updatePlaneVisibility() {
        this.planeManager.updatePlaneVisibility();
    }

    /**
     * Callback after hyperloop toggle
     * Kept for component-loader / API parity; no extra work required here.
     */
    onHyperloopToggled() {}

    /**
     * Cleanup and stop animation
     */
    destroy() {
        // Mark as cleaned up to stop animation loop
        this.isCleanedUp = true;

        if (this._mapLiteSyncRafId != null) {
            cancelAnimationFrame(this._mapLiteSyncRafId);
            this._mapLiteSyncRafId = null;
        }

        if (this._globeResizeObserver) {
            this._globeResizeObserver.disconnect();
            this._globeResizeObserver = null;
        }
        
        // Cancel animation frame
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Clear intervals
        if (this.trainSpawnInterval) {
            clearInterval(this.trainSpawnInterval);
            this.trainSpawnInterval = null;
        }
        
        // Stop transport controller spawns
        if (this.transportController) {
            if (this.transportController.trainSpawnInterval) {
                clearInterval(this.transportController.trainSpawnInterval);
            }
            if (this.transportController.planeSpawnInterval) {
                clearInterval(this.transportController.planeSpawnInterval);
            }
            if (this.transportController.boatSpawnInterval) {
                clearInterval(this.transportController.boatSpawnInterval);
            }
        }
        
        // Dispose of Three.js resources
        const renderer = this.sceneModel?.getRenderer();
        if (renderer) {
            // Force WebGL context loss to free GPU memory
            const gl = renderer.getContext();
            if (gl && typeof gl.getExtension === 'function') {
                const loseContext = gl.getExtension('WEBGL_lose_context');
                if (loseContext) {
                    loseContext.loseContext();
                }
            }
            renderer.dispose();
        }
        
        // Clear scene
        const scene = this.sceneModel?.getScene();
        if (scene) {
            scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(mat => {
                            if (mat.map) mat.map.dispose();
                            mat.dispose();
                        });
                    } else {
                        if (object.material.map) object.material.map.dispose();
                        object.material.dispose();
                    }
                }
            });
            while (scene.children.length > 0) {
                scene.remove(scene.children[0]);
            }
        }
    }
}

