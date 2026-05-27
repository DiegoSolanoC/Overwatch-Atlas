/**
 * InteractionController - Handles mouse/touch controls and marker interactions
 * Coordinates interaction services for separation of concerns
 */

function isEventFromDevSunYawPanel(event) {
    const t = event && event.target;
    return !!(t && typeof t.closest === 'function' && t.closest('.dev-sun-yaw-panel'));
}

export class InteractionController {
    constructor(sceneModel, uiView) {
        this.sceneModel = sceneModel;
        this.uiView = uiView;
        /** Skip redundant WebGL setSize (avoids buffer clears / black flashes during layout tweens) */
        this._lastGlobeBufferW = -1;
        this._lastGlobeBufferH = -1;
        
        // Initialize services
        this.pulseService = new (window.MarkerPulseService || MarkerPulseService)(sceneModel);
        this.cameraService = new (window.CameraControlService || CameraControlService)(sceneModel, uiView);
        this.mouseService = new (window.MouseInteractionService || MouseInteractionService)(sceneModel, uiView);
        this.touchService = new (window.TouchInteractionService || TouchInteractionService)(sceneModel, uiView);
        this.markerService = new (window.MarkerInteractionService || MarkerInteractionService)(sceneModel, uiView, this.pulseService);
        this.stationService = new (window.StationFollowService || StationFollowService)(sceneModel, uiView);
    }

    /**
     * Set Moon/Mars plane visibility with animation
     * @param {boolean} visible - Whether planes should be visible
     */
    setPlanesVisibility(visible) {
        const moonPlane = this.sceneModel.getMoonPlane ? this.sceneModel.getMoonPlane() : this.sceneModel.moonPlane;
        const marsPlane = this.sceneModel.getMarsPlane ? this.sceneModel.getMarsPlane() : this.sceneModel.marsPlane;
        
        // Use GlobeController's animatePlaneScale for smooth squash/stretch animation
        if (window.globeController && typeof window.globeController.animatePlaneScale === 'function') {
            if (moonPlane) {
                window.globeController.animatePlaneScale(moonPlane, visible);
            }
            if (marsPlane) {
                window.globeController.animatePlaneScale(marsPlane, visible);
            }
        } else {
            // Fallback to instant show/hide if animation not available
            if (moonPlane) {
                moonPlane.visible = visible;
            }
            if (marsPlane) {
                marsPlane.visible = visible;
            }
        }
    }

    /**
     * Restore plane visibility based on current page events
     * This should be called when camera returns to normal view
     */
    restorePlanesVisibility() {
        // Use GlobeController's updatePlaneVisibility to check current page and show/hide accordingly
        if (window.globeController && typeof window.globeController.updatePlaneVisibility === 'function') {
            window.globeController.updatePlaneVisibility();
        }
    }

    /**
     * Setup mouse/touch controls
     * @param {HTMLElement} container - Container element
     */
    setupControls(container) {
        container.addEventListener('mousedown', (e) => this.onMouseDown(e));
        container.addEventListener('mousemove', (e) => this.onMouseMove(e));
        container.addEventListener('mouseup', () => this.onMouseUp());
        container.addEventListener('mouseleave', () => this.onMouseUp());
        container.addEventListener('click', (e) => this.onMarkerClick(e));
        container.addEventListener('contextmenu', (e) => this.onContextMenu(e));
        container.addEventListener('dblclick', (e) => {
            if (isEventFromDevSunYawPanel(e)) return;
            if (typeof window.closeTimelineMusicFiltersPanelsIfOpen === 'function') {
                window.closeTimelineMusicFiltersPanelsIfOpen();
            }
        });
        // Use { passive: false } for touch events so we can preventDefault to stop page scrolling
        container.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        container.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        container.addEventListener('touchend', () => this.onMouseUp(), { passive: false });
        container.addEventListener('wheel', (e) => this.onWheel(e));
    }

    /**
     * Handle mouse down
     * @param {MouseEvent} event - Mouse event
     */
    onMouseDown(event) {
        if (isEventFromDevSunYawPanel(event)) return;
        this.mouseService.onMouseDown(event);
    }

    /**
     * Handle mouse move
     * @param {MouseEvent} event - Mouse event
     */
    onMouseMove(event) {
        if (isEventFromDevSunYawPanel(event)) {
            if (this.sceneModel.isDraggingState()) {
                this.sceneModel.setPreviousMousePosition({
                    x: event.clientX,
                    y: event.clientY
                });
            }
            return;
        }
        this.mouseService.onMouseMove(event, (e) => this.markerService.checkEventMarkerHover(e));
    }

    /**
     * Handle mouse up
     */
    onMouseUp() {
        this.mouseService.onMouseUp();
    }

