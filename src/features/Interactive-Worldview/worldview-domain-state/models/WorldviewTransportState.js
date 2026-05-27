import { worldviewTransportStateCollections } from './modules/WorldviewTransportStateCollections.js';
import { worldviewTransportStateCooldownsAndCache } from './modules/WorldviewTransportStateCooldownsAndCache.js';

export class WorldviewTransportState {
    constructor() {
        this.trains = [];
        this.routeCurves = [];
        this.routeGraph = {};
        this.routeReservations = {};
        this.planes = [];
        this.planeTrails = [];
        this.boats = [];
        this.boatTrails = [];
        this.boatRouteCurves = [];
        this.boatRouteGraph = {};
        this.boatRouteReservations = {};
        this.departureCooldowns = { train: new Map(), plane: new Map(), boat: new Map() };
        this.routePairDepartureCooldowns = new Map();
        this.satellites = [];
        this.satelliteOrbitLines = [];
        this.satelliteTrails = [];
        this.planeModelCache = null;
        this.trainEndModelCache = null;
        this.trainMiddleModelCache = null;
        this.satelliteModelCache = null;
        this.stationModelCache = null;
        this.spaceShipModelCache = null;
    }
}

Object.assign(
    WorldviewTransportState.prototype,
    worldviewTransportStateCollections,
    worldviewTransportStateCooldownsAndCache
);
