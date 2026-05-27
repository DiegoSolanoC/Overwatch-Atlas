import { EVENT_MARKER_RENDER_ORDER } from '../styling/eventMarkerRenderOrders.js';

/**
 * @param {Object} params
 * @param {number} params.radius
 * @param {number} params.color - hex
 * @param {THREE.Vector3} params.position
 * @param {boolean} [params.flatOnPlane=false]
 * @returns {THREE.Mesh}
 */
export function createMarkerMesh({ radius, color, position, flatOnPlane = false }) {
    const THREE = window.THREE;

    let markerGeometry;
    if (flatOnPlane) {
        markerGeometry = new THREE.CircleGeometry(radius, 28);
    } else {
        markerGeometry = new THREE.SphereGeometry(radius, 16, 16);
    }

    const markerMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        side: flatOnPlane ? THREE.DoubleSide : THREE.FrontSide,
        polygonOffset: flatOnPlane,
        polygonOffsetFactor: flatOnPlane ? -1 : 0,
        polygonOffsetUnits: flatOnPlane ? -1 : 0
    });

    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.material.needsUpdate = true;
    marker.position.copy(position);
    marker.renderOrder = EVENT_MARKER_RENDER_ORDER;
    if (flatOnPlane) {
        marker.userData.isFlatMapEventMarker = true;
    }

    return marker;
}
