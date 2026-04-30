/**
 * EventInteractionService - Handles event interaction logic (opening events, variant cycling)
 * Separates event interaction logic from event management
 */

class EventInteractionService {
    constructor() {
        this.eventManager = null; // Reference to EventManager (for state access)
    }

    /**
     * Set the EventManager instance (dependency injection)
     */
    setEventManager(eventManager) {
        this.eventManager = eventManager;
    }

    /**
     * Open event info from list (preview click, or whole-card click on GitHub Pages).
     * Matches navigation: same camera helper, slide opens before closing the manager panel, marker refresh returns a real Promise.
     */
    openEventFromList(event, index) {
        if (!this.eventManager) return;

        this.eventManager.isOpeningEvent = true;

        const closeManagerPanel = () => {
            const panel = document.getElementById('eventsManagePanel');
            if (panel) panel.classList.remove('open');
            const toggleBtn = document.getElementById('eventsManageToggle');
            if (toggleBtn) toggleBtn.classList.remove('active');
            setTimeout(() => {
                this.eventManager.isOpeningEvent = false;
            }, 320);
        };

        const resolveTimelineUiContext = () => {
            const gc = window.globeController;
            if (gc?.globeView && gc?.uiView && gc?.dataModel) {
                return { dataModel: gc.dataModel, uiView: gc.uiView, globe: gc };
            }
            const bridge = window.__codexEventSlideBridge;
            if (bridge?.uiView && bridge?.dataModel) {
                return { dataModel: bridge.dataModel, uiView: bridge.uiView, globe: null };
            }
            return null;
        };

        const openSlideForListItem = () => {
            const ctx = resolveTimelineUiContext();
            if (!ctx?.uiView) {
                closeManagerPanel();
                return;
            }

            const { uiView, globe } = ctx;

            const isMultiEvent = event.variants && event.variants.length > 0;
            let variantIndex = 0;
            if (isMultiEvent) {
                const itemKey = `event-${index}`;
                variantIndex = this.eventManager.eventItemVariantIndices.get(itemKey) || 0;
            }
            const displayEvent = isMultiEvent ? event.variants[variantIndex] : event;

            let targetMarker = null;
            if (globe?.sceneModel) {
                const markers = globe.sceneModel.getMarkers();
                const eventMarker = markers.find(m => {
                    if (m.userData && m.userData.isEventMarker) {
                        const markerEvent = m.userData.event;
                        return (markerEvent === event) ||
                            (markerEvent.lat !== undefined && event.lat !== undefined &&
                                Math.abs(markerEvent.lat - event.lat) < 0.0001 &&
                                Math.abs(markerEvent.lon - event.lon) < 0.0001);
                    }
                    return false;
                });

                if (eventMarker && eventMarker.userData && eventMarker.userData.isLocked) {
                    closeManagerPanel();
                    return;
                }

                if (eventMarker) {
                    targetMarker = eventMarker;
                    if (isMultiEvent && variantIndex > 0) {
                        const variantMarker = markers.find(m => (
                            m.userData && m.userData.isEventMarker &&
                            m.userData.event === event &&
                            m.userData.variantIndex === variantIndex
                        ));
                        if (variantMarker) targetMarker = variantMarker;
                    }

                    const ic = globe.interactionController;
                    const navLoc = window.NavigationLocationHelpers;
                    const sceneModel = globe.sceneModel;
                    if (ic && navLoc && typeof navLoc.handleLocationTypeCamera === 'function' && typeof navLoc.getLocationType === 'function') {
                        navLoc.handleLocationTypeCamera(ic, targetMarker, navLoc.getLocationType(targetMarker, displayEvent), sceneModel);
                    } else if (ic) {
                        const locationType = targetMarker.userData ? targetMarker.userData.locationType : 'earth';
                        if (locationType === 'moon' || locationType === 'mars') {
                            ic.resetCameraToDefault();
                        } else {
                            ic.zoomToMarker(targetMarker);
                        }
                    }
                }
            }

            const eventName = displayEvent.name || (targetMarker && targetMarker.userData && targetMarker.userData.eventName) || event.name;
            const eventDescription = displayEvent.description;
            const imagePath = this.eventManager.getEventImagePath
                ? this.eventManager.getEventImagePath(displayEvent.name, displayEvent.image)
                : null;

            // Route to appropriate implementation based on viewport (actual touch device, not DevTools emulation)
            const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            const isMobilePortrait = isTouchDevice && window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
            if (isMobilePortrait && window.standaloneEventSlide) {
                // Mobile portrait: use standalone implementation (same row list as Event Manager, not dock timeline)
                const listEv = this.eventManager.events || [];
                const eventIndex = listEv.indexOf(event);
                if (eventIndex >= 0) {
                    window.standaloneEventSlide.showEvent(eventIndex, { eventList: listEv });
                }
            } else {
                // Desktop / mobile landscape: use simple dock-like implementation
                uiView.showEventSlide(
                    eventName,
                    imagePath,
                    eventDescription,
                    targetMarker,
                    event
                );
            }

            this.resetAllEventVariants();
            closeManagerPanel();
        };

        const runOpenFlow = () => {
            const ctx = resolveTimelineUiContext();
            if (!ctx?.dataModel) {
                openSlideForListItem();
                return;
            }

            const { dataModel, uiView, globe } = ctx;
            const currentPage = dataModel.getCurrentEventPage();
            const eventsPerPage = dataModel.eventsPerPage || 10;
            const eventPage = Math.floor(index / eventsPerPage) + 1;

            if (eventPage !== currentPage) {
                dataModel.setCurrentEventPage(eventPage);
                if (uiView && typeof uiView.updatePaginationUI === 'function') {
                    uiView.updatePaginationUI();
                }
                const gv = globe?.globeView;
                const refreshPromise = gv && typeof gv.refreshEventMarkers === 'function'
                    ? gv.refreshEventMarkers(false)
                    : null;
                if (refreshPromise && typeof refreshPromise.then === 'function') {
                    refreshPromise.then(() => {
                        requestAnimationFrame(openSlideForListItem);
                    }).catch(() => {
                        setTimeout(openSlideForListItem, 50);
                    });
                } else {
                    requestAnimationFrame(openSlideForListItem);
                }
                return;
            }
            openSlideForListItem();
        };

        runOpenFlow();

        setTimeout(() => {
            this.eventManager.isOpeningEvent = false;
        }, 2000);
    }

