/**
 * Frame the camera for an event marker based on its location type.
 * Moon/Mars resets to the default view; station/marsShip either resets
 * (orbit panel) or follows the moving vehicle; Earth zooms to the marker.
 */
export function handleLocationTypeCamera(interactionController, marker, locationType, sceneModel) {
    if (locationType === 'moon' || locationType === 'mars') {
        interactionController.resetCameraToDefault();
        return;
    }
    if (locationType === 'station' || locationType === 'marsShip') {
        const orbitMarkerParent = sceneModel?.getOrbitMarkerParent
            ? sceneModel.getOrbitMarkerParent()
            : sceneModel?.orbitPlane;
        const isOnOrbitPanel = orbitMarkerParent && marker.parent === orbitMarkerParent;

        if (isOnOrbitPanel) {
            interactionController.resetCameraToDefault();
        } else {
            interactionController.setPlanesVisibility(false);
            interactionController.startFollowingStation(marker);
        }
        return;
    }
    interactionController.zoomToMarker(marker);
}

/**
 * @param {Object} marker
 * @param {Object} eventData
 * @returns {string} 'earth' | 'moon' | 'mars' | 'station' | 'marsShip'
 */
export function getLocationType(marker, eventData) {
    if (marker && marker.userData && marker.userData.locationType) {
        return marker.userData.locationType;
    }
    if (eventData && eventData.locationType) {
        return eventData.locationType;
    }
    return 'earth';
}

/* Compat alias: `window.NavigationLocationHelpers.*` is still read by
 * event-system/interaction/openEventFromList.js. */
if (typeof window !== 'undefined') {
    if (!window.NavigationLocationHelpers) {
        window.NavigationLocationHelpers = {};
    }
    window.NavigationLocationHelpers.handleLocationTypeCamera = handleLocationTypeCamera;
    window.NavigationLocationHelpers.getLocationType = getLocationType;
}