    /**
     * Handle context menu (right-click)
     * @param {MouseEvent} event - Mouse event
     */
    onContextMenu(event) {
        if (isEventFromDevSunYawPanel(event)) return;
        
        console.log('[InteractionController] onContextMenu called');
        
        // Check if right-clicking on a marker to force cycle overlapping markers
        const camera = this.sceneModel.getCamera();
        if (!camera) {
            console.log('[InteractionController] No camera');
            return;
        }
        
        const container = document.getElementById('globe-container');
        if (!container) {
            console.log('[InteractionController] No container');
            return;
        }
        
        const rect = container.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        console.log('[InteractionController] Mouse coords:', mouse.x, mouse.y);
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        raycaster.layers.mask = camera.layers.mask;

        const markers = this.sceneModel.getMarkers();
        const clickableObjects = [];
        
        if (markers && markers.length > 0) {
            for (let i = 0; i < markers.length; i++) {
                const marker = markers[i];
                if (marker && marker.userData && marker.userData.isEventMarker && marker.visible) {
                    clickableObjects.push(marker);
                }
            }
        }
        
        console.log('[InteractionController] Clickable objects:', clickableObjects.length);
        
        const intersects = raycaster.intersectObjects(clickableObjects);
        console.log('[InteractionController] Intersects:', intersects.length);
        
        if (intersects.length > 0) {
            // Right-clicked on a marker - force cycle if it's in an overlap group
            const clickedMarker = intersects[0].object;
            console.log('[InteractionController] Clicked marker:', clickedMarker.userData.eventName);
            if (window.globeEventMarkerManager && typeof window.globeEventMarkerManager.forceCycleMarker === 'function') {
                console.log('[InteractionController] Calling forceCycleMarker');
                window.globeEventMarkerManager.forceCycleMarker(clickedMarker);
                
                // Manually update hover state (badge, pagination highlight, pulse) since mouse didn't move
                // This fixes the bug where badge and pulse don't update after right-click cycling
                setTimeout(() => {
                    const group = window.globeEventMarkerManager.overlapGroups?.find(g => g.markers.includes(clickedMarker));
                    if (group) {
                        const nextMarker = group.markers[group.currentIndex];
                        if (nextMarker && this.markerService) {
                            console.log('[InteractionController] Manually updating hover state for:', nextMarker.userData.eventName);
                            
                            // Stop pulse on the old marker (clickedMarker) and start on the new one
                            if (this.pulseService) {
                                this.pulseService.stopEventMarkerPulse(clickedMarker);
                                this.pulseService.setHoveredMarker(null);
                                this.pulseService.startEventMarkerPulse(nextMarker);
                                this.pulseService.setHoveredMarker(nextMarker);
                            }
                            
                            this.markerService.highlightNumberButtonForMarker(nextMarker);
                            this.markerService._syncEventsHoverPreviewFromMarker(nextMarker);
                        }
                    }
                }, 50);
            }
            // Prevent context menu when clicking on a marker
            event.preventDefault();
            event.stopPropagation();
        }
        // Allow context menu when not clicking on a marker
    }

    /**
     * Check if mouse is hovering over an event marker and create pulse effect
     */
    checkEventMarkerHover(event) {
        this.markerService.checkEventMarkerHover(event);
    }

    /**
     * Start pulse effect on event marker
     */
    startEventMarkerPulse(marker) {
        this.pulseService.startEventMarkerPulse(marker);
    }

    /**
     * Schedule next pulse ring after current one finishes
     */
    scheduleNextPulse(marker) {
        this.pulseService.scheduleNextPulse(marker);
    }

    /**
     * Stop pulse effect on event marker
     */
    stopEventMarkerPulse(marker) {
        this.pulseService.stopEventMarkerPulse(marker);
    }

    /**
     * Create a pulse ring for event marker
     */
    createPulseRing(marker) {
        this.pulseService.createPulseRing(marker);
    }

    /**
     * Update ring position and orientation to be flat on globe surface or plane
     */
    updateRingPositionAndOrientation(ring, marker) {
        this.pulseService.updateRingPositionAndOrientation(ring, marker);
    }

    /**
     * Update pulse rings animation
     */
    updatePulseRings() {
        this.pulseService.updatePulseRings();
    }

    /**
     * Update marker pulse animation (dilation effect) - happens all the time for all event markers
     */
    updateMarkerPulse() {
        this.pulseService.updateMarkerPulse();
    }

    /**
     * Zoom in and center camera on a marker
     * @param {THREE.Object3D} marker - Marker to zoom to
     */
    zoomToMarker(marker) {
        this.cameraService.zoomToMarker(marker, (visible) => this.setPlanesVisibility(visible));
    }

    /**
     * Reset camera to default view (for Moon/Mars events)
     */
    resetCameraToDefault() {
        this.cameraService.resetCameraToDefault(() => this.restorePlanesVisibility());
    }

    /**
     * Handle marker click
     * @param {MouseEvent} event - Mouse event
     */
    onMarkerClick(event) {
        if (isEventFromDevSunYawPanel(event)) return;
        this.markerService.onMarkerClick(
            event,
            (marker) => this.zoomToMarker(marker),
            () => this.resetCameraToDefault()
        );
    }

    /**
     * Handle touch start
     * @param {TouchEvent} event - Touch event
     */
    onTouchStart(event) {
        if (event.touches.length === 1 && isEventFromDevSunYawPanel(event)) return;
        this.touchService.onTouchStart(event);
    }