    /**
     * Cycle through variants for a multi-event item
     */
    cycleEventVariant(eventIndex, event, itemElement) {
        if (!this.eventManager || !event.variants || event.variants.length <= 1) return;
        
        const itemKey = `event-${eventIndex}`;
        let currentIndex = this.eventManager.eventItemVariantIndices.get(itemKey) || 0;
        
        // Cycle to next variant (wrap around)
        currentIndex = (currentIndex + 1) % event.variants.length;
        this.eventManager.eventItemVariantIndices.set(itemKey, currentIndex);
        
        // Play switch event sound when switching variants
        if (window.SoundEffectsManager) {
            window.SoundEffectsManager.play('switchEvent');
        }
        
        // Update the preview (list card) when present; globe thumbnails refresh below
        if (itemElement) {
            this.updateEventItemPreview(eventIndex, event, itemElement, currentIndex);
        }
        const ui = typeof window !== 'undefined'
            ? (window.globeController?.uiView || window.__codexEventSlideBridge?.uiView)
            : null;
        if (ui?.updateNumberButtons) {
            ui.updateNumberButtons();
        }
        if (ui?.refreshGlobePaginationThumbHover) {
            ui.refreshGlobePaginationThumbHover(eventIndex);
        }
    }
    
    /**
     * Reset all multi-variant events to the first variant
     */
    resetAllEventVariants() {
        if (!this.eventManager) return;
        
        // Clear all variant indices (they will default to 0 when accessed)
        this.eventManager.eventItemVariantIndices.clear();
        
        // Re-render events to show first variant in all previews
        if (this.eventManager.renderEvents) {
            this.eventManager.renderEvents();
        }
        const ui = typeof window !== 'undefined'
            ? (window.globeController?.uiView || window.__codexEventSlideBridge?.uiView)
            : null;
        if (ui?.updateNumberButtons) {
            ui.updateNumberButtons();
        }
    }
    
