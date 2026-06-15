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

        if (event.target.closest?.('.map-hover-callout__panel, .map-hover-callout__stack-row')) {
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
                this.dismissPinnedMarkerCallout?.();
                this.activateEventMarker(clickedMarker, { onZoomToMarker, onResetCamera });
            }
        } else {
            // Clicked elsewhere - hide label and sticky marker callout
            this.uiView.hideCityLabel();
            this.dismissPinnedMarkerCallout?.();
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
                this.dismissPinnedMarkerCallout();
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
                this.dismissPinnedMarkerCallout();
                window.globeController?.map2dLite?.stopHoverRadiateLoop?.();
                return;
            }
            this.sceneModel.setAutoRotate(false);
            if (this.sceneModel.autoRotateTimeout) {
                clearTimeout(this.sceneModel.autoRotateTimeout);
                this.sceneModel.autoRotateTimeout = null;
            }
            this._syncEventsHoverPreviewFromMarker(markerOrNull);
            this.pinMarkerCallout(markerOrNull);
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

        this.dismissPinnedMarkerCallout();
    },

    clearDomLiteMarkerHoverIf(stub) {
        this.releaseDomLiteMarkerHover(stub);
    }
};
})(typeof window !== 'undefined' ? window : globalThis);
