import { latLonToMapPlanePosition } from '../../worldview-shared-assets/utils/WorldviewGeometry.js';

export const worldviewTrainSpawnerRuntime = {
    updateTrains() {
        if (!this.sceneModel.getHyperloopVisible()) return;
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        if (isMapView) return;

        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        const trains = this.transportModel.getTrains();
        const planeUp = new THREE.Vector3(0, 0, 1);
        const planeWidth = 2.0;
        const halfW = planeWidth / 2;
        const wrapX = (x) => ((x + halfW) % planeWidth + planeWidth) % planeWidth - halfW;
        const mapZ = 0.01;
        const buildMapCurveForRoute = (route) => {
            if (!route || route.fromLat == null || route.fromLon == null || route.toLat == null || route.toLon == null) return route?.curve;
            const a = latLonToMapPlanePosition(route.fromLat, route.fromLon, planeWidth, 1.0, mapZ);
            const b = latLonToMapPlanePosition(route.toLat, route.toLon, planeWidth, 1.0, mapZ);
            let bx = b.x;
            const dx = bx - a.x;
            if (dx > halfW) bx -= planeWidth;
            else if (dx < -halfW) bx += planeWidth;
            return new THREE.LineCurve3(new THREE.Vector3(a.x, a.y, mapZ), new THREE.Vector3(bx, b.y, mapZ));
        };

        for (let i = trains.length - 1; i >= 0; i--) {
            const train = trains[i];
            const data = train.userData;
            if (data.isNewlySpawned) {
                data.isNewlySpawned = false;
                continue;
            }
            if (!data.isWaiting) data.progress += data.speed;

            if (data.isMultiStop && data.progress >= 1.0 && !data.isTransitioning && data.currentRouteIndex < data.routes.length - 1) {
                const currentFrom = data.from;
                const currentTo = data.to;
                this.routeController.releaseRoute(currentFrom, currentTo, data.trainId);
                let nextRoute = data.routes[data.currentRouteIndex + 1];
                let canDepart = false;
                if (!this.routeController.isRouteAvailable(nextRoute.from, nextRoute.to)) {
                    const alternateRoutes = this.routeController.findAlternateRoute(currentTo, data.finalDestination, currentFrom, 5);
                    if (alternateRoutes && alternateRoutes.length > 0) {
                        data.routes = [data.routes[data.currentRouteIndex], ...alternateRoutes];
                        data.currentRouteIndex = 0;
                        nextRoute = alternateRoutes[0];
                        canDepart = true;
                    } else {
                        data.isWaiting = true;
                        data.progress = 1.0;
                    }
                } else canDepart = true;
                if (canDepart) {
                    data.isTransitioning = true;
                    data.isWaiting = false;
                    this.routeController.reserveRoute(nextRoute.from, nextRoute.to, data.trainId);
                    data.currentRouteIndex++;
                    data.journeyProgress = data.currentRouteIndex / data.totalRoutes;
                    data.curve = isMapView ? buildMapCurveForRoute(nextRoute) : nextRoute.curve;
                    data.from = nextRoute.from;
                    data.to = nextRoute.to;
                    data.previousCity = currentFrom;
                    data.needsReverse = nextRoute.needsReverse;
                    data.progress = 0;
                    const routeDistance = this.calculateRouteDistance(data.curve);
                    const baseSpeed = routeDistance < 0.5 ? 0.006 : routeDistance < 1.0 ? 0.005 : 0.004;
                    data.speed = baseSpeed + Math.random() * 0.002;
                }
            }

            if (data.isMultiStop && data.progress > 0.1 && data.progress < 0.9 && data.isTransitioning) data.isTransitioning = false;
            if (data.progress <= 0) {
                train.visible = false;
                continue;
            }

            if (!data.curve || typeof data.curve.getPointAt !== 'function') {
                train.visible = false;
                continue;
            }

            const trainProgress = Math.min(data.progress, 1.0);
            const rawTrainPos = data.curve.getPointAt(trainProgress);
            const position = isMapView ? new THREE.Vector3(wrapX(rawTrainPos.x), rawTrainPos.y, rawTrainPos.z) : rawTrainPos;
            if (!position || isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) {
                train.visible = false;
                continue;
            }

            train.position.copy(position);
            const curveLength = data.curve.getLength();
            const spacingProgress = data.wagonSpacing / curveLength;
            let anyWagonVisible = false;

            data.wagons.forEach((wagon, index) => {
                wagon.visible = false;
                if (data.isWaiting) return;
                const wagonProgress = Math.max(0, data.progress - (spacingProgress * index));
                if (wagonProgress <= 0 || wagonProgress > 1) return;
                let actualProgress = data.needsReverse ? 1 - wagonProgress : wagonProgress;
                actualProgress = Math.max(0, Math.min(1, actualProgress));
                const wagonPosition = data.curve.getPointAt(actualProgress);
                if (!wagonPosition || isNaN(wagonPosition.x) || isNaN(wagonPosition.y) || isNaN(wagonPosition.z)) return;
                let tangent = data.curve.getTangentAt(actualProgress).normalize();
                if (data.needsReverse) tangent.negate();
                const offsetDistance = isMapView ? 0.002 : 0.006;
                const up = isMapView ? planeUp : wagonPosition.clone().normalize();
                const elevatedPosition = wagonPosition.clone().add(up.clone().multiplyScalar(offsetDistance));
                const right = new THREE.Vector3().crossVectors(tangent, up.clone().normalize()).normalize();
                const correctedUp = new THREE.Vector3().crossVectors(right, tangent).normalize();
                const rotationMatrix = new THREE.Matrix4();
                rotationMatrix.makeBasis(right, correctedUp, tangent.negate());
                wagon.quaternion.setFromRotationMatrix(rotationMatrix);
                wagon.position.copy(elevatedPosition).sub(isMapView ? rawTrainPos : train.position);
                wagon.visible = hyperloopVisible;
                anyWagonVisible = hyperloopVisible;
            });

            train.visible = anyWagonVisible ? hyperloopVisible : false;
            if (data.progress <= 1) continue;

            if (!data.curve || typeof data.curve.getLength !== 'function') {
                this.routeController.releaseRoute(data.from, data.to, data.trainId);
                if (train.parent) train.parent.remove(train);
                this.transportModel.removeTrain(train);
                continue;
            }
            const allWagonsFinished = data.wagons.every((wagon, index) => (data.progress - ((data.wagonSpacing / data.curve.getLength()) * index)) > 1);
            if (allWagonsFinished) {
                this.routeController.releaseRoute(data.from, data.to, data.trainId);
                if (train.parent) train.parent.remove(train);
                this.transportModel.removeTrain(train);
            }
        }
    },

    spawnTrainsRandomly() {
        this.routeController.buildRouteGraph();
        const routeCurves = this.transportModel.getRouteCurves();
        const routeGraph = this.transportModel.getRouteGraph();
        const DEPARTURE_COOLDOWN_MS = 8000;
        const startInMap = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        if (routeCurves.length > 0 && this.sceneModel.getHyperloopVisible() && !startInMap) {
            for (let attempt = 0; attempt < 12; attempt++) {
                const randomRoute = routeCurves[Math.floor(Math.random() * routeCurves.length)];
                if (!randomRoute?.from || !randomRoute?.to) continue;
                if (!this.routeController.isRouteAvailable(randomRoute.from, randomRoute.to)) continue;
                if (!this.transportModel.canDepart('train', randomRoute.from, DEPARTURE_COOLDOWN_MS)) continue;
                if (!this.transportModel.canDepartRoutePair(randomRoute.from, randomRoute.to, DEPARTURE_COOLDOWN_MS)) continue;
                this.transportModel.markDeparted('train', randomRoute.from);
                this.transportModel.markDepartedRoutePair(randomRoute.from, randomRoute.to);
                this.createTrain(randomRoute);
                break;
            }
        }

        this.trainSpawnInterval = setInterval(() => {
            const isPageVisible = this.sceneModel.getPageVisible();
            const hyperloopVisible = this.sceneModel.getHyperloopVisible();
            const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
            if (!isPageVisible || !hyperloopVisible || isMapView) return;
            if (this.transportModel.getTrains().length >= 15 || routeCurves.length === 0) return;

            const isMultiStop = Math.random() < 0.33;
            if (isMultiStop && Object.keys(routeGraph).length > 0) {
                const numStops = Math.floor(Math.random() * 3) + 2;
                const multiRoute = this.routeController.findMultiStopRoute(numStops);
                if (multiRoute && multiRoute.routes.length >= 2) {
                    const from0 = multiRoute.routes[0]?.from;
                    const to0 = multiRoute.routes[0]?.to;
                    if (!from0 || !to0) return;
                    if (!this.transportModel.canDepart('train', from0, DEPARTURE_COOLDOWN_MS)) return;
                    if (!this.transportModel.canDepartRoutePair(from0, to0, DEPARTURE_COOLDOWN_MS)) return;
                    if (!this.routeController.isRouteAvailable(from0, to0)) return;
                    this.transportModel.markDeparted('train', from0);
                    this.transportModel.markDepartedRoutePair(from0, to0);
                    this.createMultiStopTrain(multiRoute.routes);
                    return;
                }
            }

            let selectedRoute = routeCurves[Math.floor(Math.random() * routeCurves.length)];
            const rand = Math.random();
            if (rand < 0.30) {
                const aatlisRoutes = routeCurves.filter(r => r.from === 'Aatlis' || r.to === 'Aatlis');
                if (aatlisRoutes.length > 0) selectedRoute = aatlisRoutes[Math.floor(Math.random() * aatlisRoutes.length)];
            } else if (rand < 0.45) {
                const midtownRoutes = routeCurves.filter(r => r.from === 'Midtown' || r.to === 'Midtown');
                if (midtownRoutes.length > 0) selectedRoute = midtownRoutes[Math.floor(Math.random() * midtownRoutes.length)];
            }
            if (!selectedRoute?.from || !selectedRoute?.to) return;
            if (!this.routeController.isRouteAvailable(selectedRoute.from, selectedRoute.to)) return;
            if (!this.transportModel.canDepart('train', selectedRoute.from, DEPARTURE_COOLDOWN_MS)) return;
            if (!this.transportModel.canDepartRoutePair(selectedRoute.from, selectedRoute.to, DEPARTURE_COOLDOWN_MS)) return;
            this.transportModel.markDeparted('train', selectedRoute.from);
            this.transportModel.markDepartedRoutePair(selectedRoute.from, selectedRoute.to);
            this.createTrain(selectedRoute);
        }, 1000);
    },

    stopSpawning() {
        if (!this.trainSpawnInterval) return;
        clearInterval(this.trainSpawnInterval);
        this.trainSpawnInterval = null;
    }
};
