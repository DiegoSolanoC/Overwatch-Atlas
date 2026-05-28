/**
 * @see src/features/world/worldview-controls-ui/runtime/WorldviewMarkerInteractionHandlersMixin.js
 */
(function (global) {
    global.WorldviewMarkerInteractionHandlersMixin = {
    onMarkerClick(event, onZoomToMarker, onResetCamera) {

        // Skip globe marker clicks when map view is active (DOM markers handle it)
        if (window.globeController?.map2dLite?.isVisible?.()) {
            return;
        }

        // Don't register click if mouse was dragged
        if (window.mouseMoved) {
            return;
        }
        
        const camera = this.sceneModel.getCamera();
        if (!camera) {
            return;
        }
        
        const markers = this.sceneModel.getMarkers();
        
        const container = document.getElementById('globe-container');
        if (!container) {
            return;
        }
        
        const rect = container.getBoundingClientRect();
        
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        raycaster.layers.mask = camera.layers.mask;

        // CRITICAL: Only include EVENT markers (not seaport or city markers)
        // Seaport markers were blocking event markers from being clicked
        const clickableObjects = [];
        
        if (markers && markers.length > 0) {
            for (let i = 0; i < markers.length; i++) {
                const marker = markers[i];
                if (marker && marker.userData && marker.userData.isEventMarker && marker.visible) {
                    clickableObjects.push(marker);
                }
            }
        }
        
        // Log first few markers for debugging
        if (clickableObjects.length > 0) {
            console.log('[onMarkerClick] First marker sample:', {
                hasUserData: !!clickableObjects[0].userData,
                isEventMarker: clickableObjects[0].userData?.isEventMarker,
                isInteractive: clickableObjects[0].userData?.isInteractive,
                visible: clickableObjects[0].visible,
                scale: clickableObjects[0].scale,
                position: clickableObjects[0].position,
                hasParent: !!clickableObjects[0].parent
            });
        }
        
        const intersects = raycaster.intersectObjects(clickableObjects);
        
        if (intersects.length > 0) {
            console.log('[onMarkerClick] First intersect:', {
                object: intersects[0].object,
                hasUserData: !!intersects[0].object.userData,
                isEventMarker: intersects[0].object.userData?.isEventMarker,
                isSeaportMarker: intersects[0].object.userData?.isSeaportMarker,
                distance: intersects[0].distance
            });
        } else {
        }
        
        if (intersects.length > 0) {
            const clickedMarker = intersects[0].object;

            // Clear hover state when clicking a marker
            if (window.globeController?.interactionController) {
                window.globeController.interactionController.hoveredEventMarker = null;
            }
            if (window.globeController?.markerPulseService) {
                window.globeController.markerPulseService.hoveredEventMarker = null;
            }
            // Stop pulse animation on the clicked marker
            const hoveredMarker = this.pulseService.getHoveredMarker();
            if (hoveredMarker) {
                this.pulseService.stopEventMarkerPulse(hoveredMarker);
                this.pulseService.setHoveredMarker(null);
                this.highlightNumberButtonForMarker(null);
                this._syncEventsHoverPreviewFromMarker(null);
            }
            // Stop hover radiate sound loop
            if (window.globeController?.map2dLite?.stopHoverRadiateLoop) {
                window.globeController.map2dLite.stopHoverRadiateLoop();
            }
            // Clear synthetic marker hover
            if (window.globeController?.map2dLite?.clearSyntheticMarkerHover) {
                window.globeController.map2dLite.clearSyntheticMarkerHover();
            }

            // Handle event marker click
            if (clickedMarker.userData && clickedMarker.userData.isEventMarker) {
                console.log('[onMarkerClick] Clicked marker userData:', {
                    eventName: clickedMarker.userData.eventName,
                    event: clickedMarker.userData.event,
                    variant: clickedMarker.userData.variant,
                    variantIndex: clickedMarker.userData.variantIndex,
                    locationType: clickedMarker.userData.locationType,
                    isInteractive: clickedMarker.userData.isInteractive,
                    isMainVariant: clickedMarker.userData.isMainVariant
                });
                
                // Only allow clicks on interactive markers (main variant or single events)
                if (clickedMarker.userData.isInteractive === false) {
                    return; // Non-interactive variant markers cannot be clicked
                }
                
                // Don't allow event marker clicks when image overlay is visible
                const eventImageOverlay = document.getElementById('eventImageOverlay');
                if (eventImageOverlay && eventImageOverlay.classList.contains('open')) {
                    const opacity = parseFloat(window.getComputedStyle(eventImageOverlay).opacity);
                    if (opacity > 0.1) { // Image is visible (faded in)
                        return; // Block event marker clicks but allow globe dragging
                    }
                }
                
                // Don't allow clicks on locked events
                if (clickedMarker.userData.isLocked) {
                    return;
                }
                
                // Check if this is the same event that's currently open (by checking Event System's current index)
                const events = window.eventManager?.getDockTimelineEvents?.() || [];
                const eventData = clickedMarker.userData.event;
                
                // Find event index - need to handle variants correctly
                let eventIndex = -1;
                if (clickedMarker.userData.variant) {
                    // This is a variant marker - find the parent event
                    eventIndex = events.findIndex(e => {
                        // Check if this event has variants and one matches
                        if (e.variants && e.variants.length > 0) {
                            return e.variants.some(v => v === clickedMarker.userData.variant || v.name === clickedMarker.userData.variant.name);
                        }
                        return false;
                    });
                } else {
                    // This is a single event marker
                    eventIndex = events.findIndex(e => e === eventData || e.name === eventData.name);
                }
                if (eventIndex >= 0) {
                } else {
                }
                const currentIndex = window.standaloneEventSlide?.currentEventIndex;
                const eventSlide = document.getElementById('eventSlide');
                if (eventIndex >= 0 && eventIndex === currentIndex && eventSlide && eventSlide.classList.contains('open')) {
                    // Same event and slide is open - close it
                    eventSlide.classList.remove('open');
                    
                    // Reset camera when closing by clicking same marker
                    if (window.globeController?.interactionController) {
                        window.globeController.interactionController.stopFollowingStation();
                        window.globeController.interactionController.restorePlanesVisibility?.();
                    }
                    if (window.globeController?.cameraControlService) {
                        window.globeController.cameraControlService.resetCameraToDefault();
                    }
                    
                    return;
                }
                
                // Check if this is a Moon/Mars/Station/Ship marker - adjust camera behavior
                const locationType = clickedMarker.userData ? clickedMarker.userData.locationType : 'earth';
                
                // Check if marker is on orbit panel (for station/marsShip)
                const orbitMarkerParent = this.sceneModel.getOrbitMarkerParent ? this.sceneModel.getOrbitMarkerParent() : this.sceneModel.orbitPlane;
                const isOnOrbitPanel = orbitMarkerParent && clickedMarker.parent === orbitMarkerParent;
                
                if (locationType === 'moon' || locationType === 'mars') {
                    // Reset camera to default view for Moon/Mars events
                    if (onResetCamera) {
                        onResetCamera();
                    }
                } else if (locationType === 'station' || locationType === 'marsShip') {
                    // Guard rail: if on orbit panel, treat like moon/mars (reset camera, don't follow)
                    if (isOnOrbitPanel) {
                        if (onResetCamera) {
                            onResetCamera();
                        }
                    } else {
                        // Follow the moving object (ISS / Mars Ship) when on actual satellite
                        try {
                            window.globeController?.interactionController?.setPlanesVisibility?.(false);
                            window.globeController?.interactionController?.startFollowingStation?.(clickedMarker);
                        } catch (_) {
                            // fallback to reset if follow isn't available
                            if (onResetCamera) onResetCamera();
                        }
                    }
                } else {
                    // Zoom in and center on the marker (Earth events)
                    if (onZoomToMarker) {
                        onZoomToMarker(clickedMarker);
                    }
                }
                
                // Open event slide with viewport-based routing
                if (eventIndex >= 0) {
                    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                    const isMobilePortrait = isTouchDevice && window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
                    if (isMobilePortrait && window.standaloneEventSlide) {
                        // Mobile portrait: use standalone implementation
                        window.standaloneEventSlide.showEvent(eventIndex);
                    } else if (window.globeController?.uiView) {
                        // Desktop / mobile landscape: use simple dock-like implementation
                        const eventData = events[eventIndex];
                        const eventName = eventData?.name || 'Event';
                        const eventDescription = eventData?.description || '';
                        const imagePath = window.eventManager?.getEventImagePath
                            ? window.eventManager.getEventImagePath(eventData.name, eventData.image, 'story')
                            : null;
                        window.globeController.uiView.showEventSlide(eventName, imagePath, eventDescription, clickedMarker, eventData);
                    }
                    // Play sound effect
                    if (window.SoundEffectsManager?.play) {
                        window.SoundEffectsManager.play('eventClick');
                    }
                } else {
                }
            }
        } else {
            // Clicked elsewhere - hide label
            this.uiView.hideCityLabel();
            // NOTE: Event slide close removed - Globe no longer handles event slides
            // Event System Load Out manages its own panel state
            // Empty globe tap (not a drag) closes music/filters panels
            if (typeof window.closeTimelineMusicFiltersPanelsIfOpen === 'function') {
                window.closeTimelineMusicFiltersPanelsIfOpen();
            }
        }
    },

    setDomLiteMarkerHover(markerOrNull) {
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            return;
        }

        window.globeController?.map2dLite?.clearSyntheticMarkerHover?.();

        const eventImageOverlay = document.getElementById('eventImageOverlay');
        if (eventImageOverlay && eventImageOverlay.classList.contains('open')) {
            const opacity = parseFloat(window.getComputedStyle(eventImageOverlay).opacity);
            if (opacity > 0.1) {
                this.highlightNumberButtonForMarker(null);
                this._syncEventsHoverPreviewFromMarker(null);
                this._domLiteHoverStub = null;
                window.globeController?.map2dLite?.stopHoverRadiateLoop?.();
                return;
            }
        }

        const currentGl = this.pulseService.getHoveredMarker();
        if (currentGl) {
            this.pulseService.stopEventMarkerPulse(currentGl);
            this.pulseService.setHoveredMarker(null);
        }

        if (markerOrNull) {
            const ud = markerOrNull.userData;
            if (!ud || ud.isLocked || ud.isInteractive === false) {
                this.highlightNumberButtonForMarker(null);
                this._syncEventsHoverPreviewFromMarker(null);
                this._domLiteHoverStub = null;
                window.globeController?.map2dLite?.stopHoverRadiateLoop?.();
                return;
            }
            this.sceneModel.setAutoRotate(false);
            if (this.sceneModel.autoRotateTimeout) {
                clearTimeout(this.sceneModel.autoRotateTimeout);
                this.sceneModel.autoRotateTimeout = null;
            }
            this.highlightNumberButtonForMarker(markerOrNull);
            this._syncEventsHoverPreviewFromMarker(markerOrNull);
            this._domLiteHoverStub = markerOrNull;
            window.globeController?.map2dLite?.setSyntheticHoverFromStub?.(markerOrNull);

            // Reset image auto-show timer when hovering (prevent image from coming back while interacting)
            const imageOverlayService = window.globeController?.globeView?.imageOverlayManager;
            if (imageOverlayService) {
                imageOverlayService.stillnessStartTime = null;
            }
            // Dispatch custom event to reset image restore timer in MenuHelpers
            window.dispatchEvent(new CustomEvent('markerhover'));
            return;
        }

        this.highlightNumberButtonForMarker(null);
        this._syncEventsHoverPreviewFromMarker(null);
        this._domLiteHoverStub = null;
        window.globeController?.map2dLite?.stopHoverRadiateLoop?.();
        if (this.sceneModel.getAutoRotateEnabled() && !this.sceneModel.eventMarker) {
            this.sceneModel.autoRotateTimeout = setTimeout(() => {
                this.sceneModel.setAutoRotate(true);
            }, 500);
        }
    },

    clearDomLiteMarkerHoverIf(stub) {
        if (!this._domLiteHoverStub) return;
        if (!stub?.userData) {
            if (this._domLiteHoverStub.userData?.isMap2dLiteProxy) {
                this.setDomLiteMarkerHover(null);
            }
            return;
        }
        if (this._domLiteHoverStub === stub) {
            this.setDomLiteMarkerHover(null);
            return;
        }
        const cur = this._domLiteHoverStub.userData;
        const next = stub.userData;
        if (
            cur.isMap2dLiteProxy &&
            next.isMap2dLiteProxy &&
            cur.event === next.event &&
            (cur.variantIndex ?? 0) === (next.variantIndex ?? 0)
        ) {
            this.setDomLiteMarkerHover(null);
        }
    }
};
})(typeof window !== 'undefined' ? window : globalThis);
