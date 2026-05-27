/**
 * WorldviewMarkerInteraction - Handles marker hover detection and click handling
 */

/**
 * Dismiss slide-out chrome: music, filters, event manager, palette.
 * Kept local because this file is loaded as a classic script (non-module) in index.html.
 */
function closeWorldviewAuxPanels() {
    let closedMusic = false;
    const musicPanel = document.getElementById('musicPanel');
    const musicBtn = document.getElementById('musicToggle');
    if (musicPanel && musicPanel.classList.contains('open')) {
        closedMusic = true;
        musicPanel.classList.remove('open');
        if (musicBtn) musicBtn.classList.remove('active');
    }
    const filtersPanel = document.getElementById('filtersPanel');
    const filtersBtn = document.getElementById('filtersToggle');
    if (filtersPanel && filtersPanel.classList.contains('open')) {
        filtersPanel.classList.remove('open');
        if (filtersBtn) filtersBtn.classList.remove('active');
    }
    const managePanel = document.getElementById('eventsManagePanel');
    const manageToggle = document.getElementById('eventsManageToggle');
    if (managePanel && managePanel.classList.contains('open')) {
        try {
            window.eventManager?.resetAllEventVariants?.();
        } catch (_) {}
        managePanel.classList.remove('open');
        if (manageToggle) manageToggle.classList.remove('active');
        try {
            window.SummaryInfoBadge?.hide?.();
        } catch (_) {}
    }
    const paletteMenu = document.getElementById('paletteMenu');
    if (paletteMenu && paletteMenu.classList.contains('open')) {
        if (typeof window._closePaletteMenu === 'function') {
            try {
                window._closePaletteMenu();
            } catch (_) {}
        } else {
            paletteMenu.classList.remove('open');
            const paletteToggle = document.getElementById('colorPaletteToggle');
            if (paletteToggle) paletteToggle.classList.remove('active');
        }
    }
    if (closedMusic && window.MusicManager && typeof window.MusicManager.updateNowPlaying === 'function') {
        try {
            window.MusicManager.updateNowPlaying();
        } catch (_) {}
    }
}

class WorldviewMarkerInteraction {
    constructor(sceneModel, uiView, pulseService) {
        this.sceneModel = sceneModel;
        this.uiView = uiView;
        this.pulseService = pulseService;
        /** @type {{ userData: object }|null} */
        this._domLiteHoverStub = null;
    }

    /**
     * Under Events header: show # / title for hovered globe marker (non-module callers use window.SummaryInfoBadge).
     * @param {THREE.Object3D|null} marker
     */
    _syncEventsHoverPreviewFromMarker(marker) {
        const badge = typeof window !== 'undefined' ? window.SummaryInfoBadge : null;
        if (!badge || typeof badge.hide !== 'function') return;
        if (!marker || !marker.userData || marker.userData.isLocked || marker.userData.isInteractive === false) {
            badge.hide();
            return;
        }
        const eventObj = marker.userData.event;
        if (!eventObj) {
            badge.hide();
            return;
        }

        // Use Event System data to get global event number
        let n = null;
        if (window.eventManager?.events) {
            const allEvents = window.eventManager.events;
            const index = allEvents.findIndex(e => e === eventObj);
            if (index >= 0) {
                n = index + 1; // 1-based index
            }
        }

        // Fallback to old dataModel if Event System not available
        if (n === null) {
            const dataModel = window.globeController && window.globeController.dataModel;
            if (window.EventSlideShowHelpers && typeof window.EventSlideShowHelpers.getGlobalEventNumber1Based === 'function') {
                n = window.EventSlideShowHelpers.getGlobalEventNumber1Based(eventObj, dataModel);
            }
        }
        const variantIndex =
            marker.userData && marker.userData.variantIndex !== undefined
                ? marker.userData.variantIndex
                : undefined;
        const lines =
            typeof badge.getHoverPreviewLines === 'function'
                ? badge.getHoverPreviewLines(eventObj, { variantIndex })
                : {
                    primary: String(eventObj.name || '').replace(/<[^>]+>/g, ''),
                    otherVariants: [],
                    era: '',
                    primaryRowFlag: null,
                    otherRowFlags: [],
                    yearLine: 'Year Unknown',
                };
        if (typeof badge.show === 'function') {
            badge.show(
                n,
                lines.primary,
                lines.otherVariants,
                lines.era,
                lines.primaryRowFlag,
                lines.otherRowFlags,
                lines.yearLine,
            );
        }
    }

