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

function delayThenSyncPagination(manager, options) {
    return new Promise((resolve) => {
        setTimeout(resolve, 50);
    }).then(() => manager._syncPaginationUiAfterFilters(options));
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

        const eventsPerPage = 10;
        const allEvents = window.eventManager?.events || [];
        const currentPage = window.standaloneEventSlide?.currentPage || 1;
        const startIndex = (currentPage - 1) * eventsPerPage;
        const endIndex = startIndex + eventsPerPage;
        const events = allEvents.slice(startIndex, endIndex);

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

        if (!globe) {
            if (this.sceneModel.getMapViewEnabled?.()) {
                if (activeFilters.size === 0) {
                    this.unlockAllEvents();
                }
                return delayThenSyncPagination(this, options);
            }
            return Promise.resolve();
        }

        if (activeFilters.size === 0) {
            this.unlockAllEvents();
            return delayThenSyncPagination(this, options);
        }

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

        return delayThenSyncPagination(this, options);
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
