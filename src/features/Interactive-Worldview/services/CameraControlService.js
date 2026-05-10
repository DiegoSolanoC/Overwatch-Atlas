/**
 * CameraControlService - Handles camera zoom, movement, and reset
 */

class CameraControlService {
    constructor(sceneModel, uiView) {
        this.sceneModel = sceneModel;
        this.uiView = uiView;
    }

    _getMapPanClampForZ(z) {
        const camera = this.sceneModel.getCamera();
        const earthMapPlane = this.sceneModel.getEarthMapPlane ? this.sceneModel.getEarthMapPlane() : this.sceneModel.earthMapPlane;
        const renderer = this.sceneModel.getRenderer();
        if (!camera || !earthMapPlane || !renderer) return { maxPanX: 0, maxPanY: 0 };

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
        return { maxPanX, maxPanY };
    }

    _clampMapXY(x, y, z) {
        const { maxPanX, maxPanY } = this._getMapPanClampForZ(z);
        return {
            x: Math.max(-maxPanX, Math.min(maxPanX, x)),
            y: Math.max(-maxPanY, Math.min(maxPanY, y))
        };
    }

    /**
     * Zoom in and center camera on a marker
     * @param {THREE.Object3D} marker - Marker to zoom to
     * @param {Function} onPlanesVisibilityChange - Callback to change plane visibility
     */
    zoomToMarker(marker, onPlanesVisibilityChange) {
        const camera = this.sceneModel.getCamera();
        const globe = this.sceneModel.getGlobe();
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        if (isMapView && marker && marker.userData && marker.userData.isMap2dLiteProxy) {
            if (onPlanesVisibilityChange) {
                onPlanesVisibilityChange(false);
            }
            this.sceneModel.setAutoRotate(false);
            if (this.sceneModel.autoRotateTimeout) {
                clearTimeout(this.sceneModel.autoRotateTimeout);
                this.sceneModel.autoRotateTimeout = null;
            }
            const ev = marker.userData.event;
            const vi = marker.userData.variantIndex;
            let lat = ev && ev.lat;
            let lon = ev && ev.lon;
            if (ev && ev.variants && vi != null && ev.variants[vi]) {
                const v = ev.variants[vi];
                if (v.lat !== undefined) lat = v.lat;
                if (v.lon !== undefined) lon = v.lon;
            }
            if (lat != null && lon != null) {
                window.globeController?.map2dLite?.flyToLatLon(lat, lon);
            }
            return;
        }

        // Store original camera position and globe rotation before zooming
        if (!this.uiView.originalCameraPosition) {
            this.uiView.originalCameraPosition = camera.position.clone();
            this.uiView.originalGlobeRotation = {
                x: globe.rotation.x,
                y: globe.rotation.y,
                z: globe.rotation.z
            };
        }
        
        // Hide Moon/Mars planes when zooming to a marker
        if (onPlanesVisibilityChange) {
            onPlanesVisibilityChange(false);
        }
        
        // Disable auto-rotate
        this.sceneModel.setAutoRotate(false);
        if (this.sceneModel.autoRotateTimeout) {
            clearTimeout(this.sceneModel.autoRotateTimeout);
            this.sceneModel.autoRotateTimeout = null;
        }
        
        // Get world position of marker (accounting for globe rotation)
        const markerWorldPosition = new THREE.Vector3();
        marker.getWorldPosition(markerWorldPosition);

        // Calculate target camera position
        let targetPosition;
        const markerLoc = marker.userData && marker.userData.locationType;
        const skipMapPanClamp = markerLoc === 'moon' || markerLoc === 'mars';
        if (isMapView) {
            const desiredZ = 2.0;
            // Moon/Mars markers sit on side rigs, not on the Earth map — don't clamp to map pan bounds.
            if (skipMapPanClamp) {
                targetPosition = new THREE.Vector3(markerWorldPosition.x, markerWorldPosition.y, desiredZ);
            } else {
                const { x, y } = this._clampMapXY(markerWorldPosition.x, markerWorldPosition.y, desiredZ);
                targetPosition = new THREE.Vector3(x, y, desiredZ);
            }
        } else {
            // Globe: move camera along radial direction toward marker.
            const targetDistance = 2.5; // Closer zoom distance
            const direction = markerWorldPosition.clone().normalize();
            targetPosition = direction.multiplyScalar(targetDistance);
        }
        
        // Animate camera to target position
        const startPosition = camera.position.clone();
        const duration = 500; // 0.5 second animation (faster)
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease out)
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            // Interpolate position
            const currentPosition = new THREE.Vector3().lerpVectors(startPosition, targetPosition, easeProgress);
            camera.position.copy(currentPosition);
            
