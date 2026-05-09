/**
 * LocationDisplayHelpers - Utilities for displaying location information
 * Extracted from EventSlideManager to reduce duplication
 */

/**
 * Creates location content HTML with country flag (or fictional / off-world flag) when resolvable.
 * @param {string} locationName - Location name to display
 * @param {string} [locationType='earth'] - earth | moon | mars | station | marsShip
 * @returns {string} - HTML string with flag/icon and location name
 */
export function createLocationContent(locationName, locationType = 'earth') {
    if (typeof window !== 'undefined' && window.LocationFlagHelpers && typeof window.LocationFlagHelpers.createLocationRowInnerHtml === 'function') {
        return window.LocationFlagHelpers.createLocationRowInnerHtml(locationName, locationType);
    }
    return `<img class="event-location-pin" src="src/assets/images/Icons/Filter%20Icons/Location%20Icon.png" alt="" width="28" height="28" decoding="async" /> ${locationName}`;
}

/**
 * Sets up location element with fade transition
 * @param {HTMLElement} element - Location element
 * @param {string} content - HTML content
 * @param {boolean} isAlreadyOpen - Whether slide is already open
 */
export function setLocationContentWithFade(element, content, isAlreadyOpen) {
    if (!element) return;
    
    if (isAlreadyOpen) {
        element.style.transition = 'opacity 0.2s ease';
        element.style.opacity = '0';
        setTimeout(() => {
            element.innerHTML = content;
            element.style.display = 'block';
            setTimeout(() => {
                element.style.opacity = '1';
            }, 10);
        }, 200);
    } else {
        element.innerHTML = content;
        element.style.display = 'block';
        element.style.opacity = '1';
    }
}

/**
 * Hides location element with fade transition
 * @param {HTMLElement} element - Location element
 * @param {boolean} isAlreadyOpen - Whether slide is already open
 */
export function hideLocationWithFade(element, isAlreadyOpen) {
    if (!element) return;
    
    if (isAlreadyOpen) {
        element.style.transition = 'opacity 0.2s ease';
        element.style.opacity = '0';
        setTimeout(() => {
            element.style.display = 'none';
        }, 200);
    } else {
        element.style.display = 'none';
    }
    element.onclick = null;
    element.style.cursor = '';
    element.title = '';
}

/**
 * Sets up click handler for location element
 * @param {HTMLElement} element - Location element
 * @param {Object} marker - Event marker
 * @param {string} locationType - Location type (earth, moon, mars, station)
 */
export function setupLocationClickHandler(element, marker, locationType) {
    if (!element || !marker) return;
    
    element.style.cursor = 'pointer';
    element.title = 'Click to zoom to location';
    element.onclick = (e) => {
        e.stopPropagation();
        if (!window.globeController || !window.globeController.interactionController) return;
        
        if (locationType === 'moon' || locationType === 'mars') {
            window.globeController.interactionController.resetCameraToDefault();
        } else if (locationType === 'station' || locationType === 'marsShip') {
            // Guard rail: check if on orbit panel
            const sceneModel = window.globeController?.sceneModel;
            const orbitMarkerParent = sceneModel?.getOrbitMarkerParent ? sceneModel.getOrbitMarkerParent() : sceneModel?.orbitPlane;
            const isOnOrbitPanel = orbitMarkerParent && marker.parent === orbitMarkerParent;
            
            if (isOnOrbitPanel) {
                // Treat like moon/mars - reset camera instead of following
                window.globeController.interactionController.resetCameraToDefault();
            } else {
                window.globeController.interactionController.setPlanesVisibility(false);
                window.globeController.interactionController.startFollowingStation(marker);
            }
        } else {
            window.globeController.interactionController.zoomToMarker(marker);
        }
    };
}

/**
 * Gets location name for Earth location type
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} locationName - Existing location name (optional)
 * @returns {string|null} - Location name or null
 */
export function getEarthLocationName(lat, lon, locationName = null) {
    if (locationName) return locationName;
    
    if (!window.eventManager) return null;
    
    // Check cache first
    const cacheKey = `${lat.toFixed(4)}_${lon.toFixed(4)}`;
    if (window.eventManager.locationCache && window.eventManager.locationCache.has(cacheKey)) {
        return window.eventManager.locationCache.get(cacheKey);
    }
    
    // Get location name (may return city only, will be enhanced later)
    return window.eventManager.getLocationName(lat, lon);
}

/**
 * Gets location name for Moon/Mars location type
 * @param {string} locationType - 'moon' or 'mars'
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} locationName - Existing location name (optional)
 * @returns {string} - Location name
 */
export function getMoonMarsLocationName(locationType, x, y, locationName = null) {
    if (locationName) return locationName;
    
    if (x !== undefined && y !== undefined) {
        return `${locationType === 'moon' ? 'Moon' : 'Mars'}: (${x.toFixed(1)}, ${y.toFixed(1)})`;
    }
    
    return locationType === 'moon' ? 'Moon' : 'Mars';
}

