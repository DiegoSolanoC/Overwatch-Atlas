/**
 * Worldview globe bootstrap helpers extracted from controller.
 */
export function applyWebglLayersHiddenForActiveMap(sceneModel) {
    const globe = sceneModel.getGlobe();
    const moonRig = sceneModel.getMoonRig?.() ?? sceneModel.moonRig;
    const marsRig = sceneModel.getMarsRig?.() ?? sceneModel.marsRig;
    const orbitRig = sceneModel.getOrbitRig?.() ?? sceneModel.orbitRig;
    if (globe) globe.visible = false;
    if (moonRig) moonRig.visible = false;
    if (marsRig) marsRig.visible = false;
    if (orbitRig) orbitRig.visible = false;
}

export function ensureGlobeWorldBuilt(controller, container, installDevSunYawControl) {
    if (controller._globeWorldBuilt) return;

    controller.globeView.initGlobe(() => {
        if (!controller.sceneModel.getMapViewEnabled?.()) {
            controller.animate();
        } else {
            controller.syncMapLiteWebGlImmediate();
        }
    });
    controller._globeWorldBuilt = true;

    setTimeout(() => {
        const isMobile = window.innerWidth <= 768;
        const isPortrait = container.clientHeight > container.clientWidth;
        const isMobilePortrait = isMobile && isPortrait;
        controller.interactionController.updatePlanesPosition(isMobilePortrait);
    }, 50);

    controller.globeView.addStarfield();
    controller.globeView.addShootingStars();
    controller.globeView.addCityMarkers();
    controller.globeView.addSeaportMarkers();
    controller.globeView.addEarthCityLights();

    const updateVisibility = () => {
        controller.planeManager.updatePlaneVisibility();
    };
    setTimeout(updateVisibility, 100);
    setTimeout(updateVisibility, 300);
    setTimeout(updateVisibility, 500);

    controller.globeView.addConnectionLines((routeData) => {
        controller.transportModel.addRouteCurve(routeData);
    });
    controller.globeView.addSecondaryConnectionLines();
    controller.globeView.addSeaportConnectionLines((routeData) => {
        controller.transportModel.addBoatRouteCurve(routeData);
    });

    controller.routeController.buildRouteGraph();
    controller.routeController.buildBoatRouteGraph();

    controller.transportController.spawnTrainsRandomly();
    controller.trainSpawnInterval = controller.transportController.trainSpawnInterval;
    controller.transportController.spawnPlanesRandomly();
    controller.transportController.spawnBoatsRandomly();

    controller.transportController.initializeSatellites();
    setTimeout(() => {
        const satellites = controller.transportModel.getSatellites();
        controller.globeView.addSatelliteMarkers(satellites);
    }, 100);

    if (typeof installDevSunYawControl === 'function') {
        installDevSunYawControl(controller);
    }

    if (controller.globeView && typeof controller.globeView.setGlobeSkyVisible === 'function') {
        controller.globeView.setGlobeSkyVisible(!controller.sceneModel.getMapViewEnabled());
    }

    if (controller.sceneModel.getMapViewEnabled?.()) {
        applyWebglLayersHiddenForActiveMap(controller.sceneModel);
    }
}
