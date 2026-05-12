/**
 * Marker radius in scene units (globe vs flat map, mobile breakpoint).
 * @param {boolean} isMainVariant
 * @param {string} [locationType='earth']
 * @returns {number}
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

    if (locationType === 'moon' || locationType === 'mars') {
        return base * mapDotFactor * mapScaleX;
    }
    return base * mapDotFactor;
}

/**
 * Diameter in CSS pixels for a DOM map marker (2:1 map plane width in px).
 * @param {number} mapWorldWidthPx
 * @param {boolean} isMainVariant
 */
export function getMap2dLiteMarkerDiameterPx(mapWorldWidthPx, isMainVariant) {
    const w = Math.max(1, mapWorldWidthPx);
    const r = getMarkerRadius(isMainVariant, 'earth');
    return Math.max(6, Math.round(r * w));
}
