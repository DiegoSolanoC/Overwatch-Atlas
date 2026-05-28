/**
 * WorldviewImageOverlay - Manages event image overlay visibility, auto-show/hide, and stillness detection
 */

export class WorldviewImageOverlay {
    constructor(sceneModel, uiView) {
        this.sceneModel = sceneModel;
        this.uiView = uiView; // Reference to WorldviewHudView for accessing currentEventMarker
        
        // State
        this.imageOverlayVisible = false;
        this.imageToggleState = false;
        this.imageAutoHideTimeout = null;
        this.lastGlobeRotation = null;
        this._camPosNow = new THREE.Vector3();
        this._camPosLast = new THREE.Vector3();
        this._hasCamMovementSample = false;
        this._markerWorldScratch = new THREE.Vector3();
        this._targetDirScratch = new THREE.Vector3();
        this._camDirScratch = new THREE.Vector3();
        this.stillnessStartTime = null;
        this.wasDragging = false;
    }
    
    /**
     * Toggle event image overlay visibility
     * This sets the toggle state, which controls whether auto-show/hide behavior is active
     * Also syncs with global image toggle state
     */
    toggleEventImage() {
        const eventImageOverlay = document.getElementById('eventImageOverlay');
        const eventImage = document.getElementById('eventImage');
        const imageToggleBtn = document.getElementById('eventImageToggle');
        
        if (!eventImageOverlay) return;

        if (window.SoundEffectsManager) {
            window.SoundEffectsManager.play('imageDisplay');
        }

        // Toggle the state
        this.imageToggleState = !this.imageToggleState;
        
        // Sync with global toggle state
        localStorage.setItem('globalImageToggle', this.imageToggleState.toString());
        
        // Update global toggle button visual state
        const globalImageToggleBtn = document.getElementById('globalImageToggle');
        if (globalImageToggleBtn) {
            const labelEl = globalImageToggleBtn.querySelector('.globe-control-btn__label');
            if (labelEl) {
                labelEl.textContent = this.imageToggleState ? 'Image On' : 'Image Off';
            }
            if (this.imageToggleState) {
                globalImageToggleBtn.classList.add('active');
            } else {
                globalImageToggleBtn.classList.remove('active');
            }
        }
        
        if (this.imageToggleState) {
            // Toggle ON: show image
            this.showImageOverlay();
            if (imageToggleBtn) {
                imageToggleBtn.textContent = 'Hide Image';
            }
        } else {
            // Toggle OFF: hide image
            this.hideImageOverlay();
            if (imageToggleBtn) {
                imageToggleBtn.textContent = 'Show Image';
            }
        }
    }
    
    /**
     * Show image overlay (with fade sequence)
     */
    showImageOverlay() {
        const eventImageOverlay = document.getElementById('eventImageOverlay');
        const eventImage = document.getElementById('eventImage');

        if (!eventImageOverlay) return;

        // Clear any pending auto-show timeout
        if (this.imageAutoHideTimeout) {
            clearTimeout(this.imageAutoHideTimeout);
            this.imageAutoHideTimeout = null;
        }

        // Reset display and opacity for opening
        eventImageOverlay.style.display = '';
        eventImageOverlay.style.opacity = '';
        eventImageOverlay.style.setProperty('pointer-events', '');

        // Show: show overlay, fade to black, then fade in image
        eventImageOverlay.classList.remove('fade-out');
        eventImageOverlay.classList.add('open');

        setTimeout(() => {
            eventImageOverlay.classList.add('fade-in');

            if (eventImage && eventImage.style.display !== 'none') {
                setTimeout(() => {
                    eventImage.classList.remove('fade-out');
                    eventImage.classList.add('fade-in');

                    // Disable page navigation buttons when image is fully visible
                    // Wait for image fade-in to complete (600ms transition)
                    setTimeout(() => {
                        this.disablePageNavigationButtons(true);
                    }, 600);
                }, 600);
            } else {
                // No image - disable buttons after overlay fade-in completes
                setTimeout(() => {
                    this.disablePageNavigationButtons(true);
                }, 600);
            }

            this.imageOverlayVisible = true;
        }, 50);
    }
    
    /**
     * Hide image overlay (with fade sequence)
     * @param {boolean} temporary - If true, doesn't change toggle state (for auto-hide)
     */
    hideImageOverlay(temporary = false) {
        const eventImageOverlay = document.getElementById('eventImageOverlay');
        const eventImage = document.getElementById('eventImage');

        if (!eventImageOverlay) return;

        // Re-enable page navigation buttons immediately when hiding starts
        this.disablePageNavigationButtons(false);

        // Disable pointer events immediately
        eventImageOverlay.style.setProperty('pointer-events', 'none');

        // Stop hover radiate sound loop
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

        // Gradual fade-out (same approach as standaloneEventSlide)
        const startTime = Date.now();
        const fadeInterval = 50;
        const durationMs = 600;
        
        const fadeTimer = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / durationMs, 1);
            // Ease-out curve for smooth disappearance
            const eased = 1 - (1 - progress) * (1 - progress);
            const opacity = 1 - eased;
            
