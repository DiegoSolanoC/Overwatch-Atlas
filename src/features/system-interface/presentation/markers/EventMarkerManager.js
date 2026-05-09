/**
 * EventMarkerManager - Handles event marker creation, removal, filtering, and locking
 * Extracted from GlobeView.js to improve maintainability
 */

import { latLonToVector3, xyToPlanePosition } from '../../../worldview/utils/GeometryUtils.js';
import { createMarkerMesh, createMarkerUserData, shouldEventBeLocked, getMarkerRadius, getDefaultMarkerOriginalHex } from '../../managers/helpers/MarkerCreationHelpers.js';
import { createPinLinePoints, createPinLine } from '../../managers/helpers/PinLineHelpers.js';
import { traverseEventMarkers, collectEventMarkers, collectEventMarkerPins } from '../../managers/helpers/MarkerTraversalHelpers.js';
import { animateMarkersGrow, animateMarkersShrink } from '../../managers/helpers/MarkerAnimationHelpers.js';
import { animateMarkerLock, animateMarkerUnlock } from '../../managers/helpers/MarkerLockAnimationHelpers.js';
import { createSingleEventMarker, createMultiEventMarkers } from '../../managers/helpers/MarkerCreationLogicHelpers.js';

function delayThenSyncPagination(manager, options) {
    return new Promise((resolve) => {
        setTimeout(resolve, 50);
    }).then(() => manager._syncPaginationUiAfterFilters(options));
}

/**
 * EventMarkerManager class
 * Manages all event markers on the globe, moon, mars, and station
 */
export class EventMarkerManager {
    constructor(sceneModel, dataModel) {
        this.sceneModel = sceneModel;
        this.dataModel = dataModel;
        this.overlapCycleInterval = null;
        this.overlapGroups = [];
        this.overlapCyclingPaused = false;
    }

