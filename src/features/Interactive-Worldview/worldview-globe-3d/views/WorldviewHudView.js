/**
 * WorldviewHudView - Handles UI elements (labels, buttons, toggles)
 * Note: Glitch text is handled by `window.GlitchTextService` (`utils/slide-effects/GlitchTextOverlay.js`).
 * Note: Event System features removed - Globe no longer handles events
 */

import { WorldviewImageOverlay } from './WorldviewImageOverlay.js';
import { WorldviewHackOverlay } from './WorldviewHackOverlay.js';
import { WorldviewGlobeToggles } from '../../worldview-controls-ui/runtime/WorldviewGlobeToggles.js';
import { WorldviewCameraViews } from './WorldviewCameraViews.js';
import { WorldviewVariantMarkerLayer } from './WorldviewVariantMarkerLayer.js';
import {
    updateEventSlideFactionTypeDisplay,
    updateEventSlideHeroRoleDisplay
} from '../../../system-interface/interface-info-display/eventSlideMetaDisplays.js';

/**
 * WorldviewHudView - Handles UI elements (labels, buttons, toggles)
 */
export class WorldviewHudView {
    constructor(sceneModel, dataModel = null, globeView = null) {
        this.sceneModel = sceneModel;
        this.dataModel = dataModel; // Store reference to dataModel for pagination
        this.globeView = globeView; // Store reference to globeView for refreshing markers
        this.previousAutoRotateState = null; // Store previous auto-rotate state
        this.originalCameraPosition = null; // Store original camera position before zoom
        this.originalGlobeRotation = null; // Store original globe rotation before zoom
        
        // Initialize managers
        // NOTE: Event managers removed - Globe no longer handles events
        this.imageOverlayManager = new WorldviewImageOverlay(sceneModel, this);
        this.hackedOverlayManager = new WorldviewHackOverlay();
        this.toggleManager = new WorldviewGlobeToggles(sceneModel);
        this.cameraViewManager = new WorldviewCameraViews(sceneModel, this);
        this.variantMarkerManager = new WorldviewVariantMarkerLayer(sceneModel);
    }

    /**
     * Show city name label
     * Delegates to WorldviewCameraViews
     * @param {string} cityName - City name to display
     * @param {number} x - Screen X coordinate
     * @param {number} y - Screen Y coordinate
     */
    showCityLabel(cityName, x, y) {
        this.cameraViewManager.showCityLabel(cityName, x, y);
    }

    /**
     * Hide city label
     * Delegates to WorldviewCameraViews
     */
    hideCityLabel() {
        this.cameraViewManager.hideCityLabel();
    }

    // NOTE: Glitch effect removed - Event System Load Out handles this
    
    /**
     * Toggle event image overlay visibility
     * Delegates to WorldviewImageOverlay
     */
    toggleEventImage() {
        this.imageOverlayManager.toggleEventImage();
    }
    
    /**
     * Show image overlay (with fade sequence)
     * Delegates to WorldviewImageOverlay
     */
    showImageOverlay() {
        this.imageOverlayManager.showImageOverlay();
    }
    
    /**
     * Hide image overlay (with fade sequence)
     * Delegates to WorldviewImageOverlay
     * @param {boolean} temporary - If true, doesn't change toggle state (for auto-hide)
     */
    hideImageOverlay(temporary = false) {
        this.imageOverlayManager.hideImageOverlay(temporary);
    }
    
    /**
     * Disable or enable UI buttons when image overlay is visible
     * Delegates to WorldviewImageOverlay
     * @param {boolean} disable - True to disable buttons, false to enable
     */
    disablePageNavigationButtons(disable) {
        this.imageOverlayManager.disablePageNavigationButtons(disable);
    }
    
    /**
     * Setup image overlay interaction handlers
     * Delegates to WorldviewImageOverlay
     */
    setupImageOverlayHandlers(eventImageOverlay) {
        this.imageOverlayManager.setupImageOverlayHandlers(eventImageOverlay);
    }
    
    /**
     * Called when globe dragging starts - hide image if toggle is on
     * Delegates to WorldviewImageOverlay
     */
    onGlobeDragStart() {
        this.imageOverlayManager.onGlobeDragStart();
    }
    
    /**
     * Check if camera/globe is still and recentered, then auto-show image if toggle is on
     * Delegates to WorldviewImageOverlay
     * This should be called from the animation loop
     */
    checkAndAutoShowImage() {
        this.imageOverlayManager.checkAndAutoShowImage();
    }

