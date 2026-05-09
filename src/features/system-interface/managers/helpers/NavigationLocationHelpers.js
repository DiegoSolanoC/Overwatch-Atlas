/**
 * NavigationLocationHelpers - Location type utilities for event navigation
 */

/**
 * Handles camera/zoom behavior based on location type
 * @param {Object} interactionController - InteractionController instance
 * @param {Object} marker - Marker object
 * @param {string} locationType - Location type ('earth', 'moon', 'mars', 'station')
 * @param {Object} sceneModel - SceneModel instance (for orbit panel check)
 */
export function handleLocationTypeCamera(interactionController, marker, locationType, sceneModel) {
    if (locationType === 'moon' || locationType === 'mars') {
        // Reset camera to default view for Moon/Mars events
        interactionController.resetCameraToDefault();
    } else if (locationType === 'station' || locationType === 'marsShip') {
        // Guard rail: check if on orbit panel
        const orbitMarkerParent = sceneModel?.getOrbitMarkerParent ? sceneModel.getOrbitMarkerParent() : sceneModel?.orbitPlane;
        const isOnOrbitPanel = orbitMarkerParent && marker.parent === orbitMarkerParent;
        
        if (isOnOrbitPanel) {
            // Treat like moon/mars - reset camera instead of following
            interactionController.resetCameraToDefault();
        } else {
            // For station / Mars Ship events on satellite, hide Moon/Mars panels and follow the moving object
            interactionController.setPlanesVisibility(false);
            interactionController.startFollowingStation(marker);
        }
    } else {
        // Zoom in and center on the marker (Earth events)
        interactionController.zoomToMarker(marker);
    }
}

/**
 * Gets location type from marker or event data
 * @param {Object} marker - Marker object (optional)
 * @param {Object} eventData - Event data object (optional)
 * @returns {string} - Location type, defaults to 'earth'
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

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.NavigationLocationHelpers) {
        window.NavigationLocationHelpers = {};
    }
    window.NavigationLocationHelpers.handleLocationTypeCamera = handleLocationTypeCamera;
    window.NavigationLocationHelpers.getLocationType = getLocationType;
}
