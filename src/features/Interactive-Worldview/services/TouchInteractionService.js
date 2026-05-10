/**
 * TouchInteractionService - Handles touch event interactions
 */

class TouchInteractionService {
    constructor(sceneModel, uiView) {
        this.sceneModel = sceneModel;
        this.uiView = uiView;
        this._pinchStartDistance = null;
        this._pinchStartZ = null;
    }

    /**
     * Handle touch start
     * @param {TouchEvent} event - Touch event
     */
    onTouchStart(event) {
        if (event.touches.length === 2) {
            // Begin pinch gesture (zoom)
            this.sceneModel.setDragging(false);
            this.sceneModel.initialTouchPosition = null;
            this.sceneModel.setAutoRotate(false);

            const camera = this.sceneModel.getCamera();
            if (!camera) return;
            const a = event.touches[0];
            const b = event.touches[1];
            const dx = a.clientX - b.clientX;
            const dy = a.clientY - b.clientY;
            this._pinchStartDistance = Math.sqrt(dx * dx + dy * dy);
            this._pinchStartZ = camera.position.z;
            return;
        }

        if (event.touches.length === 1) {
            this.sceneModel.setDragging(true);
            this.sceneModel.setAutoRotate(false);
            
            const touch = event.touches[0];
            this.sceneModel.setPreviousMousePosition({
                x: touch.clientX,
                y: touch.clientY
            });

            // Match mouse path: empty-globe click closes panels only when pointer did not move (see MarkerInteractionService)
            window.mouseMoved = false;
            
            // Track initial touch position to detect if it's a drag vs tap
            this.sceneModel.initialTouchPosition = {
                x: touch.clientX,
                y: touch.clientY
            };
            
            // Notify UI that dragging started (to hide image overlay if visible)
            if (this.uiView) {
                this.uiView.onGlobeDragStart();
            }
        }
    }

