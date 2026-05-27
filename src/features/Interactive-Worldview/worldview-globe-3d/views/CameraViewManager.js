/**
 * CameraViewManager - Manages camera animations, zoom, and label positioning
 */

export class CameraViewManager {
    constructor(sceneModel, uiView) {
        this.sceneModel = sceneModel;
        this.uiView = uiView; // Reference to UIView for accessing originalCameraPosition and originalGlobeRotation
        this._cameraEaseRafId = null;
    }

    _cancelCameraEaseAnimation() {
        if (this._cameraEaseRafId != null) {
            cancelAnimationFrame(this._cameraEaseRafId);
            this._cameraEaseRafId = null;
        }
    }
    
    /**
     * Zoom out from event and restore original camera position and globe rotation
     */
    zoomOutFromEvent() {
        const camera = this.sceneModel.getCamera();
        const globe = this.sceneModel.getGlobe();
        const earthMapPlane = this.sceneModel.getEarthMapPlane ? this.sceneModel.getEarthMapPlane() : this.sceneModel.earthMapPlane;
        const renderer = this.sceneModel.getRenderer ? this.sceneModel.getRenderer() : null;
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;

        if (!camera || !globe) return;

        this._cancelCameraEaseAnimation();

        const getMapFitZ = () => {
            // Fit whole map in viewport (prevents revealing space)
            const isMobilePortrait = window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
            let z = isMobilePortrait ? 5.5 : 3.5;
            if (renderer && earthMapPlane) {
                const rect = renderer.domElement.getBoundingClientRect();
                const viewportW = Math.max(1, rect.width);
                const viewportH = Math.max(1, rect.height);
                const aspect = viewportW / viewportH;
                const fovRad = (camera.fov * Math.PI) / 180;
                const tan = Math.tan(fovRad / 2);
                const halfMapW = 1.0 * (earthMapPlane.scale?.x ?? 1);
                const halfMapH = 0.5 * (earthMapPlane.scale?.y ?? 1);
                const fitDistH = halfMapH / tan;
                const fitDistW = halfMapW / (tan * aspect);
                z = Math.max(1.6, Math.min(fitDistH, fitDistW) * 0.98);
            }
            return z;
        };

        const clampMapXYForZ = (x, y, z) => {
            if (!renderer || !earthMapPlane) return { x, y };
            const rect = renderer.domElement.getBoundingClientRect();
            const viewportW = Math.max(1, rect.width);
            const viewportH = Math.max(1, rect.height);
            const aspect = viewportW / viewportH;
            const fovRad = (camera.fov * Math.PI) / 180;
            const distance = Math.max(0.01, z - earthMapPlane.position.z);
            const halfViewH = Math.tan(fovRad / 2) * distance;
            const halfViewW = halfViewH * aspect;
            const halfMapW = 1.0 * (earthMapPlane.scale?.x ?? 1);
            const halfMapH = 0.5 * (earthMapPlane.scale?.y ?? 1);
            const maxPanX = Math.max(0, halfMapW - halfViewW);
            const maxPanY = Math.max(0, halfMapH - halfViewH);
            return {
                x: Math.max(-maxPanX, Math.min(maxPanX, x)),
                y: Math.max(-maxPanY, Math.min(maxPanY, y))
            };
        };

        if (!this.uiView.originalCameraPosition || !this.uiView.originalGlobeRotation) {
            // No original state stored, use default
            const defaultZ = isMapView ? getMapFitZ() : ((window.innerWidth <= 768 && window.innerHeight > window.innerWidth) ? 5.5 : 3.5);
            const defaultPosition = new THREE.Vector3(0, 0, defaultZ);
            this.animateCameraToPosition(camera, defaultPosition, globe);
            return;
        }

        const self = this;
        
        // Animate camera back to original position
        const startPosition = camera.position.clone();
        const targetPosition = this.uiView.originalCameraPosition.clone();
        const startRotation = {
            x: globe.rotation.x,
            y: globe.rotation.y,
            z: globe.rotation.z
        };
        const targetRotation = this.uiView.originalGlobeRotation;
        
        const duration = 1000; // 1 second animation
        const startTime = Date.now();
        
        // Map view: keep target inside bounds and prevent zoom-out beyond map fit.
        if (isMapView) {
            targetPosition.z = Math.min(targetPosition.z, getMapFitZ());
            const clamped = clampMapXYForZ(targetPosition.x, targetPosition.y, targetPosition.z);
            targetPosition.x = clamped.x;
            targetPosition.y = clamped.y;
        }

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease out)
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            // Interpolate camera position
            const currentPosition = new THREE.Vector3().lerpVectors(startPosition, targetPosition, easeProgress);
            camera.position.copy(currentPosition);
            
