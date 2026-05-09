/**
 * AutoRotateController - Handles auto-rotation and event recentering
 * Extracted from GlobeController to follow Single Responsibility Principle
 */

export class AutoRotateController {
    constructor(sceneModel) {
        this.sceneModel = sceneModel;
        this.initialAngleDiff = null;
        this.fadeInTriggered = false;
    }
    
    /**
     * Reset recentering state
     */
    resetRecentering() {
        this.initialAngleDiff = null;
        this.fadeInTriggered = false;
    }
    
    /**
     * Update auto-rotation for the globe
     * @param {THREE.Object3D} globe - The globe object
     * @param {THREE.Camera} camera - The camera object
     */
    updateAutoRotate(globe, camera) {
        if (!this.sceneModel.getAutoRotate() || !this.sceneModel.getAutoRotateEnabled()) {
            return;
        }
        
        const eventMarker = this.sceneModel.eventMarker;
        if (eventMarker) {
            this.recenterToEvent(globe, camera, eventMarker);
        } else {
            this.normalAutoRotate(globe);
        }
    }
    
    /**
     * Normal auto-rotation (no event marker)
     */
    normalAutoRotate(globe) {
        globe.rotation.y += 0.002;
    }
    
    /**
     * Recenter globe to face event marker
     */
    recenterToEvent(globe, camera, eventMarker) {
        const markerWorldPos = new THREE.Vector3();
        eventMarker.getWorldPosition(markerWorldPos);
        const targetDirection = markerWorldPos.clone().normalize();
        
        // Calculate current direction the camera is looking at (from globe center)
        const cameraDirection = camera.position.clone().normalize();
        
        // Calculate rotation needed to face the marker
        const currentLat = Math.asin(cameraDirection.y);
        const currentLon = Math.atan2(cameraDirection.z, cameraDirection.x);
        const targetLat = Math.asin(targetDirection.y);
        const targetLon = Math.atan2(targetDirection.z, targetDirection.x);
        
        // Smoothly rotate globe to face marker
        const latDiff = targetLat - currentLat;
        const lonDiff = targetLon - currentLon;
        
        // Normalize lon difference to shortest path
        let normalizedLonDiff = lonDiff;
        if (normalizedLonDiff > Math.PI) normalizedLonDiff -= 2 * Math.PI;
        if (normalizedLonDiff < -Math.PI) normalizedLonDiff += 2 * Math.PI;
        
        // Calculate total angle difference
        const angleDiff = Math.abs(latDiff) + Math.abs(normalizedLonDiff);
        
        // Track initial angle difference when recentering starts
        if (this.initialAngleDiff === null || angleDiff > this.initialAngleDiff * 1.1) {
            // Reset if we're starting a new recentering (angle increased, meaning we moved away)
            this.initialAngleDiff = angleDiff;
            this.fadeInTriggered = false;
        }
        
        // Constant speed rotation (not proportional - moves fixed amount per frame)
        const constantSpeed = 0.004; // Fixed rotation speed per frame (more gradual, slower)
        
        // Calculate 90% completion threshold (10% of initial angle remaining)
        const fadeInThreshold = this.initialAngleDiff * 0.1; // 90% done = 10% remaining
        const completeThreshold = 0.01; // Stop recentering when fully done
        
        // Check if we should start fading in (90% done) - only trigger once
        if (!this.fadeInTriggered && angleDiff <= fadeInThreshold && angleDiff > completeThreshold) {
            this.triggerFadeIn();
        }
        
        if (angleDiff > completeThreshold) {
            // Still recentering - continue movement
            this.continueRecentering(globe, latDiff, normalizedLonDiff, constantSpeed);
        } else {
            // Close enough - stop recentering
            this.sceneModel.setAutoRotate(false);
            this.resetRecentering();
        }
        
        // Limit vertical rotation
        globe.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, globe.rotation.x));
    }
    
    /**
     * Continue recentering movement
     */
    continueRecentering(globe, latDiff, normalizedLonDiff, constantSpeed) {
        // Calculate direction vector
        const totalDiff = Math.sqrt(latDiff * latDiff + normalizedLonDiff * normalizedLonDiff);
        if (totalDiff > 0) {
            // Normalize direction and apply constant speed
            const dirX = latDiff / totalDiff;
            const dirY = normalizedLonDiff / totalDiff;
            
            // Move fixed amount in direction of target
            const moveAmount = Math.min(constantSpeed, totalDiff); // Don't overshoot
            globe.rotation.x += dirX * moveAmount;
            globe.rotation.y += dirY * moveAmount;
        }
    }
    
    /**
     * Trigger fade-in animation for event image
     */
    triggerFadeIn() {
        this.fadeInTriggered = true; // Mark as triggered to prevent multiple calls
        
        const eventImage = document.getElementById('eventImage');
        const eventImageOverlay = document.getElementById('eventImageOverlay');
        if (!eventImage || !eventImageOverlay || !eventImageOverlay.classList.contains('open')) {
            return;
        }
        
        // Check if image/overlay has fade-out class (was hidden during drag)
        const hasFadeOut = eventImage.classList.contains('fade-out') || 
                          eventImageOverlay.classList.contains('fade-out');
        
        if (!hasFadeOut) {
            return;
        }
        
        // Image was hidden, fade it back in with proper animation
        if (eventImage.src && eventImage.src !== window.location.href && eventImage.style.display !== 'none') {
            // Remove fade-out class
            eventImage.classList.remove('fade-out');
            eventImageOverlay.classList.remove('fade-out');
            
            // Set opacity to 0 to start fade-in from beginning
            eventImage.style.opacity = '0';
            eventImageOverlay.style.background = 'rgba(0, 0, 0, 0)'; // Transparent for image
            
            // Force reflow to ensure opacity 0 is applied
            void eventImage.offsetHeight;
            
            // Add fade-in class to trigger CSS transition
            eventImage.classList.add('fade-in');
        } else {
            // No image - fade in black overlay
            eventImageOverlay.classList.remove('fade-out');
            eventImageOverlay.style.opacity = '0';
            eventImageOverlay.style.background = 'rgba(0, 0, 0, 0.85)'; // Black background
            
            // Force reflow to ensure opacity 0 is applied
            void eventImageOverlay.offsetHeight;
            
            // Add fade-in class to trigger CSS transition
            eventImageOverlay.classList.add('fade-in');
        }
    }
}
