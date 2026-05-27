import { latLonToVector3 } from '../../../../Interactive-Worldview/worldview-shared-assets/utils/GeometryUtils.js';
import { useOrbitPanelForStationShipMarkers } from '../../../interface-platform-input/useOrbitPanelForStationShipMarkers.js';

/**
 * @returns {{linePoints: THREE.Vector3[], lineParent: THREE.Object3D}|null}
 */
export function createPinLinePoints({ locationType, markerPosition, lat, lon, globe, moonPlane, marsPlane, issSatellite, marsShipSatellite }) {
    const THREE = window.THREE;
    const sceneModel = window.globeController?.sceneModel;
    const isMapView = sceneModel?.getMapViewEnabled
        ? sceneModel.getMapViewEnabled()
        : !!sceneModel?.isMapView;
    if (isMapView) return null;

    const stationShipOnOrbit =
        (locationType === 'station' || locationType === 'marsShip')
        && sceneModel
        && useOrbitPanelForStationShipMarkers(sceneModel);
    if (stationShipOnOrbit) {
        const orbitParent = sceneModel.getOrbitMarkerParent?.() ?? sceneModel.getOrbitPlane?.() ?? sceneModel.orbitPlane;
        if (!orbitParent || !markerPosition) return null;
        const markerLocalPos = markerPosition.clone();
        const lineStart = new THREE.Vector3(markerLocalPos.x, markerLocalPos.y, 0);
        return {
            linePoints: [lineStart, markerLocalPos],
            lineParent: orbitParent
        };
    }

    if (locationType === 'earth') {
        return {
            linePoints: [
                latLonToVector3(lat, lon, 1.0),
                markerPosition
            ],
            lineParent: globe
        };
    }
    if (locationType === 'moon' && moonPlane) {
        const moonParent = window.globeController?.sceneModel?.getMoonMarkerParent
            ? window.globeController.sceneModel.getMoonMarkerParent()
            : moonPlane;
        const markerLocalPos = markerPosition.clone();
        const lineStart = new THREE.Vector3(markerLocalPos.x, markerLocalPos.y, 0);
        return {
            linePoints: [lineStart, markerLocalPos],
            lineParent: moonParent
        };
    }
    if (locationType === 'mars' && marsPlane) {
        const marsParent = window.globeController?.sceneModel?.getMarsMarkerParent
            ? window.globeController.sceneModel.getMarsMarkerParent()
            : marsPlane;
        const markerLocalPos = markerPosition.clone();
        const lineStart = new THREE.Vector3(markerLocalPos.x, markerLocalPos.y, 0);
        return {
            linePoints: [lineStart, markerLocalPos],
            lineParent: marsParent
        };
    }
    if (locationType === 'station' && issSatellite) {
        const lineStart = new THREE.Vector3(0, 0, 0);
        const lineEnd = markerPosition.clone();
        return {
            linePoints: [lineStart, lineEnd],
            lineParent: issSatellite
        };
    }
    if (locationType === 'marsShip' && marsShipSatellite) {
        const lineStart = new THREE.Vector3(0, 0, 0);
        const lineEnd = markerPosition.clone();
        return {
            linePoints: [lineStart, lineEnd],
            lineParent: marsShipSatellite
        };
    }

    return null;
}
