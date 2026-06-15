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
    constructor(sceneModel, uiView, pulseService, calloutService) {
        this.sceneModel = sceneModel;
        this.uiView = uiView;
        this.pulseService = pulseService;
        this.calloutService = calloutService || null;
        /** @type {{ userData: object }|null} */
        this._domLiteHoverStub = null;
        /** Sticky hover label — cleared on hover elsewhere, click away, or drag. */
        this._pinnedCalloutMarker = null;
    }

    hasPinnedCallout() {
        return !!this._pinnedCalloutMarker;
    }

    _isEventInfoPanelOpen() {
        const slide = document.getElementById('eventSlide');
        return !!(slide && slide.classList.contains('open'));
    }

    pinMarkerCallout(marker) {
        if (this._isEventInfoPanelOpen()) {
            this.dismissPinnedMarkerCallout();
            return;
        }
        if (!marker || !marker.userData || marker.userData.isLocked || marker.userData.isInteractive === false) {
            this.dismissPinnedMarkerCallout();
            return;
        }
        this.sceneModel.setAutoRotate(false);
        if (this.sceneModel.autoRotateTimeout) {
            clearTimeout(this.sceneModel.autoRotateTimeout);
            this.sceneModel.autoRotateTimeout = null;
        }
        this._pinnedCalloutMarker = marker;
        this._syncHoverCalloutFromMarker(marker);
        this.highlightNumberButtonForMarker(marker);
    }

    dismissPinnedMarkerCallout() {
        const hadPin = !!this._pinnedCalloutMarker;
        this._pinnedCalloutMarker = null;
        this._domLiteHoverStub = null;
        this._syncHoverCalloutFromMarker(null);
        this.highlightNumberButtonForMarker(null);
        this._syncEventsHoverPreviewFromMarker(null);
        window.globeController?.map2dLite?.stopHoverRadiateLoop?.();
        window.globeController?.map2dLite?.clearSyntheticMarkerHover?.();
        if (hadPin) {
            this._maybeResumeAutoRotateAfterCalloutDismiss();
        }
    }

    _maybeResumeAutoRotateAfterCalloutDismiss() {
        if (this.hasPinnedCallout()) return;
        if (!this.sceneModel.getAutoRotateEnabled() || this.sceneModel.eventMarker) return;
        if (this.sceneModel.autoRotateTimeout) {
            clearTimeout(this.sceneModel.autoRotateTimeout);
            this.sceneModel.autoRotateTimeout = null;
        }
        this.sceneModel.autoRotateTimeout = setTimeout(() => {
            if (!this.hasPinnedCallout()) {
                this.sceneModel.setAutoRotate(true);
            }
        }, 500);
    }

    releaseDomLiteMarkerHover(stub) {
        if (this._domLiteHoverStub === stub) {
            this._domLiteHoverStub = null;
        }
        window.globeController?.map2dLite?.stopHoverRadiateLoop?.();
        window.globeController?.map2dLite?.clearSyntheticMarkerHover?.();
        if (window.globeEventMarkerManager && typeof window.globeEventMarkerManager.resumeOverlapCycling === 'function') {
            window.globeEventMarkerManager.resumeOverlapCycling();
        }
    }

    /**
     * Open the event info panel for a marker (globe mesh or map lite stub).
     * @param {object} marker
     * @param {{ onZoomToMarker?: (m: object) => void, onResetCamera?: () => void, fromCallout?: boolean }} [opts]
     * @returns {boolean} true when an event panel was opened or already showing
     */
    activateEventMarker(marker, opts = {}) {
        const { onZoomToMarker, onResetCamera, fromCallout = false } = opts;
        if (!marker?.userData?.isEventMarker && !marker?.userData?.isMap2dLiteProxy) {
            return false;
        }
        if (marker.userData.isInteractive === false || marker.userData.isLocked) {
            return false;
        }

        if (window.globeController?.interactionController) {
            window.globeController.interactionController.hoveredEventMarker = null;
        }
        if (window.globeController?.markerPulseService) {
            window.globeController.markerPulseService.hoveredEventMarker = null;
        }
        const hoveredMarker = this.pulseService.getHoveredMarker();
        if (hoveredMarker) {
            this.pulseService.stopEventMarkerPulse(hoveredMarker);
            this.pulseService.setHoveredMarker(null);
            this.highlightNumberButtonForMarker(null);
            this._syncEventsHoverPreviewFromMarker(null);
        }
        window.globeController?.map2dLite?.stopHoverRadiateLoop?.();
        window.globeController?.map2dLite?.clearSyntheticMarkerHover?.();

        const events = window.eventManager?.getDockTimelineEvents?.() || [];
        const eventData = marker.userData.event;
        let eventIndex = -1;
        if (marker.userData.variant) {
            eventIndex = events.findIndex((e) => {
                if (e.variants && e.variants.length > 0) {
                    return e.variants.some(
                        (v) => v === marker.userData.variant || v.name === marker.userData.variant.name,
                    );
                }
                return false;
            });
        } else {
            eventIndex = events.findIndex((e) => e === eventData || e.name === eventData?.name);
        }
        if (eventIndex < 0 && eventData?.name) {
            const name = (eventData.name || '').trim();
            eventIndex = events.findIndex((e) => (e.name || '').trim() === name);
        }

        const currentIndex = window.standaloneEventSlide?.currentEventIndex;
        const eventSlide = document.getElementById('eventSlide');
        if (
            !fromCallout
            && eventIndex >= 0
            && eventIndex === currentIndex
            && eventSlide
            && eventSlide.classList.contains('open')
        ) {
            this.dismissPinnedMarkerCallout();
            window.globeController?.uiView?.hideEventSlide?.();
            return true;
        }

        const locationType = marker.userData.locationType || 'earth';
        const orbitMarkerParent = this.sceneModel.getOrbitMarkerParent
            ? this.sceneModel.getOrbitMarkerParent()
            : this.sceneModel.orbitPlane;
        const isOnOrbitPanel = !marker.userData.isMap2dLiteProxy
            && orbitMarkerParent
            && marker.parent === orbitMarkerParent;

        if (locationType === 'moon' || locationType === 'mars') {
            if (onResetCamera) onResetCamera();
        } else if (locationType === 'station' || locationType === 'marsShip') {
            if (isOnOrbitPanel) {
                if (onResetCamera) onResetCamera();
            } else {
                try {
                    window.globeController?.interactionController?.setPlanesVisibility?.(false);
                    window.globeController?.interactionController?.startFollowingStation?.(marker);
                } catch (_) {
                    if (onResetCamera) onResetCamera();
                }
            }
        } else if (onZoomToMarker) {
            onZoomToMarker(marker);
        }

        if (eventIndex < 0) {
            return false;
        }

        this.dismissPinnedMarkerCallout();

        const variantIdx = marker.userData.variantIndex ?? 0;
        if (window.globeController?.uiView) {
            window.globeController.uiView.currentEventMarker = marker;
        }

        if (window.standaloneEventSlide) {
            window.standaloneEventSlide.showEvent(eventIndex, { variantIndex: variantIdx });
        }

        if (window.SoundEffectsManager?.play) {
            window.SoundEffectsManager.play('eventClick');
        }
        return true;
    }

    _syncHoverCalloutFromMarker(marker) {
        if (!this.calloutService) return;
        if (!marker || !marker.userData || marker.userData.isLocked || marker.userData.isInteractive === false) {
            this.calloutService.hide();
            return;
        }
        if (typeof this.calloutService.show === 'function') {
            this.calloutService.show(marker);
        }
    }

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

        if (this._isEventInfoPanelOpen()) {
            if (this.hasPinnedCallout()) {
                this.dismissPinnedMarkerCallout();
            }
            return;
        }

        const isMapView = this.sceneModel.getMapViewEnabled?.() ?? !!this.sceneModel.isMapView;
        if (isMapView) {
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
                    this.dismissPinnedMarkerCallout();
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
                    this._syncEventsHoverPreviewFromMarker(null);
                    if (this.hasPinnedCallout()) {
                        this.highlightNumberButtonForMarker(this._pinnedCalloutMarker);
                    } else {
                        this.highlightNumberButtonForMarker(null);
                        this._syncHoverCalloutFromMarker(null);
                    }
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
                    this._syncEventsHoverPreviewFromMarker(null);
                    if (this.hasPinnedCallout()) {
                        this.highlightNumberButtonForMarker(this._pinnedCalloutMarker);
                    } else {
                        this.highlightNumberButtonForMarker(null);
                        this._syncHoverCalloutFromMarker(null);
                    }
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
                this._syncEventsHoverPreviewFromMarker(hoveredMarker);
                this.pinMarkerCallout(hoveredMarker);
                
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
            const currentHovered = this.pulseService.getHoveredMarker();
            if (currentHovered) {
                this.pulseService.stopEventMarkerPulse(currentHovered);
                this.pulseService.setHoveredMarker(null);
                this._syncEventsHoverPreviewFromMarker(null);

                if (this.hasPinnedCallout()) {
                    this.highlightNumberButtonForMarker(this._pinnedCalloutMarker);
                } else {
                    this.highlightNumberButtonForMarker(null);
                    this._syncHoverCalloutFromMarker(null);
                    if (this.sceneModel.getAutoRotateEnabled() && !this.sceneModel.eventMarker) {
                        this._maybeResumeAutoRotateAfterCalloutDismiss();
                    }
                }

                // Resume overlap cycling when hover ends
                if (window.globeEventMarkerManager && typeof window.globeEventMarkerManager.resumeOverlapCycling === 'function') {
                    window.globeEventMarkerManager.resumeOverlapCycling();
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

}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorldviewMarkerInteraction;
}

// Make globally accessible
if (typeof window !== 'undefined') {
    if (window.WorldviewMarkerInteractionHandlersMixin) {
        Object.assign(WorldviewMarkerInteraction.prototype, window.WorldviewMarkerInteractionHandlersMixin);
    }
    window.WorldviewMarkerInteraction = WorldviewMarkerInteraction;
    window.closeTimelineMusicFiltersPanelsIfOpen = closeWorldviewAuxPanels;
}
