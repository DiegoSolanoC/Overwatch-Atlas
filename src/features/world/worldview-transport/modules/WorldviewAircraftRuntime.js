import { latLonToVector3 } from '../../worldview-shared-assets/utils/WorldviewGeometry.js';

export const worldviewAircraftRuntime = {
    updatePlanes() {
        if (!this.sceneModel.getHyperloopVisible()) return;

        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        if (isMapView) return;

        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        const planes = this.transportModel.getPlanes();

        for (let i = planes.length - 1; i >= 0; i--) {
            const plane = planes[i];
            const data = plane.userData;

            if (data.isMultiStop && data.progress >= 1.0 && !data.isTransitioning) {
                if (data.currentRouteIndex < data.routes.length - 1) {
                    data.isTransitioning = true;
                    data.currentRouteIndex++;
                    const nextRoute = data.routes[data.currentRouteIndex];

                    data.curve = nextRoute.curve;
                    data.speed = nextRoute.speed;
                    data.from = nextRoute.from;
                    data.to = nextRoute.to;
                    data.progress = 0;
                    data.hasLanded = false;
                    data.landingTimer = 0;
                } else {
                    if (plane.parent) plane.parent.remove(plane);
                    this.transportModel.removePlane(plane);
                    continue;
                }
            }

            if (data.hasLanded) {
                data.landingTimer += 1;
                if (data.landingTimer > 60) {
                    if (plane.parent) plane.parent.remove(plane);
                    this.transportModel.removePlane(plane);
                    continue;
                }
                continue;
            }

            data.progress += data.speed;

            if (data.progress >= 1.0 && !data.isMultiStop) {
                data.progress = 1.0;
                data.hasLanded = true;
                data.landingTimer = 0;
                continue;
            }

            if (data.isMultiStop && data.progress > 0.1 && data.progress < 0.9 && data.isTransitioning) {
                data.isTransitioning = false;
            }

            if (data.progress > 0 && data.progress <= 1) {
                const position = data.curve.getPointAt(data.progress);
                plane.position.copy(position);

                data.lastTrailSpawn += 1;
                if (data.lastTrailSpawn >= data.trailSpawnInterval) {
                    const tangent = data.curve.getTangentAt(data.progress).normalize();
                    const forwardDirection = tangent.clone().negate();
                    this.transportView.createTrailSegment(position, forwardDirection);
                    data.lastTrailSpawn = 0;
                    if (Math.random() < 0.1) data.trailSpawnInterval = Math.random() * 10 + 5;
                    else data.trailSpawnInterval = 2;
                }

                data.bankChangeTimer += 1;
                if (data.bankChangeTimer > 60) {
                    data.targetBankAngle = (Math.random() - 0.5) * 0.3;
                    data.bankChangeTimer = 0;
                }

                data.bankAngle += (data.targetBankAngle - data.bankAngle) * 0.05;

                const tangent = data.curve.getTangentAt(data.progress).normalize();
                const up = position.clone().normalize();
                const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
                const correctedUp = new THREE.Vector3().crossVectors(right, tangent).normalize();

                const rotationMatrix = new THREE.Matrix4();
                rotationMatrix.makeBasis(right, correctedUp, tangent.negate());
                plane.quaternion.setFromRotationMatrix(rotationMatrix);

                const bankQuaternion = new THREE.Quaternion();
                bankQuaternion.setFromAxisAngle(tangent, data.bankAngle);
                plane.quaternion.multiply(bankQuaternion);

                plane.visible = hyperloopVisible;
            }
        }
    },

    spawnPlanesRandomly() {
        const airports = this.dataModel ? this.dataModel.getAllAirports() : [];
        const minDistance = 0.4;
        const DEPARTURE_COOLDOWN_MS = 8000;

        this.planeSpawnInterval = setInterval(() => {
            const isPageVisible = this.sceneModel.getPageVisible();
            const hyperloopVisible = this.sceneModel.getHyperloopVisible();
            const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;

            if (!isPageVisible || !hyperloopVisible || isMapView) return;

            const MAX_PLANES = 10;
            const planes = this.transportModel.getPlanes();
            if (planes.length >= MAX_PLANES || airports.length < 2) return;

            let from = null;
            for (let attempt = 0; attempt < 10; attempt++) {
                const candidateFrom = airports[Math.floor(Math.random() * airports.length)];
                if (!candidateFrom) continue;
                if (!this.transportModel.canDepart('plane', candidateFrom.name, DEPARTURE_COOLDOWN_MS)) continue;
                from = candidateFrom;
                break;
            }
            if (!from) return;

            let to = airports[Math.floor(Math.random() * airports.length)];
            while (to === from) to = airports[Math.floor(Math.random() * airports.length)];

            if (!this.transportModel.canDepartRoutePair(from.name, to.name, DEPARTURE_COOLDOWN_MS)) return;

            const fromPos = latLonToVector3(from.lat, from.lon, 1.0);
            const toPos = latLonToVector3(to.lat, to.lon, 1.0);
            const distance = fromPos.distanceTo(toPos);

            const isMultiStop = Math.random() < 0.4;
            if (isMultiStop && airports.length >= 3) {
                const numStops = Math.floor(Math.random() * 3) + 2;
                const selectedAirports = [];

                let current = airports[Math.floor(Math.random() * airports.length)];
                if (!this.transportModel.canDepart('plane', current.name, DEPARTURE_COOLDOWN_MS)) current = from;
                selectedAirports.push(current);

                for (let i = 1; i < numStops && i < airports.length; i++) {
                    let next = airports[Math.floor(Math.random() * airports.length)];
                    while (selectedAirports.includes(next) && airports.length > selectedAirports.length) {
                        next = airports[Math.floor(Math.random() * airports.length)];
                    }
                    if (!selectedAirports.includes(next)) selectedAirports.push(next);
                }

                if (selectedAirports.length >= 2) {
                    this.transportModel.markDeparted('plane', selectedAirports[0].name);
                    this.transportModel.markDepartedRoutePair(selectedAirports[0].name, selectedAirports[1].name);
                    this.createMultiStopPlane(selectedAirports);
                }
            } else if (distance >= minDistance) {
                this.transportModel.markDeparted('plane', from.name);
                this.transportModel.markDepartedRoutePair(from.name, to.name);
                this.createPlane(from, to);
            }
        }, 3000);
    },

    stopSpawning() {
        if (!this.planeSpawnInterval) return;
        clearInterval(this.planeSpawnInterval);
        this.planeSpawnInterval = null;
    }
};
