/**
 * GlobeConnectionHelpers - Utilities for creating connection lines
 * Extracted from WorldviewGlobeView to reduce duplication
 */

import {
    createArcBetweenPoints,
    latLonToVector3,
    vector3ToLatLon
} from '../../../worldview-shared-assets/utils/WorldviewGeometry.js';

/**
 * Normalize a via entry to { lat, lon }.
 * Accepts { lat, lon }, [lat, lon], or a named location resolved via `resolveName`.
 * @param {Object|Array|string} entry
 * @param {Function} [resolveName] - (name) => {lat,lon}|null
 * @returns {{lat:number, lon:number}|null}
 */
export function normalizeViaPoint(entry, resolveName) {
    if (!entry) return null;
    if (typeof entry === 'string' && typeof resolveName === 'function') {
        const loc = resolveName(entry);
        if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lon)) {
            return { lat: loc.lat, lon: loc.lon, name: entry };
        }
        return null;
    }
    if (Array.isArray(entry) && entry.length >= 2) {
        const lat = Number(entry[0]);
        const lon = Number(entry[1]);
        if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
        return null;
    }
    if (typeof entry === 'object') {
        const lat = Number(entry.lat);
        const lon = Number(entry.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
            return { lat, lon, name: entry.name };
        }
    }
    return null;
}

/**
 * Build a surface curve through from → vias → to using Catmull-Rom,
 * then re-project samples onto the ellipsoid so boats stay at sea level.
 * @param {Object} fromLocation
 * @param {Object} toLocation
 * @param {Array<{lat:number, lon:number}>} viaLocations
 * @param {number} radius
 * @param {number} segments
 * @returns {THREE.Vector3[]}
 */
export function createViaSurfacePoints(fromLocation, toLocation, viaLocations, radius, segments) {
    const controls = [
        latLonToVector3(fromLocation.lat, fromLocation.lon, radius),
        ...viaLocations.map((v) => latLonToVector3(v.lat, v.lon, radius)),
        latLonToVector3(toLocation.lat, toLocation.lon, radius)
    ];

    const ctrlCurve = new THREE.CatmullRomCurve3(controls);
    ctrlCurve.curveType = 'centripetal';

    const sampleCount = Math.max(segments, (viaLocations.length + 1) * 28);
    const points = [];
    for (let i = 0; i <= sampleCount; i++) {
        const raw = ctrlCurve.getPoint(i / sampleCount);
        const ll = vector3ToLatLon(raw);
        points.push(latLonToVector3(ll.lat, ll.lon, radius));
    }
    return points;
}

/**
 * Creates a connection line between two locations
 * @param {Object} params - Parameters
 * @param {Object} params.fromLocation - From location with lat/lon
 * @param {Object} params.toLocation - To location with lat/lon
 * @param {Array<{lat:number, lon:number}>} [params.viaLocations] - Optional midpoints (boats)
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
/**
 * Nudge path points sideways (0 at endpoints) so parallel corridors don't stack.
 * @param {THREE.Vector3[]} points
 * @param {number} lateralOffset
 * @returns {THREE.Vector3[]}
 */
export function applyLateralCorridorOffset(points, lateralOffset) {
    if (!points?.length || !lateralOffset) return points;
    const out = [];
    const tangent = new THREE.Vector3();
    const up = new THREE.Vector3();
    const right = new THREE.Vector3();
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const t = i / Math.max(1, points.length - 1);
        const fade = Math.sin(t * Math.PI);
        const prev = points[Math.max(0, i - 1)];
        const next = points[Math.min(points.length - 1, i + 1)];
        tangent.subVectors(next, prev);
        if (tangent.lengthSq() < 1e-12) {
            out.push(p.clone());
            continue;
        }
        tangent.normalize();
        up.copy(p).normalize();
        right.crossVectors(tangent, up);
        if (right.lengthSq() < 1e-12) {
            out.push(p.clone());
            continue;
        }
        right.normalize();
        const q = p.clone().addScaledVector(right, lateralOffset * fade);
        q.setLength(p.length());
        out.push(q);
    }
    return out;
}

export function createConnectionLine({
    fromLocation,
    toLocation,
    viaLocations = null,
    radius = 1.02,
    segments = 50,
    useArc = true,
    forceLongWay = false,
    lateralOffset = 0,
    parent,
    onCurveCreated,
    lineConfig
}) {
    const vias = Array.isArray(viaLocations)
        ? viaLocations.filter((v) => v && Number.isFinite(v.lat) && Number.isFinite(v.lon))
        : [];

    let curvePoints;
    let tubeSegments = segments;
    if (vias.length > 0) {
        curvePoints = createViaSurfacePoints(fromLocation, toLocation, vias, radius, segments);
        tubeSegments = Math.max(segments, (vias.length + 1) * 28);
    } else {
        curvePoints = createArcBetweenPoints(
            fromLocation.lat, fromLocation.lon,
            toLocation.lat, toLocation.lon,
            radius, segments, useArc, forceLongWay
        );
    }

    if (lateralOffset) {
        curvePoints = applyLateralCorridorOffset(curvePoints, lateralOffset);
    }

    const curve = new THREE.CatmullRomCurve3(curvePoints);

    if (onCurveCreated) {
        onCurveCreated({
            curve: curve,
            from: fromLocation.name || fromLocation.from,
            to: toLocation.name || toLocation.to,
            fromLat: fromLocation.lat,
            fromLon: fromLocation.lon,
            toLat: toLocation.lat,
            toLon: toLocation.lon,
            via: vias.length ? vias : undefined
        });
    }

    const tubeGeometry = new THREE.TubeGeometry(curve, tubeSegments, lineConfig.radius, 8, false);
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
    window.GlobeConnectionHelpers.normalizeViaPoint = normalizeViaPoint;
    window.GlobeConnectionHelpers.createViaSurfacePoints = createViaSurfacePoints;
}
