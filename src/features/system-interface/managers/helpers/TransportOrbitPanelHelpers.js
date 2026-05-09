/**
 * Station / Mars-ship markers attach to ISS or Mars-ship 3D models when transport is on in globe view.
 * When transport is off, or in flat map view (no vehicle simulation on the map), they use the orbit
 * texture panel (same x/y % coordinates as Moon/Mars).
 * @param {import('../../features/worldview/domain/models/SceneModel.js').SceneModel} sceneModel
 * @returns {boolean}
 */
export function useOrbitPanelForStationShipMarkers(sceneModel) {
    if (!sceneModel) return false;
    const isMap = sceneModel.getMapViewEnabled?.() ? sceneModel.getMapViewEnabled() : !!sceneModel.isMapView;
    // Use ?? so `false` (transport off) is preserved; a ternary would treat false as "use default true".
    const hyper = sceneModel.getHyperloopVisible?.() ?? true;
    const useOrbit = isMap || !hyper;
    console.log(`[useOrbitPanelForStationShipMarkers] isMap=${isMap}, hyperloopVisible=${hyper} -> useOrbitPanel=${useOrbit}`);
    return useOrbit;
}
