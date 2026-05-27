/**
 * WorldviewCelestialPanels - Manages Moon/Mars plane positioning, visibility, and animation
 * Extracted from GlobeController to follow Single Responsibility Principle
 */

import { useOrbitPanelForStationShipMarkers } from '../../../system-interface/interface-platform-input/useOrbitPanelForStationShipMarkers.js';

const THREE = typeof window !== 'undefined' ? window.THREE : null;

/** Moon/Mars textured planes in flat map view (HTML overlay removed; this is the sole panel chrome). */
const MAP_VIEW_CELESTIAL_OPACITY = 0.55;

export class WorldviewCelestialPanels {
    constructor(sceneModel, dataModel) {
        this.sceneModel = sceneModel;
        this.dataModel = dataModel;
        this._lastSpacePanelSfxAt = 0;
        /** Reused vectors for updatePlanePositions (avoid per-frame alloc). */
        this._camPos = THREE ? new THREE.Vector3() : null;
        this._base = THREE ? new THREE.Vector3() : null;
        this._moonPos = THREE ? new THREE.Vector3() : null;
        this._marsPos = THREE ? new THREE.Vector3() : null;
        this._orbitPos = THREE ? new THREE.Vector3() : null;
        this._right = THREE ? new THREE.Vector3() : null;
        this._camUp = THREE ? new THREE.Vector3() : null;
        this._forward = THREE ? new THREE.Vector3() : null;
        /** @type {{ w: number, h: number }} */
        this._canvasSizeCache = { w: -1, h: -1 };
    }

    _playSpacePanelSfx(show) {
        if (!window.SoundEffectsManager) return;
        const now = performance.now();
        // Avoid double-trigger when Moon + Mars animate in the same tick or updatePlaneVisibility runs multiple times quickly.
        if (now - this._lastSpacePanelSfxAt < 180) return;
        this._lastSpacePanelSfxAt = now;

        if (show) {
            // Space Panel On: fade from 1.0s → 2.5s.
            window.SoundEffectsManager.play('spacePanelOn', { fadeOutAfterMs: 1000, fadeOutDurationMs: 1500 });
        } else {
            window.SoundEffectsManager.play('spacePanelOff');
        }
    }
    
    /**
     * Get Moon and Mars planes from sceneModel
     */
    getPlanes() {
        // Try getter methods first, then fallback to direct property access
        const moonPlane = this.sceneModel.getMoonPlane ? 
            this.sceneModel.getMoonPlane() : 
            (this.sceneModel.moonPlane || null);
        const marsPlane = this.sceneModel.getMarsPlane ? 
            this.sceneModel.getMarsPlane() : 
            (this.sceneModel.marsPlane || null);
        const orbitPlane = this.sceneModel.getOrbitPlane ? this.sceneModel.getOrbitPlane() : this.sceneModel.orbitPlane;
        return { moonPlane, marsPlane, orbitPlane };
    }
    
    _getCelestialPositionTargets() {
        const { moonPlane, marsPlane, orbitPlane } = this.getPlanes();
        if (!moonPlane || !marsPlane) return { moonTarget: null, marsTarget: null, orbitTarget: null };
        const moonRig = this.sceneModel.getMoonRig ? this.sceneModel.getMoonRig() : this.sceneModel.moonRig;
        const marsRig = this.sceneModel.getMarsRig ? this.sceneModel.getMarsRig() : this.sceneModel.marsRig;
        const orbitRig = this.sceneModel.getOrbitRig ? this.sceneModel.getOrbitRig() : this.sceneModel.orbitRig;
        return {
            moonTarget: moonRig || moonPlane,
            marsTarget: marsRig || marsPlane,
            orbitTarget: orbitPlane ? (orbitRig || orbitPlane) : null
        };
    }

    _isMapView() {
        return this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
    }

    /**
     * Celestial panels use MeshBasicMaterial + userData.celestialGlowRgb; pulse open/close by brightening color.
     * Legacy MeshStandardMaterial still uses emissiveIntensity.
     * @param {THREE.Material} material
     * @param {number} emissiveLikeIntensity - same range as old emissive pulse (~0.3 settled … 2 peak)
     */
    _setCelestialPanelGlow(material, emissiveLikeIntensity) {
        if (!material || !THREE) return;
        const rgb = material.userData?.celestialGlowRgb;
        if (material.type === 'MeshBasicMaterial' && rgb) {
            const t = Math.max(0, Math.min(1, (emissiveLikeIntensity - 0.3) / (2.0 - 0.3)));
            const mult = 1.0 + t * 0.55;
            material.color.setRGB(rgb.r * mult, rgb.g * mult, rgb.b * mult);
            material.needsUpdate = true;
            return;
        }
        if (material.emissiveIntensity !== undefined) {
            material.emissiveIntensity = emissiveLikeIntensity;
            material.needsUpdate = true;
        }
    }

