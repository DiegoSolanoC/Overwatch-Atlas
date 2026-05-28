/**
 * WorldviewMarkerPulse - Handles marker pulse animation effects
 */

// Keep in sync with markers/styling/eventMarkerRenderOrders.js EVENT_PULSE_RING_RENDER_ORDER (this file loads via script tag).
const EVENT_PULSE_RING_RENDER_ORDER = 17;
/** Flat map: draw wave *under* EVENT_MARKER_RENDER_ORDER (15) so it reads as one dot + halo, not two stacked disks. */
const FLAT_MAP_PULSE_RING_RENDER_ORDER = 12;

/** Same logic as platform/useOrbitPanelForStationShipMarkers.js (this file loads via script tag, no ES imports). */
function useOrbitPanelForStationShipMarkers(sceneModel) {
    if (!sceneModel) return false;
    const isMap = sceneModel.getMapViewEnabled?.() ? sceneModel.getMapViewEnabled() : !!sceneModel.isMapView;
    const hyper = sceneModel.getHyperloopVisible?.() ?? true;
    return isMap || !hyper;
}

class WorldviewMarkerPulse {
    constructor(sceneModel) {
        this.sceneModel = sceneModel;
        this.hoveredEventMarker = null;
        this._glowColorScratch = new THREE.Color();
        this._scratchWorldQuat = new THREE.Quaternion();
        this._scratchWorldNormal = new THREE.Vector3();
        this._scratchVec3 = new THREE.Vector3();
        this._scratchScale = new THREE.Vector3();
    }

    _ensureMarkerGlowState(marker) {
        if (!marker || !marker.userData) return;
        if (marker.userData._hoverGlowBase) return;
        const mat = marker.material;
        // Use current color as base (respect overlap cycling colors)
        const baseColorHex = (mat?.color?.getHex ? mat.color.getHex() : 0xff6600);
        marker.userData._hoverGlowBase = {
            colorHex: baseColorHex,
            opacity: (mat && typeof mat.opacity === 'number') ? mat.opacity : 1
        };
    }

    _applyMarkerHoverGlow(marker, fadeCurve) {
        if (!marker?.material) return;
        this._ensureMarkerGlowState(marker);

        const base = marker.userData?._hoverGlowBase;
        if (!base) return;

        // fadeCurve matches the wave: 1.0 at start, 0.0 at end.
        const fc = Math.max(0, Math.min(1, Number.isFinite(fadeCurve) ? fadeCurve : 0));

        // Brighten the marker itself at the start, then decay back to normal.
        // Keep conservative so it doesn't blow out on different displays.
        const glowStrength = 0.85;
        const intensity = 1 + (glowStrength * fc);

        // Apply by scaling RGB; Three.js Color can exceed 1.0 and still appear brighter depending on pipeline.
        if (marker.material.color && typeof marker.material.color.setHex === 'function') {
            this._glowColorScratch.setHex(base.colorHex);
            this._glowColorScratch.multiplyScalar(intensity);
            marker.material.color.copy(this._glowColorScratch);
        }

        // Optional: slightly increase opacity early, then return to base opacity.
        // Ensure material is transparent so opacity changes take effect.
        if (typeof marker.material.opacity === 'number') {
            marker.material.transparent = true;
            marker.material.opacity = Math.min(1, base.opacity + (0.25 * fc));
        }

        marker.material.needsUpdate = true;
    }

    _resetMarkerHoverGlow(marker) {
        if (!marker?.material || !marker?.userData?._hoverGlowBase) return;
        const base = marker.userData._hoverGlowBase;
        if (marker.material.color && typeof marker.material.color.setHex === 'function') {
            marker.material.color.setHex(base.colorHex);
        }
        if (typeof marker.material.opacity === 'number') {
            marker.material.opacity = base.opacity;
        }
        marker.material.needsUpdate = true;
    }

    smoothstep(edge0, edge1, x) {
        const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
    }

    getMapViewViewportRadiusAtWorldPoint(worldPoint) {
        const camera = this.sceneModel.getCamera ? this.sceneModel.getCamera() : null;
        if (!camera || !worldPoint) return null;

        // Orthographic camera: world units are directly defined by the frustum.
        if (camera.isOrthographicCamera) {
            const zoom = (Number.isFinite(camera.zoom) && camera.zoom > 0) ? camera.zoom : 1;
            const halfW = Math.abs((camera.right - camera.left) / 2) / zoom;
            const halfH = Math.abs((camera.top - camera.bottom) / 2) / zoom;
            return Math.sqrt(halfW * halfW + halfH * halfH);
        }

        // Perspective camera: compute the max distance from worldPoint to the view frustum corners
        // on the plane perpendicular to the camera through worldPoint.
        if (camera.isPerspectiveCamera) {
            const camDir = new THREE.Vector3();
            camera.getWorldDirection(camDir);
            const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, worldPoint);

            const corners = [
                new THREE.Vector2(-1, -1),
                new THREE.Vector2(1, -1),
                new THREE.Vector2(1, 1),
                new THREE.Vector2(-1, 1)
            ];

            let maxDist = 0;
            const tmp = new THREE.Vector3();
            const ray = new THREE.Ray();
            for (let i = 0; i < corners.length; i++) {
                tmp.set(corners[i].x, corners[i].y, 0.5).unproject(camera);
                ray.origin.copy(camera.position);
                ray.direction.copy(tmp).sub(camera.position).normalize();
                const hit = ray.intersectPlane(plane, new THREE.Vector3());
                if (hit) {
                    const d = hit.distanceTo(worldPoint);
                    if (d > maxDist) maxDist = d;
                }
            }

            return maxDist > 0 ? maxDist : null;
        }

