/**
 * MarkerCreationHelpers - Utilities for creating event markers
 * Extracted from EventMarkerManager to reduce duplication
 */

/** Draw after clouds (0) / aurora (1) / rim (1–2) so pins and hover don’t fight atmosphere. */
export const EVENT_PIN_RENDER_ORDER = 14;
export const EVENT_MARKER_RENDER_ORDER = 15;
/** Must match {@link EVENT_MARKER_RENDER_ORDER} usage in MarkerPulseService (script tag; no shared import). */
export const EVENT_PULSE_RING_RENDER_ORDER = 17;

/**
 * Creates a marker mesh with specified properties
 * @param {Object} params - Parameters
 * @param {number} params.radius - Marker radius
 * @param {number} params.color - Marker color (hex)
 * @param {THREE.Vector3} params.position - Marker position
 * @returns {THREE.Mesh} - The created marker mesh
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

/**
 * Creates marker userData object
 * @param {Object} params - Parameters
 * @param {Object} params.event - Event object
 * @param {Object} params.variant - Variant object (optional)
 * @param {number} params.variantIndex - Variant index (optional)
 * @param {string} params.displayName - Display name
 * @param {string} params.locationType - Location type
 * @param {number} params.lat - Latitude (optional)
 * @param {number} params.lon - Longitude (optional)
 * @param {number} params.x - X coordinate (optional)
 * @param {number} params.y - Y coordinate (optional)
 * @param {boolean} params.isInteractive - Whether marker is interactive
 * @param {boolean} params.isMainVariant - Whether this is the main variant
 * @param {boolean} params.shouldBeLocked - Whether marker should be locked
 * @param {number} params.originalColor - Original color for restoration
 * @returns {Object} - UserData object
 */
export function createMarkerUserData({ 
    event, 
    variant, 
    variantIndex, 
    displayName, 
    locationType, 
    lat, 
    lon, 
    x, 
    y, 
    isInteractive, 
    isMainVariant, 
    shouldBeLocked, 
    originalColor 
}) {
    return {
        event: event,
        variant: variant || undefined,
        variantIndex: variantIndex !== undefined ? variantIndex : undefined,
        eventName: displayName,
        locationType: locationType,
        lat: locationType === 'earth' ? lat : undefined,
        lon: locationType === 'earth' ? lon : undefined,
        x: locationType !== 'earth' ? x : undefined,
        y: locationType !== 'earth' ? y : undefined,
        isEventMarker: true,
        isInteractive: isInteractive,
        isMainVariant: isMainVariant,
        pulseRings: [],
        isLocked: shouldBeLocked,
        originalScale: 1.0,
        originalColor: originalColor
    };
}

/**
 * Legacy faction strings in events.json that don't match manifest `filename` (filter chip keys).
 * Values must match {@link manifest.json} `factions[].filename` exactly.
 */
/** Old ids in event data or bookmarks → current manifest `filename` (must match globe filter keys). */
const LEGACY_FACTION_ID_TO_CANONICAL = {
    Shambali: '25Shambali Order',
    '13Shambali': '25Shambali Order',
    '25Shambali': '25Shambali Order',
    '26Shambali': '25Shambali Order',
    '09Lucheng': '07Lucheng Interstellar',
    /** Wrong legacy numbering; slot 27 is The Martins Collective in current manifest. */
    '27Null Sector': '26Null Sector',
    '04Omnica': '04Omnica Corporation',
    '05Omnica': '04Omnica Corporation',
    '05Vishkar': '05Vishkar Corporation',
    '08Ironclad': '08Ironclad Guild',
    '10Ironclad': '08Ironclad Guild',
    '09Crusaders': '09Crusader Initiative',
    '11Volskaya': '11Volskaya Industries',
    '06Crisis': '12The Anubis Omnic Crisis',
    '12Crisis': '12The Anubis Omnic Crisis',
    '13Lumerico': '13Lumérico Incorporated',
    '14Deadlock': '14Deadlock Rebels',
    '08Junkers': '16Junker Monarchy',
    '16Junkers': '16Junker Monarchy',
    '19Wayfinders': '19Wayfinder Society',
    '20Wayfinders': '19Wayfinder Society',
    '21Shimada': '21Shimada Clan',
    '22Shimada': '21Shimada Clan',
    '22Hashimoto': '22Hashimoto Clan',
    '23Hashimoto': '22Hashimoto Clan',
    '23Conspiracy': '23The Chernobog Conspiracy',
    '24Conspiracy': '23The Chernobog Conspiracy',
    '24Oasis': '24Oasis Ministries',
    '25Oasis': '24Oasis Ministries',
    '27Collective': '27The Martins Collective',
    '28Collective': '27The Martins Collective',
    '29Phreaks': '29The Phreaks',
    '30Phreaks': '29The Phreaks',
    '30MEKA': '30M.E.K.A Squad',
    '31MEKA': '30M.E.K.A Squad',
    '32Yokai': '32Yokai Gang',
    '33Yokai': '32Yokai Gang'
};

