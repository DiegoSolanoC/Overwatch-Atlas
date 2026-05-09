/**
 * MarkerPositionHelpers - Utilities for calculating marker positions
 * Extracted from EventMarkerManager to reduce duplication
 */

import { latLonToVector3, xyToPlanePosition } from '../../../worldview/utils/GeometryUtils.js';
import { useOrbitPanelForStationShipMarkers } from './TransportOrbitPanelHelpers.js';

/**
 * Calculates position and target parent for a marker based on location type
 */
export function calculateMarkerPosition({ locationType, lat, lon, x, y, globe, moonPlane, marsPlane, issSatellite, marsShipSatellite }) {
    console.log('[calculateMarkerPosition] Called with locationType:', locationType);
    console.log('[calculateMarkerPosition] lat:', lat, 'lon:', lon, 'x:', x, 'y:', y);
    console.log('[calculateMarkerPosition] globe exists:', !!globe);
    console.log('[calculateMarkerPosition] moonPlane exists:', !!moonPlane);
    console.log('[calculateMarkerPosition] marsPlane exists:', !!marsPlane);
    console.log('[calculateMarkerPosition] issSatellite exists:', !!issSatellite);
    console.log('[calculateMarkerPosition] marsShipSatellite exists:', !!marsShipSatellite);
    
    const THREE = window.THREE;
    const sceneModel = window.globeController?.sceneModel;
    const isMapView = sceneModel?.getMapViewEnabled
        ? sceneModel.getMapViewEnabled()
        : !!sceneModel?.isMapView;
    const surfaceLiftZ = isMapView ? 0.002 : 0.03;
    console.log('[calculateMarkerPosition] isMapView:', isMapView);
    console.log('[calculateMarkerPosition] surfaceLiftZ:', surfaceLiftZ);

    if (locationType === 'station' || locationType === 'marsShip') {
        console.log('[calculateMarkerPosition] Processing station/marsShip marker');
        const useOrbitPanel = sceneModel && useOrbitPanelForStationShipMarkers(sceneModel);
        console.log(`[calculateMarkerPosition] ${locationType}: useOrbitPanel=${useOrbitPanel}`);
        if (useOrbitPanel) {
            const orbitPlane = sceneModel.getOrbitPlane?.() ?? sceneModel.orbitPlane;
            console.log('[calculateMarkerPosition] orbitPlane exists:', !!orbitPlane);
            if (!orbitPlane) {
                console.warn('[calculateMarkerPosition] Orbit plane not found, skipping station/marsShip marker');
                return null;
            }
            const orbitParent = sceneModel.getOrbitMarkerParent?.() ?? orbitPlane;
            console.log('[calculateMarkerPosition] orbitParent exists:', !!orbitParent);
            const finalX = x !== undefined ? x : 50;
            const finalY = y !== undefined ? y : 50;
            console.log('[calculateMarkerPosition] Using coordinates:', finalX, finalY);
            const pos = xyToPlanePosition(finalX, finalY, 0.4, 0.4, orbitParent.position, null, surfaceLiftZ);
            console.log(`[calculateMarkerPosition] ${locationType} on orbit panel at (${finalX}, ${finalY}), position:`, pos);
            return {
                position: pos,
                targetParent: orbitParent
            };
        }
        if (locationType === 'station') {
            console.log('[calculateMarkerPosition] Station marker - checking ISS satellite');
            if (!issSatellite) {
                console.warn('[calculateMarkerPosition] ISS satellite not found, skipping station marker');
                return null;
            }
            console.log('[calculateMarkerPosition] Station marker on ISS satellite');
            console.log('[calculateMarkerPosition] ISS satellite position:', issSatellite.position);
            return {
                position: new THREE.Vector3(0, 0, surfaceLiftZ),
                targetParent: issSatellite
            };
        }
        console.log('[calculateMarkerPosition] MarsShip marker - checking Mars Ship satellite');
        if (!marsShipSatellite) {
            console.warn('[calculateMarkerPosition] Mars Ship satellite not found, skipping marsShip marker');
            return null;
        }
        console.log('[calculateMarkerPosition] MarsShip marker on Mars Ship satellite');
        console.log('[calculateMarkerPosition] Mars Ship satellite position:', marsShipSatellite.position);
        return {
            position: new THREE.Vector3(0, 0, surfaceLiftZ),
            targetParent: marsShipSatellite
        };
    } else if (locationType === 'moon') {
        console.log('[calculateMarkerPosition] Processing moon marker');
        if (!moonPlane) {
            console.warn('Moon plane not found, skipping marker');
            return null;
        }
        const moonParent = window.globeController?.sceneModel?.getMoonMarkerParent
            ? window.globeController.sceneModel.getMoonMarkerParent()
            : moonPlane;
        console.log('[calculateMarkerPosition] moonParent exists:', !!moonParent);
        const finalX = x !== undefined ? x : 50;
        const finalY = y !== undefined ? y : 50;
        console.log('[calculateMarkerPosition] Using coordinates:', finalX, finalY);
        const pos = xyToPlanePosition(finalX, finalY, 0.4, 0.4, moonParent.position, null, surfaceLiftZ);
        console.log('[calculateMarkerPosition] Moon marker position:', pos);
        return {
            position: pos,
            targetParent: moonParent
        };
    } else if (locationType === 'mars') {
        console.log('[calculateMarkerPosition] Processing mars marker');
        if (!marsPlane) {
            console.warn('Mars plane not found, skipping marker');
            return null;
        }
        const marsParent = window.globeController?.sceneModel?.getMarsMarkerParent
            ? window.globeController.sceneModel.getMarsMarkerParent()
            : marsPlane;
        console.log('[calculateMarkerPosition] marsParent exists:', !!marsParent);
        const finalX = x !== undefined ? x : 50;
        const finalY = y !== undefined ? y : 50;
        console.log('[calculateMarkerPosition] Using coordinates:', finalX, finalY);
        const pos = xyToPlanePosition(finalX, finalY, 0.4, 0.4, marsParent.position, null, surfaceLiftZ);
        console.log('[calculateMarkerPosition] Mars marker position:', pos);
        return {
            position: pos,
            targetParent: marsParent
        };
    } else {
        console.log('[calculateMarkerPosition] Processing earth marker');
        if (isMapView) {
            console.log('[calculateMarkerPosition] Map view - skipping earth marker');
            return null;
        }
        const pos = latLonToVector3(lat, lon, 1.03);
        console.log('[calculateMarkerPosition] Earth marker position from lat/lon:', lat, lon, '->', pos);
        return {
            position: pos,
            targetParent: globe
        };
    }
}