        return null;
    }

    isAwakeningEventMarker(marker) {
        const name = marker?.userData?.event?.name;
        return typeof name === 'string' && name.trim().toLowerCase() === 'the awakening';
    }

    /**
     * Hover wave tint: follow marker.originalColor when set, else warm orange.
     * @param {*} marker
     * @returns {number} hex
     */
    _getPulseWaveColorHex(marker) {
        const ud = marker && marker.userData;
        // Use the base color from hover glow state to avoid picking up the brightened hover color
        if (ud && ud._hoverGlowBase && Number.isFinite(ud._hoverGlowBase.colorHex)) {
            return ud._hoverGlowBase.colorHex;
        }
        // Fallback to current marker color (respect overlap cycling colors)
        if (marker?.material?.color?.getHex) {
            return marker.material.color.getHex();
        }
        if (ud && Number.isFinite(ud.originalColor)) {
            return ud.originalColor;
        }
        return 0xffaa00;
    }

    /**
     * Start pulse effect on event marker
     */
    startEventMarkerPulse(marker) {
        if (marker?.userData?.isMap2dLiteProxy) {
            return;
        }
        if (!marker.userData.pulseRings) {
            marker.userData.pulseRings = [];
        }

        // Capture base material state so we can restore after hover.
        this._ensureMarkerGlowState(marker);
        
        // Create first pulse ring immediately
        this.createPulseRing(marker);
        
        // Set up to create next ring only after current one finishes
        this.scheduleNextPulse(marker);
    }

    /**
     * Schedule next pulse ring after current one finishes
     */
    scheduleNextPulse(marker) {
        // Clear any existing interval
        if (marker.userData.pulseInterval) {
            clearTimeout(marker.userData.pulseInterval);
        }

        const ringDuration = Number.isFinite(marker.userData?.pulseWaveDurationMs)
            ? marker.userData.pulseWaveDurationMs
            : 1200;
        const nextDelay = ringDuration + 300; // small buffer to ensure the wave completes

        // Schedule next pulse after current duration
        marker.userData.pulseInterval = setTimeout(() => {
            // Only create new pulse if still hovering this marker
            if (this.hoveredEventMarker === marker) {
                // Check if image overlay is visible - if so, don't create pulse
                const eventImageOverlay = document.getElementById('eventImageOverlay');
                if (eventImageOverlay && eventImageOverlay.classList.contains('open')) {
                    const opacity = parseFloat(window.getComputedStyle(eventImageOverlay).opacity);
                    if (opacity > 0.1) {
                        // Image is visible - stop pulsing
                        this.stopEventMarkerPulse(marker);
                        return;
                    }
                }

                // Check if there are any active rings
                const activeRings = marker.userData.pulseRings.filter(ring => {
                    if (!ring || !ring.userData) return false;
                    const elapsed = Date.now() - ring.userData.startTime;
                    return elapsed < ring.userData.duration;
                });

                // Only create new ring if no active rings
                if (activeRings.length === 0) {
                    this.createPulseRing(marker);
                }

                // Schedule next pulse
                this.scheduleNextPulse(marker);
            } else {
                marker.userData.pulseInterval = null;
            }
        }, nextDelay);
    }

    /**
     * Stop pulse effect on event marker
     */
    stopEventMarkerPulse(marker) {
        if (!marker || !marker.userData || !marker.userData.pulseRings) return;
        
        // Clear interval if exists
        if (marker.userData.pulseInterval) {
            clearTimeout(marker.userData.pulseInterval);
            marker.userData.pulseInterval = null;
        }
        
        // Remove all pulse rings
        const scene = this.sceneModel.getScene();
        if (scene && marker.userData.pulseRings) {
            marker.userData.pulseRings.forEach(ring => {
                if (ring && ring.parent) {
                    ring.parent.remove(ring);
                }
            });
            marker.userData.pulseRings = [];
        }

        // Restore marker material brightness/opacity.
        this._resetMarkerHoverGlow(marker);
    }

    setHoveredMarker(marker) {
        // Reset previous marker glow immediately when switching hover.
        if (this.hoveredEventMarker && this.hoveredEventMarker !== marker) {
            this._resetMarkerHoverGlow(this.hoveredEventMarker);
        }
        this.hoveredEventMarker = marker;
    }

    /**
     * Get currently hovered marker
     */
    getHoveredMarker() {
        return this.hoveredEventMarker;
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorldviewMarkerPulse;
}

// Make globally accessible
if (typeof window !== 'undefined') {
    if (window.WorldviewMarkerPulseRingsMixin) {
        Object.assign(WorldviewMarkerPulse.prototype, window.WorldviewMarkerPulseRingsMixin);
    }
    window.WorldviewMarkerPulse = WorldviewMarkerPulse;
}
