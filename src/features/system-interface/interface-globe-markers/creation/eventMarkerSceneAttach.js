import { EARTH_GLOBE_LIGHT_LAYER } from '../../../world/worldview-shared-assets/constants/WorldviewLightingConstants.js';
import { useOrbitPanelForStationShipMarkers } from '../../interface-platform-input/useOrbitPanelForStationShipMarkers.js';

export function stationShipOnOrbitPanel(sceneModel, locationType) {
    return (locationType === 'station' || locationType === 'marsShip')
        && sceneModel
        && useOrbitPanelForStationShipMarkers(sceneModel);
}

export function stationShipWantsEarthMapScaleBoost(isMapView, locationType, sceneModel) {
    return isMapView && (locationType === 'station' || locationType === 'marsShip')
        && !stationShipOnOrbitPanel(sceneModel, locationType);
}

export function webglMarkerRadiusLocationType(locationType, sceneModel) {
    if (stationShipOnOrbitPanel(sceneModel, locationType)) return 'moon';
    return locationType;
}

export function attachEventMarkerToSceneList(sceneModel, marker, { isMapView, targetParent, globe }) {
    const markers = sceneModel.getMarkers();
    if (markers.indexOf(marker) === -1) {
        markers.push(marker);
    }
    if (isMapView && globe && targetParent === globe && marker.layers) {
        marker.layers.set(EARTH_GLOBE_LIGHT_LAYER);
    }
}
