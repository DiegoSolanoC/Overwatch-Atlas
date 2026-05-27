/**
 * Resolve the display label + coordinate context for one event in the Event Manager list.
 *
 * Two-phase strategy:
 *   1. **Single-event / first-variant defaults**: pull `cityDisplayName` (and lat/lon or
 *      x/y depending on `locationType`) off the event or its first variant.
 *   2. **Current-variant override**: if this is a multi-event and the user has cycled past
 *      variant 0, re-resolve everything against the active variant.
 *
 * Fallback ladder used at both phases when `cityDisplayName` is missing:
 *   - **earth**           → coord-based reverse lookup via `eventManager.getLocationName(lat,lon)`.
 *   - **station**         → "Space Station (ISS)".
 *   - **marsShip**        → "Red Promise Escape Ship".
 *   - **moon / mars**     → either `"Moon: (x.x, y.y)"` / `"Mars: (x.x, y.y)"` when coords
 *                           exist, or the bare body name otherwise.
 *
 * @returns {{
 *   locationName: string|null,
 *   locationType: string,
 *   displayLocationType: string,
 *   displayEvent: Record<string, any>,
 *   currentVariantIndex: number,
 *   isMultiEvent: boolean,
 *   lat: number|undefined, lon: number|undefined, x: number|undefined, y: number|undefined,
 * }}
 */
export function resolveEventItemLocation(eventManager, event, index) {
    const isMultiEvent = !!(event.variants && event.variants.length > 0);
    const locationType = event.locationType || 'earth';
    let locationName = null;
    let locationLat = event.lat;
    let locationLon = event.lon;
    let locationX = event.x;
    let locationY = event.y;

    // Phase 1: first-variant defaults (or single-event values when no variants).
    if (isMultiEvent && event.variants && event.variants.length > 0) {
        const firstVariant = event.variants[0];
        locationName = firstVariant.cityDisplayName || null;
        const variantLocationType = firstVariant.locationType || locationType;
        if (variantLocationType === 'earth') {
            if (firstVariant.lat !== undefined) locationLat = firstVariant.lat;
            if (firstVariant.lon !== undefined) locationLon = firstVariant.lon;
        } else if (variantLocationType === 'moon' || variantLocationType === 'mars') {
            if (firstVariant.x !== undefined) locationX = firstVariant.x;
            if (firstVariant.y !== undefined) locationY = firstVariant.y;
        }
        // station / marsShip: no coordinates.
    } else {
        locationName = event.cityDisplayName || null;
    }

    if (!locationName && locationType === 'earth' && locationLat !== undefined && locationLon !== undefined) {
        if (eventManager.getLocationName) {
            locationName = eventManager.getLocationName(locationLat, locationLon);
        }
    }

    if (!locationName && locationType !== 'earth') {
        if (locationType === 'station') {
            locationName = 'Space Station (ISS)';
        } else if (locationType === 'marsShip') {
            locationName = 'Red Promise Escape Ship';
        } else if (locationX !== undefined && locationY !== undefined) {
            locationName = `${locationType === 'moon' ? 'Moon' : 'Mars'}: (${locationX.toFixed(1)}, ${locationY.toFixed(1)})`;
        } else {
            locationName = locationType === 'moon' ? 'Moon' : 'Mars';
        }
    }

    // Phase 2: re-resolve against the active variant if the user has cycled past variant 0.
    let currentVariantIndex = 0;
    if (isMultiEvent) {
        const itemKey = `event-${index}`;
        if (eventManager.eventItemVariantIndices && !eventManager.eventItemVariantIndices.has(itemKey)) {
            eventManager.eventItemVariantIndices.set(itemKey, 0);
        }
        if (eventManager.eventItemVariantIndices) {
            currentVariantIndex = eventManager.eventItemVariantIndices.get(itemKey);
        }
    }

    const displayEvent = isMultiEvent ? event.variants[currentVariantIndex] : event;

    if (isMultiEvent && event.variants[currentVariantIndex]) {
        const currentVariant = event.variants[currentVariantIndex];
        locationName = currentVariant.cityDisplayName || null;
        if (currentVariant.lat !== undefined) locationLat = currentVariant.lat;
        if (currentVariant.lon !== undefined) locationLon = currentVariant.lon;
        const currentVariantLocationType = currentVariant.locationType || locationType;
        if (!locationName && currentVariantLocationType === 'earth' && locationLat !== undefined && locationLon !== undefined) {
            if (eventManager.getLocationName) {
                locationName = eventManager.getLocationName(locationLat, locationLon);
            }
        }
        if (!locationName && currentVariantLocationType !== 'earth') {
            const variantX = currentVariant.x !== undefined ? currentVariant.x : (event.x !== undefined ? event.x : undefined);
            const variantY = currentVariant.y !== undefined ? currentVariant.y : (event.y !== undefined ? event.y : undefined);
            if (currentVariantLocationType === 'station') {
                locationName = 'Space Station (ISS)';
            } else if (currentVariantLocationType === 'marsShip') {
                locationName = 'Red Promise Escape Ship';
            } else if (variantX !== undefined && variantY !== undefined) {
                locationName = `${currentVariantLocationType === 'moon' ? 'Moon' : 'Mars'}: (${variantX.toFixed(1)}, ${variantY.toFixed(1)})`;
            } else {
                locationName = currentVariantLocationType === 'moon' ? 'Moon' : 'Mars';
            }
        }
    }

    const displayLocationType = (displayEvent && displayEvent.locationType) || event.locationType || 'earth';

    return {
        locationName,
        locationType,
        displayLocationType,
        displayEvent,
        currentVariantIndex,
        isMultiEvent,
        lat: locationLat,
        lon: locationLon,
        x: locationX,
        y: locationY,
    };
}
