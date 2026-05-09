/**
 * EventNavigationService - Handles event navigation (prev/next buttons)
 */
class EventNavigationService {
    constructor(sceneModel, dataModel) {
        this.sceneModel = sceneModel;
        this.dataModel = dataModel;
        this.currentEventData = null;
        this.currentEventMarker = null;
        this.showEventSlideCallback = null; // Callback to show event slide
    }

    setCurrentEvent(eventData, marker) {
        this.currentEventData = eventData;
        this.currentEventMarker = marker;
    }

    setShowEventSlideCallback(callback) {
        this.showEventSlideCallback = callback;
    }

    setup() {
        const prevBtn = document.getElementById('eventPrevBtn');
        const nextBtn = document.getElementById('eventNextBtn');
        
        if (!prevBtn || !nextBtn) return;
        
        // Remove existing listeners by cloning
        const prevBtnClone = prevBtn.cloneNode(true);
        prevBtn.parentNode.replaceChild(prevBtnClone, prevBtn);
        const nextBtnClone = nextBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(nextBtnClone, nextBtn);
        
        const newPrevBtn = document.getElementById('eventPrevBtn');
        const newNextBtn = document.getElementById('eventNextBtn');
        
        // Get all events from EventManager (full list, not paginated)
        const getAllEvents = () => {
            if (window.eventManager && window.eventManager.events) {
                return window.eventManager.events;
            }
            if (this.dataModel) {
                return this.dataModel.getAllEvents();
            }
            return [];
        };
        
        // Find current event index in full list
        const getCurrentEventIndex = () => {
            const allEvents = getAllEvents();
            if (!this.currentEventData || allEvents.length === 0) return -1;
            
            // Get location type from current event (check marker or event data)
            const currentLocationType = (this.currentEventMarker && this.currentEventMarker.userData && this.currentEventMarker.userData.locationType) ||
                                       this.currentEventData.locationType || 'earth';
            
            // Match by location type, coordinates, and name
            return allEvents.findIndex(event => {
                const eventLocationType = event.locationType || 'earth';
                
                // Location types must match
                if (eventLocationType !== currentLocationType) return false;
                
                if (event.variants && event.variants.length > 0) {
                    // Multi-event: match first variant
                    const variant = event.variants[0];
                    const variantLocationType = variant.locationType || eventLocationType;
                    
                    // Check if variant location type matches
                    if (variantLocationType !== currentLocationType) return false;
                    
                    // Match by coordinates based on location type
                    let coordsMatch = false;
                    if (currentLocationType === 'moon' || currentLocationType === 'mars') {
                        // Moon/Mars: match by x/y coordinates
                        const currentX = this.currentEventData.x !== undefined ? this.currentEventData.x : 
                                        (this.currentEventData.variants?.[0]?.x !== undefined ? this.currentEventData.variants[0].x : undefined);
                        const currentY = this.currentEventData.y !== undefined ? this.currentEventData.y : 
                                        (this.currentEventData.variants?.[0]?.y !== undefined ? this.currentEventData.variants[0].y : undefined);
                        const variantX = variant.x !== undefined ? variant.x : event.x;
                        const variantY = variant.y !== undefined ? variant.y : event.y;
                        
                        if (currentX !== undefined && currentY !== undefined && variantX !== undefined && variantY !== undefined) {
                            coordsMatch = Math.abs(variantX - currentX) < 0.1 && Math.abs(variantY - currentY) < 0.1;
                        }
                    } else {
                        // Earth: match by lat/lon
                        const currentLat = this.currentEventData.lat !== undefined ? this.currentEventData.lat : 
                                          (this.currentEventData.variants?.[0]?.lat !== undefined ? this.currentEventData.variants[0].lat : undefined);
                        const currentLon = this.currentEventData.lon !== undefined ? this.currentEventData.lon : 
                                          (this.currentEventData.variants?.[0]?.lon !== undefined ? this.currentEventData.variants[0].lon : undefined);
                        const variantLat = variant.lat !== undefined ? variant.lat : event.lat;
                        const variantLon = variant.lon !== undefined ? variant.lon : event.lon;
                        
                        if (currentLat !== undefined && currentLon !== undefined && variantLat !== undefined && variantLon !== undefined) {
                            coordsMatch = Math.abs(variantLat - currentLat) < 0.0001 && Math.abs(variantLon - currentLon) < 0.0001;
                        }
                    }
                    
                    return coordsMatch && variant.name === (this.currentEventData.variants?.[0]?.name || this.currentEventData.name);
                } else {
                    // Single event: match by coordinates and name
                    let coordsMatch = false;
                    if (currentLocationType === 'moon' || currentLocationType === 'mars') {
                        // Moon/Mars: match by x/y coordinates
                        const currentX = this.currentEventData.x;
                        const currentY = this.currentEventData.y;
                        const eventX = event.x;
                        const eventY = event.y;
                        
                        if (currentX !== undefined && currentY !== undefined && eventX !== undefined && eventY !== undefined) {
                            coordsMatch = Math.abs(eventX - currentX) < 0.1 && Math.abs(eventY - currentY) < 0.1;
                        }
                    } else {
                        // Earth: match by lat/lon
                        const currentLat = this.currentEventData.lat;
                        const currentLon = this.currentEventData.lon;
                        const eventLat = event.lat;
                        const eventLon = event.lon;
                        
                        if (currentLat !== undefined && currentLon !== undefined && eventLat !== undefined && eventLon !== undefined) {
                            coordsMatch = Math.abs(eventLat - currentLat) < 0.0001 && Math.abs(eventLon - currentLon) < 0.0001;
                        }
                    }
                    
                    return coordsMatch && event.name === this.currentEventData.name;
                }
            });
        };
        
        // Navigate to event at index
        const navigateToEvent = (targetIndex) => {
            const allEvents = getAllEvents();
            if (targetIndex < 0 || targetIndex >= allEvents.length) return;
            
            const targetEvent = allEvents[targetIndex];
            
            // Check if event is on current page, if not switch to correct page
            if (this.dataModel && window.globeController) {
                const eventsPerPage = this.dataModel.eventsPerPage || 10;
                const targetPage = Math.floor(targetIndex / eventsPerPage) + 1;
                const currentPage = this.dataModel.getCurrentEventPage();
                
                if (targetPage !== currentPage) {
                    this.dataModel.setCurrentEventPage(targetPage);
                    
                    const T = window.TimelineMarkerSync;
                    if (T && typeof T.refreshTimelineEventMarkers === 'function') {
                        T.refreshTimelineEventMarkers();
                    }
                    const uiNav = window.globeController.uiView;
                    if (uiNav && typeof uiNav.setupEventPagination === 'function') {
                        uiNav.setupEventPagination(() => {
                            if (T && typeof T.refreshTimelineEventMarkers === 'function') {
                                T.refreshTimelineEventMarkers(true, {
                                    preservePaginationThumbEntrance: true
                                });
                            }
                        });
                    }
                }
            }
            
            // Find the marker for this event
            if (window.globeController && window.globeController.globeView) {
                const markers = window.globeController.sceneModel.getMarkers();
                const targetLocationType = targetEvent.locationType || 'earth';
                
                const eventMarker = markers.find(m => {
                    if (m.userData && m.userData.isEventMarker) {
                        const markerEvent = m.userData.event;
                        const markerLocationType = m.userData.locationType || 'earth';
                        
                        // Location types must match
                        if (markerLocationType !== targetLocationType) return false;
                        
                        // Match by event object reference first
                        if (markerEvent === targetEvent) return true;
                        
                        // Match by coordinates based on location type
                        if (targetLocationType === 'moon' || targetLocationType === 'mars') {
                            // Moon/Mars: match by x/y coordinates
                            const markerX = m.userData.x;
                            const markerY = m.userData.y;
                            const targetX = targetEvent.x;
                            const targetY = targetEvent.y;
                            
                            if (markerX !== undefined && markerY !== undefined && targetX !== undefined && targetY !== undefined) {
                                return Math.abs(markerX - targetX) < 0.1 && Math.abs(markerY - targetY) < 0.1;
                            }
                        } else {
                            // Earth: match by lat/lon
                            const markerLat = m.userData.lat;
                            const markerLon = m.userData.lon;
                            const targetLat = targetEvent.lat;
                            const targetLon = targetEvent.lon;
                            
                            if (markerLat !== undefined && markerLon !== undefined && targetLat !== undefined && targetLon !== undefined) {
                                return Math.abs(markerLat - targetLat) < 0.0001 && Math.abs(markerLon - targetLon) < 0.0001;
                            }
                        }
                    }
                    return false;
                });
                
                if (eventMarker && this.showEventSlideCallback) {
                    // Check if this is a multi-event
                    const isMultiEvent = targetEvent.variants && targetEvent.variants.length > 0;
                    const displayEvent = isMultiEvent ? targetEvent.variants[0] : targetEvent;
                    
                    const eventName = displayEvent.name || eventMarker.userData.eventName;
                    const eventDescription = displayEvent.description;
                    
                    // Get image path - use EventManager's function if available for consistency
                    let imagePath = null;
                    if (window.eventManager && typeof window.eventManager.getEventImagePath === 'function') {
                        imagePath = window.eventManager.getEventImagePath(displayEvent.name, displayEvent.image);
                        console.log(`[EventNavigationService] Image path for "${eventName}": ${imagePath}`);
                    } else {
                        // Fallback: construct path manually
                        imagePath = displayEvent.image || null;
                        if (!imagePath || !imagePath.trim()) {
                            const normalizedName = eventName.replace(/\s+/g, ' ').trim();
                            const encodedFileName = encodeURIComponent(normalizedName);
                            imagePath = `src/assets/images/Archive/Events/${encodedFileName}.png`;
                        }
                        console.log(`[EventNavigationService] Image path (fallback) for "${eventName}": ${imagePath}`);
                    }
                    
                    // Zoom to marker or reset to default view (for Moon/Mars)
                    if (window.globeController.interactionController) {
                        const locationType = eventMarker.userData ? eventMarker.userData.locationType : 'earth';
                        if (locationType === 'moon' || locationType === 'mars') {
                            // Reset camera to default view for Moon/Mars events
                            window.globeController.interactionController.resetCameraToDefault();
                        } else {
                            // Zoom in and center on the marker (Earth events)
                            window.globeController.interactionController.zoomToMarker(eventMarker);
                        }
                    }
                    
                    // Call the callback to show event slide
                    this.showEventSlideCallback(
                        eventName,
                        imagePath,
                        eventDescription,
                        eventMarker,
                        targetEvent
                    );
                }
            }
        };
        
        // Update button states
        const updateNavButtons = () => {
            const allEvents = getAllEvents();
            const currentIndex = getCurrentEventIndex();
            
            newPrevBtn.disabled = currentIndex <= 0 || allEvents.length === 0;
            newNextBtn.disabled = currentIndex >= allEvents.length - 1 || allEvents.length === 0;
        };
        
        // Initial update
        updateNavButtons();
        
        // Previous button
        newPrevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Play page sound
            if (window.SoundEffectsManager) {
                window.SoundEffectsManager.play('page');
            }
            
            const allEvents = getAllEvents();
            const currentIndex = getCurrentEventIndex();
            
            if (currentIndex > 0) {
                navigateToEvent(currentIndex - 1);
            }
            
            // Update button states after navigation
            setTimeout(updateNavButtons, 100);
        });
        
        // Next button
        newNextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Play page sound
            if (window.SoundEffectsManager) {
                window.SoundEffectsManager.play('page');
            }
            
            const allEvents = getAllEvents();
            const currentIndex = getCurrentEventIndex();
            
            if (currentIndex < allEvents.length - 1) {
                navigateToEvent(currentIndex + 1);
            }
            
            // Update button states after navigation
            setTimeout(updateNavButtons, 100);
        });
        
        // Return update function so it can be called when event changes
        return updateNavButtons;
    }

    setHideEventSlideCallback(callback) {
        this.hideEventSlideCallback = callback;
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.EventNavigationService = EventNavigationService;
}
