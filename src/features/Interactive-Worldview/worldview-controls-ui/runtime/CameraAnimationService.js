/**
 * CameraAnimationService - Handles camera animations and zoom operations
 */
class CameraAnimationService {
    constructor(sceneModel) {
        this.sceneModel = sceneModel;
        this.originalCameraPosition = null;
        this.originalGlobeRotation = null;
    }

    storeOriginalState() {
        const camera = this.sceneModel.getCamera();
        const globe = this.sceneModel.getGlobe();
        
        if (camera) {
            this.originalCameraPosition = camera.position.clone();
        }
        
        if (globe) {
            this.originalGlobeRotation = {
                x: globe.rotation.x,
                y: globe.rotation.y,
                z: globe.rotation.z
            };
        }
    }

    clearOriginalState() {
        this.originalCameraPosition = null;
        this.originalGlobeRotation = null;
    }

    zoomOutFromEvent() {
        if (!this.originalCameraPosition || !this.originalGlobeRotation) {
            // No original state stored, use default
            const camera = this.sceneModel.getCamera();
            const globe = this.sceneModel.getGlobe();
            
            if (camera) {
                // On mobile portrait, use more zoomed out position to show Moon/Mars panels
                const isMobilePortrait = window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
                const defaultZoom = isMobilePortrait ? 7.0 : 3.5;
                const THREE = window.THREE;
                if (THREE) {
                    const defaultPosition = new THREE.Vector3(0, 0, defaultZoom);
                    this.animateToPosition(camera, defaultPosition, globe);
                }
            }
            return;
        }
        
        const camera = this.sceneModel.getCamera();
        const globe = this.sceneModel.getGlobe();
        
        if (!camera || !globe) return;
        
        // Animate camera back to original position
        const startPosition = camera.position.clone();
        const targetPosition = this.originalCameraPosition.clone();
        const startRotation = {
            x: globe.rotation.x,
            y: globe.rotation.y,
            z: globe.rotation.z
        };
        const targetRotation = this.originalGlobeRotation;
        
        const duration = 1000; // 1 second animation
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease out)
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            const THREE = window.THREE;
            if (!THREE) return;
            
            // Interpolate camera position
            const currentPosition = new THREE.Vector3().lerpVectors(startPosition, targetPosition, easeProgress);
            camera.position.copy(currentPosition);
            
            // Interpolate globe rotation
            globe.rotation.x = startRotation.x + (targetRotation.x - startRotation.x) * easeProgress;
            globe.rotation.y = startRotation.y + (targetRotation.y - startRotation.y) * easeProgress;
            globe.rotation.z = startRotation.z + (targetRotation.z - startRotation.z) * easeProgress;
            
            // Look at origin
            camera.lookAt(0, 0, 0);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Clear stored original state
                this.clearOriginalState();
                
                // Restore plane visibility when zooming out from event
                if (window.globeController && window.globeController.interactionController) {
                    window.globeController.interactionController.restorePlanesVisibility();
                }
            }
        };
        
        animate();
    }

    animateToPosition(camera, targetPosition, globe) {
        const THREE = window.THREE;
        if (!THREE) return;
        
        const startPosition = camera.position.clone();
        const duration = 1000;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            const currentPosition = new THREE.Vector3().lerpVectors(startPosition, targetPosition, easeProgress);
            camera.position.copy(currentPosition);
            camera.lookAt(0, 0, 0);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.CameraAnimationService = CameraAnimationService;
}
