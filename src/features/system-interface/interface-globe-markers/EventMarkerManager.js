/**
 * Owns timeline event markers on the worldview (globe, moon, mars, orbit, ships):
 * add/remove/refresh, filter lock state, and overlap cycling at duplicate coordinates.
 */

import { shouldEventBeLocked } from './filtering/shouldEventBeLocked.js';
import { getDefaultMarkerOriginalHex } from './styling/markerColors.js';
import { traverseEventMarkers, collectEventMarkers, collectEventMarkerPins } from './traversal/eventMarkerTraversal.js';
import { animateMarkersGrow, animateMarkersShrink } from './animations/markerGrowShrink.js';
import { animateMarkerLock, animateMarkerUnlock } from './animations/markerLockUnlock.js';
import { createSingleEventMarker } from './creation/createSingleEventMarker.js';
import { createMultiEventMarkers } from './creation/createMultiEventMarkers.js';
import { OverlapCyclingController } from './overlapCycling.js';
import { getCurrentDockPageEventSlice } from '../interface-bottom-dock/currentDockPageEvents.js';

function clearWorldMarkerHoverUi() {
    try {
        const ic = typeof window !== 'undefined' ? window.globeController?.interactionController : null;
        const ms = ic?.markerService;
        const map2d = window.globeController?.map2dLite;
        map2d?.clearSyntheticMarkerHover?.();
        map2d?.stopHoverRadiateLoop?.();
        ms?.dismissPinnedMarkerCallout?.();
        ms?.setDomLiteMarkerHover?.(null);
        ms?._syncEventsHoverPreviewFromMarker?.(null);
        ms?.highlightNumberButtonForMarker?.(null);
        ic?.pulseService?.setHoveredMarker?.(null);
        ic?.hideMarkerHoverCallout?.();
        window.SummaryInfoBadge?.hide?.();
    } catch (_) {
        /* interaction stack may be unavailable */
    }
}

function syncMap2dLiteMarkersForFilters(options = {}) {
    try {
        const gc = typeof window !== 'undefined' ? window.globeController : null;
        const map2d = gc?.map2dLite;
        if (!map2d) return;
        const sceneModel = gc?.sceneModel;
        if (sceneModel?.getMapViewEnabled && !sceneModel.getMapViewEnabled()) return;
        /* Prefer in-place lock morph; full rebuild only when markers were just (re)created. */
        if (options.domLiteFromRefresh && typeof map2d.syncMarkers === 'function') {
            map2d.syncMarkers({ mode: 'instant' });
            return;
        }
        if (typeof map2d.syncFilterLockStates === 'function') {
            map2d.syncFilterLockStates();
            return;
        }
        map2d.syncMarkers?.({ mode: 'instant' });
    } catch (_) {
        /* map layer may be tearing down */
    }
}

export class EventMarkerManager {
    constructor(sceneModel, dataModel) {
        this.sceneModel = sceneModel;
        this.dataModel = dataModel;
        this._overlap = new OverlapCyclingController();
    }

    /** @returns {Array<{markers: THREE.Object3D[], currentIndex: number}>} */
    get overlapGroups() {
        return this._overlap.overlapGroups;
    }

    addEventMarkers(animate = false) {
        const globe = this.sceneModel.getGlobe();
        const moonPlane = this.sceneModel.getMoonPlane ? this.sceneModel.getMoonPlane() : this.sceneModel.moonPlane;
        const marsPlane = this.sceneModel.getMarsPlane ? this.sceneModel.getMarsPlane() : this.sceneModel.marsPlane;

        const { events } = getCurrentDockPageEventSlice();

        const markers = this.sceneModel.getMarkers();
        const allEventMarkers = markers.filter(m => m?.userData?.event);
        if (allEventMarkers.length > 0) {
            allEventMarkers.forEach(marker => {
                if (marker.userData?.pinLine && marker.userData.pinLine.parent) {
                    marker.userData.pinLine.parent.remove(marker.userData.pinLine);
                }
                if (marker.parent) {
                    marker.parent.remove(marker);
                }
                const index = markers.indexOf(marker);
                if (index > -1) {
                    markers.splice(index, 1);
                }
            });
        }

        const newMarkers = [];
        const newPinLines = [];

        const issSatellite = window.globeController && window.globeController.transportController
            ? window.globeController.transportController.findISS()
            : null;

        const marsShipSatellite = window.globeController && window.globeController.transportController
            ? window.globeController.transportController.findMarsShip?.()
            : null;

        events.forEach(event => {
            const isMultiEvent = event.variants && event.variants.length > 0;

            if (isMultiEvent) {
                const results = createMultiEventMarkers({
                    event,
                    sceneModel: this.sceneModel,
                    globe,
                    moonPlane,
                    marsPlane,
                    issSatellite,
                    marsShipSatellite,
                    animate
                });

                results.forEach(({ marker, pinLine, isMainVariant }) => {
                    if (isMainVariant && marker.visible) {
                        newMarkers.push(marker);
                        if (pinLine) {
                            newPinLines.push(pinLine);
                        }
                    }
                });
            } else {
                const result = createSingleEventMarker({
                    event,
                    sceneModel: this.sceneModel,
                    globe,
                    moonPlane,
                    marsPlane,
                    issSatellite,
                    marsShipSatellite,
                    animate
                });

                if (result) {
                    newMarkers.push(result.marker);
                    if (result.pinLine) {
                        newPinLines.push(result.pinLine);
                    }
                }
            }
        });

        this.setupOverlapCycling(newMarkers);

        if (animate && (newMarkers.length > 0 || newPinLines.length > 0)) {
            return animateMarkersGrow(newMarkers, newPinLines);
        }
        newMarkers.forEach(marker => {
            const base = (marker.userData && marker.userData.isLocked) ? 0.75 : 1.0;
            const s = (marker.userData && marker.userData.originalScale) ? (base * marker.userData.originalScale) : base;
            marker.scale.set(s, s, s);
        });
        newPinLines.forEach(line => {
            if (line.material) {
                line.material.opacity = 1;
                line.material.transparent = false;
            }
        });
        return Promise.resolve();
    }