/**
 * True if entity's resolved country flags intersect any `country:<flagFile.png>` entries in activeFilters.
 */
function countryFiltersMatchEntity(entity, activeFilters) {
    if (!entity || !activeFilters || activeFilters.size === 0) return false;
    let anyCountryChip = false;
    for (const f of activeFilters) {
        if (String(f).startsWith('country:')) {
            anyCountryChip = true;
            break;
        }
    }
    if (!anyCountryChip) return false;
    const lh = typeof window !== 'undefined' ? window.LocationFlagHelpers : null;
    const files = lh && typeof lh.collectCountryFlagFilesForEntity === 'function'
        ? lh.collectCountryFlagFilesForEntity(entity)
        : [];
    if (!files.length) return false;
    const flagSet = new Set(files);
    for (const f of activeFilters) {
        const s = String(f ?? '');
        if (!s.startsWith('country:')) continue;
        const want = s.slice('country:'.length).trim();
        if (want && flagSet.has(want)) return true;
    }
    return false;
}

function factionIdMatchesActiveFilters(factionId, activeFilters) {
    if (factionId == null || !activeFilters) return false;
    const id = String(factionId).trim();
    if (!id) return false;
    if (activeFilters.has(id)) return true;
    const canonical = LEGACY_FACTION_ID_TO_CANONICAL[id];
    if (canonical && activeFilters.has(canonical)) return true;
    const fh = typeof window !== 'undefined' && window.FactionMatchHelpers;
    if (fh && typeof fh.activeFilterSetMatchesFactionId === 'function') {
        return fh.activeFilterSetMatchesFactionId(activeFilters, factionId);
    }
    return false;
}

/**
 * True if this entity's hero/faction ids intersect active globe filters.
 * @param {Object|null|undefined} entity - Event root or variant object
 * @param {Set} activeFilters - Set of active filter IDs
 */
export function entityMatchesActiveFilters(entity, activeFilters) {
    if (!entity || !activeFilters || activeFilters.size === 0) {
        return false;
    }
    const heroFilters = entity.filters || [];
    const npcFilters = entity.npcs || [];
    const factionFilters = entity.factions || [];
    return heroFilters.some((id) => id != null && activeFilters.has(String(id).trim()))
        || npcFilters.some((id) => id != null && activeFilters.has(String(id).trim()))
        || factionFilters.some((id) => factionIdMatchesActiveFilters(id, activeFilters))
        || countryFiltersMatchEntity(entity, activeFilters);
}

/**
 * First variant index that matches filters, or 0 if only the root matches, or 0 when no filters.
 * @param {Object|null|undefined} event - Root timeline event (may include `variants[]`)
 * @param {Set} activeFilters
 * @returns {number}
 */
export function getPreferredVariantIndexForActiveFilters(event, activeFilters) {
    if (!event || !activeFilters || activeFilters.size === 0) {
        return 0;
    }
    const variants = event.variants;
    if (!variants || variants.length === 0) {
        return 0;
    }
    for (let i = 0; i < variants.length; i++) {
        if (entityMatchesActiveFilters(variants[i], activeFilters)) {
            return i;
        }
    }
    if (entityMatchesActiveFilters(event, activeFilters)) {
        return 0;
    }
    return 0;
}

/**
 * How many of an event's root + variants individually match active filters.
 * Used to show variant switching under filtering only when at least two are reachable (same chip UX as unfiltered).
 */
export function countFilterMatchingEntitiesInEvent(event, activeFilters) {
    if (!event || !activeFilters || activeFilters.size === 0) {
        return 0;
    }
    const variants = event.variants;
    if (!variants || variants.length === 0) {
        return entityMatchesActiveFilters(event, activeFilters) ? 1 : 0;
    }
    let n = 0;
    if (entityMatchesActiveFilters(event, activeFilters)) n++;
    for (let i = 0; i < variants.length; i++) {
        if (entityMatchesActiveFilters(variants[i], activeFilters)) n++;
    }
    return n;
}

/**
 * Checks if an event should be locked based on active filters
 * @param {Object} event - Event object
 * @param {Set} activeFilters - Set of active filter IDs
 * @returns {boolean} - True if event should be locked
 */
