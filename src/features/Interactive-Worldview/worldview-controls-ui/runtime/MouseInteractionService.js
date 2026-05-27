/**
 * MouseInteractionService - Handles mouse event interactions
 */

class MouseInteractionService {
    constructor(sceneModel, uiView) {
        this.sceneModel = sceneModel;
        this.uiView = uiView;
    }

    /**
     * Handle mouse down
     * @param {MouseEvent} event - Mouse event
     */
    onMouseDown(event) {
        this.sceneModel.setDragging(true);
        this.sceneModel.setAutoRotate(false);
        
        // Clear any pending auto-rotate timeout
        if (this.sceneModel.autoRotateTimeout) {
            clearTimeout(this.sceneModel.autoRotateTimeout);
            this.sceneModel.autoRotateTimeout = null;
        }
        
        this.sceneModel.setPreviousMousePosition({
            x: event.clientX,
            y: event.clientY
        });
        
        // Track if mouse moved (to differentiate click from drag)
        window.mouseMoved = false;
        
        // Notify UI that dragging started (to hide image overlay if visible)
        if (this.uiView) {
            this.uiView.onGlobeDragStart();
        }
    }

    /**
     * Handle mouse move
     * @param {MouseEvent} event - Mouse event
     * @param {Function} onMarkerHover - Callback for marker hover detection
     */
    onMouseMove(event, onMarkerHover) {
        // Check for hover on event markers (even when not dragging)
        if (onMarkerHover) {
            onMarkerHover(event);
        }
        
        if (!this.sceneModel.isDraggingState()) return;

        const isMapView = this.sceneModel.getMapViewEnabled && this.sceneModel.getMapViewEnabled();
        
        window.mouseMoved = true;
        
        // If viewing an event and user manually rotates, reset auto-rotate
        if (this.sceneModel.eventMarker) {
            this.sceneModel.setAutoRotate(false);
            // Clear existing timeout
            if (this.sceneModel.autoRotateTimeout) {
                clearTimeout(this.sceneModel.autoRotateTimeout);
                this.sceneModel.autoRotateTimeout = null;
            }
        }
        
        const deltaX = event.clientX - this.sceneModel.getPreviousMousePosition().x;
        const deltaY = event.clientY - this.sceneModel.getPreviousMousePosition().y;

        if (isMapView) {
            const camera = this.sceneModel.getCamera();
            const renderer = this.sceneModel.getRenderer();
            const earthMapPlane = this.sceneModel.getEarthMapPlane ? this.sceneModel.getEarthMapPlane() : this.sceneModel.earthMapPlane;
            if (camera && renderer && earthMapPlane) {
                const rect = renderer.domElement.getBoundingClientRect();
                const viewportW = Math.max(1, rect.width);
                const viewportH = Math.max(1, rect.height);

                const fovRad = (camera.fov * Math.PI) / 180;
                const distance = Math.max(0.01, camera.position.z - earthMapPlane.position.z);
                const halfViewH = Math.tan(fovRad / 2) * distance;
                const worldPerPixel = (halfViewH * 2) / viewportH;

                // Drag right => move view left (camera.x decreases), drag up => move view down (camera.y increases)
                const attemptedX = camera.position.x - (deltaX * worldPerPixel);
                const attemptedY = camera.position.y + (deltaY * worldPerPixel);

                const halfMapW = 1.0 * (earthMapPlane.scale?.x ?? 1); // base plane width 2.0 => half 1.0
                const halfMapH = 0.5 * (earthMapPlane.scale?.y ?? 1); // base plane height 1.0 => half 0.5
                const aspect = viewportW / viewportH;
                const halfViewW = halfViewH * aspect;

                const maxPanX = Math.max(0, halfMapW - halfViewW);
                const maxPanY = Math.max(0, halfMapH - halfViewH);

                const nextX = Math.max(-maxPanX, Math.min(maxPanX, attemptedX));
                const nextY = Math.max(-maxPanY, Math.min(maxPanY, attemptedY));

                // Edge glow feedback when user tries to drag past borders
                if (window.MapEdgeGlowService) {
                    const container = document.getElementById('globe-container');
                    const svc = window.MapEdgeGlowService.getInstance();
                    if (container) svc.ensure(container);

                    const eps = 1e-6;
                    const hitLeft = attemptedX < (-maxPanX - eps);
                    const hitRight = attemptedX > (maxPanX + eps);
                    const hitBottom = attemptedY < (-maxPanY - eps);
                    const hitTop = attemptedY > (maxPanY + eps);

                    // Estimate how hard we're pushing based on overshoot distance (normalized)
                    const ox = Math.abs(attemptedX - nextX);
                    const oy = Math.abs(attemptedY - nextY);
                    const denom = Math.max(1e-6, Math.max(maxPanX, maxPanY));
                    const overshoot = Math.min(1, (Math.max(ox, oy) / denom) * 2.5);

                    svc.hit({ left: hitLeft, right: hitRight, top: hitTop, bottom: hitBottom, overshoot });
                }

                camera.position.x = nextX;
                camera.position.y = nextY;
                camera.lookAt(nextX, nextY, 0);
            }
        } else {
            const globe = this.sceneModel.getGlobe();
            if (globe) {
                const rotationSpeed = 0.005;
                const velocityX = deltaY * rotationSpeed;
                const velocityY = deltaX * rotationSpeed;
                
                globe.rotation.y += velocityY;
                globe.rotation.x += velocityX;
                
                // Limit vertical rotation
                globe.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, globe.rotation.x));
                
                // Update rotation velocity for momentum
                this.sceneModel.setRotationVelocity({
                    x: velocityX,
                    y: velocityY
                });
            }
        }
        
        this.sceneModel.setPreviousMousePosition({
            x: event.clientX,
            y: event.clientY
        });
    }

    /**
     * Handle mouse up
     */
    onMouseUp() {
        this.sceneModel.setDragging(false);
        
        // Clear initial touch position
        this.sceneModel.initialTouchPosition = null;
        
        // Set timeout to resume auto-rotation after inactivity
        if (this.sceneModel.getAutoRotateEnabled() && this.sceneModel.autoRotateTimeout) {
            clearTimeout(this.sceneModel.autoRotateTimeout);
        }
        
        if (this.sceneModel.getAutoRotateEnabled()) {
            // If viewing an event, recenter to it after delay
            if (this.sceneModel.eventMarker) {
                this.sceneModel.autoRotateTimeout = setTimeout(() => {
                    this.sceneModel.setAutoRotate(true);
                    this.sceneModel.setRotationVelocity({ x: 0, y: 0 });
                }, 2000); // 2 seconds delay after dragging stops
            } else {
                // Normal auto-rotate
                this.sceneModel.autoRotateTimeout = setTimeout(() => {
                    this.sceneModel.setAutoRotate(true);
                    this.sceneModel.setRotationVelocity({ x: 0, y: 0 });
                }, 5000); // 5 second delay
            }
        }
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MouseInteractionService;
}

// Make globally accessible
if (typeof window !== 'undefined') {
    window.MouseInteractionService = MouseInteractionService;
}