/**
 * Gets location name for Station location type
 * @param {string} locationName - Existing location name (optional)
 * @returns {string} - Location name
 */
export function getStationLocationName(locationName = null) {
    return locationName || 'Space Station (ISS)';
}

/**
 * Gets location name for Mars Ship location type
 * @param {string} locationName - Existing location name (optional)
 * @returns {string}
 */
export function getMarsShipLocationName(locationName = null) {
    return locationName || 'Red Promise Escape Ship';
}

/**
 * Sets up location display for Earth type
 * @param {HTMLElement} element - Location element
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Object} marker - Event marker
 * @param {boolean} isAlreadyOpen - Whether slide is already open
 * @param {string|null} existingLocationName - Existing location name (optional)
 * @param {boolean} enableUpdateCallback - Whether to enable location update callback
 * @returns {boolean} - True if location was set up successfully
 */
export function setupEarthLocation(element, lat, lon, marker, isAlreadyOpen, existingLocationName = null, enableUpdateCallback = false) {
    if (!element || lat === undefined || lon === undefined) return false;
    
    const locationName = getEarthLocationName(lat, lon, existingLocationName);
    
    if (locationName) {
        const content = createLocationContent(locationName, 'earth');
        setLocationContentWithFade(element, content, isAlreadyOpen);
        setupLocationClickHandler(element, marker, 'earth');
        if (marker && marker.userData && marker.userData.isMap2dLiteProxy) {
            element.onclick = (e) => {
                e.stopPropagation();
                window.globeController?.map2dLite?.flyToLatLon(lat, lon);
            };
        }
        
        // Set up location update callback if enabled
        if (enableUpdateCallback) {
            const updateLocationInSlide = (updatedLat, updatedLon, updatedLocationName) => {
                if (Math.abs(updatedLat - lat) < 0.01 && Math.abs(updatedLon - lon) < 0.01) {
                    const updatedContent = createLocationContent(updatedLocationName, 'earth');
                    element.innerHTML = updatedContent;
                    setupLocationClickHandler(element, marker, 'earth');
                }
            };
            window.updateEventSlideLocation = updateLocationInSlide;
        }
        
        return true;
    } else {
        // Show coordinates as fallback
        const content = createLocationContent(`${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'earth');
        setLocationContentWithFade(element, content, isAlreadyOpen);
        setupLocationClickHandler(element, marker, 'earth');
        if (marker && marker.userData && marker.userData.isMap2dLiteProxy) {
            element.onclick = (e) => {
                e.stopPropagation();
                window.globeController?.map2dLite?.flyToLatLon(lat, lon);
            };
        }
        return true;
    }
}

/**
 * Sets up location display for Moon/Mars type
 * @param {HTMLElement} element - Location element
 * @param {string} locationType - 'moon' or 'mars'
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} locationName - Existing location name (optional)
 * @param {Object} marker - Event marker
 * @param {boolean} isAlreadyOpen - Whether slide is already open
 * @returns {boolean} - True if location was set up successfully
 */
export function setupMoonMarsLocation(element, locationType, x, y, locationName, marker, isAlreadyOpen) {
    if (!element) return false;
    
    const name = getMoonMarsLocationName(locationType, x, y, locationName);
    
    if (name) {
        const content = createLocationContent(name, locationType);
        setLocationContentWithFade(element, content, isAlreadyOpen);
        setupLocationClickHandler(element, marker, locationType);
        return true;
    } else {
        hideLocationWithFade(element, isAlreadyOpen);
        return false;
    }
}

/**
 * Sets up location display for Station type
 * @param {HTMLElement} element - Location element
 * @param {string} locationName - Existing location name (optional)
 * @param {Object} marker - Event marker
 * @param {boolean} isAlreadyOpen - Whether slide is already open
 * @returns {boolean} - True if location was set up successfully
 */
export function setupStationLocation(element, locationName, marker, isAlreadyOpen) {
    if (!element) return false;
    
    const name = getStationLocationName(locationName);
    
    if (name) {
        const content = createLocationContent(name, 'station');
        setLocationContentWithFade(element, content, isAlreadyOpen);
        setupLocationClickHandler(element, marker, 'station');
        return true;
    } else {
        hideLocationWithFade(element, isAlreadyOpen);
        return false;
    }
}

/**
 * Sets up location display for Mars Ship type
 */
export function setupMarsShipLocation(element, locationName, marker, isAlreadyOpen) {
    if (!element) return false;

    const name = getMarsShipLocationName(locationName);
    if (name) {
        const content = createLocationContent(name, 'marsShip');
        setLocationContentWithFade(element, content, isAlreadyOpen);
        setupLocationClickHandler(element, marker, 'marsShip');
        return true;
    } else {
        hideLocationWithFade(element, isAlreadyOpen);
        return false;
    }
}
