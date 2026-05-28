/**
 * GlobeConnectionHelpers - Utilities for creating connection lines
 * Extracted from WorldviewGlobeView to reduce duplication
 */

import { createArcBetweenPoints } from '../../../worldview-shared-assets/utils/WorldviewGeometry.js';

/**
 * Creates a connection line between two locations
 * @param {Object} params - Parameters
 * @param {Object} params.fromLocation - From location with lat/lon
 * @param {Object} params.toLocation - To location with lat/lon
 * @param {number} params.radius - Curve radius (default 1.02)
 * @param {number} params.segments - Number of segments (default 50)
 * @param {boolean} params.useArc - Whether to use arc (default true)
 * @param {boolean} params.forceLongWay - Force long way around (default false)
 * @param {THREE.Object3D} params.parent - Parent object to add line to
 * @param {Function} params.onCurveCreated - Optional callback with curve data
 * @param {Object} params.lineConfig - Line configuration
 * @param {number} params.lineConfig.radius - Tube radius
 * @param {number} params.lineConfig.color - Line color (hex)
 * @param {number} params.lineConfig.opacity - Line opacity
 * @param {string} params.lineConfig.userDataKey - UserData key to set
 * @param {boolean} params.lineConfig.visible - Initial visibility (default true)
 * @returns {THREE.Mesh} - Created tube mesh
 */
export function createConnectionLine({ 
    fromLocation, 
    toLocation, 
    radius = 1.02, 
    segments = 50, 
    useArc = true, 
    forceLongWay = false,
    parent,
    onCurveCreated,
    lineConfig
}) {
    const curvePoints = createArcBetweenPoints(
        fromLocation.lat, fromLocation.lon,
        toLocation.lat, toLocation.lon,
        radius, segments, useArc, forceLongWay
    );
    
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    
    if (onCurveCreated) {
        onCurveCreated({
            curve: curve,
            from: fromLocation.name || fromLocation.from,
            to: toLocation.name || toLocation.to,
            fromLat: fromLocation.lat,
            fromLon: fromLocation.lon,
            toLat: toLocation.lat,
            toLon: toLocation.lon
        });
    }
    
    const tubeGeometry = new THREE.TubeGeometry(curve, segments, lineConfig.radius, 8, false);
    const tubeMaterial = new THREE.MeshBasicMaterial({
        color: lineConfig.color,
        transparent: true,
        opacity: lineConfig.opacity
    });
    
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    if (lineConfig.userDataKey) {
        tube.userData[lineConfig.userDataKey] = true;
    }
    tube.visible = lineConfig.visible !== false;
    
    parent.add(tube);
    
    return tube;
}

/**
 * Creates gradient glow effect for a connection line
 * @param {THREE.CatmullRomCurve3} curve - Base curve
 * @param {THREE.Object3D} parent - Parent object to add glow to
 * @param {number} baseRadius - Base radius for glow
 * @param {number} segments - Number of segments (default 50)
 * @param {number} layers - Number of glow layers (default 2)
 */
export function createConnectionGlow(curve, parent, baseRadius, segments = 50, layers = 2) {
    for (let layer = 0; layer < layers; layer++) {
        const radiusMultiplier = 1 + layer * 0.8;
        const layerRadius = baseRadius * radiusMultiplier;
        
        const points = curve.getPoints(segments);
        const radialSegments = 8;
        const radiusArray = [];
        
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const fadeFactor = Math.sin(t * Math.PI);
            radiusArray.push(layerRadius * fadeFactor);
        }
        
        const glowPath = new THREE.CatmullRomCurve3(points);
        const glowGeometry = new THREE.TubeGeometry(
            glowPath, 
            segments, 
            layerRadius, 
            radialSegments, 
            false
        );
        
        const positionAttr = glowGeometry.attributes.position;
        for (let i = 0; i < positionAttr.count; i++) {
            const segmentIndex = Math.floor(i / (radialSegments + 1));
            if (segmentIndex < radiusArray.length) {
                const scaleFactor = radiusArray[segmentIndex] / layerRadius;
                const x = positionAttr.getX(i);
                const y = positionAttr.getY(i);
                const z = positionAttr.getZ(i);
                
                const centerPoint = points[segmentIndex];
                const dx = x - centerPoint.x;
                const dy = y - centerPoint.y;
                const dz = z - centerPoint.z;
                
                positionAttr.setXYZ(
                    i,
                    centerPoint.x + dx * scaleFactor,
                    centerPoint.y + dy * scaleFactor,
                    centerPoint.z + dz * scaleFactor
                );
            }
        }
        positionAttr.needsUpdate = true;
        
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffcc00,
            transparent: true,
            opacity: 0.3 / (layer + 1)
        });
        
        const glowTube = new THREE.Mesh(glowGeometry, glowMaterial);
        glowTube.userData.isConnectionLine = true;
        parent.add(glowTube);
    }
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.GlobeConnectionHelpers) {
        window.GlobeConnectionHelpers = {};
    }
    window.GlobeConnectionHelpers.createConnectionLine = createConnectionLine;
    window.GlobeConnectionHelpers.createConnectionGlow = createConnectionGlow;
}
