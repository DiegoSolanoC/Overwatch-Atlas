import { worldviewTrainSpawnerFacadeMethods } from './modules/WorldviewTrainSpawnerFacadeMethods.js';
import { worldviewTrainSpawnerRuntime } from './modules/WorldviewTrainSpawnerRuntime.js';

export class WorldviewTrainSpawner {
    constructor(sceneModel, transportModel, routeController) {
        this.sceneModel = sceneModel;
        this.transportModel = transportModel;
        this.routeController = routeController;
        this.trainSpawnInterval = null;
    }
}

Object.assign(
    WorldviewTrainSpawner.prototype,
    worldviewTrainSpawnerFacadeMethods,
    worldviewTrainSpawnerRuntime
);
