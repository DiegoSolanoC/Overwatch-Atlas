/**
 * Thumbnail hover camera helpers — drive the globe camera (or Map2DLite
 * transform) when the user hovers an event thumbnail in the dock.
 *
 * On hover:
 *   - centerCameraOnMarker(marker) zooms toward the marker (radial approach
 *     in globe view, flyToLatLon in map view) and stashes the prior state.
 * On unhover:
 *   - restoreCameraFromThumbnailHover() animates back to the stashed state
 *     and clears it.
 *
 * The two functions share module-private `_thumbnailHoverCameraState`, which
 * is why they live together. Globe view uses the global `THREE` namespace
 * (loaded by index.html before this module runs).
 *
 * Extracted from main-menu/event-system-load-out/EventSystemLoadOut.js.
 */

let _thumbnailHoverCameraState = null;

/**
 * Smoothly center the camera on a marker (hover preview).
 * Disables auto-rotate while previewing. Stashes prior state for restoration.
 */
export function centerCameraOnMarker(marker) {
    const sceneModel = window.globeController?.sceneModel;
    if (!sceneModel || !marker) return;

    const isMapView = sceneModel.getMapViewEnabled?.() || !!sceneModel.isMapView;

    sceneModel.setAutoRotate?.(false);

    if (isMapView) {
        const ev = marker.userData?.event;
        if (ev?.lat != null && ev?.lon != null) {
            const map2dLite = window.globeController?.map2dLite;
            if (map2dLite && !_thumbnailHoverCameraState) {
                _thumbnailHoverCameraState = {
                    isMapView: true,
                    tx: map2dLite._tx,
                    ty: map2dLite._ty,
                    scale: map2dLite._scale
                };
            }
            window.globeController?.map2dLite?.flyToLatLon?.(ev.lat, ev.lon);
        }
        return;
    }

    const camera = sceneModel.getCamera?.();
    const globe = sceneModel.getGlobe?.();
    if (!camera || !globe) return;

    if (!_thumbnailHoverCameraState) {
        _thumbnailHoverCameraState = {
            cameraPosition: camera.position.clone(),
            isMapView: false
        };
    }

    const markerWorldPos = new THREE.Vector3();
    marker.getWorldPosition(markerWorldPos);

    // Moderate zoom: closer than default (~4-5) but not as close as click (~2.5).
    const targetDistance = 3.2;
    const direction = markerWorldPos.clone().normalize();
    const targetPosition = direction.multiplyScalar(targetDistance);

    const startPosition = camera.position.clone();
    const startTime = Date.now();
    const duration = 600;

    function animateCamera() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);

        camera.position.lerpVectors(startPosition, targetPosition, ease);

        const currentMarkerPos = new THREE.Vector3();
        marker.getWorldPosition(currentMarkerPos);
        camera.lookAt(currentMarkerPos);

        if (progress < 1) {
            requestAnimationFrame(animateCamera);
        }
    }

    animateCamera();
}

/**
 * Restore the camera to its position before thumbnail hover, then clear the
 * stash. No-op if nothing is stashed or if the user switched view modes
 * mid-hover. Re-arms auto-rotate after a short delay if it was enabled.
 */
export function restoreCameraFromThumbnailHover() {
    if (!_thumbnailHoverCameraState) return;

    const sceneModel = window.globeController?.sceneModel;
    if (!sceneModel) return;

    const state = _thumbnailHoverCameraState;
    const isMapView = sceneModel.getMapViewEnabled?.() || !!sceneModel.isMapView;

    if (isMapView && state.isMapView) {
        const map2dLite = window.globeController?.map2dLite;
        if (map2dLite && state.tx != null) {
            const startTx = map2dLite._tx;
            const startTy = map2dLite._ty;
            const startScale = map2dLite._scale;
            const targetTx = state.tx;
            const targetTy = state.ty;
            const targetScale = state.scale;
            const startTime = Date.now();
            const duration = 500;

            function animateRestore() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const ease = 1 - Math.pow(1 - progress, 3);

                map2dLite._tx = startTx + (targetTx - startTx) * ease;
                map2dLite._ty = startTy + (targetTy - startTy) * ease;
                map2dLite._scale = startScale + (targetScale - startScale) * ease;
                map2dLite._applyTransform();

                if (progress < 1) {
                    requestAnimationFrame(animateRestore);
                }
            }
            animateRestore();
        }
    } else if (!isMapView && !state.isMapView && state.cameraPosition) {
        const camera = sceneModel.getCamera?.();
        if (!camera) {
            _thumbnailHoverCameraState = null;
            return;
        }

        const startPos = camera.position.clone();
        const targetPos = state.cameraPosition;
        const startTime = Date.now();
        const duration = 500;

        function animateRestore() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);

            camera.position.lerpVectors(startPos, targetPos, ease);
            camera.lookAt(0, 0, 0);

            if (progress < 1) {
                requestAnimationFrame(animateRestore);
            }
        }
        animateRestore();
    }

    _thumbnailHoverCameraState = null;

    if (sceneModel.getAutoRotateEnabled?.()) {
        setTimeout(() => {
            if (!sceneModel.eventMarker) {
                sceneModel.setAutoRotate?.(true);
            }
        }, 1000);
    }
}