            if (!isMapView) {
                // Interpolate globe rotation
                globe.rotation.x = startRotation.x + (targetRotation.x - startRotation.x) * easeProgress;
                globe.rotation.y = startRotation.y + (targetRotation.y - startRotation.y) * easeProgress;
                globe.rotation.z = startRotation.z + (targetRotation.z - startRotation.z) * easeProgress;
                // Look at origin
                camera.lookAt(0, 0, 0);
            } else {
                // Map view: clamp during animation and keep camera perpendicular (no tilt)
                const clamped = clampMapXYForZ(camera.position.x, camera.position.y, camera.position.z);
                camera.position.x = clamped.x;
                camera.position.y = clamped.y;
                camera.lookAt(camera.position.x, camera.position.y, 0);
            }
            
            if (progress < 1) {
                self._cameraEaseRafId = requestAnimationFrame(animate);
            } else {
                self._cameraEaseRafId = null;
                // Clear stored original state
                self.uiView.originalCameraPosition = null;
                self.uiView.originalGlobeRotation = null;
                
                // Restore plane visibility when zooming out from event
                if (window.globeController && window.globeController.interactionController) {
                    window.globeController.interactionController.restorePlanesVisibility();
                }
            }
        };
        
        this._cameraEaseRafId = requestAnimationFrame(animate);
    }
    
    /**
     * Reset zoom and camera centering to default (camera at default distance, globe rotation 0,0,0).
     */
    resetToDefault() {
        const camera = this.sceneModel.getCamera();
        const globe = this.sceneModel.getGlobe();
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        if (!camera || !globe) return;

        this._cancelCameraEaseAnimation();

        this.uiView.originalCameraPosition = null;
        this.uiView.originalGlobeRotation = null;

        if (isMapView) {
            window.globeController?.map2dLite?.resetView?.();
            if (window.globeController && window.globeController.interactionController) {
                window.globeController.interactionController.restorePlanesVisibility();
            }
            return;
        }

        const isMobilePortrait = window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
        let defaultZoom = isMobilePortrait ? 7.0 : 3.5;

        const targetPosition = new THREE.Vector3(0, 0, defaultZoom);
        const startPosition = camera.position.clone();
        const startRotation = { x: globe.rotation.x, y: globe.rotation.y, z: globe.rotation.z };
        const duration = 1000;
        const startTime = Date.now();
        const self = this;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            const currentPosition = new THREE.Vector3().lerpVectors(startPosition, targetPosition, easeProgress);
            camera.position.copy(currentPosition);

            if (!isMapView) {
                globe.rotation.x = startRotation.x + (0 - startRotation.x) * easeProgress;
                globe.rotation.y = startRotation.y + (0 - startRotation.y) * easeProgress;
                globe.rotation.z = startRotation.z + (0 - startRotation.z) * easeProgress;
                camera.lookAt(0, 0, 0);
            } else {
                // Map view: never animate globe rotation (can tilt/reveal space); keep camera perpendicular.
                camera.position.x = 0;
                camera.position.y = 0;
                camera.lookAt(0, 0, 0);
            }

            if (progress < 1) {
                self._cameraEaseRafId = requestAnimationFrame(animate);
            } else {
                self._cameraEaseRafId = null;
                if (window.globeController && window.globeController.interactionController) {
                    window.globeController.interactionController.restorePlanesVisibility();
                }
            }
        };
        this._cameraEaseRafId = requestAnimationFrame(animate);
    }

    /**
     * Animate camera to a specific position
     */
    animateCameraToPosition(camera, targetPosition, globe) {
        this._cancelCameraEaseAnimation();

        const startPosition = camera.position.clone();
        const duration = 1000;
        const startTime = Date.now();
        const earthMapPlane = this.sceneModel.getEarthMapPlane ? this.sceneModel.getEarthMapPlane() : this.sceneModel.earthMapPlane;
        const renderer = this.sceneModel.getRenderer ? this.sceneModel.getRenderer() : null;
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const clampMapXYForZ = (x, y, z) => {
            if (!renderer || !earthMapPlane) return { x, y };
            const rect = renderer.domElement.getBoundingClientRect();
            const viewportW = Math.max(1, rect.width);
            const viewportH = Math.max(1, rect.height);
            const aspect = viewportW / viewportH;
            const fovRad = (camera.fov * Math.PI) / 180;
            const distance = Math.max(0.01, z - earthMapPlane.position.z);
            const halfViewH = Math.tan(fovRad / 2) * distance;
            const halfViewW = halfViewH * aspect;
            const halfMapW = 1.0 * (earthMapPlane.scale?.x ?? 1);
            const halfMapH = 0.5 * (earthMapPlane.scale?.y ?? 1);
            const maxPanX = Math.max(0, halfMapW - halfViewW);
            const maxPanY = Math.max(0, halfMapH - halfViewH);
            return {
                x: Math.max(-maxPanX, Math.min(maxPanX, x)),
                y: Math.max(-maxPanY, Math.min(maxPanY, y))
            };
        };
        
        const self = this;
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            const currentPosition = new THREE.Vector3().lerpVectors(startPosition, targetPosition, easeProgress);
            camera.position.copy(currentPosition);
            if (isMapView) {
                const clamped = clampMapXYForZ(camera.position.x, camera.position.y, camera.position.z);
                camera.position.x = clamped.x;
                camera.position.y = clamped.y;
                camera.lookAt(camera.position.x, camera.position.y, 0);
            } else {
                camera.lookAt(0, 0, 0);
            }

            const gc = typeof window !== 'undefined' ? window.globeController : null;
            if (isMapView && gc && typeof gc.syncMapLiteWebGlImmediate === 'function') {
                gc.syncMapLiteWebGlImmediate();
            }
            
            if (progress < 1) {
                self._cameraEaseRafId = requestAnimationFrame(animate);
            } else {
                self._cameraEaseRafId = null;
            }
        };
        
        this._cameraEaseRafId = requestAnimationFrame(animate);
    }

    /**
     * Show city name label
     * @param {string} cityName - City name to display
     * @param {number} x - Screen X coordinate
     * @param {number} y - Screen Y coordinate
     */
    showCityLabel(cityName, x, y) {
        this.hideCityLabel(); // Remove any existing label
        
        const labelElement = document.createElement('div');
        labelElement.className = 'city-label';
        labelElement.textContent = cityName;
        labelElement.style.position = 'absolute';
        labelElement.style.left = `${x}px`;
        labelElement.style.top = `${y}px`;
        labelElement.style.background = 'rgba(0, 0, 0, 0.8)';
        labelElement.style.color = '#fff';
        labelElement.style.padding = '8px 12px';
        labelElement.style.borderRadius = '4px';
        labelElement.style.fontSize = '14px';
        labelElement.style.fontWeight = 'bold';
        labelElement.style.pointerEvents = 'none';
        labelElement.style.zIndex = '1000';
        labelElement.style.transform = 'translate(-50%, -100%)';
        labelElement.style.marginTop = '-10px';
        labelElement.style.whiteSpace = 'nowrap';
        labelElement.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
        
        document.body.appendChild(labelElement);
        this.sceneModel.setLabelElement(labelElement);
    }

    /**
     * Hide city label
     */
    hideCityLabel() {
        const labelElement = this.sceneModel.getLabelElement();
        if (labelElement) {
            labelElement.remove();
            this.sceneModel.setLabelElement(null);
        }
        this.sceneModel.setActiveMarker(null);
    }

    /**
     * Update label position to follow marker
     */
    updateLabelPosition() {
        const labelElement = this.sceneModel.getLabelElement();
        const activeMarker = this.sceneModel.getActiveMarker();
        
        if (!labelElement || !activeMarker) return;
        if (activeMarker.userData && activeMarker.userData.isMap2dLiteProxy) return;

        const camera = this.sceneModel.getCamera();
        const renderer = this.sceneModel.getRenderer();
        
        const vector = new THREE.Vector3();
        activeMarker.getWorldPosition(vector);
        vector.project(camera);
        
        const x = (vector.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
        const y = (-vector.y * 0.5 + 0.5) * renderer.domElement.clientHeight;
        
        labelElement.style.left = `${x}px`;
        labelElement.style.top = `${y}px`;
    }
}