    /**
     * Update Moon/Mars plane positions to stay on camera's right side
     * @param {THREE.Camera} camera - The camera object
     */
    updatePlanePositions(camera) {
        const { moonPlane, marsPlane } = this.getPlanes();
        const { moonTarget, marsTarget, orbitTarget } = this._getCelestialPositionTargets();

        if (!moonPlane || !marsPlane || !moonTarget || !marsTarget || !camera || !THREE) {
            return;
        }
        const isMapView = this._isMapView();
        const renderer = this.sceneModel.getRenderer ? this.sceneModel.getRenderer() : this.sceneModel.renderer;

        this._camPos.copy(camera.position);

        camera.updateMatrixWorld();

        this._right.setFromMatrixColumn(camera.matrixWorld, 0);
        this._camUp.setFromMatrixColumn(camera.matrixWorld, 1);
        this._forward.setFromMatrixColumn(camera.matrixWorld, 2);

        this._right.normalize();
        this._camUp.normalize();
        this._forward.normalize();

        let horizontalOffset = isMapView ? 2.4 : 1.5;
        let moonVerticalOffset = 0.42;
        let marsVerticalOffset = 0;
        let orbitVerticalOffset = -0.42;

        if (isMapView && renderer && renderer.domElement) {
            const el = renderer.domElement;
            const cw = el.clientWidth;
            const ch = el.clientHeight;
            if (cw !== this._canvasSizeCache.w || ch !== this._canvasSizeCache.h) {
                this._canvasSizeCache.w = cw;
                this._canvasSizeCache.h = ch;
            }
            const viewportW = Math.max(1, this._canvasSizeCache.w);
            const viewportH = Math.max(1, this._canvasSizeCache.h);
            const aspect = viewportW / viewportH;

            const fovRad = (camera.fov * Math.PI) / 180;
            const zOffset = 0.18;
            const distance = Math.max(0.01, this._camPos.z - zOffset);
            const halfViewH = Math.tan(fovRad / 2) * distance;
            const halfViewW = halfViewH * aspect;

            const panelHalfW = 0.4 / 2;
            const panelHalfH = 0.4 / 2;
            const padX = 0.12;
            const padY = 0.10;

            horizontalOffset = Math.max(0, halfViewW - (panelHalfW + padX));
            const v = Math.max(0, Math.min(halfViewH - (panelHalfH + padY), halfViewH * 0.25));
            moonVerticalOffset = v;
            marsVerticalOffset = 0;
            orbitVerticalOffset = -v;
        }

        if (isMapView) {
            this._base.set(this._camPos.x, this._camPos.y, 0);
        } else {
            this._base.set(0, 0, 0);
        }

        this._moonPos
            .copy(this._base)
            .addScaledVector(this._right, horizontalOffset)
            .addScaledVector(this._camUp, moonVerticalOffset);

        this._marsPos
            .copy(this._base)
            .addScaledVector(this._right, horizontalOffset)
            .addScaledVector(this._camUp, marsVerticalOffset);

        if (this._orbitPos) {
            this._orbitPos
                .copy(this._base)
                .addScaledVector(this._right, horizontalOffset)
                .addScaledVector(this._camUp, orbitVerticalOffset);
        }

        if (isMapView) {
            const zOffset = 0.18;
            this._moonPos.z += zOffset;
            this._marsPos.z += zOffset;
            if (this._orbitPos) this._orbitPos.z += zOffset;
        }

        moonTarget.position.copy(this._moonPos);
        marsTarget.position.copy(this._marsPos);
        if (orbitTarget && this._orbitPos) {
            orbitTarget.position.copy(this._orbitPos);
        }

        if (isMapView) {
            moonTarget.rotation.set(0, 0, 0);
            marsTarget.rotation.set(0, 0, 0);
            if (orbitTarget) orbitTarget.rotation.set(0, 0, 0);
        } else {
            moonTarget.lookAt(this._camPos);
            marsTarget.lookAt(this._camPos);
            if (orbitTarget) orbitTarget.lookAt(this._camPos);
        }

        const orbitPlane = this.sceneModel.getOrbitPlane ? this.sceneModel.getOrbitPlane() : this.sceneModel.orbitPlane;
        const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const globeCelestialScale = isMapView ? 1 : w <= 480 ? 0.58 : w <= 768 ? 0.7 : 1;
        moonPlane.scale.setScalar(globeCelestialScale);
        marsPlane.scale.setScalar(globeCelestialScale);
        if (orbitPlane) orbitPlane.scale.setScalar(globeCelestialScale);
    }
    