    /**
     * Check if mouse is hovering over an event marker and create pulse effect
     */
    checkEventMarkerHover(event) {
        // Disable hover effects on mobile/touch devices
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            return;
        }
        
        if (!this.sceneModel) return;
        
        const camera = this.sceneModel.getCamera();
        if (!camera) return;
        
        const container = document.getElementById('globe-container');
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        // Match camera layer mask (Earth map subtree uses layer 1). Default raycaster only tests layer 0.
        raycaster.layers.mask = camera.layers.mask;

        const markers = this.sceneModel.getMarkers();
        const eventMarkers = [];
        if (markers && markers.length > 0) {
            for (let i = 0; i < markers.length; i++) {
                const m = markers[i];
                if (m && m.userData && m.userData.isEventMarker && m.visible) {
                    eventMarkers.push(m);
                }
            }
        }

        if (eventMarkers.length === 0) return;
        
        const intersects = raycaster.intersectObjects(eventMarkers);
        
        // Don't allow hover interactions when event image overlay is visible
        const eventImageOverlay = document.getElementById('eventImageOverlay');
        if (eventImageOverlay && eventImageOverlay.classList.contains('open')) {
            const opacity = parseFloat(window.getComputedStyle(eventImageOverlay).opacity);
            if (opacity > 0.1) { // Image is visible (faded in)
                // Stop any existing pulse when image becomes visible
                const hoveredMarker = this.pulseService.getHoveredMarker();
                if (hoveredMarker) {
                    this.pulseService.stopEventMarkerPulse(hoveredMarker);
                    this.pulseService.setHoveredMarker(null);
                }
                return; // Block hover effects but allow globe movement
            }
        }
        
