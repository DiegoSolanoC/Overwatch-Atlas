/**
 * WorldviewAircraftControls - Handles plane creation, updates, and spawning
 */

// Keep in sync with GeometryUtils.latLonToVector3 (oblate WGS84 ellipsoid).
const _EARTH_POLAR_RATIO = 6356752.314245179 / 6378137.0;
function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const ux = -(Math.sin(phi) * Math.cos(theta));
    const uz = Math.sin(phi) * Math.sin(theta);
    const uy = Math.cos(phi);
    const a = radius;
    const b = radius * _EARTH_POLAR_RATIO;
    const inv = (ux * ux + uz * uz) / (a * a) + (uy * uy) / (b * b);
    const k = 1 / Math.sqrt(inv);
    return new THREE.Vector3(k * ux, k * uy, k * uz);
}

function createArcBetweenPoints(lat1, lon1, lat2, lon2, altitude, segments, isMainConnection = true, forceLongWay = false) {
    const points = [];
    const lat1Rad = lat1 * Math.PI / 180;
    let lon1Rad = lon1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    let lon2Rad = lon2 * Math.PI / 180;
    
    if (forceLongWay) {
        const lon1Norm = ((lon1 % 360) + 360) % 360;
        const lon2Norm = ((lon2 % 360) + 360) % 360;
        const dLonShort = ((lon2Norm - lon1Norm + 540) % 360) - 180;
        const dLonLong = dLonShort > 0 ? dLonShort - 360 : dLonShort + 360;
        lon2Rad = lon1Rad + dLonLong * Math.PI / 180;
    }
    
    const dLon = lon2Rad - lon1Rad;
    const dLat = lat2Rad - lat1Rad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const angularDistance = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceFactor = angularDistance / Math.PI;
    const baseArcHeight = isMainConnection ? 0.03 : 0.02;
    const maxArcHeight = baseArcHeight * distanceFactor;
    const minArcHeight = isMainConnection ? 0.005 : 0.003;
    const finalArcHeight = Math.max(minArcHeight, maxArcHeight);
    
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const fraction = t * angularDistance;
        const A = Math.sin((1 - t) * angularDistance) / Math.sin(angularDistance);
        const B = Math.sin(t * angularDistance) / Math.sin(angularDistance);
        const x = A * Math.cos(lat1Rad) * Math.cos(lon1Rad) + B * Math.cos(lat2Rad) * Math.cos(lon2Rad);
        const y = A * Math.cos(lat1Rad) * Math.sin(lon1Rad) + B * Math.cos(lat2Rad) * Math.sin(lon2Rad);
        const z = A * Math.sin(lat1Rad) + B * Math.sin(lat2Rad);
        const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI;
        const lon = Math.atan2(y, x) * 180 / Math.PI;
        const arcHeight = Math.sin(t * Math.PI) * finalArcHeight;
        const currentAltitude = altitude + arcHeight;
        const point = latLonToVector3(lat, lon, currentAltitude);
        points.push(point);
    }
    return points;
}

class WorldviewAircraftControls {
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
        
        for (let i = 0; i <= totalSegments; i++) {
            const t = i / totalSegments;
            const basePoint = createArcBetweenPoints(
                fromCity.lat, fromCity.lon,
                toCity.lat, toCity.lon,
                1.005, totalSegments, true
            )[i];
            
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
        
        if (planeModelCache) {
            const planeModel = planeModelCache.clone();
            planeModel.scale.set(0.02, 0.02, 0.02);
            planeModel.visible = true;
            
            planeModel.traverse((child) => {
                if (child.isMesh) {
                    child.material = new THREE.MeshStandardMaterial({
                        color: 0x0088cc,
                        emissive: 0x0088cc,
                        emissiveIntensity: 1.0,
                        transparent: true,
                        opacity: 0.85,
                        roughness: 0.5,
                        metalness: 0.5
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
                
                model.scale.set(0.02, 0.02, 0.02);
                model.visible = true;
                
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.material = new THREE.MeshStandardMaterial({
                            color: 0x0088cc,
                            emissive: 0x0088cc,
                            emissiveIntensity: 1.0,
                            transparent: true,
                            opacity: 0.85,
                            roughness: 0.5,
                            metalness: 0.5
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
        globe.add(planeGroup);
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
            
            for (let j = 0; j <= totalSegments; j++) {
                const t = j / totalSegments;
                const basePoint = createArcBetweenPoints(
                    fromCity.lat, fromCity.lon,
                    toCity.lat, toCity.lon,
                    1.005, totalSegments, true
                )[j];
                
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

    /**
     * Update planes - handles movement, landing, and trail spawning
     */
    updatePlanes() {
        const globe = this.sceneModel.getGlobe();
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
                    globe.remove(plane);
                    this.transportModel.removePlane(plane);
                    continue;
                }
            }
            
            if (data.hasLanded) {
                data.landingTimer += 1;
                if (data.landingTimer > 60) {
                    globe.remove(plane);
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
        
        const minDistance = 0.4;
        
        this.planeSpawnInterval = setInterval(() => {
            const isPageVisible = this.sceneModel.getPageVisible();
            const hyperloopVisible = this.sceneModel.getHyperloopVisible();
            
            if (!isPageVisible || !hyperloopVisible) return;
            
            const MAX_PLANES = 10;
            const planes = this.transportModel.getPlanes();
            if (planes.length >= MAX_PLANES) return;
            
            if (airports.length < 2) return;
            
            const from = airports[Math.floor(Math.random() * airports.length)];
            let to = airports[Math.floor(Math.random() * airports.length)];
            
            while (to === from) {
                to = airports[Math.floor(Math.random() * airports.length)];
            }
            
            const fromPos = latLonToVector3(from.lat, from.lon, 1.0);
            const toPos = latLonToVector3(to.lat, to.lon, 1.0);
            const distance = fromPos.distanceTo(toPos);
            
            const isMultiStop = Math.random() < 0.4;
            
            if (isMultiStop && airports.length >= 3) {
                const numStops = Math.floor(Math.random() * 3) + 2;
                const selectedAirports = [];
                
                let current = airports[Math.floor(Math.random() * airports.length)];
                selectedAirports.push(current);
                
                for (let i = 1; i < numStops && i < airports.length; i++) {
                    let next = airports[Math.floor(Math.random() * airports.length)];
                    while (selectedAirports.includes(next) && airports.length > selectedAirports.length) {
                        next = airports[Math.floor(Math.random() * airports.length)];
                    }
                    if (!selectedAirports.includes(next)) {
                        selectedAirports.push(next);
                    }
                }
                
                if (selectedAirports.length >= 2) {
                    this.createMultiStopPlane(selectedAirports);
                }
            } else if (distance >= minDistance) {
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

// Make available globally
if (typeof window !== 'undefined') {
    window.WorldviewAircraftControls = WorldviewAircraftControls;
}
