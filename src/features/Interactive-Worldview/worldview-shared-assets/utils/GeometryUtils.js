/**
 * GeometryUtils - Utility functions for coordinate conversion and geometry
 * Version: 1.2.0 (Oblate Earth: lat/lon ray meets WGS84-scaled ellipsoid)
 */

import { EARTH_POLAR_TO_EQUATORIAL_RATIO } from '../constants/GlobePhysicalConstants.js';

/**
 * Convert lat/lon to 3D on an oblate spheroid (equatorial radius = radius, polar = radius * WGS84 ratio).
 * Matches UV mapping that assumes spherical angles; ray from origin along that direction to the ellipsoid.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} radius - Equatorial radius (matches scaled globe mesh)
 * @returns {THREE.Vector3}
 */
export function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const ux = -(Math.sin(phi) * Math.cos(theta));
    const uz = Math.sin(phi) * Math.sin(theta);
    const uy = Math.cos(phi);

    const a = radius;
    const b = radius * EARTH_POLAR_TO_EQUATORIAL_RATIO;
    const inv = (ux * ux + uz * uz) / (a * a) + (uy * uy) / (b * b);
    const k = 1 / Math.sqrt(inv);

    return new THREE.Vector3(k * ux, k * uy, k * uz);
}

/**
 * Convert lat/lon to LOCAL 3D coordinates on a flat equirectangular map plane.
 * Assumes the map texture is equirectangular and the plane is centered at origin.
 * @param {number} lat - Latitude (-90..90)
 * @param {number} lon - Longitude (-180..180)
 * @param {number} planeWidth - Plane width in 3D units (default 2.0)
 * @param {number} planeHeight - Plane height in 3D units (default 1.0)
 * @param {number} z - Local Z offset to keep markers above plane surface
 * @returns {THREE.Vector3}
 */
export function latLonToMapPlanePosition(lat, lon, planeWidth = 2.0, planeHeight = 1.0, z = 0.03) {
    // Map lon [-180, 180] -> u [0,1], lat [90,-90] -> v [0,1]
    const u = (lon + 180) / 360;
    const v = (90 - lat) / 180;

    const x = (u - 0.5) * planeWidth;
    const y = (0.5 - v) * planeHeight;

    return new THREE.Vector3(x, y, z);
}

/**
 * Convert a 3D position on/near the Earth sphere back into lat/lon.
 * Inverse of latLonToVector3's angle conventions.
 * @param {THREE.Vector3} vec - World/local vector (radius can be any > 0)
 * @returns {{lat:number, lon:number}}
 */
export function vector3ToLatLon(vec) {
    const r = Math.max(1e-9, vec.length());
    const y = vec.y / r;
    const phi = Math.acos(Math.max(-1, Math.min(1, y))); // 0..pi
    const theta = Math.atan2(vec.z, -vec.x); // matches (lon + 180) in radians

    const lat = 90 - (phi * 180 / Math.PI);
    const lon = (theta * 180 / Math.PI) - 180;

    // Normalize lon to [-180, 180)
    const normLon = ((((lon + 180) % 360) + 360) % 360) - 180;
    return { lat, lon: normLon };
}

/**
 * Create arc between two lat/lon points
 * @param {number} lat1 - Start latitude
 * @param {number} lon1 - Start longitude
 * @param {number} lat2 - End latitude
 * @param {number} lon2 - End longitude
 * @param {number} altitude - Altitude above globe
 * @param {number} segments - Number of segments
 * @param {boolean} isMainConnection - Is main connection
 * @param {boolean} forceLongWay - Force the long way around (opposite direction)
 * @returns {Array<THREE.Vector3>}
 */
