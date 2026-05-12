import { EVENT_PIN_RENDER_ORDER } from '../../styling/eventMarkerRenderOrders.js';

/**
 * @param {Object} params
 * @returns {THREE.Line}
 */
export function createPinLine({ linePoints, color, animate, marker }) {
    const THREE = window.THREE;

    const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineMaterial = new THREE.LineBasicMaterial({
        color: color,
        transparent: animate,
        opacity: animate ? 0 : 1
    });

    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.renderOrder = EVENT_PIN_RENDER_ORDER;
    line.userData.isEventMarkerPin = true;
    line.userData.marker = marker;
    marker.userData.pinLine = line;

    return line;
}
