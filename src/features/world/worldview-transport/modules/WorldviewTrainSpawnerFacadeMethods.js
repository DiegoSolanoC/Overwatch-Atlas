import { latLonToMapPlanePosition } from '../../worldview-shared-assets/utils/WorldviewGeometry.js';
import { getTransportVehicleColors } from '../../worldview-shared-assets/utils/TransportPaletteColors.js';

export const worldviewTrainSpawnerFacadeMethods = {
    calculateRouteDistance(curve) {
        return this.routeController.calculateRouteDistance(curve);
    },

    createTrain(routeData, isMultiStop = false, journeyProgress = 0) {
        const globe = this.sceneModel.getGlobe();
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const planeWidth = 2.0;
        const halfW = planeWidth / 2;
        const mapZ = 0.01;
        const buildWrappedMapLineCurve = (fromLat, fromLon, toLat, toLon) => {
            const a = latLonToMapPlanePosition(fromLat, fromLon, planeWidth, 1.0, mapZ);
            const b = latLonToMapPlanePosition(toLat, toLon, planeWidth, 1.0, mapZ);
            let bx = b.x;
            const dx = bx - a.x;
            if (dx > halfW) bx -= planeWidth;
            else if (dx < -halfW) bx += planeWidth;
            return new THREE.LineCurve3(new THREE.Vector3(a.x, a.y, mapZ), new THREE.Vector3(bx, b.y, mapZ));
        };
        const activeCurve = (isMapView && routeData?.fromLat != null && routeData?.fromLon != null && routeData?.toLat != null && routeData?.toLon != null)
            ? buildWrappedMapLineCurve(routeData.fromLat, routeData.fromLon, routeData.toLat, routeData.toLon)
            : routeData.curve;
        const routeDistance = this.calculateRouteDistance(activeCurve);

        let maxWagons = routeDistance < 0.5 ? 2 : routeDistance < 1.0 ? 4 : 6;
        const rand = Math.random();
        let numWagons = rand < 0.7 ? Math.floor(Math.random() * (maxWagons - 2)) + 3 : 2;
        numWagons = Math.min(numWagons, maxWagons);

        const trainGroup = new THREE.Group();
        const wagons = [];
        const gltfLoader = this.sceneModel.getGLTFLoader();
        const trainEndModelCache = this.transportModel.getTrainEndModelCache();
        const trainMiddleModelCache = this.transportModel.getTrainMiddleModelCache();
        const modelScale = isMapView ? (0.02 / 2) : 0.02;
        const fallbackScale = isMapView ? (1 / 2) : 1;
        const { color: trainColor, emissive: trainEmissive } = getTransportVehicleColors();

        const applyTrainMaterial = (model) => {
            model.traverse((child) => {
                if (!child.isMesh) return;
                if (!child.material || child.material.type !== 'MeshBasicMaterial') {
                    child.material = new THREE.MeshPhongMaterial({
                        color: trainColor, emissive: trainEmissive, emissiveIntensity: 0.3, transparent: true, opacity: 0.85, shininess: 30
                    });
                }
                child.visible = true;
                if (child.geometry) {
                    child.geometry.computeBoundingBox();
                    child.geometry.computeBoundingSphere();
                }
            });
        };
        const getTrainEndModel = (callback) => {
            if (trainEndModelCache) {
                const model = trainEndModelCache.clone();
                model.scale.set(modelScale, modelScale, modelScale);
                model.visible = true;
                applyTrainMaterial(model);
                callback(model);
                return;
            }
            gltfLoader.load('src/assets/models/TrainEnd.glb', (gltf) => {
                const model = gltf.scene;
                this.transportModel.setTrainEndModelCache(model.clone());
                model.scale.set(modelScale, modelScale, modelScale);
                model.visible = true;
                applyTrainMaterial(model);
                callback(model);
            }, undefined, () => {
                callback(new THREE.Mesh(
                    new THREE.BoxGeometry(0.03 * fallbackScale, 0.01 * fallbackScale, 0.08 * fallbackScale),
                    new THREE.MeshPhongMaterial({ color: trainColor, transparent: true, opacity: 0.85 })
                ));
            });
        };
        const getTrainMiddleModel = (callback) => {
            if (trainMiddleModelCache) {
                const model = trainMiddleModelCache.clone(true);
                model.scale.set(modelScale, modelScale, modelScale);
                model.visible = true;
                applyTrainMaterial(model);
                callback(model);
                return;
            }
            gltfLoader.load('src/assets/models/TrainMiddle.glb', (gltf) => {
                const model = gltf.scene;
                this.transportModel.setTrainMiddleModelCache(model.clone());
                model.scale.set(modelScale, modelScale, modelScale);
                model.visible = true;
                applyTrainMaterial(model);
                callback(model);
            }, undefined, () => {
                callback(new THREE.Mesh(
                    new THREE.BoxGeometry(0.03 * fallbackScale, 0.01 * fallbackScale, 0.08 * fallbackScale),
                    new THREE.MeshPhongMaterial({ color: trainColor, transparent: true, opacity: 0.85 })
                ));
            });
        };

        for (let i = 0; i < numWagons; i++) {
            const wagonGroup = new THREE.Group();
            if (i === 0) getTrainEndModel((model) => wagonGroup.add(model));
            else if (i === numWagons - 1) getTrainEndModel((model) => { model.rotation.y = Math.PI; wagonGroup.add(model); });
            else getTrainMiddleModel((model) => wagonGroup.add(model));
            wagonGroup.renderOrder = 999;
            wagonGroup.visible = false;
            trainGroup.add(wagonGroup);
            wagons.push(wagonGroup);
        }

        const baseSpeed = routeDistance < 0.5 ? 0.006 : routeDistance < 1.0 ? 0.005 : 0.004;
        const speed = baseSpeed + Math.random() * 0.002;
        trainGroup.userData = {
            curve: activeCurve, progress: 0, speed, from: routeData.from, to: routeData.to, wagons,
            wagonSpacing: isMapView ? (0.045 / 2) : 0.045, isMultiStop: false, routes: null, currentRouteIndex: 0,
            needsReverse: false, isTransitioning: false, trainId: Math.random().toString(36).substr(2, 9),
            isWaiting: false, journeyProgress
        };
        if (!isMultiStop) this.routeController.reserveRoute(routeData.from, routeData.to, trainGroup.userData.trainId);
        trainGroup.position.copy(activeCurve.getPointAt(0));
        trainGroup.visible = false;
        trainGroup.userData.isNewlySpawned = true;
        if (globe) globe.add(trainGroup);
        this.transportModel.addTrain(trainGroup);
        return trainGroup;
    },

    createMultiStopTrain(routes) {
        const firstRoute = routes[0];
        const train = this.createTrain(firstRoute, true, 0);
        train.userData.isMultiStop = true;
        train.userData.routes = routes;
        train.userData.currentRouteIndex = 0;
        train.userData.totalRoutes = routes.length;
        train.userData.trainId = Math.random().toString(36).substr(2, 9);
        train.userData.finalDestination = routes[routes.length - 1].to;
        train.userData.previousCity = null;
        train.userData.isWaiting = false;
        train.userData.journeyProgress = 0;
        this.routeController.reserveRoute(firstRoute.from, firstRoute.to, train.userData.trainId);
        return train;
    }
};
