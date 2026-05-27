/**
 * Fast iteration over `sceneModel.getMarkers()` for event markers only.
 * @param {Object} sceneModel
 * @param {(marker: THREE.Object3D) => void} callback
 */
export function traverseEventMarkers(sceneModel, callback) {
    const markers = sceneModel.getMarkers();
    if (!markers) return;

    markers.forEach(marker => {
        if (marker.userData && marker.userData.isEventMarker) {
            callback(marker);
        }
    });
}

/**
 * @param {Object} sceneModel
 * @returns {THREE.Object3D[]}
 */
export function collectEventMarkers(sceneModel) {
    const markers = sceneModel.getMarkers();
    if (!markers) return [];

    return markers.filter(marker => marker.userData && marker.userData.isEventMarker);
}

/**
 * Pin lines live on `marker.userData.pinLine`, not as separate scene markers.
 * @param {Object} sceneModel
 * @returns {THREE.Line[]}
 */
export function collectEventMarkerPins(sceneModel) {
    const markers = sceneModel.getMarkers();
    if (!markers) return [];

    const pins = [];
    markers.forEach(marker => {
        if (marker.userData && marker.userData.isEventMarker && marker.userData.pinLine) {
            pins.push(marker.userData.pinLine);
        }
    });
    return pins;
}