    /**
     * Update Moon/Mars plane visibility based on current page events
     * Planes are shown only if the current page has at least one event on that plane
     * Animates panels with vertical scaling (squash/stretch effect)
     * NOTE: Now uses Event System data when available, falls back to Globe's dataModel
     */
    updatePlaneVisibility() {
        // Try multiple ways to get planes
        let moonPlane = null;
        let marsPlane = null;
        
        if (this.sceneModel) {
            moonPlane = this.sceneModel.getMoonPlane ? this.sceneModel.getMoonPlane() : this.sceneModel.moonPlane;
            marsPlane = this.sceneModel.getMarsPlane ? this.sceneModel.getMarsPlane() : this.sceneModel.marsPlane;
        }
        
        if (!moonPlane || !marsPlane) {
            console.log('[updatePlaneVisibility] Moon or Mars plane not found, skipping');
            return;
        }
        
        const orbitPlane = this.sceneModel.getOrbitPlane ? this.sceneModel.getOrbitPlane() : this.sceneModel.orbitPlane;

        // Determine which data source to use for current page events
        let currentPageEvents = [];
        let dataSource = 'none';
        
        // Try Event System data first
        if (window.eventManager?.events && window.standaloneEventSlide?.currentPage) {
            const allEvents = window.eventManager.events;
            const currentPage = window.standaloneEventSlide.currentPage;
            const eventsPerPage = 10;
            const startIndex = (currentPage - 1) * eventsPerPage;
            const endIndex = startIndex + eventsPerPage;
            currentPageEvents = allEvents.slice(startIndex, endIndex);
            dataSource = `EventSystem (page ${currentPage})`;
        } else if (this.dataModel) {
            // Fall back to Globe's dataModel
            currentPageEvents = this.dataModel.getEventsForCurrentPage();
            dataSource = 'Globe dataModel';
        } else {
            console.log('[updatePlaneVisibility] No data source available, hiding all planes');
            this.animatePlaneScale(moonPlane, false);
            this.animatePlaneScale(marsPlane, false);
            if (orbitPlane) this.animatePlaneScale(orbitPlane, false);
            return;
        }

        let hasMoonEvent = false;
        let hasMarsEvent = false;
        let hasOrbitEvent = false;

        currentPageEvents.forEach(event => {
            const locationType = event.locationType || 'earth';

            if (locationType === 'moon') {
                hasMoonEvent = true;
            } else if (locationType === 'mars') {
                hasMarsEvent = true;
            } else if (locationType === 'station' || locationType === 'marsShip') {
                hasOrbitEvent = true;
            }

            if (event.variants && event.variants.length > 0) {
                event.variants.forEach(variant => {
                    const variantLocationType = variant.locationType || locationType;
                    if (variantLocationType === 'moon') {
                        hasMoonEvent = true;
                    } else if (variantLocationType === 'mars') {
                        hasMarsEvent = true;
                    } else if (variantLocationType === 'station' || variantLocationType === 'marsShip') {
                        hasOrbitEvent = true;
                    }
                });
            }
        });

        const shouldShowOrbit = hasOrbitEvent && useOrbitPanelForStationShipMarkers(this.sceneModel);

        this.animatePlaneScale(moonPlane, hasMoonEvent);
        this.animatePlaneScale(marsPlane, hasMarsEvent);
        if (orbitPlane) {
            this.animatePlaneScale(orbitPlane, shouldShowOrbit);
        }
    }
    
    /**
     * @param {THREE.Mesh} plane - Celestial texture mesh (child of optional scale rig)
     * @param {THREE.Object3D} scaleHost - Object whose Y scale is animated (rig or plane)
     */
    _applyCelestialScaleVisibility(plane, scaleHost, show, animating) {
        const map = this._isMapView();
        const isCelestialVisual = !!plane.userData?.isCelestialVisualMesh;
        const panelActive = !!(show || animating);

        if (scaleHost !== plane) {
            scaleHost.visible = panelActive;
            if (map && isCelestialVisual) {
                plane.visible = panelActive;
                if (plane.material) {
                    plane.material.transparent = true;
                    plane.material.opacity = panelActive ? MAP_VIEW_CELESTIAL_OPACITY : 0;
                    plane.material.depthWrite = false;
                    plane.material.needsUpdate = true;
                }
            } else {
                plane.visible = isCelestialVisual && panelActive;
                if (plane.material && isCelestialVisual) {
                    plane.material.opacity = 0.75;
                    plane.material.depthWrite = true;
                    plane.material.needsUpdate = true;
                }
            }
        } else {
            plane.visible = panelActive;
        }
    }

