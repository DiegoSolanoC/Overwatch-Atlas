/**
 * MarkerTraversalHelpers - Utilities for traversing markers across globe/moon/mars
 * Extracted from EventMarkerManager to reduce duplication
 * 
 * PERFORMANCE NOTE: Uses sceneModel.getMarkers() array directly instead of scene traversal
 * for much better performance, as scene traversal visits every object in the scene graph.
 */

/**
 * Traverses all event markers using the markers array (much faster than scene traversal)
 * @param {Object} sceneModel - SceneModel instance
 * @param {Function} callback - Callback function to call for each event marker
 */
export function traverseEventMarkers(sceneModel, callback) {
    const markers = sceneModel.getMarkers();
    if (!markers) return;
    
    // Filter to only event markers and call callback
    markers.forEach(marker => {
        if (marker.userData && marker.userData.isEventMarker) {
            callback(marker);
        }
    });
}

/**
 * Collects all event markers from the markers array (much faster than scene traversal)
 * @param {Object} sceneModel - SceneModel instance
 * @returns {Array} - Array of event markers
 */
export function collectEventMarkers(sceneModel) {
    const markers = sceneModel.getMarkers();
    if (!markers) return [];
    
    // Filter to only event markers
    return markers.filter(marker => marker.userData && marker.userData.isEventMarker);
}

/**
 * Collects all event marker pin lines from the markers array
 * Note: Pin lines are stored in marker.userData.pinLine, not as separate markers
 * @param {Object} sceneModel - SceneModel instance
 * @returns {Array} - Array of pin lines
 */
export function collectEventMarkerPins(sceneModel) {
    const markers = sceneModel.getMarkers();
    if (!markers) return [];
    
    // Collect pin lines from event markers
    const pins = [];
    markers.forEach(marker => {
        if (marker.userData && marker.userData.isEventMarker && marker.userData.pinLine) {
            pins.push(marker.userData.pinLine);
        }
    });
    return pins;
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.MarkerTraversalHelpers) {
        window.MarkerTraversalHelpers = {};
    }
    window.MarkerTraversalHelpers.traverseEventMarkers = traverseEventMarkers;
    window.MarkerTraversalHelpers.collectEventMarkers = collectEventMarkers;
    window.MarkerTraversalHelpers.collectEventMarkerPins = collectEventMarkerPins;
}