    /**
     * Handle touch move
     * @param {TouchEvent} event - Touch event
     */
    onTouchMove(event) {
        if (event.touches.length === 1 && isEventFromDevSunYawPanel(event)) {
            const touch = event.touches[0];
            if (this.sceneModel.isDraggingState()) {
                this.sceneModel.setPreviousMousePosition({
                    x: touch.clientX,
                    y: touch.clientY
                });
            }
            return;
        }
        this.touchService.onTouchMove(event);
    }

    /**
     * Handle wheel/zoom
     * @param {WheelEvent} event - Wheel event
     */
    onWheel(event) {
        if (isEventFromDevSunYawPanel(event)) return;
        this.cameraService.onWheel(event);
    }

    /**
     * Zoom in (move camera closer)
     */
    zoomIn() {
        const mapOn = this.sceneModel.getMapViewEnabled?.() ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        if (mapOn && window.globeController?.map2dLite?.isVisible?.()) {
            window.globeController.map2dLite.zoomIn();
            return;
        }
        this.cameraService.zoomIn();
    }

    /**
     * Zoom out (move camera farther)
     */
    zoomOut() {
        const mapOn = this.sceneModel.getMapViewEnabled?.() ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        if (mapOn && window.globeController?.map2dLite?.isVisible?.()) {
            window.globeController.map2dLite.zoomOut();
            return;
        }
        this.cameraService.zoomOut();
    }

    /**
     * Reset zoom and camera to default view
     */
    resetToDefault() {
        this.uiView.resetToDefault();
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        const camera = this.sceneModel.getCamera();
        const renderer = this.sceneModel.getRenderer();
        const container = document.getElementById('globe-container');
        
        // Update mobile portrait state on resize
        if (container && this.sceneModel) {
            const isMobile = window.innerWidth <= 768;
            const isPortrait = container.clientHeight > container.clientWidth;
            const wasMobilePortrait = this.sceneModel.isMobilePortrait;
            const isMobilePortrait = isMobile && isPortrait;
            this.sceneModel.isMobilePortrait = isMobilePortrait;
            
            // If orientation changed, reposition Moon and Mars panels
            if (wasMobilePortrait !== isMobilePortrait) {
                this.updatePlanesPosition(isMobilePortrait);
            }
        }
        
        if (container && camera && renderer) {
            const w = Math.max(1, Math.round(container.clientWidth));
            const h = Math.max(1, Math.round(container.clientHeight));
            if (w !== this._lastGlobeBufferW || h !== this._lastGlobeBufferH) {
                this._lastGlobeBufferW = w;
                this._lastGlobeBufferH = h;
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.setSize(w, h);
                if (this.sceneModel && typeof this.sceneModel.applyRendererPixelRatioCap === 'function') {
                    this.sceneModel.applyRendererPixelRatioCap();
                }
            }
        }

        try {
            const sunBg = this.sceneModel.getSunBackground && this.sceneModel.getSunBackground();
            const GH = typeof window !== 'undefined' ? window.GlobeInitHelpers : null;
            if (sunBg && GH && typeof GH.applySunBackgroundForViewport === 'function') {
                GH.applySunBackgroundForViewport(sunBg);
            }
            if (window.globeController && window.globeController.globeView
                && typeof window.globeController.globeView.syncSunDirectionToShaders === 'function') {
                window.globeController.globeView.syncSunDirectionToShaders();
            }
        } catch (_) { /* ignore */ }
    }
    
    /**
     * Update Moon and Mars planes position based on viewport
     * @param {boolean} isMobilePortrait - Whether in mobile portrait mode
     */
    updatePlanesPosition(isMobilePortrait) {
        const moonPlane = this.sceneModel.getMoonPlane();
        const marsPlane = this.sceneModel.getMarsPlane();
        const moonTarget = this.sceneModel.getMoonRig ? this.sceneModel.getMoonRig() : null;
        const marsTarget = this.sceneModel.getMarsRig ? this.sceneModel.getMarsRig() : null;
        const moonMove = moonTarget || moonPlane;
        const marsMove = marsTarget || marsPlane;

        if (moonMove) {
            if (isMobilePortrait) {
                moonMove.position.set(-0.8, 1.2, 0);
            } else {
                moonMove.position.set(1.5, 0.3, 0);
            }
            const cameraZ = isMobilePortrait ? 5.5 : 3.5;
            moonMove.lookAt(0, 0, cameraZ);
        }

        if (marsMove) {
            if (isMobilePortrait) {
                marsMove.position.set(0.3, 1.2, 0);
            } else {
                marsMove.position.set(1.5, -0.3, 0);
            }
            const cameraZ = isMobilePortrait ? 5.5 : 3.5;
            marsMove.lookAt(0, 0, cameraZ);
        }
    }
    
    /**
     * Start continuously following a station marker (ISS)
     * @param {Object} marker - The station marker to follow
     */
    startFollowingStation(marker) {
        this.stationService.startFollowingStation(marker);
    }
    
    /**
     * Stop following the station marker
     */
    stopFollowingStation() {
        this.stationService.stopFollowingStation();
    }
    
    /**
     * Update pin lines and marker positions for station events
     */
    updateStationPinLines() {
        this.stationService.updateStationPinLines();
    }
}
