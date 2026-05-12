/**
 * @param {Object} params
 * @returns {Object} userData for an event marker mesh
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