            eventImageOverlay.style.opacity = String(opacity);
            if (eventImage) {
                eventImage.style.opacity = String(opacity);
            }
            
            if (progress >= 1) {
                clearInterval(fadeTimer);
                eventImageOverlay.style.opacity = '0';
                eventImageOverlay.classList.remove('open', 'slide-open');
                eventImageOverlay.style.display = 'none';
                if (eventImage) {
                    eventImage.style.opacity = '0';
                    eventImage.style.display = 'none';
                    eventImage.src = '';
                }
                this.imageOverlayVisible = false;

                // If temporary hide, don't change toggle state
                if (!temporary) {
                    this.imageToggleState = false;
                }

                // Passive "Now playing" badge was hidden while overlay was open — restore if appropriate.
                if (window.MusicManager && typeof window.MusicManager.updateNowPlaying === 'function') {
                    try {
                        window.MusicManager.updateNowPlaying();
                    } catch (_) {}
                }
            }
        }, fadeInterval);
    }
    
    /**
     * Disable or enable UI buttons when image overlay is visible
     * @param {boolean} disable - True to disable buttons, false to enable
     */
    disablePageNavigationButtons(disable) {
        // Fade-in callbacks schedule disable(true) on timers. If the user closes the slide first,
        // those callbacks must not re-lock pagination (slide is no longer "open").
        if (disable) {
            const slide = document.getElementById('eventSlide');
            if (!slide || !slide.classList.contains('open')) {
                return;
            }
        }

        // Helper function to disable/enable a button with visual feedback
        const setButtonState = (button, isDisabled) => {
            if (!button) return;
            
            if (isDisabled && !button.hasAttribute('data-original-disabled')) {
                // Store original disabled state
                const wasDisabled = button.disabled;
                button.setAttribute('data-original-disabled', wasDisabled ? 'true' : 'false');
                button.disabled = true;
                // Add visual indication
                button.style.opacity = '0.4';
                button.style.cursor = 'not-allowed';
                button.style.pointerEvents = 'none';
            } else if (!isDisabled && button.hasAttribute('data-original-disabled')) {
                // Restore original disabled state
                const wasOriginallyDisabled = button.getAttribute('data-original-disabled') === 'true';
                button.disabled = wasOriginallyDisabled;
                button.removeAttribute('data-original-disabled');
                // Remove visual indication
                button.style.opacity = '';
                button.style.cursor = '';
                button.style.pointerEvents = '';
            }
        };
        
        // Page navigation buttons
        const prevPageBtn = document.getElementById('prevPageBtn');
        const nextPageBtn = document.getElementById('nextPageBtn');
        const pageInput = document.getElementById('pageInput');
        
        setButtonState(prevPageBtn, disable);
        setButtonState(nextPageBtn, disable);
        
        // Page input (go to page)
        if (pageInput) {
            if (disable && !pageInput.hasAttribute('data-original-disabled')) {
                pageInput.setAttribute('data-original-disabled', pageInput.disabled ? 'true' : 'false');
                pageInput.disabled = true;
                pageInput.style.opacity = '0.4';
                pageInput.style.cursor = 'not-allowed';
            } else if (!disable && pageInput.hasAttribute('data-original-disabled')) {
                const wasOriginallyDisabled = pageInput.getAttribute('data-original-disabled') === 'true';
                pageInput.disabled = wasOriginallyDisabled;
                pageInput.removeAttribute('data-original-disabled');
                pageInput.style.opacity = '';
                pageInput.style.cursor = '';
            }
        }

        // Page slider: keep usable while event info is open (same as thumbnails).

        // Thumbnails + page slider: clear any stale lock from older builds or same-tab edge cases.
        if (!disable) {
            const pageSlider = document.getElementById('eventPageSlider');
            if (pageSlider && pageSlider.hasAttribute('data-original-disabled')) {
                const wasOriginallyDisabled = pageSlider.getAttribute('data-original-disabled') === 'true';
                pageSlider.disabled = wasOriginallyDisabled;
                pageSlider.removeAttribute('data-original-disabled');
                pageSlider.style.opacity = '';
                pageSlider.style.cursor = '';
            }

            const numberButtonsContainer = document.getElementById('eventNumberButtons');
            if (numberButtonsContainer) {
                numberButtonsContainer.querySelectorAll('.event-number-btn').forEach((btn) => {
                    if (!btn.hasAttribute('data-original-disabled')) return;
                    const wasOriginallyDisabled = btn.getAttribute('data-original-disabled') === 'true';
                    btn.disabled = wasOriginallyDisabled;
                    btn.removeAttribute('data-original-disabled');
                    if (!btn.classList.contains('locked')) {
                        btn.style.opacity = '';
                        btn.style.cursor = '';
                        btn.style.pointerEvents = '';
                    }
                });
            }
        }

        // Globe control buttons
        const musicToggle = document.getElementById('musicToggle');
        const colorPaletteToggle = document.getElementById('colorPaletteToggle');
        const exitButton = document.getElementById('exitButton');
        const eventsManageToggle = document.getElementById('eventsManageToggle');
        const filtersToggle = document.getElementById('filtersToggle');
        const hyperloopToggle = document.getElementById('hyperloopToggle');
        const autoRotateToggle = document.getElementById('autoRotateToggle');
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomResetBtn = document.getElementById('zoomResetBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');

        // Desktop: header controls stay usable while an event image is shown (legacy overlay lock).
        // Mobile: only palette + music stay on the header — keep those enabled; lock the rest.
        const isMobileViewport =
            typeof window !== 'undefined' &&
            window.matchMedia &&
            window.matchMedia('(max-width: 768px)').matches;
        const disableGlobeChrome =
            disable && isMobileViewport;

        const setGlobeButtonState = (button) => {
            if (!button) return;
            if (disableGlobeChrome && (button === musicToggle || button === colorPaletteToggle)) {
                return;
            }
            setButtonState(button, disableGlobeChrome);
        };

        setGlobeButtonState(musicToggle);
        setGlobeButtonState(colorPaletteToggle);
        setGlobeButtonState(exitButton);
        setGlobeButtonState(eventsManageToggle);
        setGlobeButtonState(filtersToggle);
        setGlobeButtonState(hyperloopToggle);
        setGlobeButtonState(autoRotateToggle);
        setGlobeButtonState(zoomInBtn);
        setGlobeButtonState(zoomResetBtn);
        setGlobeButtonState(zoomOutBtn);
    }
    
    /**
     * Setup image overlay interaction handlers
     * - Clicking the image hides it temporarily (5 seconds, then auto-restore)
     * - Globe dragging also hides the image
     */
    setupImageOverlayHandlers(eventImageOverlay) {
        if (!eventImageOverlay) return;
        
        // Click on image overlay to hide temporarily (5 second auto-restore)
        eventImageOverlay.addEventListener('click', (e) => {
            // Only hide if clicking the image itself (not other controls)
            if (e.target === eventImageOverlay || e.target.tagName === 'IMG') {
                e.stopPropagation();
                this.hideImageOverlayTemporarily(5000); // 5 seconds
            }
        });
    }
    
    /**
     * Hide image overlay temporarily with auto-restore after delay
     * @param {number} delayMs - Milliseconds before auto-restoring (default 5000)
     */
    hideImageOverlayTemporarily(delayMs = 5000) {
        console.log('[DEBUG WorldviewImageOverlay] hideImageOverlayTemporarily called, imageOverlayVisible:', this.imageOverlayVisible);
        if (!this.imageOverlayVisible) return;
        
        console.log('[DEBUG WorldviewImageOverlay] Calling hideImageOverlay with temporary=true');
        // Hide temporarily (preserves toggle state)
        this.hideImageOverlay(true);
        
        // Clear any existing auto-show timeout
        if (this.imageAutoHideTimeout) {
            clearTimeout(this.imageAutoHideTimeout);
            this.imageAutoHideTimeout = null;
        }
        
        // Schedule auto-restore after delay
        if (this.imageToggleState) {
            this.imageAutoHideTimeout = setTimeout(() => {
                if (this.imageToggleState && !this.imageOverlayVisible) {
                    this.showImageOverlay();
                }
            }, delayMs);
        }
    }
    
    /**
     * Called when globe dragging starts - hide image if visible
     * Always allows hiding by dragging, regardless of toggle state
     */
    onGlobeDragStart() {
        // Hide image whenever it's visible (allows drag-to-hide at any time)
        if (this.imageOverlayVisible) {
            this.hideImageOverlay(true); // Temporary hide (preserves toggle state)
            
            // Clear any pending auto-show timeout
            if (this.imageAutoHideTimeout) {
                clearTimeout(this.imageAutoHideTimeout);
                this.imageAutoHideTimeout = null;
            }
        }
    }
    
    /**
     * Check if camera/globe is still and recentered, then auto-show image if toggle is on
     * This should be called from the animation loop
     */
    checkAndAutoShowImage() {
        // Only check if toggle is on and image is currently hidden
        if (!this.imageToggleState || this.imageOverlayVisible) {
            this.stillnessStartTime = null;
            return;
        }
        
        // Only check if we're viewing an event
        if (!this.sceneModel.eventMarker || !this.uiView.currentEventMarker) {
            this.stillnessStartTime = null;
            return;
        }
        
        const camera = this.sceneModel.getCamera();
        const globe = this.sceneModel.getGlobe();
        
        if (!camera || !globe) return;
        
        // Check if auto-rotate has stopped (meaning we're recentered)
        // When auto-rotate stops, it means we've reached the target
        const isAutoRotating = this.sceneModel.getAutoRotate();
        
        // Check if user is dragging (manual interaction)
        const isDragging = this.sceneModel.isDraggingState();
        
        // If dragging just started (wasn't dragging before, now is), hide image
        // This is a backup check - onGlobeDragStart should handle it, but this ensures consistency
        if (isDragging && !this.wasDragging && this.imageOverlayVisible) {
            this.hideImageOverlay(true); // Temporary hide
            
            // Clear any pending auto-show timeout
            if (this.imageAutoHideTimeout) {
                clearTimeout(this.imageAutoHideTimeout);
                this.imageAutoHideTimeout = null;
            }
            
            // Reset stillness tracking
            this.stillnessStartTime = null;
        }
        
        // Update dragging state
        this.wasDragging = isDragging;
        
        // If currently dragging, don't check for auto-show
        if (isDragging) {
            return;
        }
        
        this._camPosNow.copy(camera.position);
        const currentGlobeRot = {
            x: globe.rotation.x,
            y: globe.rotation.y,
            z: globe.rotation.z
        };

        const movementThreshold = 0.005;
        let hasMovedSignificantly = false;

        if (this._hasCamMovementSample && this.lastGlobeRotation) {
            const cameraMovement = this._camPosNow.distanceTo(this._camPosLast);
            const globeRotDiff = Math.abs(currentGlobeRot.x - this.lastGlobeRotation.x) +
                                Math.abs(currentGlobeRot.y - this.lastGlobeRotation.y) +
                                Math.abs(currentGlobeRot.z - this.lastGlobeRotation.z);
            if (cameraMovement > movementThreshold || globeRotDiff > movementThreshold) {
                hasMovedSignificantly = true;
            }
        }

        this._camPosLast.copy(this._camPosNow);
        this.lastGlobeRotation = { ...currentGlobeRot };
        this._hasCamMovementSample = true;

        const curMarker = this.uiView.currentEventMarker;
        let isRecentered = true;
        if (!curMarker.userData || !curMarker.userData.isMap2dLiteProxy) {
            curMarker.getWorldPosition(this._markerWorldScratch);
            this._targetDirScratch.copy(this._markerWorldScratch).normalize();
            this._camDirScratch.copy(camera.position).normalize();
            const targetDirection = this._targetDirScratch;
            const cameraDirection = this._camDirScratch;

            const currentLat = Math.asin(cameraDirection.y);
            const currentLon = Math.atan2(cameraDirection.z, cameraDirection.x);
            const targetLat = Math.asin(targetDirection.y);
            const targetLon = Math.atan2(targetDirection.z, targetDirection.x);

            const latDiff = targetLat - currentLat;
            let lonDiff = targetLon - currentLon;
            if (lonDiff > Math.PI) lonDiff -= 2 * Math.PI;
            if (lonDiff < -Math.PI) lonDiff += 2 * Math.PI;

            const angleDiff = Math.abs(latDiff) + Math.abs(lonDiff);
            isRecentered = angleDiff < 0.02;
        }
        
        // Conditions for showing image:
        // 1. Not dragging (user stopped interacting)
        // 2. Auto-rotate has stopped (meaning we reached target and stopped moving)
        // 3. Recentered on marker (double-check)
        // 4. Not moving significantly (momentum has settled)
        const shouldCheckStillness = !isDragging && !isAutoRotating && isRecentered && !hasMovedSignificantly;
        
        // If conditions not met, reset stillness timer
        if (!shouldCheckStillness) {
            this.stillnessStartTime = null;
            return;
        }
        
        // If conditions met, start/update stillness timer
        if (!this.stillnessStartTime) {
            this.stillnessStartTime = Date.now();
        }
        
        // If still for 0.5 seconds, show image
        const stillnessDuration = 500; // 0.5 seconds (reduced from 1 second)
        const elapsedStill = Date.now() - this.stillnessStartTime;
        
        if (elapsedStill >= stillnessDuration) {
            // Only trigger once - check if we already set a timeout
            if (!this.imageAutoHideTimeout) {
                // Show image immediately (no delay)
                if (this.imageToggleState && !this.imageOverlayVisible) {
                    this.showImageOverlay();
                }
                this.imageAutoHideTimeout = null;
                // Reset stillness timer so it can trigger again if needed
                this.stillnessStartTime = null;
            }
        }
    }
}
