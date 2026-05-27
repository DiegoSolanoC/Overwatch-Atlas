/**
 * TransportModel - Manages transport system state
 * Handles trains, planes, boats, routes, and reservations
 */
export class TransportModel {
    constructor() {
        // Train system
        this.trains = [];
        this.routeCurves = []; // Store all route curves for train animation
        this.routeGraph = {}; // Graph of city connections for multi-stop routes
        this.routeReservations = {}; // Track which routes are currently in use

        // Plane system
        this.planes = [];
        this.planeTrails = []; // Independent trail segments that fade over time

        // Boat system
        this.boats = [];
        this.boatTrails = []; // Boat trail segments (delta/triangle shape)
        this.boatRouteCurves = []; // Store all boat route curves
        this.boatRouteGraph = {}; // Graph of port connections for multi-stop routes
        this.boatRouteReservations = {}; // Track which routes are currently in use

        // Departure cooldowns (avoid multiple vehicles departing same origin too quickly)
        // Keyed by origin name -> last departure timestamp (ms).
        this.departureCooldowns = {
            train: new Map(),
            plane: new Map(),
            boat: new Map()
        };

        // Cross-vehicle cooldown for matching (A,B) pairs:
        // If any vehicle departs from A -> B, no other vehicle (any type) may depart A -> B
        // within the cooldown window. Directional by design (A->B differs from B->A).
        this.routePairDepartureCooldowns = new Map(); // key -> last departure timestamp (ms)

        // Satellite system
        this.satellites = [];
        this.satelliteOrbitLines = []; // Purple orbit lines
        this.satelliteTrails = []; // Star trail segments


        // Model cache
        this.planeModelCache = null;
        this.trainEndModelCache = null;
        this.trainMiddleModelCache = null;
        this.satelliteModelCache = null;
        this.stationModelCache = null; // Separate cache for Station model (ISS)
        this.spaceShipModelCache = null; // Separate cache for Mars Ship (SpaceShip.glb)
    }

    _normalizeLocationKey(name) {
        return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }

    _getRoutePairKey(from, to) {
        const a = this._normalizeLocationKey(from);
        const b = this._normalizeLocationKey(to);
        return `${a}→${b}`;
    }

    /**
     * Can a vehicle type depart from a given origin?
     * @param {'train'|'plane'|'boat'} type
     * @param {string} origin
     * @param {number} cooldownMs
     * @param {number} nowMs
     * @returns {boolean}
     */
    canDepart(type, origin, cooldownMs = 8000, nowMs = Date.now()) {
        if (!origin) return true;
        const m = this.departureCooldowns?.[type];
        if (!m || typeof m.get !== 'function') return true;
        const last = m.get(origin);
        if (!Number.isFinite(last)) return true;
        return (nowMs - last) >= cooldownMs;
    }

    /**
     * Mark a departure for cooldown tracking.
     * @param {'train'|'plane'|'boat'} type
     * @param {string} origin
     * @param {number} nowMs
     */
    markDeparted(type, origin, nowMs = Date.now()) {
        if (!origin) return;
        const m = this.departureCooldowns?.[type];
        if (!m || typeof m.set !== 'function') return;
        m.set(origin, nowMs);
    }

    /**
     * Cross-vehicle cooldown for exact route pairs (A -> B).
     * @param {string} from
     * @param {string} to
     * @param {number} cooldownMs
     * @param {number} nowMs
     * @returns {boolean}
     */
    canDepartRoutePair(from, to, cooldownMs = 8000, nowMs = Date.now()) {
        if (!from || !to) return true;
        const key = this._getRoutePairKey(from, to);
        const last = this.routePairDepartureCooldowns.get(key);
        if (!Number.isFinite(last)) return true;
        return (nowMs - last) >= cooldownMs;
    }

    /**
     * Mark a route-pair departure for cross-vehicle cooldown.
     * @param {string} from
     * @param {string} to
     * @param {number} nowMs
     */
    markDepartedRoutePair(from, to, nowMs = Date.now()) {
        if (!from || !to) return;
        const key = this._getRoutePairKey(from, to);
        this.routePairDepartureCooldowns.set(key, nowMs);
    }

