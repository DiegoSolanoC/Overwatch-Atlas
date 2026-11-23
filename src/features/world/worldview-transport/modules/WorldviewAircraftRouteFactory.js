import { latLonToVector3, createArcBetweenPoints } from '../../worldview-shared-assets/utils/WorldviewGeometry.js';
import { getTransportVehicleColors } from '../../worldview-shared-assets/utils/TransportPaletteColors.js';

const _laneTangent = new THREE.Vector3();
const _laneUp = new THREE.Vector3();
const _laneRight = new THREE.Vector3();

/**
 * Count live planes already flying the same undirected OD pair.
 */
function countPlanesOnRoute(transportModel, fromName, toName) {
    const planes = transportModel?.getPlanes?.() || [];
    const key = [fromName, toName].sort().join('|');
    let n = 0;
    for (let i = 0; i < planes.length; i++) {
        const ud = planes[i]?.userData;
        if (!ud?.isPlane) continue;
        const a = ud.from;
        const b = ud.to;
        if (!a || !b) continue;
        if ([a, b].sort().join('|') === key) n++;
    }
    return n;
}

/**
 * Assign a lateral lane + altitude band so concurrent flights on the same corridor separate.
 */
function assignTrafficLane(transportModel, fromName, toName) {
    const n = countPlanesOnRoute(transportModel, fromName, toName);
    const laneIndex = (n % 5) - 2; // -2..2
    const altitudeBand = (n % 3) - 1; // -1..1
    return {
        laneOffset: laneIndex * 0.015,
        altitudeBias: altitudeBand * 0.007,
        laneIndex
    };
}

/**
 * Build a takeoff/cruise/landing curve with optional lateral corridor offset (0 at endpoints).
 */
function buildFlightCurve(fromCity, toCity, laneOffset = 0, altitudeBias = 0) {
    const groundStart = latLonToVector3(fromCity.lat, fromCity.lon, 1.005);
    const groundEnd = latLonToVector3(toCity.lat, toCity.lon, 1.005);
    const distance = groundStart.distanceTo(groundEnd);

    const minAltitude = 1.04;
    const maxAltitude = 1.08;
    const normalizedDistance = Math.min(distance / 1.5, 1.0);
    const cruiseAltitude = minAltitude + (maxAltitude - minAltitude) * normalizedDistance + altitudeBias;

    const takeoffPhase = 0.25 - (normalizedDistance * 0.05);
    const landingPhase = 0.50 - (normalizedDistance * 0.10);
    const cruiseStart = takeoffPhase;
    const cruiseEnd = 1.0 - landingPhase;

    const totalSegments = 60;
    const arcPoints = createArcBetweenPoints(
        fromCity.lat, fromCity.lon,
        toCity.lat, toCity.lon,
        1.005, totalSegments, true
    );

    const flightPoints = [];
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

        const point = basePoint.clone().normalize().multiplyScalar(altitude);

        if (laneOffset) {
            const prev = arcPoints[Math.max(0, i - 1)];
            const next = arcPoints[Math.min(totalSegments, i + 1)];
            _laneTangent.subVectors(next, prev);
            if (_laneTangent.lengthSq() > 1e-12) {
                _laneTangent.normalize();
                _laneUp.copy(point).normalize();
                _laneRight.crossVectors(_laneTangent, _laneUp);
                if (_laneRight.lengthSq() > 1e-12) {
                    _laneRight.normalize();
                    const fade = Math.sin(t * Math.PI);
                    point.addScaledVector(_laneRight, laneOffset * fade);
                    point.setLength(altitude);
                }
            }
        }

        flightPoints.push(point);
    }

    const curve = new THREE.CatmullRomCurve3(flightPoints);
    const speed = distance > 1.5 ? 0.0015 : 0.0020;
    return { curve, speed, distance, cruiseAltitude };
}

function attachPlaneModel(planeGroup, planeModelCache, gltfLoader, transportModel, modelScale, planeColor, planeEmissive) {
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
        return;
    }

    gltfLoader.load('src/assets/models/Plane.glb', (gltf) => {
        const model = gltf.scene;
        const cached = model.clone();
        transportModel.setPlaneModelCache(cached);

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

export const worldviewAircraftRouteFactory = {
    createPlane(fromCity, toCity) {
        const globe = this.sceneModel.getGlobe();
        const gltfLoader = this.sceneModel.getGLTFLoader();
        const planeModelCache = this.transportModel.getPlaneModelCache();
        const modelScale = 0.02;

        const lane = assignTrafficLane(this.transportModel, fromCity.name, toCity.name);
        const { curve, speed } = buildFlightCurve(
            fromCity,
            toCity,
            lane.laneOffset,
            lane.altitudeBias
        );

        const planeGroup = new THREE.Group();
        const { color: planeColor, emissive: planeEmissive } = getTransportVehicleColors();
        attachPlaneModel(
            planeGroup,
            planeModelCache,
            gltfLoader,
            this.transportModel,
            modelScale,
            planeColor,
            planeEmissive
        );

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
            bankChangeTimer: 0,
            // Air-traffic control — runtime detours off the assigned corridor
            detourLateral: 0,
            detourAltitude: 0,
            targetDetourLateral: 0,
            targetDetourAltitude: 0,
            laneIndex: lane.laneIndex,
            atcId: Math.random().toString(36).slice(2, 10)
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
            const lane = assignTrafficLane(this.transportModel, fromCity.name, toCity.name);
            const { curve, speed } = buildFlightCurve(
                fromCity,
                toCity,
                lane.laneOffset,
                lane.altitudeBias
            );

            routes.push({
                from: fromCity.name,
                to: toCity.name,
                fromCity,
                toCity,
                curve,
                speed,
                laneIndex: lane.laneIndex
            });
        }

        const firstRoute = routes[0];
        const plane = this.createPlane(firstRoute.fromCity, firstRoute.toCity);

        // Replace the single-leg curve with the multi-stop schedule
        plane.userData.curve = firstRoute.curve;
        plane.userData.speed = firstRoute.speed;
        plane.userData.from = firstRoute.from;
        plane.userData.to = firstRoute.to;
        plane.userData.laneIndex = firstRoute.laneIndex;
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
