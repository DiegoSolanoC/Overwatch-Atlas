import { worldviewSatelliteOrbitRuntime } from './modules/WorldviewSatelliteOrbitRuntime.js';
import { worldviewSatelliteLifecycle } from './modules/WorldviewSatelliteLifecycle.js';

export class WorldviewSatelliteSpawner {
    constructor(sceneModel, transportModel, transportView) {
        this.sceneModel = sceneModel;
        this.transportModel = transportModel;
        this.transportView = transportView;
        this._satellitePageKey = null;
        this._satellitePageHasStation = false;
        this._satellitePageHasMarsShip = false;
        this._issLocalRollQuat = new THREE.Quaternion();
        this._issLocalRollAxis = new THREE.Vector3(0, 0, 1);
    }
}

Object.assign(
    WorldviewSatelliteSpawner.prototype,
    worldviewSatelliteOrbitRuntime,
    worldviewSatelliteLifecycle
);