export function createArcBetweenPoints(lat1, lon1, lat2, lon2, altitude, segments, isMainConnection = true, forceLongWay = false) {
    const points = [];
    
    const lat1Rad = lat1 * Math.PI / 180;
    let lon1Rad = lon1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    let lon2Rad = lon2 * Math.PI / 180;
    
    // If forcing long way, adjust longitude to go the opposite direction
    if (forceLongWay) {
        // Normalize longitudes to 0-360 range
        const lon1Norm = ((lon1 % 360) + 360) % 360;
        const lon2Norm = ((lon2 % 360) + 360) % 360;
        
        // Calculate both directions
        const dLonShort = ((lon2Norm - lon1Norm + 540) % 360) - 180;
        const dLonLong = dLonShort > 0 ? dLonShort - 360 : dLonShort + 360;
        
        // Use the long way
        lon2Rad = lon1Rad + dLonLong * Math.PI / 180;
    }
    
    const dLon = lon2Rad - lon1Rad;
    const dLat = lat2Rad - lat1Rad;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const angularDistance = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    const distanceFactor = angularDistance / Math.PI;
    const baseArcHeight = isMainConnection ? 0.03 : 0.02;
    const maxArcHeight = baseArcHeight * distanceFactor;
    const minArcHeight = isMainConnection ? 0.005 : 0.003;
    const finalArcHeight = Math.max(minArcHeight, maxArcHeight);
    
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const fraction = t * angularDistance;
        
        const A = Math.sin((1 - t) * angularDistance) / Math.sin(angularDistance);
        const B = Math.sin(t * angularDistance) / Math.sin(angularDistance);
        
        const x = A * Math.cos(lat1Rad) * Math.cos(lon1Rad) + B * Math.cos(lat2Rad) * Math.cos(lon2Rad);
        const y = A * Math.cos(lat1Rad) * Math.sin(lon1Rad) + B * Math.cos(lat2Rad) * Math.sin(lon2Rad);
        const z = A * Math.sin(lat1Rad) + B * Math.sin(lat2Rad);
        
        const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI;
        const lon = Math.atan2(y, x) * 180 / Math.PI;
        
        const arcHeight = Math.sin(t * Math.PI) * finalArcHeight;
        const currentAltitude = altitude + arcHeight;
        
        const point = latLonToVector3(lat, lon, currentAltitude);
        points.push(point);
    }
    
    return points;
}

/**
 * Convert 2D plane coordinates (0-100, 0-100) to 3D position on a plane
 * @param {number} x - X coordinate (0-100, where 0 is left, 100 is right)
 * @param {number} y - Y coordinate (0-100, where 0 is top, 100 is bottom)
 * @param {number} planeWidth - Width of the plane in 3D units
 * @param {number} planeHeight - Height of the plane in 3D units
 * @param {THREE.Vector3} planeCenter - Center position of the plane in 3D space
 * @param {THREE.Vector3} planeNormal - Normal vector of the plane (default: 0, 0, 1 for XY plane)
 * @returns {THREE.Vector3}
 */
export function xyToPlanePosition(x, y, planeWidth, planeHeight, planeCenter, planeNormal = null, surfaceZ = 0.03) {
    // Convert from 0-100 coordinate system to -1 to 1 (centered)
    // (0,0) = top-left in image = (-width/2, height/2) in 3D
    // (100,100) = bottom-right in image = (width/2, -height/2) in 3D
    const normalizedX = (x / 100) * 2 - 1; // Convert 0-100 to -1 to 1
    const normalizedY = 1 - (y / 100) * 2; // Convert 0-100 to 1 to -1 (flip Y)
    
    // Calculate position on plane (plane default orientation: faces +Z axis)
    // Plane is positioned at planeCenter and faces camera (at z=3.5)
    // Since markers are added as children of the plane, we need LOCAL coordinates (relative to plane center)
    const localX = normalizedX * (planeWidth / 2);
    const localY = normalizedY * (planeHeight / 2);
    const localZ = surfaceZ;
    
    // Plane default orientation: X is left-right, Y is up-down, Z is forward-back
    // Since markers are children of the plane, return LOCAL position (not world position)
    // The plane's position (1.5, 0.3, 0) will be added automatically by Three.js
    const localPosition = new THREE.Vector3(localX, localY, localZ);
    
    return localPosition;
}