    removeEventMarkers(animate = false) {
        this.stopOverlapCycling();

        const globe = this.sceneModel.getGlobe();

        if (!globe) {
            console.warn('EventMarkerManager: Cannot remove event markers - globe not initialized yet');
            return Promise.resolve();
        }

        const eventMarkers = collectEventMarkers(this.sceneModel);
        const pinLines = collectEventMarkerPins(this.sceneModel);

        const markers = this.sceneModel.getMarkers();

        const removeMarker = (marker) => {
            const index = markers.indexOf(marker);
            if (index > -1) {
                markers.splice(index, 1);
            }

            if (marker.userData && marker.userData.pinLine) {
                const pinLine = marker.userData.pinLine;
                if (pinLine.parent) {
                    pinLine.parent.remove(pinLine);
                }
            }

            if (marker.parent) {
                marker.parent.remove(marker);
            }
        };

        const removeOrphanedEventPins = (parent) => {
            if (!parent || !parent.children) return;
            const toRemove = [];
            for (let i = 0; i < parent.children.length; i++) {
                const c = parent.children[i];
                if (c.userData && c.userData.isEventMarkerPin) toRemove.push(c);
            }
            toRemove.forEach(c => { if (c.parent) c.parent.remove(c); });
        };

        const doRemove = () => {
            eventMarkers.forEach(removeMarker);
            pinLines.forEach(line => {
                if (line.parent) line.parent.remove(line);
            });
            removeOrphanedEventPins(globe);
            const earthMapPlane = this.sceneModel.getEarthMapPlane ? this.sceneModel.getEarthMapPlane() : this.sceneModel.earthMapPlane;
            if (earthMapPlane) removeOrphanedEventPins(earthMapPlane);
            const moon = this.sceneModel.getMoonPlane ? this.sceneModel.getMoonPlane() : this.sceneModel.moonPlane;
            const mars = this.sceneModel.getMarsPlane ? this.sceneModel.getMarsPlane() : this.sceneModel.marsPlane;
            const moonRig = this.sceneModel.getMoonRig ? this.sceneModel.getMoonRig() : this.sceneModel.moonRig;
            const marsRig = this.sceneModel.getMarsRig ? this.sceneModel.getMarsRig() : this.sceneModel.marsRig;
            if (moonRig) removeOrphanedEventPins(moonRig);
            if (marsRig) removeOrphanedEventPins(marsRig);
            if (moon) removeOrphanedEventPins(moon);
            if (mars) removeOrphanedEventPins(mars);
        };

        if (eventMarkers.length === 0 && pinLines.length === 0) {
            doRemove();
            return Promise.resolve();
        }

        if (animate && eventMarkers.length > 0) {
            return animateMarkersShrink(eventMarkers, pinLines).then(doRemove);
        }
        doRemove();
        return Promise.resolve();
    }

