/**
 * NavigationCoordinateHelpers - Coordinate matching utilities for event navigation
 */

/**
 * Matches coordinates for current event data against a target event
 * @param {Object} currentEventData - Current event data
 * @param {Object} targetEvent - Target event to match against
 * @param {string} locationType - Location type ('earth', 'moon', 'mars', 'station')
 * @returns {boolean} - True if coordinates match
 */
export function matchEventCoordinates(currentEventData, targetEvent, locationType) {
    if (locationType === 'station' || locationType === 'marsShip') {
        // Station / Mars Ship: match by name only (no fixed coordinates)
        return true;
    }
    
    if (locationType === 'moon' || locationType === 'mars') {
        // Moon/Mars: match by x/y coordinates
        const currentX = currentEventData.x;
        const currentY = currentEventData.y;
        const targetX = targetEvent.x;
        const targetY = targetEvent.y;
        
        if (currentX !== undefined && currentY !== undefined && targetX !== undefined && targetY !== undefined) {
            return Math.abs(targetX - currentX) < 0.1 && Math.abs(targetY - currentY) < 0.1;
        }
        return false;
    } else {
        // Earth: match by lat/lon
        const currentLat = currentEventData.lat;
        const currentLon = currentEventData.lon;
        const targetLat = targetEvent.lat;
        const targetLon = targetEvent.lon;
        
        if (currentLat !== undefined && currentLon !== undefined && targetLat !== undefined && targetLon !== undefined) {
            return Math.abs(targetLat - currentLat) < 0.0001 && Math.abs(targetLon - currentLon) < 0.0001;
        }
        return false;
    }
}

/**
 * Gets coordinate values from event data (handles variants)
 * @param {Object} eventData - Event data object
 * @param {string} locationType - Location type
 * @returns {Object} - Object with coordinate values
 */
export function getEventCoordinates(eventData, locationType) {
    if (locationType === 'moon' || locationType === 'mars') {
        return {
            x: eventData.x !== undefined ? eventData.x : (eventData.variants?.[0]?.x !== undefined ? eventData.variants[0].x : undefined),
            y: eventData.y !== undefined ? eventData.y : (eventData.variants?.[0]?.y !== undefined ? eventData.variants[0].y : undefined)
        };
    } else if (locationType === 'station' || locationType === 'marsShip') {
        return {}; // Station/marsShip events don't have coordinates
    } else {
        return {
            lat: eventData.lat !== undefined ? eventData.lat : (eventData.variants?.[0]?.lat !== undefined ? eventData.variants[0].lat : undefined),
            lon: eventData.lon !== undefined ? eventData.lon : (eventData.variants?.[0]?.lon !== undefined ? eventData.variants[0].lon : undefined)
        };
    }
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.NavigationCoordinateHelpers) {
        window.NavigationCoordinateHelpers = {};
    }
    window.NavigationCoordinateHelpers.matchEventCoordinates = matchEventCoordinates;
    window.NavigationCoordinateHelpers.getEventCoordinates = getEventCoordinates;
}
