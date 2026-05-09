/**
 * PlaneManager - Manages plane creation, updates, and spawning
 */

import { latLonToVector3, createArcBetweenPoints } from '../../utils/GeometryUtils.js';
import { getTransportVehicleColors } from '../../utils/TransportPaletteColors.js';

export class PlaneManager {
    constructor(sceneModel, transportModel, transportView, dataModel) {
        this.sceneModel = sceneModel;
        this.transportModel = transportModel;
        this.transportView = transportView;
        this.dataModel = dataModel;
        this.planeSpawnInterval = null;
    }
    
    /**
     * Create a plane
     * @param {Object} fromCity - From city object
     * @param {Object} toCity - To city object
     * @returns {Object} Plane object
     */
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
            const planeModel = planeModelCache.clone(); // Clone model (materials are cloned automatically)
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
                    const cached = model.clone(); // Clone model (materials are cloned automatically)
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
            curve: curve,
            progress: 0,
            speed: speed,
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
    }

    /**
     * Create a multi-stop plane
     * @param {Array} airports - Array of airport objects in order
     * @returns {Object} Plane object
     */
    createMultiStopPlane(airports) {
        if (airports.length < 2) return null;
        
        // Create route segments for each airport pair
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
                fromCity: fromCity,
                toCity: toCity,
                curve: curve,
                speed: speed
            });
        }
        
        // Create plane with first route
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
        
        const journey = routes.map(r => `${r.from}->${r.to}`).join(' | ');
        
        return plane;
    }

    /**
     * Update planes - handles movement, landing, and trail spawning
     */
    updatePlanes() {
        if (!this.sceneModel.getHyperloopVisible()) return;

        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        if (isMapView) return;

        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        const planes = this.transportModel.getPlanes();

        for (let i = planes.length - 1; i >= 0; i--) {
            const plane = planes[i];
            const data = plane.userData;
            
            // Handle multi-stop planes
            if (data.isMultiStop && data.progress >= 1.0 && !data.isTransitioning) {
                if (data.currentRouteIndex < data.routes.length - 1) {
                    // Move to next route immediately
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
                    // Last stop - remove immediately
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
                    if (Math.random() < 0.1) {
                        data.trailSpawnInterval = Math.random() * 10 + 5;
                    } else {
                        data.trailSpawnInterval = 2;
                    }
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
    }

    /**
     * Spawn planes randomly
     */
    spawnPlanesRandomly() {
        const airports = this.dataModel ? this.dataModel.getAllAirports() : [];
        console.log(`📊 Total airports: ${airports.length}`);
        
        const minDistance = 0.4;
        const DEPARTURE_COOLDOWN_MS = 8000;
        
        this.planeSpawnInterval = setInterval(() => {
            const isPageVisible = this.sceneModel.getPageVisible();
            const hyperloopVisible = this.sceneModel.getHyperloopVisible();
            const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
            
            if (!isPageVisible || !hyperloopVisible || isMapView) return;
            
            // Limit number of planes (half the normal amount for mobile performance)
            const MAX_PLANES = 10;
            const planes = this.transportModel.getPlanes();
            if (planes.length >= MAX_PLANES) return;
            
            if (airports.length < 2) return;
            
            // Try a few picks to respect departure cooldown on the origin.
            let from = null;
            let to = null;
            for (let attempt = 0; attempt < 10; attempt++) {
                const candidateFrom = airports[Math.floor(Math.random() * airports.length)];
                if (!candidateFrom) continue;
                if (!this.transportModel.canDepart('plane', candidateFrom.name, DEPARTURE_COOLDOWN_MS)) continue;
                from = candidateFrom;
                break;
            }
            if (!from) return;

            to = airports[Math.floor(Math.random() * airports.length)];
            
            while (to === from) {
                to = airports[Math.floor(Math.random() * airports.length)];
            }
            
            // Cross-vehicle: if any vehicle departed from->to recently, block this takeoff.
            if (!this.transportModel.canDepartRoutePair(from.name, to.name, DEPARTURE_COOLDOWN_MS)) return;

            // Use globe distance metric for spawn filtering (good enough for map view too)
            const fromPos = latLonToVector3(from.lat, from.lon, 1.0);
            const toPos = latLonToVector3(to.lat, to.lon, 1.0);
            const distance = fromPos.distanceTo(toPos);
            
            const isMultiStop = Math.random() < 0.4; // 40% chance for multi-stop
            
            if (isMultiStop && airports.length >= 3) {
                // Create multi-stop plane
                const numStops = Math.floor(Math.random() * 3) + 2; // 2-4 stops
                const selectedAirports = [];
                
                // Pick random starting airport
                let current = airports[Math.floor(Math.random() * airports.length)];
                // Ensure the first departure respects cooldown
                if (!this.transportModel.canDepart('plane', current.name, DEPARTURE_COOLDOWN_MS)) {
                    // fall back to the `from` we already validated
                    current = from;
                }
                selectedAirports.push(current);
                
                // Pick subsequent airports
                for (let i = 1; i < numStops && i < airports.length; i++) {
                    let next = airports[Math.floor(Math.random() * airports.length)];
                    // Avoid duplicates
                    while (selectedAirports.includes(next) && airports.length > selectedAirports.length) {
                        next = airports[Math.floor(Math.random() * airports.length)];
                    }
                    if (!selectedAirports.includes(next)) {
                        selectedAirports.push(next);
                    }
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
    }
    
    /**
     * Stop spawning planes
     */
    stopSpawning() {
        if (this.planeSpawnInterval) {
            clearInterval(this.planeSpawnInterval);
            this.planeSpawnInterval = null;
        }
    }
}
