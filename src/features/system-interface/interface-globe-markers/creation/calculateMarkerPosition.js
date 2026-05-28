import { latLonToVector3, xyToPlanePosition } from '../../../world/worldview-shared-assets/utils/WorldviewGeometry.js';
import { useOrbitPanelForStationShipMarkers } from '../../interface-platform-input/useOrbitPanelForStationShipMarkers.js';

/**
 * Position and parent object for an event marker from location + scene refs.
 */
export function calculateMarkerPosition({ locationType, lat, lon, x, y, globe, moonPlane, marsPlane, issSatellite, marsShipSatellite }) {
    const THREE = window.THREE;
    const sceneModel = window.globeController?.sceneModel;
    const isMapView = sceneModel?.getMapViewEnabled
        ? sceneModel.getMapViewEnabled()
        : !!sceneModel?.isMapView;
    const surfaceLiftZ = isMapView ? 0.002 : 0.03;

    if (locationType === 'station' || locationType === 'marsShip') {
        const useOrbitPanel = sceneModel && useOrbitPanelForStationShipMarkers(sceneModel);
        if (useOrbitPanel) {
            const orbitPlane = sceneModel.getOrbitPlane?.() ?? sceneModel.orbitPlane;
            if (!orbitPlane) {
                console.warn('[calculateMarkerPosition] Orbit plane not found, skipping station/marsShip marker');
                return null;
            }
            const orbitParent = sceneModel.getOrbitMarkerParent?.() ?? orbitPlane;
            const finalX = x !== undefined ? x : 50;
            const finalY = y !== undefined ? y : 50;
            const pos = xyToPlanePosition(finalX, finalY, 0.4, 0.4, orbitParent.position, null, surfaceLiftZ);
            return {
                position: pos,
                targetParent: orbitParent
            };
        }
        if (locationType === 'station') {
            if (!issSatellite) {
                console.warn('[calculateMarkerPosition] ISS satellite not found, skipping station marker');
                return null;
            }
            return {
                position: new THREE.Vector3(0, 0, surfaceLiftZ),
                targetParent: issSatellite
            };
        }
        if (!marsShipSatellite) {
            console.warn('[calculateMarkerPosition] Mars Ship satellite not found, skipping marsShip marker');
            return null;
        }
        return {
            position: new THREE.Vector3(0, 0, surfaceLiftZ),
            targetParent: marsShipSatellite
        };
    }
    if (locationType === 'moon') {
        if (!moonPlane) {
            console.warn('Moon plane not found, skipping marker');
            return null;
        }
        const moonParent = window.globeController?.sceneModel?.getMoonMarkerParent
            ? window.globeController.sceneModel.getMoonMarkerParent()
            : moonPlane;
        const finalX = x !== undefined ? x : 50;
        const finalY = y !== undefined ? y : 50;
        const pos = xyToPlanePosition(finalX, finalY, 0.4, 0.4, moonParent.position, null, surfaceLiftZ);
        return {
            position: pos,
            targetParent: moonParent
        };
    }
    if (locationType === 'mars') {
        if (!marsPlane) {
            console.warn('Mars plane not found, skipping marker');
            return null;
        }
        const marsParent = window.globeController?.sceneModel?.getMarsMarkerParent
            ? window.globeController.sceneModel.getMarsMarkerParent()
            : marsPlane;
        const finalX = x !== undefined ? x : 50;
        const finalY = y !== undefined ? y : 50;
        const pos = xyToPlanePosition(finalX, finalY, 0.4, 0.4, marsParent.position, null, surfaceLiftZ);
        return {
            position: pos,
            targetParent: marsParent
        };
    }
    if (isMapView) {
        return null;
    }
    const pos = latLonToVector3(lat, lon, 1.03);
    return {
        position: pos,
        targetParent: globe
    };
}