export function shouldEventBeLocked(event, activeFilters) {
    if (!activeFilters || activeFilters.size === 0) {
        return false;
    }
    if (!event) {
        return true;
    }
    
    const variants = event.variants;
    if (variants && variants.length > 0) {
        const rootMatches = entityMatchesActiveFilters(event, activeFilters);
        const variantMatches = variants.some((v) => entityMatchesActiveFilters(v, activeFilters));
        return !rootMatches && !variantMatches;
    }
    
    return !entityMatchesActiveFilters(event, activeFilters);
}

/**
 * Gets marker radius based on screen size and variant type
 * @param {boolean} isMainVariant - Whether this is the main variant
 * @returns {number} - Marker radius
 */
export function getMarkerRadius(isMainVariant, locationType = 'earth') {
    const isSmallMobile = window.innerWidth <= 480;
    const isMapView = window.globeController?.sceneModel?.getMapViewEnabled
        ? window.globeController.sceneModel.getMapViewEnabled()
        : !!window.globeController?.sceneModel?.isMapView;

    const base = isMainVariant
        ? (isSmallMobile ? 0.030 : 0.015)
        : (isSmallMobile ? 0.020 : 0.010);

    if (!isMapView) return base;

    const mapDotFactor = 0.7;
    const sm = window.globeController?.sceneModel;
    const earthPlane = sm?.getEarthMapPlane ? sm.getEarthMapPlane() : sm?.earthMapPlane;
    const mapScaleX = earthPlane?.scale?.x > 0 ? earthPlane.scale.x : 1;

    // Earth flat markers are children of the scaled map plane, so their world radius is
    // base * mapDotFactor * mapScaleX. Moon/Mars markers sit on side rigs without that scale;
    // use the same world-size target so panel dots match Earth map dots.
    if (locationType === 'moon' || locationType === 'mars') {
        return base * mapDotFactor * mapScaleX;
    }
    return base * mapDotFactor;
}

/**
 * Gets marker color based on variant type (same on all UI palettes)
 * @param {boolean} isMainVariant - Whether this is the main variant
 * @returns {number} - Color hex value
 */
export function getMarkerColor(isMainVariant) {
    return isMainVariant ? 0xff6600 : 0xff69b4;
}

/** Locked / filtered-out marker color (matches {@link MarkerLockAnimationHelpers}). */
export const EVENT_MARKER_LOCKED_HEX = 0x331100;

/**
 * Diameter in CSS pixels for a DOM map marker, matching {@link getMarkerRadius} on the flat Earth map
 * (plane width 2 in scene units → diameter fraction = radius in unit space).
 * @param {number} mapWorldWidthPx - Width in px of the 2:1 map layer (e.g. Map2DLiteLayer `_baseW`).
 * @param {boolean} isMainVariant
 */
export function getMap2dLiteMarkerDiameterPx(mapWorldWidthPx, isMainVariant) {
    const w = Math.max(1, mapWorldWidthPx);
    const r = getMarkerRadius(isMainVariant, 'earth');
    return Math.max(6, Math.round(r * w));
}

/**
 * Default restore color when userData.originalColor was never set.
 * @param {{ isInteractive?: boolean, isMainVariant?: boolean }} userData
 * @returns {number}
 */
export function getDefaultMarkerOriginalHex(userData) {
    if (!userData || userData.isInteractive === false) {
        return getMarkerColor(false);
    }
    return getMarkerColor(userData.isMainVariant !== false);
}

/**
 * When the color palette changes, update unlocked event markers + pin lines to match.
 * @param {*} sceneModel
 */
export function applyPaletteToExistingEventMarkers(sceneModel) {
    const gc = typeof window !== 'undefined' ? window.globeController : null;
    if (sceneModel?.getMapViewEnabled?.() && gc?.map2dLite) {
        gc.map2dLite.refreshTexturesFromScene?.();
        gc.map2dLite.syncMarkers?.({ mode: 'instant' });
    }
    if (!sceneModel || typeof sceneModel.getMarkers !== 'function') return;
    const markers = sceneModel.getMarkers();
    if (!markers || !markers.length) return;

    for (let i = 0; i < markers.length; i++) {
        const marker = markers[i];
        const ud = marker.userData;
        if (!ud || !ud.isEventMarker || ud.isLocked) continue;

        const isInteractive = ud.isInteractive !== false;
        const isMainVariant = ud.isMainVariant !== false;
        const hex = isInteractive && isMainVariant ? getMarkerColor(true) : getMarkerColor(false);

        ud.originalColor = hex;
        if (marker.material && marker.material.color && typeof marker.material.color.setHex === 'function') {
            marker.material.color.setHex(hex);
        }

        const pin = ud.pinLine;
        if (isMainVariant && pin && pin.material && pin.material.color && typeof pin.material.color.setHex === 'function') {
            pin.material.color.setHex(hex);
        }

        delete ud._hoverGlowBase;
    }
}