            if (isMapView) {
                if (!skipMapPanClamp) {
                    const clamped = this._clampMapXY(camera.position.x, camera.position.y, camera.position.z);
                    camera.position.x = clamped.x;
                    camera.position.y = clamped.y;
                }
                camera.lookAt(camera.position.x, camera.position.y, 0);
            } else {
                // Look at the marker's world position (not just origin)
                const currentMarkerWorldPos = new THREE.Vector3();
                marker.getWorldPosition(currentMarkerWorldPos);
                
                // On mobile, offset the lookAt point downward to position marker in top image area
                const isMobile = window.innerWidth <= 768;
                if (isMobile) {
                    // Calculate offset to center marker in top half of screen (where image is)
                    const viewportHeight = window.innerHeight;
                    const topAreaHeight = (viewportHeight * 0.5) - 60; // Height of top area
                    const topAreaCenter = 60 + (topAreaHeight / 2); // Center Y of top area
                    const screenCenter = viewportHeight / 2;
                    const offsetY = (topAreaCenter - screenCenter) / viewportHeight; // Normalized offset
                    
                    // Calculate direction from camera to marker
                    const cameraToMarker = new THREE.Vector3().subVectors(currentMarkerWorldPos, camera.position).normalize();
                    
                    // Calculate camera's right and up vectors in world space
                    const cameraRight = new THREE.Vector3().crossVectors(cameraToMarker, new THREE.Vector3(0, 1, 0)).normalize();
                    const cameraUp = new THREE.Vector3().crossVectors(cameraRight, cameraToMarker).normalize();
                    
                    // Offset the lookAt point downward (opposite of camera up) to make marker appear higher
                    const offsetDistance = Math.abs(offsetY) * 1.5; // Increased to position marker higher in top area
                    const offsetVector = cameraUp.multiplyScalar(-offsetDistance); // Negative to move down
                    currentMarkerWorldPos.add(offsetVector);
                }
                
                camera.lookAt(currentMarkerWorldPos);
            }
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                if (isMapView) {
                    if (!skipMapPanClamp) {
                        const clamped = this._clampMapXY(camera.position.x, camera.position.y, camera.position.z);
                        camera.position.x = clamped.x;
                        camera.position.y = clamped.y;
                    }
                    camera.lookAt(camera.position.x, camera.position.y, 0);
                }
                // After zoom completes, set up recentering timeout if viewing event
                if (this.sceneModel.eventMarker && this.sceneModel.getAutoRotateEnabled()) {
                    if (this.sceneModel.autoRotateTimeout) {
                        clearTimeout(this.sceneModel.autoRotateTimeout);
                    }
                    this.sceneModel.autoRotateTimeout = setTimeout(() => {
                        this.sceneModel.setAutoRotate(true);
                        this.sceneModel.setRotationVelocity({ x: 0, y: 0 });
                    }, 2000); // 2 seconds delay after dragging stops
                }
            }
        };
        
        animate();
    }

    /**
     * Reset camera to default view (for Moon/Mars events)
     * @param {Function} onPlanesVisibilityRestore - Callback to restore plane visibility
     */
    resetCameraToDefault(onPlanesVisibilityRestore) {
        console.log('[CameraControlService.resetCameraToDefault] Called');
        
        // CRITICAL: Stop any station/marsShip following first
        console.log('[CameraControlService.resetCameraToDefault] Stopping station/marsShip follow');
        if (window.globeController?.interactionController) {
            window.globeController.interactionController.stopFollowingStation();
        }
        
        const camera = this.sceneModel.getCamera();
        const globe = this.sceneModel.getGlobe();
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const earthMapPlane = this.sceneModel.getEarthMapPlane ? this.sceneModel.getEarthMapPlane() : this.sceneModel.earthMapPlane;
        const renderer = this.sceneModel.getRenderer();
        
        console.log('[CameraControlService.resetCameraToDefault] isMapView:', isMapView);
        console.log('[CameraControlService.resetCameraToDefault] camera exists:', !!camera);
        console.log('[CameraControlService.resetCameraToDefault] globe exists:', !!globe);
        console.log('[CameraControlService.resetCameraToDefault] camera position before:', camera ? camera.position.clone() : 'no camera');
        console.log('[CameraControlService.resetCameraToDefault] globe rotation before:', globe ? { x: globe.rotation.x, y: globe.rotation.y, z: globe.rotation.z } : 'no globe');
        
        if (!camera || !globe) {
            console.log('[CameraControlService.resetCameraToDefault] Early return - missing camera or globe');
            return;
        }

        if (isMapView) {
            console.log('[CameraControlService.resetCameraToDefault] Map view mode - calling map2dLite.resetView');
            if (onPlanesVisibilityRestore) {
                onPlanesVisibilityRestore();
            }
            this.sceneModel.setAutoRotate(false);
            if (this.sceneModel.autoRotateTimeout) {
                clearTimeout(this.sceneModel.autoRotateTimeout);
                this.sceneModel.autoRotateTimeout = null;
            }
            window.globeController?.map2dLite?.resetView?.();
            console.log('[CameraControlService.resetCameraToDefault] Map view reset complete');
            return;
        }
        
        // Restore plane visibility for Moon/Mars events (they might have been hidden by Earth event zoom)
        if (onPlanesVisibilityRestore) {
            console.log('[CameraControlService.resetCameraToDefault] Restoring plane visibility');
            onPlanesVisibilityRestore();
        } else {
            // If no callback provided, try to restore via interactionController
            console.log('[CameraControlService.resetCameraToDefault] No restore callback, trying interactionController');
            window.globeController?.interactionController?.restorePlanesVisibility?.();
        }
        
        // Disable auto-rotate
        console.log('[CameraControlService.resetCameraToDefault] Disabling auto-rotate');
        this.sceneModel.setAutoRotate(false);
        if (this.sceneModel.autoRotateTimeout) {
            clearTimeout(this.sceneModel.autoRotateTimeout);
            this.sceneModel.autoRotateTimeout = null;
        }

        // Default camera position and (optionally) globe rotation
        // On mobile portrait, use more zoomed out position to show Moon/Mars panels
        const isMobilePortrait = this.sceneModel.isMobilePortrait || (window.innerWidth <= 768 && window.innerHeight > window.innerWidth);
        let defaultZoom = isMobilePortrait ? 7.0 : 3.5;
        console.log('[CameraControlService.resetCameraToDefault] isMobilePortrait:', isMobilePortrait);
        console.log('[CameraControlService.resetCameraToDefault] defaultZoom:', defaultZoom);

        // Map view: fit whole map (same perspective 3D pipeline as Moon/Mars planes).
        if (isMapView && camera && earthMapPlane && renderer) {
            console.log('[CameraControlService.resetCameraToDefault] Calculating map fit zoom');
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
            defaultZoom = Math.max(1.6, Math.min(fitDistH, fitDistW) * 0.98);
            console.log('[CameraControlService.resetCameraToDefault] Calculated map fit zoom:', defaultZoom);
        }

        const targetPosition = new THREE.Vector3(0, 0, defaultZoom);
        const targetRotation = { x: 0, y: 0, z: 0 };
        console.log('[CameraControlService.resetCameraToDefault] targetPosition:', targetPosition);
        console.log('[CameraControlService.resetCameraToDefault] targetRotation:', targetRotation);

        // Map: snap to default framing (no lerp) — avoids "flying into" the plane while staying true perspective 3D.
        if (isMapView && earthMapPlane && renderer) {
            console.log('[CameraControlService.resetCameraToDefault] Map view - snapping to position');
            camera.position.copy(targetPosition);
            const clamped = this._clampMapXY(camera.position.x, camera.position.y, camera.position.z);
            camera.position.x = clamped.x;
            camera.position.y = clamped.y;
            camera.lookAt(camera.position.x, camera.position.y, 0);
            console.log('[CameraControlService.resetCameraToDefault] Map view snap complete, final position:', camera.position.clone());
            return;
        }
        
        // Animate camera to default position (globe)
        console.log('[CameraControlService.resetCameraToDefault] Globe view - animating to default');
        const startPosition = camera.position.clone();
        const startRotation = {
            x: globe.rotation.x,
            y: globe.rotation.y,
            z: globe.rotation.z
        };
        console.log('[CameraControlService.resetCameraToDefault] startPosition:', startPosition);
        console.log('[CameraControlService.resetCameraToDefault] startRotation:', startRotation);
        
        const duration = 500; // 0.5 second animation
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease out)
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            // Interpolate camera position
            camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
            
            // Interpolate globe rotation (skip in map view to avoid unexpected globe rotation jumps)
            if (!isMapView) {
                globe.rotation.x = startRotation.x + (targetRotation.x - startRotation.x) * easeProgress;
                globe.rotation.y = startRotation.y + (targetRotation.y - startRotation.y) * easeProgress;
                globe.rotation.z = startRotation.z + (targetRotation.z - startRotation.z) * easeProgress;
            }
            
            if (isMapView) {
                // Map view: keep camera perpendicular to the plane (no tilt) and clamp pan.
                const clamped = this._clampMapXY(camera.position.x, camera.position.y, camera.position.z);
                camera.position.x = clamped.x;
                camera.position.y = clamped.y;
                camera.lookAt(camera.position.x, camera.position.y, 0);
            } else {
                // Globe view: look at origin (earth globe center).
                camera.lookAt(0, 0, 0);
            }
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                console.log('[CameraControlService.resetCameraToDefault] Animation complete');
                console.log('[CameraControlService.resetCameraToDefault] Final camera position:', camera.position.clone());
                console.log('[CameraControlService.resetCameraToDefault] Final globe rotation:', { x: globe.rotation.x, y: globe.rotation.y, z: globe.rotation.z });
            }
        };
        
        animate();
    }

    /**
     * Handle wheel/zoom
     * @param {WheelEvent} event - Wheel event
     */
    onWheel(event) {
        event.preventDefault();
        const camera = this.sceneModel.getCamera();
        const earthMapPlane = this.sceneModel.getEarthMapPlane ? this.sceneModel.getEarthMapPlane() : this.sceneModel.earthMapPlane;
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const renderer = this.sceneModel.getRenderer();
        const delta = event.deltaY * 0.001; // Original sensitivity
        const isMobilePortrait = this.sceneModel.isMobilePortrait || (window.innerWidth <= 768 && window.innerHeight > window.innerWidth);
        
        // Different zoom limits for mobile portrait (allows more zoom out to show panels)
        const minZoom = 1.5;
        let maxZoom = isMobilePortrait ? 7.0 : 5.0;

        // Map view: clamp zoom-out so the viewport never shows beyond the map edges.
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
        
        camera.position.z += delta;
        camera.position.z = Math.max(minZoom, Math.min(maxZoom, camera.position.z));

        // Map view: after zoom changes, clamp pan to boundaries.
        if (isMapView && camera && earthMapPlane && renderer) {
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
        }
        
        // Clear stored original position when manually zooming (so clicking globe doesn't reset)
        if (this.uiView) {
            this.uiView.originalCameraPosition = null;
            this.uiView.originalGlobeRotation = null;
        }
    }

    /**
     * Zoom in (move camera closer)
     */
    zoomIn() {
        const camera = this.sceneModel.getCamera();
        const earthMapPlane = this.sceneModel.getEarthMapPlane ? this.sceneModel.getEarthMapPlane() : this.sceneModel.earthMapPlane;
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const renderer = this.sceneModel.getRenderer();
        if (camera) {
            const delta = 0.4; // Zoom step size (increased from 0.2 for stronger zoom)
            const isMobilePortrait = this.sceneModel.isMobilePortrait || (window.innerWidth <= 768 && window.innerHeight > window.innerWidth);
            
            // Different zoom limits for mobile portrait (allows more zoom out to show panels)
            const minZoom = 1.5;
            let maxZoom = isMobilePortrait ? 7.0 : 5.0; // Allow more zoom out on mobile portrait
            
            if (isMapView && earthMapPlane && renderer) {
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
            
            camera.position.z -= delta;
            camera.position.z = Math.max(minZoom, Math.min(maxZoom, camera.position.z));

            if (isMapView && earthMapPlane && renderer) {
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
            }
            
            // Clear stored original position when manually zooming (so clicking globe doesn't reset)
            if (this.uiView) {
                this.uiView.originalCameraPosition = null;
                this.uiView.originalGlobeRotation = null;
            }
        }
    }

    /**
     * Zoom out (move camera farther)
     */
    zoomOut() {
        const camera = this.sceneModel.getCamera();
        const earthMapPlane = this.sceneModel.getEarthMapPlane ? this.sceneModel.getEarthMapPlane() : this.sceneModel.earthMapPlane;
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const renderer = this.sceneModel.getRenderer();
        if (camera) {
            const delta = 0.4; // Zoom step size (increased from 0.2 for stronger zoom)
            const isMobilePortrait = this.sceneModel.isMobilePortrait || (window.innerWidth <= 768 && window.innerHeight > window.innerWidth);
            
            // Different zoom limits for mobile portrait (allows more zoom out to show panels)
            const minZoom = 1.5;
            let maxZoom = isMobilePortrait ? 7.0 : 5.0; // Allow more zoom out on mobile portrait
            
            if (isMapView && earthMapPlane && renderer) {
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
            
            camera.position.z += delta;
            camera.position.z = Math.max(minZoom, Math.min(maxZoom, camera.position.z));

            if (isMapView && earthMapPlane && renderer) {
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
            }
            
            // Clear stored original position when manually zooming (so clicking globe doesn't reset)
            if (this.uiView) {
                this.uiView.originalCameraPosition = null;
                this.uiView.originalGlobeRotation = null;
            }
        }
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CameraControlService;
}

// Make globally accessible
if (typeof window !== 'undefined') {
    window.CameraControlService = CameraControlService;
}
