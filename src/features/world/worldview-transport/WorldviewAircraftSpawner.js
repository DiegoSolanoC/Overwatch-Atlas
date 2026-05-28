import { worldviewAircraftRouteFactory } from './modules/WorldviewAircraftRouteFactory.js';
import { worldviewAircraftRuntime } from './modules/WorldviewAircraftRuntime.js';

export class WorldviewAircraftSpawner {
    constructor(sceneModel, transportModel, transportView, dataModel) {
        this.sceneModel = sceneModel;
        this.transportModel = transportModel;
        this.transportView = transportView;
        this.dataModel = dataModel;
        this.planeSpawnInterval = null;
    }
    
}

Object.assign(
    WorldviewAircraftSpawner.prototype,
    worldviewAircraftRouteFactory,
    worldviewAircraftRuntime
);