        if (intersects.length > 0) {
            const hoveredMarker = intersects[0].object;
            
            // Don't allow hover effects on non-interactive markers (variant markers)
            if (hoveredMarker.userData && hoveredMarker.userData.isInteractive === false) {
                // If we were hovering an interactive marker, stop it
                const currentHovered = this.pulseService.getHoveredMarker();
                if (currentHovered && currentHovered.userData.isInteractive !== false) {
                    this.pulseService.stopEventMarkerPulse(currentHovered);
                    this.pulseService.setHoveredMarker(null);
                    this.highlightNumberButtonForMarker(null);
                    this._syncEventsHoverPreviewFromMarker(null);
                }
                return;
            }
            
            // Don't allow hover effects on locked events
            if (hoveredMarker.userData && hoveredMarker.userData.isLocked) {
                // If we were hovering an unlocked marker, stop it
                const currentHovered = this.pulseService.getHoveredMarker();
                if (currentHovered && !currentHovered.userData.isLocked) {
                    this.pulseService.stopEventMarkerPulse(currentHovered);
                    this.pulseService.setHoveredMarker(null);
                    this.highlightNumberButtonForMarker(null);
                    this._syncEventsHoverPreviewFromMarker(null);
                }
                return;
            }
            
            // Stop auto-rotation while hovering
            this.sceneModel.setAutoRotate(false);
            if (this.sceneModel.autoRotateTimeout) {
                clearTimeout(this.sceneModel.autoRotateTimeout);
                this.sceneModel.autoRotateTimeout = null;
            }
            
            // If hovering a different marker, stop previous pulse
            const currentHovered = this.pulseService.getHoveredMarker();
            if (currentHovered && currentHovered !== hoveredMarker) {
                this.pulseService.stopEventMarkerPulse(currentHovered);
            }
            
            // Start pulse on new marker if not already pulsing
            if (currentHovered !== hoveredMarker) {
                this.pulseService.startEventMarkerPulse(hoveredMarker);
                this.pulseService.setHoveredMarker(hoveredMarker);
                this.highlightNumberButtonForMarker(hoveredMarker);
                this._syncEventsHoverPreviewFromMarker(hoveredMarker);
                
                // Pause overlap cycling when hovering over a marker
                if (window.globeEventMarkerManager && typeof window.globeEventMarkerManager.pauseOverlapCycling === 'function') {
                    window.globeEventMarkerManager.pauseOverlapCycling();
                }
            }
            // Reset image auto-show timer when hovering (prevent image from coming back while interacting)
            const imageOverlayService = window.globeController?.globeView?.imageOverlayManager;
            if (imageOverlayService) {
                imageOverlayService.stillnessStartTime = null;
            }
            // Dispatch custom event to reset image restore timer in MenuHelpers
            window.dispatchEvent(new CustomEvent('markerhover'));
        } else {
            // Not hovering any event marker - resume auto-rotate if enabled
            const currentHovered = this.pulseService.getHoveredMarker();
            if (currentHovered) {
                this.pulseService.stopEventMarkerPulse(currentHovered);
                this.pulseService.setHoveredMarker(null);
                this.highlightNumberButtonForMarker(null);
                this._syncEventsHoverPreviewFromMarker(null);
                
                // Resume overlap cycling when hover ends
                if (window.globeEventMarkerManager && typeof window.globeEventMarkerManager.resumeOverlapCycling === 'function') {
                    window.globeEventMarkerManager.resumeOverlapCycling();
                }
                
                // Resume auto-rotate after a shorter delay
                if (this.sceneModel.getAutoRotateEnabled() && !this.sceneModel.eventMarker) {
                    this.sceneModel.autoRotateTimeout = setTimeout(() => {
                        this.sceneModel.setAutoRotate(true);
                    }, 500); // 0.5 second delay - faster resume
                }
            }
        }
    }

    /**
     * Highlight the number button (1-10) that corresponds to the hovered event marker.
     * Uses same visual as button hover: scale up, brighter background/border, stronger shadow.
     * @param {THREE.Object3D|null} marker - Hovered event marker or null to clear highlight
     */
    highlightNumberButtonForMarker(marker) {
        const buttons = document.querySelectorAll('.event-number-btn');
        buttons.forEach(btn => btn.classList.remove('number-btn-marker-hover'));

        if (!marker || !marker.userData || !marker.userData.event) return;

        // Use Event System data instead of old dataModel
        let currentPageEvents = [];
        if (window.eventManager?.events && window.standaloneEventSlide?.currentPage) {
            const allEvents = window.eventManager.events;
            const currentPage = window.standaloneEventSlide.currentPage;
            const eventsPerPage = 10;
            const startIndex = (currentPage - 1) * eventsPerPage;
            const endIndex = startIndex + eventsPerPage;
            currentPageEvents = allEvents.slice(startIndex, endIndex);
        } else {
            // Fallback to old dataModel
            const dataModel = window.globeController && window.globeController.dataModel;
            if (!dataModel) return;
            currentPageEvents = dataModel.getEventsForCurrentPage();
        }

        const event = marker.userData.event;
        let index = currentPageEvents.findIndex(e => e === event);
        if (index < 0) {
            const name = (event.name || '').trim();
            index = currentPageEvents.findIndex(e => (e.name || '').trim() === name);
        }
        if (index < 0) return;

        const position = index + 1; // 1-10
        const btn = document.querySelector(`.event-number-btn[data-position="${position}"]`);
        if (btn && !btn.disabled && !btn.classList.contains('locked')) {
            btn.classList.add('number-btn-marker-hover');
        }
    }

    /**
     * Handle marker click
     * @param {MouseEvent} event - Mouse event
     * @param {Function} onZoomToMarker - Callback to zoom to marker
     * @param {Function} onResetCamera - Callback to reset camera
     */
    onMarkerClick(event, onZoomToMarker, onResetCamera) {

        // Skip globe marker clicks when map view is active (DOM markers handle it)
        if (window.globeController?.map2dLite?.isVisible?.()) {
            return;
        }

        // Don't register click if mouse was dragged
        if (window.mouseMoved) {
            return;
        }
        
        const camera = this.sceneModel.getCamera();
        if (!camera) {
            return;
        }
        
        const markers = this.sceneModel.getMarkers();
        
        const container = document.getElementById('globe-container');
        if (!container) {
            return;
        }
        
        const rect = container.getBoundingClientRect();
        
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        raycaster.layers.mask = camera.layers.mask;

        // CRITICAL: Only include EVENT markers (not seaport or city markers)
        // Seaport markers were blocking event markers from being clicked
        const clickableObjects = [];
        
        if (markers && markers.length > 0) {
            for (let i = 0; i < markers.length; i++) {
                const marker = markers[i];
                if (marker && marker.userData && marker.userData.isEventMarker && marker.visible) {
                    clickableObjects.push(marker);
                }
            }
        }
        
        // Log first few markers for debugging
        if (clickableObjects.length > 0) {
            console.log('[onMarkerClick] First marker sample:', {
                hasUserData: !!clickableObjects[0].userData,
                isEventMarker: clickableObjects[0].userData?.isEventMarker,
                isInteractive: clickableObjects[0].userData?.isInteractive,
                visible: clickableObjects[0].visible,
                scale: clickableObjects[0].scale,
                position: clickableObjects[0].position,
                hasParent: !!clickableObjects[0].parent
            });
        }
        
        const intersects = raycaster.intersectObjects(clickableObjects);
        
        if (intersects.length > 0) {
            console.log('[onMarkerClick] First intersect:', {
                object: intersects[0].object,
                hasUserData: !!intersects[0].object.userData,
                isEventMarker: intersects[0].object.userData?.isEventMarker,
                isSeaportMarker: intersects[0].object.userData?.isSeaportMarker,
                distance: intersects[0].distance
            });
        } else {
        }
        
        if (intersects.length > 0) {
            const clickedMarker = intersects[0].object;

            // Clear hover state when clicking a marker
            if (window.globeController?.interactionController) {
                window.globeController.interactionController.hoveredEventMarker = null;
            }
            if (window.globeController?.markerPulseService) {
                window.globeController.markerPulseService.hoveredEventMarker = null;
            }
            // Stop pulse animation on the clicked marker
            const hoveredMarker = this.pulseService.getHoveredMarker();
            if (hoveredMarker) {
                this.pulseService.stopEventMarkerPulse(hoveredMarker);
                this.pulseService.setHoveredMarker(null);
                this.highlightNumberButtonForMarker(null);
                this._syncEventsHoverPreviewFromMarker(null);
            }
            // Stop hover radiate sound loop
            if (window.globeController?.map2dLite?.stopHoverRadiateLoop) {
                window.globeController.map2dLite.stopHoverRadiateLoop();
            }
            // Clear synthetic marker hover
            if (window.globeController?.map2dLite?.clearSyntheticMarkerHover) {
                window.globeController.map2dLite.clearSyntheticMarkerHover();
            }

            // Handle event marker click
            if (clickedMarker.userData && clickedMarker.userData.isEventMarker) {
                console.log('[onMarkerClick] Clicked marker userData:', {
                    eventName: clickedMarker.userData.eventName,
                    event: clickedMarker.userData.event,
                    variant: clickedMarker.userData.variant,
                    variantIndex: clickedMarker.userData.variantIndex,
                    locationType: clickedMarker.userData.locationType,
                    isInteractive: clickedMarker.userData.isInteractive,
                    isMainVariant: clickedMarker.userData.isMainVariant
                });
                
                // Only allow clicks on interactive markers (main variant or single events)
                if (clickedMarker.userData.isInteractive === false) {
                    return; // Non-interactive variant markers cannot be clicked
                }
                
                // Don't allow event marker clicks when image overlay is visible
                const eventImageOverlay = document.getElementById('eventImageOverlay');
                if (eventImageOverlay && eventImageOverlay.classList.contains('open')) {
                    const opacity = parseFloat(window.getComputedStyle(eventImageOverlay).opacity);
                    if (opacity > 0.1) { // Image is visible (faded in)
                        return; // Block event marker clicks but allow globe dragging
                    }
                }
                
                // Don't allow clicks on locked events
                if (clickedMarker.userData.isLocked) {
                    return;
                }
                
                // Check if this is the same event that's currently open (by checking Event System's current index)
                const events = window.eventManager?.getDockTimelineEvents?.() || [];
                const eventData = clickedMarker.userData.event;
                
                // Find event index - need to handle variants correctly
                let eventIndex = -1;
                if (clickedMarker.userData.variant) {
                    // This is a variant marker - find the parent event
                    eventIndex = events.findIndex(e => {
                        // Check if this event has variants and one matches
                        if (e.variants && e.variants.length > 0) {
                            return e.variants.some(v => v === clickedMarker.userData.variant || v.name === clickedMarker.userData.variant.name);
                        }
                        return false;
                    });
                } else {
                    // This is a single event marker
                    eventIndex = events.findIndex(e => e === eventData || e.name === eventData.name);
                }
                if (eventIndex >= 0) {
                } else {
                }
                const currentIndex = window.standaloneEventSlide?.currentEventIndex;
                const eventSlide = document.getElementById('eventSlide');
                if (eventIndex >= 0 && eventIndex === currentIndex && eventSlide && eventSlide.classList.contains('open')) {
                    // Same event and slide is open - close it
                    eventSlide.classList.remove('open');
                    
                    // Reset camera when closing by clicking same marker
                    if (window.globeController?.interactionController) {
                        window.globeController.interactionController.stopFollowingStation();
                        window.globeController.interactionController.restorePlanesVisibility?.();
                    }
                    if (window.globeController?.cameraControlService) {
                        window.globeController.cameraControlService.resetCameraToDefault();
                    }
                    
                    return;
                }
                
                // Check if this is a Moon/Mars/Station/Ship marker - adjust camera behavior
                const locationType = clickedMarker.userData ? clickedMarker.userData.locationType : 'earth';
                
                // Check if marker is on orbit panel (for station/marsShip)
                const orbitMarkerParent = this.sceneModel.getOrbitMarkerParent ? this.sceneModel.getOrbitMarkerParent() : this.sceneModel.orbitPlane;
                const isOnOrbitPanel = orbitMarkerParent && clickedMarker.parent === orbitMarkerParent;
                
                if (locationType === 'moon' || locationType === 'mars') {
                    // Reset camera to default view for Moon/Mars events
                    if (onResetCamera) {
                        onResetCamera();
                    }
                } else if (locationType === 'station' || locationType === 'marsShip') {
                    // Guard rail: if on orbit panel, treat like moon/mars (reset camera, don't follow)
                    if (isOnOrbitPanel) {
                        if (onResetCamera) {
                            onResetCamera();
                        }
                    } else {
                        // Follow the moving object (ISS / Mars Ship) when on actual satellite
                        try {
                            window.globeController?.interactionController?.setPlanesVisibility?.(false);
                            window.globeController?.interactionController?.startFollowingStation?.(clickedMarker);
                        } catch (_) {
                            // fallback to reset if follow isn't available
                            if (onResetCamera) onResetCamera();
                        }
                    }
                } else {
                    // Zoom in and center on the marker (Earth events)
                    if (onZoomToMarker) {
                        onZoomToMarker(clickedMarker);
                    }
                }
                
                // Open event slide with viewport-based routing
                if (eventIndex >= 0) {
                    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                    const isMobilePortrait = isTouchDevice && window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
                    if (isMobilePortrait && window.standaloneEventSlide) {
                        // Mobile portrait: use standalone implementation
                        window.standaloneEventSlide.showEvent(eventIndex);
                    } else if (window.globeController?.uiView) {
                        // Desktop / mobile landscape: use simple dock-like implementation
                        const eventData = events[eventIndex];
                        const eventName = eventData?.name || 'Event';
                        const eventDescription = eventData?.description || '';
                        const imagePath = window.eventManager?.getEventImagePath
                            ? window.eventManager.getEventImagePath(eventData.name, eventData.image, 'story')
                            : null;
                        window.globeController.uiView.showEventSlide(eventName, imagePath, eventDescription, clickedMarker, eventData);
                    }
                    // Play sound effect
                    if (window.SoundEffectsManager?.play) {
                        window.SoundEffectsManager.play('eventClick');
                    }
                } else {
                }
            }
        } else {
            // Clicked elsewhere - hide label
            this.uiView.hideCityLabel();
            // NOTE: Event slide close removed - Globe no longer handles event slides
            // Event System Load Out manages its own panel state
            // Empty globe tap (not a drag) closes music/filters panels
            closeWorldviewAuxPanels();
        }
    }

    /**
     * Map2DLite DOM markers: same chrome as WebGL hover (pagination highlight, Events preview badge, auto-rotate pause).
     * WebGL pulse rings are skipped (no mesh). Desktop only — matches {@link checkEventMarkerHover}.
     * @param {{ userData: object }|null} markerOrNull - Stub from WorldviewMapLiteLayer, or null to clear.
     */
    setDomLiteMarkerHover(markerOrNull) {
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            return;
        }

        window.globeController?.map2dLite?.clearSyntheticMarkerHover?.();

        const eventImageOverlay = document.getElementById('eventImageOverlay');
        if (eventImageOverlay && eventImageOverlay.classList.contains('open')) {
            const opacity = parseFloat(window.getComputedStyle(eventImageOverlay).opacity);
            if (opacity > 0.1) {
                this.highlightNumberButtonForMarker(null);
                this._syncEventsHoverPreviewFromMarker(null);
                this._domLiteHoverStub = null;
                window.globeController?.map2dLite?.stopHoverRadiateLoop?.();
                return;
            }
        }

        const currentGl = this.pulseService.getHoveredMarker();
        if (currentGl) {
            this.pulseService.stopEventMarkerPulse(currentGl);
            this.pulseService.setHoveredMarker(null);
        }

        if (markerOrNull) {
            const ud = markerOrNull.userData;
            if (!ud || ud.isLocked || ud.isInteractive === false) {
                this.highlightNumberButtonForMarker(null);
                this._syncEventsHoverPreviewFromMarker(null);
                this._domLiteHoverStub = null;
                window.globeController?.map2dLite?.stopHoverRadiateLoop?.();
                return;
            }
            this.sceneModel.setAutoRotate(false);
            if (this.sceneModel.autoRotateTimeout) {
                clearTimeout(this.sceneModel.autoRotateTimeout);
                this.sceneModel.autoRotateTimeout = null;
            }
            this.highlightNumberButtonForMarker(markerOrNull);
            this._syncEventsHoverPreviewFromMarker(markerOrNull);
            this._domLiteHoverStub = markerOrNull;
            window.globeController?.map2dLite?.setSyntheticHoverFromStub?.(markerOrNull);

            // Reset image auto-show timer when hovering (prevent image from coming back while interacting)
            const imageOverlayService = window.globeController?.globeView?.imageOverlayManager;
            if (imageOverlayService) {
                imageOverlayService.stillnessStartTime = null;
            }
            // Dispatch custom event to reset image restore timer in MenuHelpers
            window.dispatchEvent(new CustomEvent('markerhover'));
            return;
        }

        this.highlightNumberButtonForMarker(null);
        this._syncEventsHoverPreviewFromMarker(null);
        this._domLiteHoverStub = null;
        window.globeController?.map2dLite?.stopHoverRadiateLoop?.();
        if (this.sceneModel.getAutoRotateEnabled() && !this.sceneModel.eventMarker) {
            this.sceneModel.autoRotateTimeout = setTimeout(() => {
                this.sceneModel.setAutoRotate(true);
            }, 500);
        }
    }

    /**
     * Clear DOM-lite hover only if `stub` is still the active target (avoids mouseleave firing after another marker’s enter).
     * Pagination resolves the marker again on every pointer leave, creating a **new** map-lite stub object
     * each time (unlike WebGL meshes, which keep a stable reference). Match proxy stubs by `event` + `variantIndex` like
     * {@link WorldviewMapLiteLayer#setSyntheticHoverFromStub}.
     * @param {{ userData: object }} stub
     */
    clearDomLiteMarkerHoverIf(stub) {
        if (!this._domLiteHoverStub) return;
        if (!stub?.userData) {
            if (this._domLiteHoverStub.userData?.isMap2dLiteProxy) {
                this.setDomLiteMarkerHover(null);
            }
            return;
        }
        if (this._domLiteHoverStub === stub) {
            this.setDomLiteMarkerHover(null);
            return;
        }
        const cur = this._domLiteHoverStub.userData;
        const next = stub.userData;
        if (
            cur.isMap2dLiteProxy &&
            next.isMap2dLiteProxy &&
            cur.event === next.event &&
            (cur.variantIndex ?? 0) === (next.variantIndex ?? 0)
        ) {
            this.setDomLiteMarkerHover(null);
        }
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorldviewMarkerInteraction;
}

// Make globally accessible
if (typeof window !== 'undefined') {
    window.WorldviewMarkerInteraction = WorldviewMarkerInteraction;
    window.closeTimelineMusicFiltersPanelsIfOpen = closeWorldviewAuxPanels;
}