    refreshEventMarkers(animate = true, options = {}) {
        const globe = this.sceneModel.getGlobe();
        if (!globe) {
            if (this.sceneModel.getMapViewEnabled?.()) {
                return delayThenSyncPagination(this, {
                    ...options,
                    domLiteFromRefresh: true,
                    domLiteAnimate: animate
                });
            }
            console.warn('EventMarkerManager: Cannot refresh event markers - globe not initialized yet');
            return Promise.resolve();
        }

        const scene = this.sceneModel.getScene ? this.sceneModel.getScene() : null;
        const earthMapPlane = this.sceneModel.getEarthMapPlane ? this.sceneModel.getEarthMapPlane() : this.sceneModel.earthMapPlane;
        const moonPlane = this.sceneModel.getMoonPlane ? this.sceneModel.getMoonPlane() : this.sceneModel.moonPlane;
        const marsPlane = this.sceneModel.getMarsPlane ? this.sceneModel.getMarsPlane() : this.sceneModel.marsPlane;
        const moonRig = this.sceneModel.getMoonRig ? this.sceneModel.getMoonRig() : this.sceneModel.moonRig;
        const marsRig = this.sceneModel.getMarsRig ? this.sceneModel.getMarsRig() : this.sceneModel.marsRig;
        const issSatellite = window.globeController?.transportController?.findISS
            ? window.globeController.transportController.findISS()
            : null;
        const marsShipSatellite = window.globeController?.transportController?.findMarsShip
            ? window.globeController.transportController.findMarsShip()
            : null;
        const orbitPlane = this.sceneModel.getOrbitPlane ? this.sceneModel.getOrbitPlane() : this.sceneModel.orbitPlane;
        const orbitRig = this.sceneModel.getOrbitRig ? this.sceneModel.getOrbitRig() : this.sceneModel.orbitRig;
        const containers = [
            scene, globe, earthMapPlane, moonRig, marsRig, orbitRig, moonPlane, marsPlane, orbitPlane, issSatellite, marsShipSatellite
        ].filter(Boolean);
        containers.forEach(parent => {
            const toRemove = [];
            parent.traverse(obj => {
                if (obj?.userData?.isPulseRing) toRemove.push(obj);
            });
            toRemove.forEach(o => { if (o.parent) o.parent.remove(o); });
        });
        if (window.globeController?.interactionController?.pulseService) {
            window.globeController.interactionController.pulseService.setHoveredMarker(null);
        }
        window.globeController?.interactionController?.hideMarkerHoverCallout?.();

        return this.removeEventMarkers(animate).then(() => {
            return this.addEventMarkers(animate);
        }).then(() => {
            return this.applyFilters({ ...options, domLiteFromRefresh: true, domLiteAnimate: animate });
        }).then(() => {
            if (window.globeController && typeof window.globeController.updatePlaneVisibility === 'function') {
                window.globeController.updatePlaneVisibility();
            }
            if (window.globeController && typeof window.globeController.rebindOpenEventMarkerAfterRefresh === 'function') {
                window.globeController.rebindOpenEventMarkerAfterRefresh();
            }
        });
    }

    applyFilters(options = {}) {
        const activeFilters = window.standaloneActiveFilters || new Set();
        const globe = this.sceneModel.getGlobe();
        const mapView = !!this.sceneModel.getMapViewEnabled?.();

        clearWorldMarkerHoverUi();

        /*
         * Map view: only touch DOM markers. Updating hidden Three.js markers caused
         * a noticeable pause before the visible lock morph started.
         */
        if (mapView) {
            syncMap2dLiteMarkersForFilters(options);
            /* Defer dock rebuild so the lock morph paints before pagination work. */
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => this._syncPaginationUiAfterFilters(options));
            } else {
                this._syncPaginationUiAfterFilters(options);
            }
            return Promise.resolve();
        }

        if (!globe) {
            return Promise.resolve();
        }

        if (activeFilters.size === 0) {
            this.unlockAllEvents();
        } else {
            const processMarker = (child) => {
                if (child.userData && child.userData.isEventMarker) {
                    const event = child.userData.event;
                    if (!shouldEventBeLocked(event, activeFilters)) {
                        this.unlockEvent(child);
                    } else {
                        this.lockEvent(child);
                    }
                }
            };
            traverseEventMarkers(this.sceneModel, processMarker);
        }

        this._syncPaginationUiAfterFilters(options);
        return Promise.resolve();
    }

    _syncPaginationUiAfterFilters(options = {}) {
        if (typeof window.updateStandalonePaginationForFilters === 'function') {
            window.updateStandalonePaginationForFilters();
        }
    }

    lockEvent(marker) {
        if (!marker || !marker.userData) return;

        if (!marker.userData.originalScale) {
            marker.userData.originalScale = marker.scale.x;
        }
        if (!marker.userData.originalColor) {
            marker.userData.originalColor = getDefaultMarkerOriginalHex(marker.userData);
        }

        animateMarkerLock(marker);
    }

    unlockEvent(marker) {
        if (!marker || !marker.userData) return;
        animateMarkerUnlock(marker);
    }

    unlockAllEvents() {
        const globe = this.sceneModel.getGlobe();
        if (!globe) return;

        const unlockMarker = (child) => {
            if (child.userData && child.userData.isEventMarker) {
                this.unlockEvent(child);
            }
        };

        traverseEventMarkers(this.sceneModel, unlockMarker);
    }

    setupOverlapCycling(markers) {
        this._overlap.setupOverlapCycling(markers);
    }

    cycleOverlaps() {
        this._overlap.cycleOverlaps();
    }

    pauseOverlapCycling() {
        this._overlap.pauseOverlapCycling();
    }

    resumeOverlapCycling() {
        this._overlap.resumeOverlapCycling();
    }

    stopOverlapCycling() {
        this._overlap.stopOverlapCycling();
    }

    forceCycleToEvent(event) {
        return this._overlap.forceCycleToEvent(event);
    }

    forceCycleMarker(marker) {
        this._overlap.forceCycleMarker(marker);
    }
}