    /**
     * Animate plane scale vertically (squash/stretch effect)
     * @param {THREE.Mesh} plane - The plane mesh (visual); scale may live on parent rig
     * @param {boolean} show - Whether to show (stretch) or hide (squash) the plane
     */
    animatePlaneScale(plane, show) {
        if (!plane || !plane.material) return;

        const scaleHost = plane.parent && plane.parent.userData && plane.parent.userData.isCelestialScaleRig
            ? plane.parent
            : plane;

        if (!plane.userData) {
            plane.userData = {};
        }
        if (scaleHost.scale.y === undefined || isNaN(scaleHost.scale.y)) {
            scaleHost.scale.y = show ? 0 : 1;
        }

        const startScaleY = scaleHost.scale.y;
        const targetScaleY = show ? 1 : 0;

        const scaleThreshold = 0.01;
        if (Math.abs(startScaleY - targetScaleY) < scaleThreshold) {
            scaleHost.scale.set(1, targetScaleY, 1);
            this._applyCelestialScaleVisibility(plane, scaleHost, show, false);
            if (plane.material) {
                this._setCelestialPanelGlow(plane.material, 0.3);
            }
            scaleHost.updateMatrix();
            this._syncDomLiteCelestialPanelsFromPlaneAnimation();
            return;
        }

        this._playSpacePanelSfx(show);

        if (plane.userData && plane.userData.isAnimating) {
            plane.userData.isAnimating = false;
        }

        const duration = 150;
        const startTime = performance.now();
        const settledIntensity = 0.3;
        const peakIntensity = 2.0;

        this._applyCelestialScaleVisibility(plane, scaleHost, show, true);
        plane.userData.isAnimating = true;

        const animate = () => {
            if (!plane.userData || !plane.userData.isAnimating) {
                return;
            }

            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            let easeProgress;
            if (show) {
                easeProgress = 1 - Math.pow(1 - progress, 3);
            } else {
                easeProgress = progress * progress;
            }

            const currentScaleY = startScaleY + (targetScaleY - startScaleY) * easeProgress;
            scaleHost.scale.set(1, currentScaleY, 1);

            const glowProgress = Math.sin(progress * Math.PI);
            const currentIntensity = settledIntensity + (peakIntensity - settledIntensity) * glowProgress;

            if (plane.material) {
                this._setCelestialPanelGlow(plane.material, currentIntensity);
            }

            scaleHost.updateMatrix();
            this._syncDomLiteCelestialPanelsFromPlaneAnimation();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                scaleHost.scale.set(1, targetScaleY, 1);
                this._applyCelestialScaleVisibility(plane, scaleHost, show, false);

                if (plane.material) {
                    this._setCelestialPanelGlow(plane.material, settledIntensity);
                }

                if (plane.userData) {
                    plane.userData.isAnimating = false;
                }
                scaleHost.updateMatrix();
                this._syncDomLiteCelestialPanelsFromPlaneAnimation();
            }
        };

        requestAnimationFrame(animate);
    }

    /** DOM map reads rig scale for celestial thumbnails; main globe rAF is paused in map mode. */
    _syncDomLiteCelestialPanelsFromPlaneAnimation() {
        if (!this._isMapView()) return;
        const gc = typeof window !== 'undefined' ? window.globeController : null;
        if (gc && typeof gc.syncMapLiteWebGlImmediate === 'function') {
            gc.syncMapLiteWebGlImmediate();
        }
    }

    /**
     * After toggling map/globe, re-apply celestial mesh vs rig visibility.
     */
    syncCelestialVisualMeshesForViewMode() {
        const { moonPlane, marsPlane, orbitPlane } = this.getPlanes();
        for (const plane of [moonPlane, marsPlane, orbitPlane]) {
            if (!plane || !plane.userData || !plane.userData.isCelestialVisualMesh) continue;
            const scaleHost = plane.parent && plane.parent.userData && plane.parent.userData.isCelestialScaleRig
                ? plane.parent
                : plane;
            const panelShown = scaleHost.visible && (scaleHost.scale?.y ?? 0) > 0.01;
            this._applyCelestialScaleVisibility(plane, scaleHost, panelShown, !!plane.userData.isAnimating);
        }
    }
}
