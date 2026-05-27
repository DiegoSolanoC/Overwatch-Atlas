/**
 * unloadEventSystem — teardown helpers paired with `bootEventManager`.
 *
 *   - `removeAllEventMarkers()` strips every event marker from the globe scene so a
 *     subsequent mode switch starts clean.
 *   - `clearEventManager()` nulls `window.eventManager` so anyone reading it after
 *     unload gets `null` instead of a stale, half-disposed instance.
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

export function clearEventManager() {
    if (window.eventManager) {
        window.eventManager = null;
    }
}
