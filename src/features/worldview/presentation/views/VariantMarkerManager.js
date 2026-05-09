/**
 * VariantMarkerManager - Manages showing/hiding variant markers for multi-events
 */

export class VariantMarkerManager {
    constructor(sceneModel) {
        this.sceneModel = sceneModel;
    }
    
    /**
     * Show variant markers for a multi-event
     * @param {Object} eventData - The event data object
     */
    showVariantMarkers(eventData) {
        if (!this.sceneModel) return;
        
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
    
    /**
     * Hide variant markers for a multi-event
     * @param {Object} eventData - The event data object
     */
    hideVariantMarkers(eventData) {
        if (!this.sceneModel) return;
        
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