    /**
     * Show event slide (for WorldviewMapLiteLayer compatibility)
     * Routes to simple dock-like implementation on desktop, standalone on mobile portrait
     * @param {string} eventName - Event name
     * @param {string} eventImage - Event image path
     * @param {string} desc - Event description
     * @param {Object} stub - Marker stub
     * @param {Object} fullEvent - Full event data
     */
    showEventSlide(eventName, eventImage, desc, stub, fullEvent) {
        // Detect mobile portrait viewport (actual touch device, not DevTools emulation)
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isMobilePortrait = isTouchDevice && window.innerWidth <= 768 && window.innerHeight > window.innerWidth;

        if (isMobilePortrait && window.standaloneEventSlide) {
            // Mobile portrait: resolve index in the same list the marker / slide row came from (story globe vs active archive)
            const activeList = window.eventManager?.events || [];
            const dockList = window.eventManager?.getDockTimelineEvents?.() || [];
            let eventIndex = activeList.indexOf(fullEvent);
            let list = activeList;
            if (eventIndex < 0) {
                eventIndex = dockList.indexOf(fullEvent);
                list = dockList;
            }
            if (eventIndex >= 0) {
                window.standaloneEventSlide.showEvent(
                    eventIndex,
                    list === dockList ? {} : { eventList: list }
                );
                return;
            }
        }

        // Desktop / mobile landscape: use simple dock-like implementation
        this._showEventSlideSimple(eventName, eventImage, desc, stub, fullEvent);
    }

    /**
     * Simple dock-like implementation (CSS toggle only)
     * Used on desktop and mobile landscape
     */
    _showEventSlideSimple(eventName, eventImage, desc, stub, fullEvent) {
        // This is called by WorldviewMapLiteLayer when clicking markers
        // Store the current event marker for reference
        this.currentEventMarker = stub;

        // Mutual exclusion: opening Event Info closes Filters.
        const filtersPanel = document.getElementById('filtersPanel');
        const filtersToggle = document.getElementById('filtersToggle');
        if (filtersPanel?.classList.contains('open')) {
            filtersPanel.classList.remove('open');
            filtersToggle?.classList.remove('active');
        }

        // Open the event slide panel (left-side panel with event details)
        const eventSlide = document.getElementById('eventSlide');
        if (eventSlide) {
            eventSlide.classList.add('open');
            // Reset display property to ensure it's visible
            eventSlide.style.display = '';
        }

        // Set the image source if provided
        if (eventImage) {
            const eventImageEl = document.getElementById('eventImage');
            if (eventImageEl) {
                eventImageEl.src = eventImage;
                eventImageEl.style.display = '';
            }
        }

        // Globe / dock list path does not run standalone `displaySlide` — still show title, body, and factions type.
        const eventSlideTitle = document.getElementById('eventSlideTitle');
        const eventSlideText = document.getElementById('eventSlideText');
        if (eventSlideTitle && eventName != null) {
            eventSlideTitle.innerHTML =
                typeof eventName === 'string' ? eventName : String(eventName);
        }
        if (eventSlideText) {
            const body = desc != null && String(desc).trim() !== '' ? String(desc) : 'No description available.';
            eventSlideText.innerHTML = body;
        }
        const variantIdx =
            stub && stub.userData && stub.userData.variantIndex != null
                ? Number(stub.userData.variantIndex)
                : 0;
        if (fullEvent) {
            const v = Number.isFinite(variantIdx) ? variantIdx : 0;
            updateEventSlideFactionTypeDisplay(fullEvent, v);
            updateEventSlideHeroRoleDisplay(fullEvent, v);
        } else {
            updateEventSlideFactionTypeDisplay(null, 0);
            updateEventSlideHeroRoleDisplay(null, 0);
        }

        // Show the image overlay
        this.imageOverlayManager.showImageOverlay();
    }

    /**
     * Hide event slide (for WorldviewMapLiteLayer compatibility)
     * Handles both simple dock-like and standalone implementations
     */
    hideEventSlide() {
        // Detect mobile portrait viewport (actual touch device, not DevTools emulation)
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isMobilePortrait = isTouchDevice && window.innerWidth <= 768 && window.innerHeight > window.innerWidth;

        if (isMobilePortrait && window.standaloneEventSlide?.cancelEdit) {
            // Mobile portrait: use standalone implementation's close logic
            window.standaloneEventSlide.cancelEdit();
            const eventSlide = document.getElementById('eventSlide');
            if (eventSlide) {
                eventSlide.classList.remove('open');
            }
            if (window.standaloneEventSlide?.hideImageOverlay) {
                window.standaloneEventSlide.hideImageOverlay();
            }
        } else {
            // Desktop / mobile landscape: use simple dock-like implementation
            this._hideEventSlideSimple();
        }
    }

