import { latLonToVector3, createArcBetweenPoints } from '../../worldview-shared-assets/utils/WorldviewGeometry.js';
import { getTransportVehicleColors } from '../../worldview-shared-assets/utils/TransportPaletteColors.js';

export const worldviewAircraftRouteFactory = {
    createPlane(fromCity, toCity) {
        const globe = this.sceneModel.getGlobe();
        const gltfLoader = this.sceneModel.getGLTFLoader();
        const planeModelCache = this.transportModel.getPlaneModelCache();
        const modelScale = 0.02;

        const groundStart = latLonToVector3(fromCity.lat, fromCity.lon, 1.005);
        const groundEnd = latLonToVector3(toCity.lat, toCity.lon, 1.005);
        const distance = groundStart.distanceTo(groundEnd);

        const minAltitude = 1.04;
        const maxAltitude = 1.08;
        const normalizedDistance = Math.min(distance / 1.5, 1.0);
        const cruiseAltitude = minAltitude + (maxAltitude - minAltitude) * normalizedDistance;

        const takeoffPhase = 0.25 - (normalizedDistance * 0.05);
        const landingPhase = 0.50 - (normalizedDistance * 0.10);
        const cruiseStart = takeoffPhase;
        const cruiseEnd = 1.0 - landingPhase;

        const flightPoints = [];
        const totalSegments = 60;
        const arcPoints = createArcBetweenPoints(
            fromCity.lat, fromCity.lon,
            toCity.lat, toCity.lon,
            1.005, totalSegments, true
        );
        for (let i = 0; i <= totalSegments; i++) {
            const t = i / totalSegments;
            const basePoint = arcPoints[i];

            let altitude;
            if (t < cruiseStart) {
                const takeoffProgress = t / cruiseStart;
                const easeOut = Math.sin(takeoffProgress * Math.PI / 2);
                altitude = 1.005 + (cruiseAltitude - 1.005) * easeOut;
            } else if (t > cruiseEnd) {
                const landingProgress = (t - cruiseEnd) / (1.0 - cruiseEnd);
                const easeIn = landingProgress * landingProgress;
                altitude = cruiseAltitude - (cruiseAltitude - 1.005) * easeIn;
            } else {
                altitude = cruiseAltitude;
            }

            const normalizedPos = basePoint.clone().normalize();
            flightPoints.push(normalizedPos.multiplyScalar(altitude));
        }
        const curve = new THREE.CatmullRomCurve3(flightPoints);
        const speed = distance > 1.5 ? 0.0015 : 0.0020;

        const planeGroup = new THREE.Group();
        const { color: planeColor, emissive: planeEmissive } = getTransportVehicleColors();

        if (planeModelCache) {
            const planeModel = planeModelCache.clone();
            planeModel.scale.set(modelScale, modelScale, modelScale);
            planeModel.visible = true;

            planeModel.traverse((child) => {
                if (child.isMesh) {
                    child.material = new THREE.MeshPhongMaterial({
                        color: planeColor,
                        emissive: planeEmissive,
                        emissiveIntensity: 0.3,
                        transparent: true,
                        opacity: 0.85,
                        shininess: 30
                    });
                    child.visible = true;
                }
            });

            planeGroup.add(planeModel);
        } else {
            gltfLoader.load('src/assets/models/Plane.glb', (gltf) => {
                const model = gltf.scene;
                const cached = model.clone();
                this.transportModel.setPlaneModelCache(cached);

                model.scale.set(modelScale, modelScale, modelScale);
                model.visible = true;

                model.traverse((child) => {
                    if (child.isMesh) {
                        child.material = new THREE.MeshPhongMaterial({
                            color: planeColor,
                            emissive: planeEmissive,
                            emissiveIntensity: 0.3,
                            transparent: true,
                            opacity: 0.85,
                            shininess: 30
                        });
                        child.visible = true;
                        if (child.geometry) {
                            child.geometry.computeBoundingBox();
                            child.geometry.computeBoundingSphere();
                        }
                    }
                });

                planeGroup.add(model);
            }, undefined, (error) => {
                console.error('Error loading plane model:', error);
            });
        }

        planeGroup.userData = {
            curve,
            progress: 0,
            speed,
            from: fromCity.name,
            to: toCity.name,
            isPlane: true,
            lastTrailSpawn: 0,
            trailSpawnInterval: 2,
            landingTimer: 0,
            hasLanded: false,
            bankAngle: 0,
            targetBankAngle: 0,
            bankChangeTimer: 0
        };

        planeGroup.visible = false;
        if (globe) globe.add(planeGroup);
        this.transportModel.addPlane(planeGroup);

        return planeGroup;
    },

    createMultiStopPlane(airports) {
        if (airports.length < 2) return null;

        const routes = [];
        for (let i = 0; i < airports.length - 1; i++) {
            const fromCity = airports[i];
            const toCity = airports[i + 1];
            const groundStart = latLonToVector3(fromCity.lat, fromCity.lon, 1.005);
            const groundEnd = latLonToVector3(toCity.lat, toCity.lon, 1.005);
            const distance = groundStart.distanceTo(groundEnd);

            const minAltitude = 1.04;
            const maxAltitude = 1.08;
            const normalizedDistance = Math.min(distance / 1.5, 1.0);
            const cruiseAltitude = minAltitude + (maxAltitude - minAltitude) * normalizedDistance;

            const takeoffPhase = 0.25 - (normalizedDistance * 0.05);
            const landingPhase = 0.50 - (normalizedDistance * 0.10);
            const cruiseStart = takeoffPhase;
            const cruiseEnd = 1.0 - landingPhase;

            const flightPoints = [];
            const totalSegments = 60;
            const arcPoints = createArcBetweenPoints(
                fromCity.lat, fromCity.lon,
                toCity.lat, toCity.lon,
                1.005, totalSegments, true
            );
            for (let j = 0; j <= totalSegments; j++) {
                const t = j / totalSegments;
                const basePoint = arcPoints[j];

                let altitude;
                if (t < cruiseStart) {
                    const takeoffProgress = t / cruiseStart;
                    const easeOut = Math.sin(takeoffProgress * Math.PI / 2);
                    altitude = 1.005 + (cruiseAltitude - 1.005) * easeOut;
                } else if (t > cruiseEnd) {
                    const landingProgress = (t - cruiseEnd) / (1.0 - cruiseEnd);
                    const easeIn = landingProgress * landingProgress;
                    altitude = cruiseAltitude - (cruiseAltitude - 1.005) * easeIn;
                } else {
                    altitude = cruiseAltitude;
                }

                const normalizedPos = basePoint.clone().normalize();
                flightPoints.push(normalizedPos.multiplyScalar(altitude));
            }
            const curve = new THREE.CatmullRomCurve3(flightPoints);
            const speed = distance > 1.5 ? 0.0015 : 0.0020;

            routes.push({
                from: fromCity.name,
                to: toCity.name,
                fromCity,
                toCity,
                curve,
                speed
            });
        }

        const firstRoute = routes[0];
        const plane = this.createPlane(firstRoute.fromCity, firstRoute.toCity);

        plane.userData.isMultiStop = true;
        plane.userData.routes = routes;
        plane.userData.currentRouteIndex = 0;
        plane.userData.totalRoutes = routes.length;
        plane.userData.planeId = Math.random().toString(36).substr(2, 9);
        plane.userData.finalDestination = routes[routes.length - 1].to;
        plane.userData.hasLanded = false;
        plane.userData.landingTimer = 0;
        plane.userData.isTransitioning = false;

        return plane;
    }
};