    /**
     * Add event markers to the globe, moon, mars, and station
     * @param {boolean} animate - Whether to animate the markers growing in
     * @returns {Promise} - Resolves when markers are added (and animation completes if animate=true)
     */
    addEventMarkers(animate = false) {
        const globe = this.sceneModel.getGlobe();
        const moonPlane = this.sceneModel.getMoonPlane ? this.sceneModel.getMoonPlane() : this.sceneModel.moonPlane;
        const marsPlane = this.sceneModel.getMarsPlane ? this.sceneModel.getMarsPlane() : this.sceneModel.marsPlane;
        
        // NOTE: Use Event System's events and current page instead of Globe's dataModel
        const eventsPerPage = 10;
        const allEvents = window.eventManager?.events || [];
        const currentPage = window.standaloneEventSlide?.currentPage || 1;
        const startIndex = (currentPage - 1) * eventsPerPage;
        const endIndex = startIndex + eventsPerPage;
        const events = allEvents.slice(startIndex, endIndex);

        console.log(`[addEventMarkers] Page ${currentPage}, creating ${events.length} markers:`, events.map(e => e.name));
        
        // CRITICAL: Clear ALL markers with event data (old markers may not have isEventMarker flag)
        const markers = this.sceneModel.getMarkers();
        const allEventMarkers = markers.filter(m => m?.userData?.event);
        console.log(`[addEventMarkers] Found ${allEventMarkers.length} markers with event data to clear`);
        if (allEventMarkers.length > 0) {
            console.log(`[addEventMarkers] Existing marker events:`, allEventMarkers.map(m => m.userData?.event?.name || 'no name'));
            let removedCount = 0;
            allEventMarkers.forEach(marker => {
                // Remove pin line if exists
                if (marker.userData?.pinLine && marker.userData.pinLine.parent) {
                    marker.userData.pinLine.parent.remove(marker.userData.pinLine);
                }
                // Remove marker from scene
                if (marker.parent) {
                    marker.parent.remove(marker);
                    removedCount++;
                }
                // Remove from markers array
                const index = markers.indexOf(marker);
                if (index > -1) {
                    markers.splice(index, 1);
                }
            });
            console.log(`[addEventMarkers] Removed ${removedCount} markers, markers array now has ${markers.length}`);
        }
        
        // Collect all markers and pin lines for animation
        const newMarkers = [];
        const newPinLines = [];

        // Get ISS satellite for station events
        const issSatellite = window.globeController && window.globeController.transportController 
            ? window.globeController.transportController.findISS() 
            : null;

        // Get Mars Ship for marsShip events
        const marsShipSatellite = window.globeController && window.globeController.transportController
            ? window.globeController.transportController.findMarsShip?.()
            : null;
        
        console.log(`[addEventMarkers] Satellites found: ISS=${!!issSatellite}, MarsShip=${!!marsShipSatellite}`);
        
        events.forEach(event => {
            const isMultiEvent = event.variants && event.variants.length > 0;
            
            if (isMultiEvent) {
                // Multi-event: create markers for each variant
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
                
                // Collect markers and pin lines for animation
                results.forEach(({ marker, pinLine, isMainVariant }) => {
                    if (isMainVariant && marker.visible) {
                        newMarkers.push(marker);
                        if (pinLine) {
                            newPinLines.push(pinLine);
                        }
                    }
                });
            } else {
                // Single event: create one orange marker
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
        
        // Animate markers and pin lines growing if requested
        const totalAfter = this.sceneModel.getMarkers()?.length || 0;
        console.log(`[addEventMarkers] Created ${newMarkers.length} markers. Total markers after: ${totalAfter}`);
        console.log(`[addEventMarkers] New marker events:`, newMarkers.map(m => m.userData?.event?.name || 'no name'));
        
        // Detect overlapping coordinates and set up cycling
        this.setupOverlapCycling(newMarkers);
        
        if (animate && (newMarkers.length > 0 || newPinLines.length > 0)) {
            return animateMarkersGrow(newMarkers, newPinLines);
        } else {
            // If not animating, ensure markers are at full scale
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
    }

    /**
     * Remove all event markers and their pin lines
     * @param {boolean} animate - Whether to animate the removal (shrink to 0)
     * @returns {Promise} - Resolves when removal (and animation) is complete
     */
    removeEventMarkers(animate = false) {
        // Stop overlap cycling when removing markers
        this.stopOverlapCycling();
        
        const globe = this.sceneModel.getGlobe();
        
        // Check if globe exists before trying to traverse
        if (!globe) {
            console.warn('EventMarkerManager: Cannot remove event markers - globe not initialized yet');
            return Promise.resolve();
        }
        
        // Collect event markers and their pin lines using helpers
        const eventMarkers = collectEventMarkers(this.sceneModel);
        const pinLines = collectEventMarkerPins(this.sceneModel);
        
        console.log(`[removeEventMarkers] Found ${eventMarkers.length} markers to remove:`, eventMarkers.map(m => m.userData?.event?.name || 'no name'));
        
        const markers = this.sceneModel.getMarkers();
        
        // Helper to remove a marker and its pin line
        const removeMarker = (marker) => {
            // Remove from markers array
            const index = markers.indexOf(marker);
            if (index > -1) {
                markers.splice(index, 1);
            }
            
            // Remove pin line if it exists
            if (marker.userData && marker.userData.pinLine) {
                const pinLine = marker.userData.pinLine;
                if (pinLine.parent) {
                    pinLine.parent.remove(pinLine);
                }
            }
            
            // Remove marker from scene
            if (marker.parent) {
                marker.parent.remove(marker);
            }
        };
        
        // Remove any orphaned event-marker pin lines (e.g. from city/seaport-style pins at same location, or missed teardown). Only lines with isEventMarkerPin are from events; isMarkerPin are city/seaport and are not removed here.
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
        
        // If no markers to remove, still run orphan cleanup then return
        if (eventMarkers.length === 0 && pinLines.length === 0) {
            doRemove();
            return Promise.resolve();
        }
        
        // If animating, shrink markers before removing
        if (animate && eventMarkers.length > 0) {
            return animateMarkersShrink(eventMarkers, pinLines).then(doRemove);
        }
        doRemove();
        return Promise.resolve();
    }

    /**
     * Refresh event markers (remove and re-add)
     * @param {boolean} [animate=true] - Grow/shrink animation; use false when opening from event manager for snappier UX
     * @param {{ preservePaginationThumbEntrance?: boolean }} [options] - If true (page-turn callback), delayed filter sync will not cancel thumb entrance animation
     * @returns {Promise<void>|undefined}
     */
    refreshEventMarkers(animate = true, options = {}) {
        console.log(`[refreshEventMarkers] Called with animate=${animate}, total markers before: ${this.sceneModel.getMarkers()?.length || 0}`);
        
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

        // IMPORTANT: clear any pulse-ring meshes from the previous page immediately.
        // Otherwise they can linger (parented to ISS/Moon/Mars) and appear to "snap/tilt" right after page switches.
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
        // Also reset hovered marker reference so no pulses keep scheduling across page boundaries.
        if (window.globeController?.interactionController?.pulseService) {
            window.globeController.interactionController.pulseService.setHoveredMarker(null);
        }
        
        return this.removeEventMarkers(animate).then(() => {
            console.log('[refreshEventMarkers] Old markers removed, adding new markers...');
            return this.addEventMarkers(animate);
        }).then(() => {
            console.log('[refreshEventMarkers] New markers added, applying filters...');
            return this.applyFilters({ ...options, domLiteFromRefresh: true, domLiteAnimate: animate });
        }).then(() => {
            console.log('[refreshEventMarkers] Filters applied, updating plane visibility...');
            if (window.globeController && typeof window.globeController.updatePlaneVisibility === 'function') {
                window.globeController.updatePlaneVisibility();
            } else {
                console.log('[refreshEventMarkers] updatePlaneVisibility not available');
            }
            if (window.globeController && typeof window.globeController.rebindOpenEventMarkerAfterRefresh === 'function') {
                window.globeController.rebindOpenEventMarkerAfterRefresh();
            }
            console.log('[refreshEventMarkers] Complete!');
        });
    }

    /**
     * Apply active filters to event markers
     * Locks events that don't match any selected filter
     * @param {{ preservePaginationThumbEntrance?: boolean, domLiteAnimate?: boolean, domLiteFromRefresh?: boolean }} [options] - `domLiteFromRefresh` true when called from {@link refreshEventMarkers} (page turn vs filter-only DOM sync)
     * @returns {Promise<void>}
     */
    applyFilters(options = {}) {
        // NOTE: Use standaloneActiveFilters instead of sceneModel.activeFilters
        // EventMarkerManager is now owned by Event System, not Globe
        const activeFilters = window.standaloneActiveFilters || new Set();
        console.log(`[EventMarkerManager.applyFilters] Filters: [${Array.from(activeFilters).join(', ')}], size: ${activeFilters.size}`);
        
        const globe = this.sceneModel.getGlobe();

        if (!globe) {
            if (this.sceneModel.getMapViewEnabled?.()) {
                if (activeFilters.size === 0) {
                    console.log('[EventMarkerManager.applyFilters] Map view, no filters - unlocking all');
                    this.unlockAllEvents();
                }
                return delayThenSyncPagination(this, options);
            }
            return Promise.resolve();
        }

        // If no filters active, unlock all and refresh number button states
        if (activeFilters.size === 0) {
            console.log('[EventMarkerManager.applyFilters] No filters active - unlocking all events');
            this.unlockAllEvents();
            return delayThenSyncPagination(this, options);
        }

        // Helper function to check and lock/unlock a marker (multi-variant: unlock if any variant matches)
        let lockedCount = 0;
        let unlockedCount = 0;
        const processMarker = (child) => {
            if (child.userData && child.userData.isEventMarker) {
                const event = child.userData.event;
                if (!shouldEventBeLocked(event, activeFilters)) {
                    this.unlockEvent(child);
                    unlockedCount++;
                } else {
                    this.lockEvent(child);
                    lockedCount++;
                }
            }
        };

        // Check event markers using traversal helper
        traverseEventMarkers(this.sceneModel, processMarker);
        
        console.log(`[EventMarkerManager.applyFilters] Results: ${unlockedCount} unlocked, ${lockedCount} locked`);

        // Small delay so WebGL lock/unlock animations can start before we sync DOM map + pagination
        return delayThenSyncPagination(this, options);
    }

    /**
     * After marker lock state changes, refresh pagination thumbs. When {@link refreshEventMarkers}
     * was triggered by a page turn, preserve the staggered thumb entrance (do not strip --enter).
     * @returns {Promise<void>}
     */
    async _syncPaginationUiAfterFilters(options = {}) {
        // NOTE: Globe UI sync removed - Event System handles all pagination
        // Only update Event System's pagination visual (green filter-hit lines)
        if (typeof window.updateStandalonePaginationForFilters === 'function') {
            window.updateStandalonePaginationForFilters();
        }
    }

    /**
     * Lock an event marker (dark orange/near black, smaller, no interactions)
     * Animates the transition smoothly
     */
    lockEvent(marker) {
        if (!marker || !marker.userData) return;
        
        // Store original values if not already stored
        if (!marker.userData.originalScale) {
            marker.userData.originalScale = marker.scale.x;
        }
        if (!marker.userData.originalColor) {
            marker.userData.originalColor = getDefaultMarkerOriginalHex(marker.userData);
        }
        
        animateMarkerLock(marker);
    }

    /**
     * Unlock an event marker (restore to normal)
     * Animates the transition smoothly
     */
    unlockEvent(marker) {
        if (!marker || !marker.userData) return;
        animateMarkerUnlock(marker);
    }

    /**
     * Unlock all event markers
     */
    unlockAllEvents() {
        const globe = this.sceneModel.getGlobe();
        if (!globe) return;
        
        // Helper function to unlock a marker
        const unlockMarker = (child) => {
            if (child.userData && child.userData.isEventMarker) {
                this.unlockEvent(child);
            }
        };
        
        // Unlock event markers using traversal helper
        traverseEventMarkers(this.sceneModel, unlockMarker);
    }

    /**
     * Detect overlapping coordinates and set up cycling for overlapping markers
     * @param {Array} markers - Array of newly created markers
     */
    setupOverlapCycling(markers) {
        console.log('[Overlap Cycling] setupOverlapCycling called with', markers.length, 'markers');
        
        // Clear any existing interval
        if (this.overlapCycleInterval) {
            clearInterval(this.overlapCycleInterval);
            this.overlapCycleInterval = null;
        }
        this.overlapGroups = [];

        // Group markers by coordinate
        const coordinateGroups = new Map();
        
        markers.forEach(marker => {
            if (!marker.userData || !marker.userData.event) return;
            
            const event = marker.userData.event;
            const lat = event.lat;
            const lon = event.lon;
            
            console.log('[Overlap Cycling] Checking marker:', event.name, 'coords:', lat, lon);
            
            // Only group events with valid coordinates
            if (lat == null || lon == null) return;
            
            const key = `${lat},${lon}`;
            if (!coordinateGroups.has(key)) {
                coordinateGroups.set(key, []);
            }
            coordinateGroups.get(key).push(marker);
        });

        console.log('[Overlap Cycling] Coordinate groups:', coordinateGroups.size);

        // Create overlap groups for coordinates with multiple markers
        coordinateGroups.forEach((groupMarkers, key) => {
            if (groupMarkers.length > 1) {
                console.log(`[Overlap Cycling] Found ${groupMarkers.length} markers at coordinate ${key}:`, groupMarkers.map(m => m.userData.event?.name));
                this.overlapGroups.push({
                    markers: groupMarkers,
                    currentIndex: 0
                });
                
                // Initially hide all except the first, and set colors
                groupMarkers.forEach((marker, index) => {
                    marker.visible = (index === 0);
                    // Also hide/show pin line
                    if (marker.userData.pinLine) {
                        marker.userData.pinLine.visible = (index === 0);
                    }
                    
                    // Store the true original color before any cycling
                    if (!marker.userData._trueOriginalColor && marker.userData.originalColor) {
                        marker.userData._trueOriginalColor = marker.userData.originalColor;
                    }
                    
                    // Set color based on index: first = orange, second = pink
                    if (index === 0) {
                        // First marker: regular orange (original color)
                        if (marker.userData.originalColor) {
                            marker.material.color.setHex(marker.userData.originalColor);
                        }
                    } else if (index === 1) {
                        // Second marker: pink
                        marker.material.color.setHex(0xff69b4);
                    }
                });
            }
        });

        // If there are overlap groups, start cycling
        if (this.overlapGroups.length > 0) {
            console.log(`[Overlap Cycling] Starting cycling for ${this.overlapGroups.length} coordinate groups`);
            this.overlapCycleInterval = setInterval(() => {
                console.log('[Overlap Cycling] Cycling...');
                this.cycleOverlaps();
            }, 5000); // 5 second interval
        } else {
            console.log('[Overlap Cycling] No overlap groups found, cycling not started');
        }
    }

    /**
     * Cycle visibility of overlapping markers
     */
    cycleOverlaps() {
        // Skip cycling if paused (hovering)
        if (this.overlapCyclingPaused) {
            return;
        }
        
        this.overlapGroups.forEach(group => {
            // Hide current marker
            const currentMarker = group.markers[group.currentIndex];
            if (currentMarker) {
                currentMarker.visible = false;
                if (currentMarker.userData.pinLine) {
                    currentMarker.userData.pinLine.visible = false;
                }
                // Stop pulse rings on the marker being hidden
                if (window.globeController?.markerPulseService) {
                    window.globeController.markerPulseService.stopEventMarkerPulse(currentMarker);
                }
            }

            // Move to next marker (loop back to start)
            group.currentIndex = (group.currentIndex + 1) % group.markers.length;

            // Show next marker
            const nextMarker = group.markers[group.currentIndex];
            if (nextMarker) {
                nextMarker.visible = true;
                if (nextMarker.userData.pinLine) {
                    nextMarker.userData.pinLine.visible = true;
                }
                
                // Update color based on which marker is now visible
                if (group.currentIndex === 0) {
                    // First marker: regular orange (original color)
                    if (nextMarker.userData.originalColor) {
                        nextMarker.material.color.setHex(nextMarker.userData.originalColor);
                    }
                } else if (group.currentIndex === 1) {
                    // Second marker: pink
                    nextMarker.material.color.setHex(0xff69b4);
                }
                
                // Clear hover glow state so it uses the new color as base
                if (nextMarker.userData._hoverGlowBase) {
                    delete nextMarker.userData._hoverGlowBase;
                }
                
                // Start new pulse on the next marker if it's currently being hovered
                const hoveredMarker = window.globeController?.markerPulseService?.getHoveredMarker();
                if (hoveredMarker === currentMarker) {
                    // The user was hovering the marker that just switched, so start pulse on the new one
                    if (window.globeController?.markerPulseService) {
                        window.globeController.markerPulseService.startEventMarkerPulse(nextMarker);
                        window.globeController.markerPulseService.setHoveredMarker(nextMarker);
                    }
                }
            }
        });
    }

    /**
     * Pause overlap cycling (called when hovering over a cycling marker)
     */
    pauseOverlapCycling() {
        if (!this.overlapCyclingPaused && this.overlapGroups.length > 0) {
            this.overlapCyclingPaused = true;
            console.log('[Overlap Cycling] Paused due to hover');
        }
    }

    /**
     * Resume overlap cycling (called when hover ends)
     */
    resumeOverlapCycling() {
        if (this.overlapCyclingPaused) {
            this.overlapCyclingPaused = false;
            console.log('[Overlap Cycling] Resumed after hover');
        }
    }

    /**
     * Stop overlap cycling (call when removing markers or changing pages)
     */
    stopOverlapCycling() {
        if (this.overlapCycleInterval) {
            clearInterval(this.overlapCycleInterval);
            this.overlapCycleInterval = null;
        }
        this.overlapGroups = [];
    }

    /**
     * Force cycle to a specific marker in an overlap group by event
     * @param {Object} event - The event to show
     * @returns {Object|null} - The target marker that was switched to, or null
     */
    forceCycleToEvent(event) {
        if (!event) return null;
        
        console.log('[Overlap Cycling] forceCycleToEvent called for:', event.name);
        
        // Find the overlap group that contains this event
        const group = this.overlapGroups.find(g => 
            g.markers.some(m => {
                const markerEvent = m.userData.event;
                if (!markerEvent) return false;
                // Compare by name and location since event objects might be different references
                return markerEvent.name === event.name &&
                       markerEvent.lat === event.lat &&
                       markerEvent.lon === event.lon;
            })
        );
        
        if (!group) {
            console.log('[Overlap Cycling] Event not in any overlap group');
            return null; // Not in an overlap group
        }
        
        console.log('[Overlap Cycling] Found overlap group with', group.markers.length, 'markers');
        
        // Find the index of the marker for this event
        const targetIndex = group.markers.findIndex(m => {
            const markerEvent = m.userData.event;
            if (!markerEvent) return false;
            return markerEvent.name === event.name &&
                   markerEvent.lat === event.lat &&
                   markerEvent.lon === event.lon;
        });
        
        if (targetIndex === -1) {
            console.log('[Overlap Cycling] Could not find marker index for event');
            return null;
        }
        
        console.log('[Overlap Cycling] Switching to index:', targetIndex, 'from current:', group.currentIndex);
        
        // Hide current marker
        const currentMarker = group.markers[group.currentIndex];
        if (currentMarker) {
            currentMarker.visible = false;
            if (currentMarker.userData.pinLine) {
                currentMarker.userData.pinLine.visible = false;
            }
            // Stop pulse rings on the marker being hidden
            if (window.globeController?.markerPulseService) {
                window.globeController.markerPulseService.stopEventMarkerPulse(currentMarker);
            }
        }
        
        // Set to target index
        group.currentIndex = targetIndex;
        
        // Show target marker
        const targetMarker = group.markers[targetIndex];
        if (targetMarker) {
            targetMarker.visible = true;
            if (targetMarker.userData.pinLine) {
                targetMarker.userData.pinLine.visible = true;
            }
            
            // Update color based on index
            if (targetIndex === 0) {
                // First marker: restore to true original color
                if (targetMarker.userData._trueOriginalColor) {
                    targetMarker.material.color.setHex(targetMarker.userData._trueOriginalColor);
                    targetMarker.userData.originalColor = targetMarker.userData._trueOriginalColor;
                } else if (targetMarker.userData.originalColor) {
                    targetMarker.material.color.setHex(targetMarker.userData.originalColor);
                }
            } else if (targetIndex === 1) {
                // Second marker: pink
                targetMarker.material.color.setHex(0xff69b4);
                // Update originalColor so wave picks up the correct color
                targetMarker.userData.originalColor = 0xff69b4;
            }
            
            // Clear hover glow state so it uses the new color as base
            if (targetMarker.userData._hoverGlowBase) {
                delete targetMarker.userData._hoverGlowBase;
            }
        }
        
        // Reset the interval timer
        if (this.overlapCycleInterval) {
            clearInterval(this.overlapCycleInterval);
            this.overlapCycleInterval = setInterval(() => {
                console.log('[Overlap Cycling] Cycling...');
                this.cycleOverlaps();
            }, 5000);
        }
        
        return targetMarker;
    }

    /**
     * Force cycle to the next marker for a specific marker (right-click)
     * @param {THREE.Object3D} marker - The marker that was right-clicked
     */
    forceCycleMarker(marker) {
        // Find which overlap group this marker belongs to
        const group = this.overlapGroups.find(g => g.markers.includes(marker));
        if (!group) return;

        console.log('[Overlap Cycling] Force cycling marker:', marker.userData.eventName);

        // Hide current marker
        const currentMarker = group.markers[group.currentIndex];
        if (currentMarker) {
            currentMarker.visible = false;
            if (currentMarker.userData.pinLine) {
                currentMarker.userData.pinLine.visible = false;
            }
            // Stop pulse rings on the marker being hidden
            if (window.globeController?.markerPulseService) {
                window.globeController.markerPulseService.stopEventMarkerPulse(currentMarker);
            }
        }

        // Move to next marker
        group.currentIndex = (group.currentIndex + 1) % group.markers.length;

        // Show next marker
        const nextMarker = group.markers[group.currentIndex];
        if (nextMarker) {
            nextMarker.visible = true;
            if (nextMarker.userData.pinLine) {
                nextMarker.userData.pinLine.visible = true;
            }
            
            // Update color based on which marker is now visible
            if (group.currentIndex === 0) {
                // First marker: restore to true original color
                if (nextMarker.userData._trueOriginalColor) {
                    nextMarker.material.color.setHex(nextMarker.userData._trueOriginalColor);
                    nextMarker.userData.originalColor = nextMarker.userData._trueOriginalColor;
                } else if (nextMarker.userData.originalColor) {
                    nextMarker.material.color.setHex(nextMarker.userData.originalColor);
                }
            } else if (group.currentIndex === 1) {
                // Second marker: pink
                nextMarker.material.color.setHex(0xff69b4);
                // Update originalColor so wave picks up the correct color
                nextMarker.userData.originalColor = 0xff69b4;
            }
            
            // Clear hover glow state so it uses the new color as base
            if (nextMarker.userData._hoverGlowBase) {
                delete nextMarker.userData._hoverGlowBase;
            }
            
            // Update hover glow base with the new color so pulse uses it
            if (nextMarker.material) {
                nextMarker.userData._hoverGlowBase = {
                    colorHex: nextMarker.material.color.getHex(),
                    opacity: (typeof nextMarker.material.opacity === 'number') ? nextMarker.material.opacity : 1
                };
            }
            
            // Always restart pulse on the new marker when force-cycling
            // This matches map DOM behavior which updates CSS variables regardless of state
            console.log('[Overlap Cycling] Force cycle - restarting pulse on new marker');
            console.log('[Overlap Cycling] nextMarker:', nextMarker?.userData?.eventName, 'material color:', nextMarker.material.color.getHex().toString(16), 'originalColor:', nextMarker.userData.originalColor?.toString(16));
            console.log('[Overlap Cycling] nextMarker _hoverGlowBase:', nextMarker.userData._hoverGlowBase?.colorHex?.toString(16));
            
            if (window.globeController?.markerPulseService) {
                // Clear hovered marker first to ensure clean state
                window.globeController.markerPulseService.setHoveredMarker(null);
                window.globeController.markerPulseService.stopEventMarkerPulse(currentMarker);
                window.globeController.markerPulseService.stopEventMarkerPulse(nextMarker);
                
                // Force a frame update to ensure color is applied
                if (nextMarker.material) {
                    nextMarker.material.needsUpdate = true;
                }
                
                // Start pulse immediately with the new marker
                window.globeController.markerPulseService.startEventMarkerPulse(nextMarker);
                window.globeController.markerPulseService.setHoveredMarker(nextMarker);
                
                console.log('[Overlap Cycling] DEBUG: About to check markerService availability');
                console.log('[Overlap Cycling] DEBUG: globeController exists:', !!window.globeController);
                console.log('[Overlap Cycling] DEBUG: interactionController exists:', !!window.globeController?.interactionController);
                console.log('[Overlap Cycling] DEBUG: markerService exists:', !!window.globeController?.interactionController?.markerService);
                
                // Manually update hover state (badge, pagination highlight) since mouse didn't move
                if (window.globeController?.interactionController?.markerService) {
                    const markerService = window.globeController.interactionController.markerService;
                    console.log('[Overlap Cycling] Manually updating hover state for:', nextMarker.userData.eventName);
                    markerService.highlightNumberButtonForMarker(nextMarker);
                    markerService._syncEventsHoverPreviewFromMarker(nextMarker);
                    console.log('[Overlap Cycling] Hover state updated');
                } else {
                    console.log('[Overlap Cycling] ERROR: markerService not available');
                }
            }
        }

        // Reset the interval timer
        if (this.overlapCycleInterval) {
            clearInterval(this.overlapCycleInterval);
            this.overlapCycleInterval = setInterval(() => {
                console.log('[Overlap Cycling] Cycling...');
                this.cycleOverlaps();
            }, 5000);
        }
    }
}