    /**
     * Update the preview for an event item with a specific variant
     */
    updateEventItemPreview(eventIndex, event, itemElement, variantIndex) {
        if (!this.eventManager) return;
        
        const variant = event.variants[variantIndex];
        
        // Update image
        const imageContainer = itemElement.querySelector('.event-item-preview-image');
        const imagePath = this.eventManager.getEventImagePath ? 
            this.eventManager.getEventImagePath(variant.name, variant.image) : null;
        // No cache busting needed for variant switching - images are already loaded
        const imagePathWithCache = imagePath || null;
        
        if (imagePathWithCache) {
            imageContainer.innerHTML = `<img src="${imagePathWithCache}" alt="${variant.name}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.3); font-size: 12px; width: 100%; height: 100%;\\'>No Image</div>';" onload="">`;
        } else {
            imageContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.3); font-size: 12px; width: 100%; height: 100%;">No Image</div>';
        }
        
        // Update title
        const titleElement = itemElement.querySelector('.event-item-title');
        if (titleElement) {
            titleElement.innerHTML = window.GlitchTextService ? 
                window.GlitchTextService.getDisplayEventName(variant.name) : variant.name;
        }

        // Refresh filter/country hit classes for the active variant (no visible pills)
        itemElement.classList.remove('event-item--search-hit-filter', 'event-item--search-hit-country');
        const oldPills = itemElement.querySelector('.event-search-hit-pills-row');
        if (oldPills) oldPills.remove();
        if (this.eventManager.getSearchMatchAxesForItem) {
            const axes = this.eventManager.getSearchMatchAxesForItem(variant);
            if (axes.filterActive || axes.countryActive) {
                if (axes.filterHit) itemElement.classList.add('event-item--search-hit-filter');
                if (axes.countryHit) itemElement.classList.add('event-item--search-hit-country');
            }
        }
        
        // Update location
        const locationElement = itemElement.querySelector('.event-item-location');
        if (locationElement) {
            let locationName = variant.cityDisplayName || null;
            const variantLocationType = variant.locationType || (event.locationType || 'earth');
            
            // Only call getLocationName for Earth events with valid lat/lon
            if (!locationName && variantLocationType === 'earth' && variant.lat !== undefined && variant.lon !== undefined) {
                if (this.eventManager.getLocationName) {
                    locationName = this.eventManager.getLocationName(variant.lat, variant.lon);
                }
            }
            // Fallback to coordinates for Earth events
            if (!locationName && variantLocationType === 'earth' && variant.lat !== undefined && variant.lon !== undefined) {
                locationName = `${variant.lat.toFixed(4)}, ${variant.lon.toFixed(4)}`;
            }
            // For Moon/Mars/Station/MarsShip events, display coordinates / defaults
            if (!locationName && variantLocationType !== 'earth') {
                if (variantLocationType === 'station') {
                    locationName = 'Space Station (ISS)';
                } else if (variantLocationType === 'marsShip') {
                    locationName = 'Red Promise Escape Ship';
                } else if (variant.x !== undefined && variant.y !== undefined) {
                    locationName = `${variantLocationType === 'moon' ? 'Moon' : 'Mars'}: (${variant.x.toFixed(1)}, ${variant.y.toFixed(1)})`;
                } else {
                    locationName = variantLocationType === 'moon' ? 'Moon' : 'Mars';
                }
            }
            const locText = locationName || 'Unknown';
            const rowInner = (typeof window !== 'undefined' && window.LocationFlagHelpers && typeof window.LocationFlagHelpers.createLocationRowInnerHtml === 'function')
                ? window.LocationFlagHelpers.createLocationRowInnerHtml(locText, variantLocationType)
                : `<img class="event-location-pin" src="assets/images/icons/Location Icon.png" alt="" width="28" height="28" decoding="async" /> ${locText}`;
            locationElement.innerHTML = rowInner;
        }
        const yearElement = itemElement.querySelector('.event-item-year');
        if (yearElement) {
            const timelineHelpers = (typeof window !== 'undefined') ? window.EventTimelineHelpers : null;
            const yearSource = (
                variant && (variant.yearStart != null || variant.yearEnd != null)
            ) ? variant : event;
            yearElement.textContent = timelineHelpers && typeof timelineHelpers.formatPanelYearRangeLine === 'function'
                ? timelineHelpers.formatPanelYearRangeLine(yearSource)
                : 'Year Unknown';
        }
        
        // Update badge text
        const badge = itemElement.querySelector('.multi-event-badge');
        if (badge) {
            badge.textContent = `${variantIndex + 1}/${event.variants.length}`;
        }

        const hasDescription = variant.description && variant.description.trim().length > 0;
        itemElement.classList.toggle('event-item--unfinished', !hasDescription);
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventInteractionService;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.EventInteractionService = new EventInteractionService();
}