    /**
     * Add a train
     * @param {Object} train - Train object
     */
    addTrain(train) {
        this.trains.push(train);
    }

    /**
     * Remove a train
     * @param {Object} train - Train object to remove
     */
    removeTrain(train) {
        const index = this.trains.indexOf(train);
        if (index > -1) {
            this.trains.splice(index, 1);
        }
    }

    /**
     * Get all trains
     * @returns {Array}
     */
    getTrains() {
        return this.trains;
    }

    /**
     * Add a route curve
     * @param {Object} curve - Route curve object
     */
    addRouteCurve(curve) {
        this.routeCurves.push(curve);
    }

    /**
     * Get all route curves
     * @returns {Array}
     */
    getRouteCurves() {
        return this.routeCurves;
    }

    /**
     * Get route graph
     * @returns {Object}
     */
    getRouteGraph() {
        return this.routeGraph;
    }

    /**
     * Set route graph
     * @param {Object} graph - Route graph
     */
    setRouteGraph(graph) {
        this.routeGraph = graph;
    }

    /**
     * Get route reservations
     * @returns {Object}
     */
    getRouteReservations() {
        return this.routeReservations;
    }

    /**
     * Add a plane
     * @param {Object} plane - Plane object
     */
    addPlane(plane) {
        this.planes.push(plane);
    }

    /**
     * Remove a plane
     * @param {Object} plane - Plane object to remove
     */
    removePlane(plane) {
        const index = this.planes.indexOf(plane);
        if (index > -1) {
            this.planes.splice(index, 1);
        }
    }

    /**
     * Get all planes
     * @returns {Array}
     */
    getPlanes() {
        return this.planes;
    }

    /**
     * Add a plane trail segment
     * @param {Object} trail - Trail segment
     */
    addPlaneTrail(trail) {
        this.planeTrails.push(trail);
    }

    /**
     * Remove a plane trail segment
     * @param {Object} trail - Trail segment to remove
     */
    removePlaneTrail(trail) {
        const index = this.planeTrails.indexOf(trail);
        if (index > -1) {
            this.planeTrails.splice(index, 1);
        }
    }

    /**
     * Get all plane trails
     * @returns {Array}
     */
    getPlaneTrails() {
        return this.planeTrails;
    }

    /**
     * Add a boat
     * @param {Object} boat - Boat object
     */
    addBoat(boat) {
        this.boats.push(boat);
    }

    /**
     * Remove a boat
     * @param {Object} boat - Boat object to remove
     */
    removeBoat(boat) {
        const index = this.boats.indexOf(boat);
        if (index > -1) {
            this.boats.splice(index, 1);
        }
    }

    /**
     * Get all boats
     * @returns {Array}
     */
    getBoats() {
        return this.boats;
    }

    /**
     * Add a boat trail segment
     * @param {Object} trail - Trail segment
     */
    addBoatTrail(trail) {
        this.boatTrails.push(trail);
    }

    /**
     * Remove a boat trail segment
     * @param {Object} trail - Trail segment to remove
     */
    removeBoatTrail(trail) {
        const index = this.boatTrails.indexOf(trail);
        if (index > -1) {
            this.boatTrails.splice(index, 1);
        }
    }

    /**
     * Get all boat trails
     * @returns {Array}
     */
    getBoatTrails() {
        return this.boatTrails;
    }

    /**
     * Add a boat route curve
     * @param {Object} curve - Route curve object
     */
    addBoatRouteCurve(curve) {
        this.boatRouteCurves.push(curve);
    }

    /**
     * Get all boat route curves
     * @returns {Array}
     */
    getBoatRouteCurves() {
        return this.boatRouteCurves;
    }

    /**
     * Get boat route graph
     * @returns {Object}
     */
    getBoatRouteGraph() {
        return this.boatRouteGraph;
    }

    /**
     * Set boat route graph
     * @param {Object} graph - Route graph
     */
    setBoatRouteGraph(graph) {
        this.boatRouteGraph = graph;
    }

