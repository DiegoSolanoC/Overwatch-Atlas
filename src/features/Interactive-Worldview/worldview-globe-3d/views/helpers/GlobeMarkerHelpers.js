/**
 * GlobeMarkerHelpers - Utilities for creating markers
 * Extracted from GlobeView to reduce duplication
 */

import { latLonToVector3 } from '../../../worldview-shared-assets/utils/GeometryUtils.js';

/**
 * Creates a marker with pin line
 * @param {Object} params - Parameters
 * @param {Object} params.location - Location object with lat/lon
 * @param {number} params.radius - Marker radius
 * @param {number} params.color - Marker color (hex)
 * @param {number} params.pinColor - Pin line color (hex)
 * @param {number} params.elevation - Elevation above globe (default 1.02)
 * @param {Object} params.userData - User data to attach to marker
 * @param {THREE.Object3D} params.parent - Parent object to add marker to
 * @param {Array} params.markersArray - Array to push marker to
 * @param {boolean} params.visible - Initial visibility (default true)
 * @param {boolean} params.pinVisible - Whether the pin line is visible (default true). Set false for city/seaport markers so only event pins show and "loose" pins at shared locations are avoided.
 * @returns {THREE.Mesh} - Created marker mesh
 */
export function createMarkerWithPin({ location, radius, color, pinColor, elevation = 1.02, userData, parent, markersArray, visible = true, pinVisible = true }) {
    const position = latLonToVector3(location.lat, location.lon, elevation);
    
    const markerGeometry = new THREE.SphereGeometry(radius, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ color });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(position);
    marker.userData = userData;
    marker.visible = visible;
    
    // Add pin line (hidden for city/seaport so only event pins show; avoids loose pins when event marker is not on current page)
    const pinLineStart = latLonToVector3(location.lat, location.lon, 1.0);
    const pinLineEnd = position;
    const pinLineGeometry = new THREE.BufferGeometry().setFromPoints([pinLineStart, pinLineEnd]);
    const pinLineMaterial = new THREE.LineBasicMaterial({ 
        color: pinColor,
        transparent: true,
        opacity: (visible && pinVisible) ? 1.0 : 0.7
    });
    const pinLine = new THREE.Line(pinLineGeometry, pinLineMaterial);
    pinLine.userData.isMarkerPin = true;
    // Copy seaport marker flag to pin line if present
    if (userData && userData.isSeaportMarker) {
        pinLine.userData.isSeaportMarker = true;
        pinLine.userData.isSeaportMarkerPin = true;
    }
    pinLine.visible = visible && pinVisible;
    
    parent.add(marker);
    parent.add(pinLine);
    
    if (markersArray) {
        markersArray.push(marker);
    }
    
    return marker;
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.GlobeMarkerHelpers) {
        window.GlobeMarkerHelpers = {};
    }
    window.GlobeMarkerHelpers.createMarkerWithPin = createMarkerWithPin;
}
