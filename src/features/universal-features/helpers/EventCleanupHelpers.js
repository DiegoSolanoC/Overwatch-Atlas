/**
 * EventCleanupHelpers - Utilities for cleaning up event-related resources
 * Extracted from component-loader.js
 */

/**
 * Removes all event markers from the globe
 */
export function removeAllEventMarkers() {
    if (!window.globeController || !window.globeController.sceneModel) {
        return;
    }
    
    const markers = window.globeController.sceneModel.getMarkers();
    const scene = window.globeController.sceneModel.getScene();
    
    markers.forEach(marker => {
        if (marker.userData && marker.userData.isEventMarker) {
            scene.remove(marker);
        }
    });
    
    // Clear markers array
    window.globeController.sceneModel.getMarkers().length = 0;
}

/**
 * Clears the event manager reference
 */
export function clearEventManager() {
    if (window.eventManager) {
        window.eventManager = null;
    }
}
