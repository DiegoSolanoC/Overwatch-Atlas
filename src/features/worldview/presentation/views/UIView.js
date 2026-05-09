/**
 * UIView - Handles UI elements (labels, buttons, toggles)
 * Note: Glitch text functionality is now handled by GlitchTextService
 * Note: Event System features removed - Globe no longer handles events
 */

import { ImageOverlayManager } from './ImageOverlayManager.js';
import { HackedOverlayManager } from './HackedOverlayManager.js';
import { ToggleManager } from './ToggleManager.js';
import { CameraViewManager } from './CameraViewManager.js';
import { VariantMarkerManager } from './VariantMarkerManager.js';
import {
    updateEventSlideFactionTypeDisplay,
    updateEventSlideHeroRoleDisplay
} from '../../../system-interface/managers/helpers/EventSlideShowHelpers.js';

/**
 * UIView - Handles UI elements (labels, buttons, toggles)
 */
export class UIView {
    constructor(sceneModel, dataModel = null, globeView = null) {
        this.sceneModel = sceneModel;
        this.dataModel = dataModel; // Store reference to dataModel for pagination
        this.globeView = globeView; // Store reference to globeView for refreshing markers
        this.previousAutoRotateState = null; // Store previous auto-rotate state
        this.originalCameraPosition = null; // Store original camera position before zoom
        this.originalGlobeRotation = null; // Store original globe rotation before zoom
        
        // Initialize managers
        // NOTE: Event managers removed - Globe no longer handles events
        this.imageOverlayManager = new ImageOverlayManager(sceneModel, this);
        this.hackedOverlayManager = new HackedOverlayManager();
        this.toggleManager = new ToggleManager(sceneModel);
        this.cameraViewManager = new CameraViewManager(sceneModel, this);
        this.variantMarkerManager = new VariantMarkerManager(sceneModel);
    }

    /**
     * Show city name label
     * Delegates to CameraViewManager
     * @param {string} cityName - City name to display
     * @param {number} x - Screen X coordinate
     * @param {number} y - Screen Y coordinate
     */
    showCityLabel(cityName, x, y) {
        this.cameraViewManager.showCityLabel(cityName, x, y);
    }

    /**
     * Hide city label
     * Delegates to CameraViewManager
     */
    hideCityLabel() {
        this.cameraViewManager.hideCityLabel();
    }

    // NOTE: Glitch effect removed - Event System Load Out handles this
    
    /**
     * Toggle event image overlay visibility
     * Delegates to ImageOverlayManager
     */
    toggleEventImage() {
        this.imageOverlayManager.toggleEventImage();
    }
    
    /**
     * Show image overlay (with fade sequence)
     * Delegates to ImageOverlayManager
     */
    showImageOverlay() {
        this.imageOverlayManager.showImageOverlay();
    }
    
    /**
     * Hide image overlay (with fade sequence)
     * Delegates to ImageOverlayManager
     * @param {boolean} temporary - If true, doesn't change toggle state (for auto-hide)
     */
    hideImageOverlay(temporary = false) {
        this.imageOverlayManager.hideImageOverlay(temporary);
    }
    
    /**
     * Disable or enable UI buttons when image overlay is visible
     * Delegates to ImageOverlayManager
     * @param {boolean} disable - True to disable buttons, false to enable
     */
    disablePageNavigationButtons(disable) {
        this.imageOverlayManager.disablePageNavigationButtons(disable);
    }
    
    /**
     * Setup image overlay interaction handlers
     * Delegates to ImageOverlayManager
     */
    setupImageOverlayHandlers(eventImageOverlay) {
        this.imageOverlayManager.setupImageOverlayHandlers(eventImageOverlay);
    }
    
    /**
     * Called when globe dragging starts - hide image if toggle is on
     * Delegates to ImageOverlayManager
     */
    onGlobeDragStart() {
        this.imageOverlayManager.onGlobeDragStart();
    }
    
    /**
     * Check if camera/globe is still and recentered, then auto-show image if toggle is on
     * Delegates to ImageOverlayManager
     * This should be called from the animation loop
     */
    checkAndAutoShowImage() {
        this.imageOverlayManager.checkAndAutoShowImage();
    }

    /**
     * Show event slide (for Map2DLiteLayer compatibility)
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
        // This is called by Map2DLiteLayer when clicking markers
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

        // Globe / dock list path does not run EventSlideManager or standalone displaySlide — still show title, body, and factions type.
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
     * Hide event slide (for Map2DLiteLayer compatibility)
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
        // This is called by Map2DLiteLayer when clicking markers
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
     * Delegates to CameraViewManager
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
     * Delegates to CameraViewManager
     */
    animateCameraToPosition(camera, targetPosition, globe) {
        this.cameraViewManager.animateCameraToPosition(camera, targetPosition, globe);
    }

    /**
     * Update label position to follow marker
     * Delegates to CameraViewManager
     */
    updateLabelPosition() {
        this.cameraViewManager.updateLabelPosition();
    }

    /**
     * Setup auto-rotate toggle
     * Delegates to ToggleManager
     */
    setupAutoRotateToggle() {
        this.toggleManager.setupAutoRotateToggle();
    }

    /**
     * Setup hyperloop toggle
     * Delegates to ToggleManager
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
     * Delegates to HackedOverlayManager
     */
    showHackedOverlay() {
        this.hackedOverlayManager.showHackedOverlay();
    }
    
    /**
     * Show variant markers for a multi-event
     * Delegates to VariantMarkerManager
     * @param {Object} eventData - The event data object
     */
    showVariantMarkers(eventData) {
        this.variantMarkerManager.showVariantMarkers(eventData);
    }
    
    /**
     * Hide variant markers for a multi-event
     * Delegates to VariantMarkerManager
     * @param {Object} eventData - The event data object
     */
    hideVariantMarkers(eventData) {
        this.variantMarkerManager.hideVariantMarkers(eventData);
    }
}

