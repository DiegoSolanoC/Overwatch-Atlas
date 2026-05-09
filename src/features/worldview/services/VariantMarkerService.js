/**
 * VariantMarkerService - Handles showing/hiding variant markers for multi-events
 */
class VariantMarkerService {
    constructor(sceneModel) {
        this.sceneModel = sceneModel;
    }

    show(eventData) {
        if (!this.sceneModel || !eventData) return;
        
        const markers = this.sceneModel.getMarkers();
        markers.forEach(marker => {
            if (marker.userData && 
                marker.userData.isEventMarker && 
                marker.userData.event === eventData &&
                !marker.userData.isMainVariant) {
                marker.visible = true;
            }
        });
    }

    hide(eventData) {
        if (!this.sceneModel || !eventData) return;
        
        const markers = this.sceneModel.getMarkers();
        markers.forEach(marker => {
            if (marker.userData && 
                marker.userData.isEventMarker && 
                marker.userData.event === eventData &&
                !marker.userData.isMainVariant) {
                marker.visible = false;
            }
        });
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.VariantMarkerService = VariantMarkerService;
}
