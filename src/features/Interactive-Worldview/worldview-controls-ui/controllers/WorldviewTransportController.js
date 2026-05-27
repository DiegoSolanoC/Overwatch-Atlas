/**
 * TransportController - Handles transport creation, updates, and spawning
 * Complete implementation migrated from globe.js
 */
import { latLonToVector3, createArcBetweenPoints } from '../../worldview-shared-assets/utils/WorldviewGeometry.js';
import { DEBUG_PHANTOM_WAGONS } from '../../worldview-shared-assets/utils/WorldviewTransportDebug.js';
import { WorldviewTrainSpawner } from '../../worldview-transport/WorldviewTrainSpawner.js';
import { WorldviewAircraftSpawner } from '../../worldview-transport/WorldviewAircraftSpawner.js';
import { WorldviewBoatSpawner } from '../../worldview-transport/WorldviewBoatSpawner.js';
import { WorldviewSatelliteSpawner } from '../../worldview-transport/WorldviewSatelliteSpawner.js';

export class WorldviewTransportController {
    constructor(sceneModel, transportModel, routeController, transportView, globeView, dataModel) {
        this.sceneModel = sceneModel;
        this.transportModel = transportModel;
        this.routeController = routeController;
        this.transportView = transportView;
        this.globeView = globeView;
        this.dataModel = dataModel;
        
        // Initialize managers
        this.trainManager = new WorldviewTrainSpawner(sceneModel, transportModel, routeController);
        this.planeManager = new WorldviewAircraftSpawner(sceneModel, transportModel, transportView, dataModel);
        this.boatManager = new WorldviewBoatSpawner(sceneModel, transportModel, routeController, transportView);
        this.satelliteManager = new WorldviewSatelliteSpawner(sceneModel, transportModel, transportView);
    }

    /**
     * Calculate route distance
     * Delegates to routeController
     * @param {THREE.Curve} curve - Route curve
     * @returns {number}
     */
    calculateRouteDistance(curve) {
        return this.routeController.calculateRouteDistance(curve);
    }

    /**
     * Create a train with wagons
     * Delegates to TrainManager
     * @param {Object} routeData - Route data
     * @param {boolean} isMultiStop - Is multi-stop route
     * @param {number} journeyProgress - Journey progress
     * @returns {Object} Train object
     */
    createTrain(routeData, isMultiStop = false, journeyProgress = 0) {
        return this.trainManager.createTrain(routeData, isMultiStop, journeyProgress);
    }

    /**
     * Create a multi-stop train
     * Delegates to TrainManager
     * @param {Array} routes - Array of route data
     * @returns {Object} Train object
     */
    createMultiStopTrain(routes) {
        return this.trainManager.createMultiStopTrain(routes);
    }

    /**
     * Create a plane
     * Delegates to WorldviewAircraftSpawner
     * @param {Object} fromCity - From city object
     * @param {Object} toCity - To city object
     * @returns {Object} Plane object
     */
    createPlane(fromCity, toCity) {
        return this.planeManager.createPlane(fromCity, toCity);
    }

    /**
     * Create a multi-stop plane
     * Delegates to WorldviewAircraftSpawner
     * @param {Array} airports - Array of airport objects in order
     * @returns {Object} Plane object
     */
    createMultiStopPlane(airports) {
        return this.planeManager.createMultiStopPlane(airports);
    }

    /**
     * Create a boat
     * @param {Object} routeData - Route data
     * @param {boolean} isMultiStop - Is multi-stop route
     * @returns {Object} Boat object
     */
    createBoat(routeData, isMultiStop = false) {
        return this.boatManager.createBoat(routeData, isMultiStop);
    }

    /**
     * Create a multi-stop boat
     * Delegates to BoatManager
     * @param {Array} routes - Array of route data
     * @returns {Object} Boat object
     */
    createMultiStopBoat(routes) {
        return this.boatManager.createMultiStopBoat(routes);
    }

    /**
     * Update trains - handles movement, multi-stop transitions, and wagon positioning
     * Delegates to TrainManager
     */
    updateTrains() {
        this.trainManager.updateTrains();
    }

    /**
     * Update planes - handles movement, landing, and trail spawning
     * Delegates to WorldviewAircraftSpawner
     */
    updatePlanes() {
        this.planeManager.updatePlanes();
    }

    /**
     * Update boats - handles movement, multi-stop transitions, and trail spawning
     */
    updateBoats() {
        this.boatManager.updateBoats();
    }

    /**
     * Spawn trains randomly
     * Delegates to TrainManager
     */
    spawnTrainsRandomly() {
        this.trainManager.spawnTrainsRandomly();
    }

    /**
     * Spawn planes randomly
     * Delegates to WorldviewAircraftSpawner
     */
    spawnPlanesRandomly() {
        this.planeManager.spawnPlanesRandomly();
    }

    /**
     * Spawn boats randomly
     * Delegates to BoatManager
     */
    spawnBoatsRandomly() {
        this.boatManager.spawnBoatsRandomly();
    }

    /**
     * Create a satellite
     * Delegates to SatelliteManager
     * @param {Object} config - Satellite configuration {type, orbitRadius, orbitSpeed, inclination, startAngle, rotationAngle, name}
     * @returns {Object} Satellite object
     */
    createSatellite(config) {
        return this.satelliteManager.createSatellite(config);
    }
    

    /**
     * Update satellites - handle orbital motion with speed variation and rotation angle changes
     * Delegates to SatelliteManager
     */
    updateSatellites() {
        this.satelliteManager.updateSatellites();
    }

    /**
     * Initialize satellites
     * Delegates to SatelliteManager
     */
    initializeSatellites() {
        this.satelliteManager.initializeSatellites();
    }

    setSatellitesMapViewEnabled(enabled) {
        if (this.satelliteManager && typeof this.satelliteManager.setMapViewEnabled === 'function') {
            this.satelliteManager.setMapViewEnabled(enabled);
        }
    }

    /**
     * Recreate decor satellites when transport is turned on (after unload).
     * @returns {THREE.Group[]} Newly created satellite groups (empty if none).
     */
    ensureDecorSatellitesLoaded() {
        const created = this.satelliteManager.ensureDecorSatellitesLoaded();
        if (created.length > 0 && this.globeView && typeof this.globeView.addSatelliteMarkers === 'function') {
            this.globeView.addSatelliteMarkers(created);
        }
        const isMap = this.sceneModel.getMapViewEnabled && this.sceneModel.getMapViewEnabled();
        if (created.length > 0 && isMap) {
            this.setSatellitesMapViewEnabled(true);
        }
        return created;
    }

    /** Remove and dispose background "small" satellites (ISS / Mars Ship stay). */
    disposeDecorSatellites() {
        this.satelliteManager.disposeDecorSatellites();
    }

    /**
     * Find the ISS satellite
     * Delegates to SatelliteManager
     * @returns {Object|null} ISS satellite object or null
     */
    findISS() {
        return this.satelliteManager.findISS();
    }

    /**
     * Find the Mars Ship satellite group
     * @returns {Object|null}
     */
    findMarsShip() {
        return this.satelliteManager.findMarsShip();
    }
}