    /**
     * Simple dock-like hide implementation
     * Used on desktop and mobile landscape
     */
    _hideEventSlideSimple() {
        // This is called by WorldviewMapLiteLayer when clicking markers
        // Clear the current event marker
        this.currentEventMarker = null;

        updateEventSlideFactionTypeDisplay(null, 0);
        updateEventSlideHeroRoleDisplay(null, 0);

        // Stop hover radiate loop
        if (window.globeController?.map2dLite?.stopHoverRadiateLoop) {
            window.globeController.map2dLite.stopHoverRadiateLoop();
        }
        // Clear synthetic marker hover
        if (window.globeController?.map2dLite?.clearSyntheticMarkerHover) {
            window.globeController.map2dLite.clearSyntheticMarkerHover();
        }
        // Clear hover state
        if (window.globeController?.interactionController) {
            window.globeController.interactionController.hoveredEventMarker = null;
        }
        if (window.globeController?.markerPulseService) {
            window.globeController.markerPulseService.hoveredEventMarker = null;
        }

        // Close the event slide panel (match X button behavior)
        const eventSlide = document.getElementById('eventSlide');
        if (eventSlide) {
            eventSlide.classList.remove('open');
        }

        // Play sound effect (match X button behavior)
        if (window.SoundEffectsManager?.play) {
            window.SoundEffectsManager.play('eventClick');
        }

        // Reset globe immediately when closing
        this.resetToDefault();

        // Hide the image overlay
        this.imageOverlayManager.hideImageOverlay();
    }

    /**
     * Zoom out from event and restore original camera position and globe rotation
     * Delegates to WorldviewCameraViews
     */
    zoomOutFromEvent() {
        this.cameraViewManager.zoomOutFromEvent();
    }

    /**
     * Reset zoom and camera to default view
     */
    resetToDefault() {
        this.cameraViewManager.resetToDefault();
    }
    
    /**
     * Animate camera to a specific position
     * Delegates to WorldviewCameraViews
     */
    animateCameraToPosition(camera, targetPosition, globe) {
        this.cameraViewManager.animateCameraToPosition(camera, targetPosition, globe);
    }

    /**
     * Update label position to follow marker
     * Delegates to WorldviewCameraViews
     */
    updateLabelPosition() {
        this.cameraViewManager.updateLabelPosition();
    }

    /**
     * Setup auto-rotate toggle
     * Delegates to WorldviewGlobeToggles
     */
    setupAutoRotateToggle() {
        this.toggleManager.setupAutoRotateToggle();
    }

    /**
     * Setup hyperloop toggle
     * Delegates to WorldviewGlobeToggles
     * @param {Function} onToggle - Callback when toggle changes
     */
    setupHyperloopToggle(onToggle) {
        this.toggleManager.setupHyperloopToggle(onToggle);
    }

    /**
     * @param {Function} [onToggle]
     */
    setupWeatherEffectsToggle(onToggle) {
        this.toggleManager.setupWeatherEffectsToggle(onToggle);
    }

    /**
     * @param {Function} [onToggle]
     */
    setupLightingToggle(onToggle) {
        this.toggleManager.setupLightingToggle(onToggle);
    }

    /**
     * Setup globe <-> map view toggle
     */
    setupMapViewToggle() {
        this.toggleManager.setupMapViewToggle();
    }
    
    /**
     * Start glitch animation for glitchy text overlays
     * Constantly changes the random characters in the overlay
     */
    /**
     * Start glitch animation (delegates to GlitchTextService)
     */
    startGlitchAnimation() {
        if (window.GlitchTextService) {
            window.GlitchTextService.startAnimation();
        }
    }
    
    /**
     * Stop glitch animation (delegates to GlitchTextService)
     */
    stopGlitchAnimation() {
        if (window.GlitchTextService) {
            window.GlitchTextService.stopAnimation();
        }
    }
    
    /**
     * Show hacked image overlay over glitchy text
     * Delegates to WorldviewHackOverlay
     */
    showHackedOverlay() {
        this.hackedOverlayManager.showHackedOverlay();
    }
    
    /**
     * Show variant markers for a multi-event
     * Delegates to WorldviewVariantMarkerLayer
     * @param {Object} eventData - The event data object
     */
    showVariantMarkers(eventData) {
        this.variantMarkerManager.showVariantMarkers(eventData);
    }
    
    /**
     * Hide variant markers for a multi-event
     * Delegates to WorldviewVariantMarkerLayer
     * @param {Object} eventData - The event data object
     */
    hideVariantMarkers(eventData) {
        this.variantMarkerManager.hideVariantMarkers(eventData);
    }
}