    /**
     * Handle touch move
     * @param {TouchEvent} event - Touch event
     */
    onTouchMove(event) {
        // Pinch zoom (two-finger)
        if (event.touches.length === 2) {
            event.preventDefault();
            event.stopPropagation();

            const camera = this.sceneModel.getCamera();
            const renderer = this.sceneModel.getRenderer();
            const earthMapPlane = this.sceneModel.getEarthMapPlane ? this.sceneModel.getEarthMapPlane() : this.sceneModel.earthMapPlane;
            const isMapView = this.sceneModel.getMapViewEnabled && this.sceneModel.getMapViewEnabled();
            if (!camera) return;

            const a = event.touches[0];
            const b = event.touches[1];
            const dx = a.clientX - b.clientX;
            const dy = a.clientY - b.clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (this._pinchStartDistance == null || this._pinchStartZ == null) {
                this._pinchStartDistance = dist;
                this._pinchStartZ = camera.position.z;
                return;
            }

            // dist increases (fingers apart) => zoom in (smaller z)
            const delta = dist - this._pinchStartDistance;
            const zoomDelta = -delta * 0.005; // tuned for mobile
            let nextZ = this._pinchStartZ + zoomDelta;

            // Clamp zoom similar to CameraControlService
            const isMobilePortrait = this.sceneModel.isMobilePortrait || (window.innerWidth <= 768 && window.innerHeight > window.innerWidth);
            const minZoom = 1.5;
            let maxZoom = isMobilePortrait ? 7.0 : 5.0;

            if (isMapView && camera && earthMapPlane && renderer) {
                const rect = renderer.domElement.getBoundingClientRect();
                const viewportW = Math.max(1, rect.width);
                const viewportH = Math.max(1, rect.height);
                const aspect = viewportW / viewportH;
                const fovRad = (camera.fov * Math.PI) / 180;
                const tan = Math.tan(fovRad / 2);
                const halfMapW = 1.0 * (earthMapPlane.scale?.x ?? 1);
                const halfMapH = 0.5 * (earthMapPlane.scale?.y ?? 1);
                const maxDistH = halfMapH / tan;
                const maxDistW = halfMapW / (tan * aspect);
                maxZoom = Math.min(maxZoom, Math.max(1.6, Math.min(maxDistH, maxDistW) * 0.98));
            }

            nextZ = Math.max(minZoom, Math.min(maxZoom, nextZ));
            camera.position.z = nextZ;

            if (isMapView && camera && earthMapPlane && renderer) {
                // After zoom changes, clamp pan to boundaries (prevents seeing beyond map).
                const rect = renderer.domElement.getBoundingClientRect();
                const viewportW = Math.max(1, rect.width);
                const viewportH = Math.max(1, rect.height);
                const aspect = viewportW / viewportH;
                const fovRad = (camera.fov * Math.PI) / 180;
                const distance = Math.max(0.01, camera.position.z - earthMapPlane.position.z);
                const halfViewH = Math.tan(fovRad / 2) * distance;
                const halfViewW = halfViewH * aspect;
                const halfMapW = 1.0 * (earthMapPlane.scale?.x ?? 1);
                const halfMapH = 0.5 * (earthMapPlane.scale?.y ?? 1);
                const maxPanX = Math.max(0, halfMapW - halfViewW);
                const maxPanY = Math.max(0, halfMapH - halfViewH);
                camera.position.x = Math.max(-maxPanX, Math.min(maxPanX, camera.position.x));
                camera.position.y = Math.max(-maxPanY, Math.min(maxPanY, camera.position.y));
                camera.lookAt(camera.position.x, camera.position.y, 0);
            } else {
                camera.lookAt(0, 0, 0);
            }

            // Make pinch incremental (smoother)
            this._pinchStartDistance = dist;
            this._pinchStartZ = camera.position.z;
            return;
        }

        if (event.touches.length === 1) {
            if (!this.sceneModel.isDraggingState()) return;
            
            const touch = event.touches[0];
            const deltaX = touch.clientX - this.sceneModel.getPreviousMousePosition().x;
            const deltaY = touch.clientY - this.sceneModel.getPreviousMousePosition().y;
            
            // Check if this is a significant movement (not just a tap)
            const initialPos = this.sceneModel.initialTouchPosition;
            if (initialPos) {
                const totalDeltaX = Math.abs(touch.clientX - initialPos.x);
                const totalDeltaY = Math.abs(touch.clientY - initialPos.y);
                const totalMovement = Math.sqrt(totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY);

                if (totalMovement > 8) {
                    window.mouseMoved = true;
                }
                
                // If movement is significant (more than 5px), prevent page scrolling
                if (totalMovement > 5) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            } else {
                // Fallback: always prevent if we don't have initial position
                event.preventDefault();
                event.stopPropagation();
            }
            
            const globe = this.sceneModel.getGlobe();
            const isMapView = this.sceneModel.getMapViewEnabled && this.sceneModel.getMapViewEnabled();
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
                    
                    const attemptedX = camera.position.x - (deltaX * worldPerPixel);
                    const attemptedY = camera.position.y + (deltaY * worldPerPixel);
                    
                    const halfMapW = 1.0 * (earthMapPlane.scale?.x ?? 1);
                    const halfMapH = 0.5 * (earthMapPlane.scale?.y ?? 1);
                    const aspect = viewportW / viewportH;
                    const halfViewW = halfViewH * aspect;
                    
                    const maxPanX = Math.max(0, halfMapW - halfViewW);
                    const maxPanY = Math.max(0, halfMapH - halfViewH);
                    
                    const nextX = Math.max(-maxPanX, Math.min(maxPanX, attemptedX));
                    const nextY = Math.max(-maxPanY, Math.min(maxPanY, attemptedY));

                    // Edge glow feedback when user tries to drag past borders (touch)
                    if (window.MapEdgeGlowService) {
                        const container = document.getElementById('globe-container');
                        const svc = window.MapEdgeGlowService.getInstance();
                        if (container) svc.ensure(container);

                        const eps = 1e-6;
                        const hitLeft = attemptedX < (-maxPanX - eps);
                        const hitRight = attemptedX > (maxPanX + eps);
                        const hitBottom = attemptedY < (-maxPanY - eps);
                        const hitTop = attemptedY > (maxPanY + eps);

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
            } else if (globe) {
                const rotationSpeed = 0.005;
                globe.rotation.y += deltaX * rotationSpeed;
                globe.rotation.x += deltaY * rotationSpeed;
                globe.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, globe.rotation.x));
            }
            
            this.sceneModel.setPreviousMousePosition({
                x: touch.clientX,
                y: touch.clientY
            });
        }
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TouchInteractionService;
}

// Make globally accessible
if (typeof window !== 'undefined') {
    window.TouchInteractionService = TouchInteractionService;
}