    /**
     * Get boat route reservations
     * @returns {Object}
     */
    getBoatRouteReservations() {
        return this.boatRouteReservations;
    }

    /**
     * Set plane model cache
     * @param {Object} model - Cached plane model
     */
    setPlaneModelCache(model) {
        this.planeModelCache = model;
    }

    /**
     * Get plane model cache
     * @returns {Object|null}
     */
    getPlaneModelCache() {
        return this.planeModelCache;
    }

    /**
     * Set train end model cache
     * @param {Object} model - Cached train end model
     */
    setTrainEndModelCache(model) {
        this.trainEndModelCache = model;
    }

    /**
     * Get train end model cache
     * @returns {Object|null}
     */
    getTrainEndModelCache() {
        return this.trainEndModelCache;
    }

    /**
     * Set train middle model cache
     * @param {Object} model - Cached train middle model
     */
    setTrainMiddleModelCache(model) {
        this.trainMiddleModelCache = model;
    }

    /**
     * Get train middle model cache
     * @returns {Object|null}
     */
    getTrainMiddleModelCache() {
        return this.trainMiddleModelCache;
    }

    /**
     * Set satellite model cache
     * @param {Object} model - Cached satellite model
     */
    setSatelliteModelCache(model) {
        this.satelliteModelCache = model;
    }

    /**
     * Get satellite model cache
     * @returns {Object|null}
     */
    getSatelliteModelCache() {
        return this.satelliteModelCache;
    }

    /**
     * Set station model cache
     * @param {Object} model - Cached station model
     */
    setStationModelCache(model) {
        this.stationModelCache = model;
    }

    /**
     * Get station model cache
     * @returns {Object|null}
     */
    getStationModelCache() {
        return this.stationModelCache;
    }

    /**
     * Set spaceship model cache (Mars Ship)
     * @param {Object} model - Cached spaceship model
     */
    setSpaceShipModelCache(model) {
        this.spaceShipModelCache = model;
    }

    /**
     * Get spaceship model cache (Mars Ship)
     * @returns {Object|null}
     */
    getSpaceShipModelCache() {
        return this.spaceShipModelCache;
    }

    /**
     * Add a satellite
     * @param {Object} satellite - Satellite object
     */
    addSatellite(satellite) {
        this.satellites.push(satellite);
    }

    /**
     * Remove a satellite
     * @param {Object} satellite - Satellite object to remove
     */
    removeSatellite(satellite) {
        const index = this.satellites.indexOf(satellite);
        if (index > -1) {
            this.satellites.splice(index, 1);
        }
    }

    /**
     * Get all satellites
     * @returns {Array}
     */
    getSatellites() {
        return this.satellites;
    }

    /**
     * Add a satellite orbit line
     * @param {Object} orbitLine - Orbit line object
     */
    addSatelliteOrbitLine(orbitLine) {
        this.satelliteOrbitLines.push(orbitLine);
    }

    /**
     * Remove a satellite orbit line from tracking
     * @param {Object} orbitLine - Orbit line object
     */
    removeSatelliteOrbitLine(orbitLine) {
        const index = this.satelliteOrbitLines.indexOf(orbitLine);
        if (index > -1) {
            this.satelliteOrbitLines.splice(index, 1);
        }
    }

    /**
     * Get all satellite orbit lines
     * @returns {Array}
     */
    getSatelliteOrbitLines() {
        return this.satelliteOrbitLines;
    }

    /**
     * Add a satellite trail segment
     * @param {Object} trail - Trail segment
     */
    addSatelliteTrail(trail) {
        this.satelliteTrails.push(trail);
    }

    /**
     * Remove a satellite trail segment
     * @param {Object} trail - Trail segment to remove
     */
    removeSatelliteTrail(trail) {
        const index = this.satelliteTrails.indexOf(trail);
        if (index > -1) {
            this.satelliteTrails.splice(index, 1);
        }
    }

    /**
     * Get all satellite trails
     * @returns {Array}
     */
    getSatelliteTrails() {
        return this.satelliteTrails;
    }

}

