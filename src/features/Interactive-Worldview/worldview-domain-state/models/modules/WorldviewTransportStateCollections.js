function addTo(listName, item) {
    this[listName].push(item);
}

function removeFrom(listName, item) {
    const list = this[listName];
    const index = list.indexOf(item);
    if (index > -1) list.splice(index, 1);
}

function getList(listName) {
    return this[listName];
}

export const worldviewTransportStateCollections = {
    addTrain(train) { addTo.call(this, 'trains', train); },
    removeTrain(train) { removeFrom.call(this, 'trains', train); },
    getTrains() { return getList.call(this, 'trains'); },
    addRouteCurve(curve) { addTo.call(this, 'routeCurves', curve); },
    getRouteCurves() { return getList.call(this, 'routeCurves'); },
    getRouteGraph() { return this.routeGraph; },
    setRouteGraph(graph) { this.routeGraph = graph; },
    getRouteReservations() { return this.routeReservations; },
    addPlane(plane) { addTo.call(this, 'planes', plane); },
    removePlane(plane) { removeFrom.call(this, 'planes', plane); },
    getPlanes() { return getList.call(this, 'planes'); },
    addPlaneTrail(trail) { addTo.call(this, 'planeTrails', trail); },
    removePlaneTrail(trail) { removeFrom.call(this, 'planeTrails', trail); },
    getPlaneTrails() { return getList.call(this, 'planeTrails'); },
    addBoat(boat) { addTo.call(this, 'boats', boat); },
    removeBoat(boat) { removeFrom.call(this, 'boats', boat); },
    getBoats() { return getList.call(this, 'boats'); },
    addBoatTrail(trail) { addTo.call(this, 'boatTrails', trail); },
    removeBoatTrail(trail) { removeFrom.call(this, 'boatTrails', trail); },
    getBoatTrails() { return getList.call(this, 'boatTrails'); },
    addBoatRouteCurve(curve) { addTo.call(this, 'boatRouteCurves', curve); },
    getBoatRouteCurves() { return getList.call(this, 'boatRouteCurves'); },
    getBoatRouteGraph() { return this.boatRouteGraph; },
    setBoatRouteGraph(graph) { this.boatRouteGraph = graph; },
    getBoatRouteReservations() { return this.boatRouteReservations; },
    addSatellite(satellite) { addTo.call(this, 'satellites', satellite); },
    removeSatellite(satellite) { removeFrom.call(this, 'satellites', satellite); },
    getSatellites() { return getList.call(this, 'satellites'); },
    addSatelliteOrbitLine(orbitLine) { addTo.call(this, 'satelliteOrbitLines', orbitLine); },
    removeSatelliteOrbitLine(orbitLine) { removeFrom.call(this, 'satelliteOrbitLines', orbitLine); },
    getSatelliteOrbitLines() { return getList.call(this, 'satelliteOrbitLines'); },
    addSatelliteTrail(trail) { addTo.call(this, 'satelliteTrails', trail); },
    removeSatelliteTrail(trail) { removeFrom.call(this, 'satelliteTrails', trail); },
    getSatelliteTrails() { return getList.call(this, 'satelliteTrails'); }
};
