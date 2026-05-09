/**
 * ImageOverlayService - Handles event image overlay display, hiding, and auto-show behavior
 */
class ImageOverlayService {
    constructor(sceneModel) {
        this.sceneModel = sceneModel;
        this.imageOverlayVisible = false;
        this.imageToggleState = false;
        this.imageAutoHideTimeout = null;
        this.lastCameraPosition = null;
        this.lastGlobeRotation = null;
        this.stillnessStartTime = null;
        this.wasDragging = false;
        this.currentEventMarker = null;
        this.disableButtonsCallback = null; // Callback to disable/enable buttons
    }

    setDisableButtonsCallback(callback) {
        this.disableButtonsCallback = callback;
    }

    setCurrentEventMarker(marker) {
        this.currentEventMarker = marker;
    }

    toggle() {
        const eventImageOverlay = document.getElementById('eventImageOverlay');
        const imageToggleBtn = document.getElementById('eventImageToggle');
        
        if (!eventImageOverlay) return;
        
        // Play sound effect
        if (window.SoundEffectsManager) {
            window.SoundEffectsManager.play('switchMap');
        }
        
        // Toggle the state
        this.imageToggleState = !this.imageToggleState;
        
        if (this.imageToggleState) {
            // Toggle ON: show image
            this.show();
            if (imageToggleBtn) {
                imageToggleBtn.textContent = 'Hide Image';
            }
        } else {
            // Toggle OFF: hide image
            this.hide(false);
            if (imageToggleBtn) {
                imageToggleBtn.textContent = 'Show Image';
            }
        }
    }

    show() {
        const eventImageOverlay = document.getElementById('eventImageOverlay');
        const eventImage = document.getElementById('eventImage');
        
        if (!eventImageOverlay) return;
        
        // Clear any pending auto-show timeout
        if (this.imageAutoHideTimeout) {
            clearTimeout(this.imageAutoHideTimeout);
            this.imageAutoHideTimeout = null;
        }
        
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
                        if (this.disableButtonsCallback) {
                            this.disableButtonsCallback(true);
                        }
                    }, 600);
                }, 600);
            } else {
                // No image - disable buttons after overlay fade-in completes
                setTimeout(() => {
                    if (this.disableButtonsCallback) {
                        this.disableButtonsCallback(true);
                    }
                }, 600);
            }
            
            this.imageOverlayVisible = true;
        }, 50);
    }

    hide(temporary = false) {
        const eventImageOverlay = document.getElementById('eventImageOverlay');
        const eventImage = document.getElementById('eventImage');
        
        if (!eventImageOverlay) return;
        
        // Re-enable page navigation buttons immediately when hiding starts
        if (this.disableButtonsCallback) {
            this.disableButtonsCallback(false);
        }
        
        // Hide: fade out image, then fade to black, then hide overlay
        // Start fade immediately for faster response
        if (eventImage && eventImage.style.display !== 'none') {
            eventImage.classList.remove('fade-in');
            eventImage.classList.add('fade-out');
        }
        
        // Start overlay fade immediately (don't wait for image fade)
        eventImageOverlay.classList.remove('fade-in');
        eventImageOverlay.classList.add('fade-out');
        
        // After fade completes, hide overlay
        setTimeout(() => {
            eventImageOverlay.classList.remove('open', 'fade-out');
            if (eventImage) {
                eventImage.classList.remove('fade-out');
            }
            this.imageOverlayVisible = false;
            
            // If temporary hide, don't change toggle state
            if (!temporary) {
                this.imageToggleState = false;
            }
        }, 350); // Faster fade-out (matches CSS transition of 0.3s + small buffer)
    }

    setupHandlers(eventImageOverlay) {
        // No direct handlers needed - dragging is detected via sceneModel.isDraggingState()
        // in the checkAndAutoShowImage method
    }

    onGlobeDragStart() {
        // Only hide if toggle is on (auto-hide behavior is active) and image is visible
        if (this.imageToggleState && this.imageOverlayVisible) {
            this.hide(true); // Temporary hide
            
            // Clear any pending auto-show timeout
            if (this.imageAutoHideTimeout) {
                clearTimeout(this.imageAutoHideTimeout);
                this.imageAutoHideTimeout = null;
            }
        }
    }

    checkAndAutoShowImage() {
        // Only check if toggle is on and image is currently hidden
        if (!this.imageToggleState || this.imageOverlayVisible) {
            this.stillnessStartTime = null;
            return;
        }
        
        // Only check if we're viewing an event
        if (!this.sceneModel.eventMarker || !this.currentEventMarker) {
            this.stillnessStartTime = null;
            return;
        }
        
        const camera = this.sceneModel.getCamera();
        const globe = this.sceneModel.getGlobe();
        
        if (!camera || !globe) return;
        
        // Check if auto-rotate has stopped (meaning we're recentered)
        const isAutoRotating = this.sceneModel.getAutoRotate();
        
        // Check if user is dragging (manual interaction)
        const isDragging = this.sceneModel.isDraggingState();
        
        // If dragging just started (wasn't dragging before, now is), hide image
        if (isDragging && !this.wasDragging && this.imageToggleState && this.imageOverlayVisible) {
            this.hide(true); // Temporary hide
            
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
        
        const THREE = window.THREE;
        if (!THREE) return;
        
        // Get current positions
        const currentCameraPos = camera.position.clone();
        const currentGlobeRot = {
            x: globe.rotation.x,
            y: globe.rotation.y,
            z: globe.rotation.z
        };
        
        // Check if camera/globe has moved significantly
        // Use a threshold that allows for very small movements (momentum damping)
        const movementThreshold = 0.005; // Small threshold for detecting significant movement
        let hasMovedSignificantly = false;
        
        if (this.lastCameraPosition && this.lastGlobeRotation) {
            const cameraMovement = currentCameraPos.distanceTo(this.lastCameraPosition);
            const globeRotDiff = Math.abs(currentGlobeRot.x - this.lastGlobeRotation.x) +
                                Math.abs(currentGlobeRot.y - this.lastGlobeRotation.y) +
                                Math.abs(currentGlobeRot.z - this.lastGlobeRotation.z);
            
            if (cameraMovement > movementThreshold || globeRotDiff > movementThreshold) {
                hasMovedSignificantly = true;
            }
        }
        
        // Update last positions
        this.lastCameraPosition = currentCameraPos.clone();
        this.lastGlobeRotation = { ...currentGlobeRot };
        
        // Check if recentered on event marker (DOM map uses a stub without getWorldPosition)
        let isRecentered = true;
        if (!this.currentEventMarker.userData || !this.currentEventMarker.userData.isMap2dLiteProxy) {
            const markerWorldPos = new THREE.Vector3();
            this.currentEventMarker.getWorldPosition(markerWorldPos);
            const targetDirection = markerWorldPos.clone().normalize();
            const cameraDirection = camera.position.clone().normalize();

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
                    this.show();
                }
                this.imageAutoHideTimeout = null;
                // Reset stillness timer so it can trigger again if needed
                this.stillnessStartTime = null;
            }
        }
    }

    reset() {
        this.imageOverlayVisible = false;
        this.imageToggleState = false;
        if (this.imageAutoHideTimeout) {
            clearTimeout(this.imageAutoHideTimeout);
            this.imageAutoHideTimeout = null;
        }
        this.lastCameraPosition = null;
        this.lastGlobeRotation = null;
        this.stillnessStartTime = null;
        this.wasDragging = false;
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ImageOverlayService = ImageOverlayService;
}
