/**
 * TrainManager - Manages train creation, updates, and spawning
 */

import { latLonToMapPlanePosition } from '../worldview-shared-assets/utils/GeometryUtils.js';
import { getTransportVehicleColors } from '../worldview-shared-assets/utils/TransportPaletteColors.js';

export class TrainManager {
    constructor(sceneModel, transportModel, routeController) {
        this.sceneModel = sceneModel;
        this.transportModel = transportModel;
        this.routeController = routeController;
        this.trainSpawnInterval = null;
    }
    
    /**
     * Calculate route distance
     * @param {THREE.Curve} curve - Route curve
     * @returns {number}
     */
    calculateRouteDistance(curve) {
        return this.routeController.calculateRouteDistance(curve);
    }
    
    /**
     * Create a train with wagons
     * @param {Object} routeData - Route data
     * @param {boolean} isMultiStop - Is multi-stop route
     * @param {number} journeyProgress - Journey progress
     * @returns {Object} Train object
     */
    createTrain(routeData, isMultiStop = false, journeyProgress = 0) {
        const globe = this.sceneModel.getGlobe();
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;

        // Map view: use a straight line between endpoints (no curvature)
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

            const start = new THREE.Vector3(a.x, a.y, mapZ);
            const end = new THREE.Vector3(bx, b.y, mapZ);
            return new THREE.LineCurve3(start, end);
        };

        const activeCurve = (isMapView && routeData?.fromLat != null && routeData?.fromLon != null && routeData?.toLat != null && routeData?.toLon != null)
            ? buildWrappedMapLineCurve(routeData.fromLat, routeData.fromLon, routeData.toLat, routeData.toLon)
            : routeData.curve;
        const routeDistance = this.calculateRouteDistance(activeCurve);
        
        // Determine number of wagons based on distance
        let maxWagons;
        if (routeDistance < 0.5) {
            maxWagons = 2;
        } else if (routeDistance < 1.0) {
            maxWagons = 4;
        } else {
            maxWagons = 6;
        }
        
        const rand = Math.random();
        let numWagons;
        if (rand < 0.7) {
            numWagons = Math.floor(Math.random() * (maxWagons - 2)) + 3;
        } else {
            numWagons = 2;
        }
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
                if (child.isMesh) {
                    // Only apply material if it's not already a trail (which uses MeshBasicMaterial)
                    // Check if material exists and is not MeshBasicMaterial, or create new one
                    if (!child.material || child.material.type !== 'MeshBasicMaterial') {
                        child.material = new THREE.MeshPhongMaterial({
                            color: trainColor,
                            emissive: trainEmissive,
                            emissiveIntensity: 0.3,
                            transparent: true,
                            opacity: 0.85,
                            shininess: 30
                        });
                    }
                    child.visible = true;
                    if (child.geometry) {
                        child.geometry.computeBoundingBox();
                        child.geometry.computeBoundingSphere();
                    }
                }
            });
        };
        
        // Function to load or clone train end model
        const getTrainEndModel = (callback) => {
            if (trainEndModelCache) {
                const model = trainEndModelCache.clone(); // Clone model (materials are cloned automatically)
                model.scale.set(modelScale, modelScale, modelScale);
                model.visible = true;
                applyTrainMaterial(model);
                callback(model);
            } else {
                gltfLoader.load('src/assets/models/TrainEnd.glb', (gltf) => {
                    const model = gltf.scene;
                    const cached = model.clone(); // Clone model (materials are cloned automatically)
                    this.transportModel.setTrainEndModelCache(cached);
                    
                    model.scale.set(modelScale, modelScale, modelScale);
                    model.visible = true;
                    applyTrainMaterial(model);
                    callback(model);
                }, undefined, (error) => {
                    console.error('Error loading TrainEnd.glb:', error);
                    // Fallback to simple box
                    const fallback = new THREE.Mesh(
                        new THREE.BoxGeometry(0.03 * fallbackScale, 0.01 * fallbackScale, 0.08 * fallbackScale),
                        new THREE.MeshPhongMaterial({ color: trainColor, transparent: true, opacity: 0.85 })
                    );
                    callback(fallback);
                });
            }
        };
        
        // Function to load or clone train middle model
        const getTrainMiddleModel = (callback) => {
            if (trainMiddleModelCache) {
                const model = trainMiddleModelCache.clone(true); // Deep clone to clone materials too
                model.scale.set(modelScale, modelScale, modelScale);
                model.visible = true;
                applyTrainMaterial(model);
                callback(model);
            } else {
                gltfLoader.load('src/assets/models/TrainMiddle.glb', (gltf) => {
                    const model = gltf.scene;
                    const cached = model.clone(); // Clone model (materials are cloned automatically)
                    this.transportModel.setTrainMiddleModelCache(cached);
                    
                    model.scale.set(modelScale, modelScale, modelScale);
                    model.visible = true;
                    applyTrainMaterial(model);
                    callback(model);
                }, undefined, (error) => {
                    console.error('Error loading TrainMiddle.glb:', error);
                    // Fallback to simple box
                    const fallback = new THREE.Mesh(
                        new THREE.BoxGeometry(0.03 * fallbackScale, 0.01 * fallbackScale, 0.08 * fallbackScale),
                        new THREE.MeshPhongMaterial({ color: trainColor, transparent: true, opacity: 0.85 })
                    );
                    callback(fallback);
                });
            }
        };
        
        // Create wagons with appropriate models
        for (let i = 0; i < numWagons; i++) {
            const wagonGroup = new THREE.Group();
            
            if (i === 0) {
                // First wagon: use TrainEnd.glb
                getTrainEndModel((model) => {
                    wagonGroup.add(model);
                });
            } else if (i === numWagons - 1) {
                // Last wagon: use TrainEnd.glb rotated 180 degrees on Y axis to face backwards
                getTrainEndModel((model) => {
                    model.rotation.y = Math.PI; // 180 degrees rotation on Y axis
                    wagonGroup.add(model);
                });
            } else {
                // Middle wagons: use TrainMiddle.glb
                getTrainMiddleModel((model) => {
                    wagonGroup.add(model);
                });
            }
            
            wagonGroup.renderOrder = 999;
            wagonGroup.visible = false;
            wagonGroup.position.set(0, 0, 0);
            
            trainGroup.add(wagonGroup);
            wagons.push(wagonGroup);
        }
        
        let baseSpeed;
        if (routeDistance < 0.5) {
            baseSpeed = 0.006;
        } else if (routeDistance < 1.0) {
            baseSpeed = 0.005;
        } else {
            baseSpeed = 0.004;
        }
        const speed = baseSpeed + Math.random() * 0.002;
        
        trainGroup.userData = {
            curve: activeCurve,
            progress: 0,
            speed: speed,
            from: routeData.from,
            to: routeData.to,
            wagons: wagons,
            wagonSpacing: isMapView ? (0.045 / 2) : 0.045,
            isMultiStop: false,
            routes: null,
            currentRouteIndex: 0,
            needsReverse: false,
            isTransitioning: false,
            trainId: Math.random().toString(36).substr(2, 9),
            isWaiting: false,
            journeyProgress: journeyProgress
        };
        
        if (!isMultiStop) {
            this.routeController.reserveRoute(routeData.from, routeData.to, trainGroup.userData.trainId);
        }
        
        const startPos = activeCurve.getPointAt(0);
        trainGroup.position.copy(startPos);
        trainGroup.visible = false;
        trainGroup.userData.isNewlySpawned = true;
        
        const parent = globe;
        if (parent) parent.add(trainGroup);
        this.transportModel.addTrain(trainGroup);
        
        return trainGroup;
    }

    /**
     * Create a multi-stop train
     * @param {Array} routes - Array of route data
     * @returns {Object} Train object
     */
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
        
        const journey = routes.map(r => `${r.from}->${r.to}${r.needsReverse?'(rev)':''}`).join(' | ');
        
        return train;
    }

    /**
     * Update trains - handles movement, multi-stop transitions, and wagon positioning
     */
    updateTrains() {
        if (!this.sceneModel.getHyperloopVisible()) return;

        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        if (isMapView) return;

        const globe = this.sceneModel.getGlobe();
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        const trains = this.transportModel.getTrains();
        const planeUp = new THREE.Vector3(0, 0, 1);
        const planeWidth = 2.0;
        const halfW = planeWidth / 2;
        const wrapX = (x) => {
            // Wrap x into [-halfW, halfW)
            return ((x + halfW) % planeWidth + planeWidth) % planeWidth - halfW;
        };
        const mapZ = 0.01;
        const buildMapCurveForRoute = (route) => {
            if (!route || route.fromLat == null || route.fromLon == null || route.toLat == null || route.toLon == null) return route?.curve;
            const a = latLonToMapPlanePosition(route.fromLat, route.fromLon, planeWidth, 1.0, mapZ);
            const b = latLonToMapPlanePosition(route.toLat, route.toLon, planeWidth, 1.0, mapZ);
            let bx = b.x;
            const dx = bx - a.x;
            if (dx > halfW) bx -= planeWidth;
            else if (dx < -halfW) bx += planeWidth;
            return new THREE.LineCurve3(
                new THREE.Vector3(a.x, a.y, mapZ),
                new THREE.Vector3(bx, b.y, mapZ)
            );
        };
        
        for (let i = trains.length - 1; i >= 0; i--) {
            const train = trains[i];
            const data = train.userData;
            
            if (data.isNewlySpawned) {
                data.isNewlySpawned = false;
                continue;
            }
            
            if (!data.isWaiting) {
                data.progress += data.speed;
            }
            
            // Handle multi-stop trains
            if (data.isMultiStop && data.progress >= 1.0 && !data.isTransitioning) {
                if (data.currentRouteIndex < data.routes.length - 1) {
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
                            if (!data.isWaiting) {
                                data.isWaiting = true;
                                data.progress = 1.0;
                            }
                            canDepart = false;
                        }
                    } else {
                        canDepart = true;
                    }
                    
                    if (canDepart) {
                        data.isTransitioning = true;
                        if (data.isWaiting) {
                            data.isWaiting = false;
                        }
                        
                        this.routeController.reserveRoute(nextRoute.from, nextRoute.to, data.trainId);
                        data.currentRouteIndex++;
                        data.journeyProgress = data.currentRouteIndex / data.totalRoutes;
                        
                        const progressPercent = Math.round(data.journeyProgress * 100);
                        
                        data.curve = isMapView ? buildMapCurveForRoute(nextRoute) : nextRoute.curve;
                        data.from = nextRoute.from;
                        data.to = nextRoute.to;
                        data.previousCity = currentFrom;
                        data.needsReverse = nextRoute.needsReverse;
                        data.progress = 0;
                        
                        const routeDistance = this.calculateRouteDistance(data.curve);
                        let baseSpeed;
                        if (routeDistance < 0.5) {
                            baseSpeed = 0.006;
                        } else if (routeDistance < 1.0) {
                            baseSpeed = 0.005;
                        } else {
                            baseSpeed = 0.004;
                        }
                        data.speed = baseSpeed + Math.random() * 0.002;
                    }
                }
            }
            
            if (data.isMultiStop && data.progress > 0.1 && data.progress < 0.9 && data.isTransitioning) {
                data.isTransitioning = false;
            }
            
            // Position train like planes/boats - simpler and more reliable
            // Allow progress > 1 so wagons can disappear one by one
            if (data.progress > 0) {
                if (!data.curve || typeof data.curve.getPointAt !== 'function') {
                    train.visible = false;
                    continue;
                }
                
                try {
                    // Clamp train position to end of curve when progress > 1
                    const trainProgress = Math.min(data.progress, 1.0);
                    const rawTrainPos = data.curve.getPointAt(trainProgress);
                    const position = isMapView
                        ? new THREE.Vector3(wrapX(rawTrainPos.x), rawTrainPos.y, rawTrainPos.z)
                        : rawTrainPos;
                    
                    if (!position || isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) {
                        train.visible = false;
                        continue;
                    }
                    
                    // Validate position like planes/boats do
                    if (!isMapView) {
                        const distanceFromCenter = position.length();
                        if (distanceFromCenter < 0.5 || distanceFromCenter > 2.0) {
                            train.visible = false;
                            continue;
                        }
                    }
                    
                    train.position.copy(position);
                    
                    // Position wagons relative to train (simpler approach)
                    const curveLength = data.curve.getLength();
                    const spacingProgress = data.wagonSpacing / curveLength;
                    let anyWagonVisible = false;
                    
                    data.wagons.forEach((wagon, index) => {
                        wagon.visible = false;
                        
                        if (data.isWaiting) {
                            return;
                        }
                        
                        const wagonProgress = Math.max(0, data.progress - (spacingProgress * index));
                        
                        // Wagons appear when wagonProgress > 0, disappear when wagonProgress > 1
                        // Mirror the appearance behavior: only show if wagonProgress is between 0 and 1
                        if (wagonProgress <= 0) {
                            return; // Wagon hasn't appeared yet
                        }
                        
                        if (wagonProgress > 1) {
                            return; // Wagon has disappeared (passed the end)
                        }
                        
                        let actualProgress = wagonProgress;
                        if (data.needsReverse) {
                            actualProgress = 1 - wagonProgress;
                        }
                        
                        actualProgress = Math.max(0, Math.min(1, actualProgress));
                        
                        try {
                            const wagonPosition = data.curve.getPointAt(actualProgress);
                            
                            if (!wagonPosition || isNaN(wagonPosition.x) || isNaN(wagonPosition.y) || isNaN(wagonPosition.z)) {
                                return;
                            }
                            
                            // Validate wagon position
                            if (!isMapView) {
                                const wagonDistance = wagonPosition.length();
                                if (wagonDistance < 0.5 || wagonDistance > 2.0) {
                                    return;
                                }
                            }
                            
                            let tangent = data.curve.getTangentAt(actualProgress).normalize();
                            
                            if (data.needsReverse) {
                                tangent.negate();
                            }
                            
                            const offsetDistance = isMapView ? 0.002 : 0.006;
                            const up = isMapView ? planeUp : wagonPosition.clone().normalize();
                            const elevatedPosition = wagonPosition.clone().add(up.clone().multiplyScalar(offsetDistance));
                            
                            const right = new THREE.Vector3().crossVectors(tangent, up.clone().normalize()).normalize();
                            const correctedUp = new THREE.Vector3().crossVectors(right, tangent).normalize();
                            
                            const rotationMatrix = new THREE.Matrix4();
                            rotationMatrix.makeBasis(right, correctedUp, tangent.negate());
                            
                            wagon.quaternion.setFromRotationMatrix(rotationMatrix);
                            // In map view, keep local offsets stable across seam-wrapping by subtracting the *raw* train position
                            wagon.position.copy(elevatedPosition).sub(isMapView ? rawTrainPos : train.position);
                            
                            wagon.visible = hyperloopVisible;
                            anyWagonVisible = hyperloopVisible;
                        } catch (error) {
                            wagon.visible = false;
                        }
                    });
                    
                    train.visible = anyWagonVisible ? hyperloopVisible : false;
                } catch (error) {
                    train.visible = false;
                    continue;
                }
            } else {
                train.visible = false;
            }
            
            // Clean up completed trains - wagons disappear one by one like they appear
            if (data.progress > 1) {
                // Check if all wagons have finished (disappeared)
                // Use same calculation as wagon positioning to ensure consistency
                if (!data.curve || typeof data.curve.getLength !== 'function') {
                    // Can't calculate, remove train
                    this.routeController.releaseRoute(data.from, data.to, data.trainId);
                    if (train.parent) train.parent.remove(train);
                    this.transportModel.removeTrain(train);
                    continue;
                }
                
                const curveLength = data.curve.getLength();
                const spacingProgress = data.wagonSpacing / curveLength;
                let allWagonsFinished = true;
                
                data.wagons.forEach((wagon, index) => {
                    const wagonProgress = data.progress - (spacingProgress * index);
                    // Wagon is finished if it has passed the end (wagonProgress > 1)
                    // Wagon is still visible if wagonProgress <= 1
                    if (wagonProgress <= 1) {
                        allWagonsFinished = false;
                    }
                });
                
                // Only remove train when ALL wagons have finished disappearing
                if (allWagonsFinished) {
                    this.routeController.releaseRoute(data.from, data.to, data.trainId);
                    if (train.parent) train.parent.remove(train);
                    this.transportModel.removeTrain(train);
                    continue;
                }
            }
        }
    }

    /**
     * Spawn trains randomly
     */
    spawnTrainsRandomly() {
        this.routeController.buildRouteGraph();
        
        const routeCurves = this.transportModel.getRouteCurves();
        const routeGraph = this.transportModel.getRouteGraph();
        
        console.log(`📊 Total routes: ${routeCurves.length}`);
        console.log(`📊 Cities in graph: ${Object.keys(routeGraph).length}`);
        
        const DEPARTURE_COOLDOWN_MS = 8000;
        const startInMap = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        if (routeCurves.length > 0 && this.sceneModel.getHyperloopVisible() && !startInMap) {
            // Initial spawn: respect reservations + departure cooldown
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
            
            // Limit number of trains (half the normal amount for mobile performance)
            const MAX_TRAINS = 15;
            const trains = this.transportModel.getTrains();
            if (trains.length >= MAX_TRAINS) return;
            
            if (routeCurves.length > 0) {
                const isMultiStop = Math.random() < 0.33;
                
                if (isMultiStop && Object.keys(routeGraph).length > 0) {
                    const numStops = Math.floor(Math.random() * 3) + 2;
                    const multiRoute = this.routeController.findMultiStopRoute(numStops);
                    
                    if (multiRoute && multiRoute.routes.length >= 2) {
                        const from0 = multiRoute.routes[0]?.from;
                        const to0 = multiRoute.routes[0]?.to;
                        if (!from0 || !to0) return;
                        // Prevent spam departures from same city and avoid duplicating the same starting segment.
                        if (!this.transportModel.canDepart('train', from0, DEPARTURE_COOLDOWN_MS)) return;
                        if (!this.transportModel.canDepartRoutePair(from0, to0, DEPARTURE_COOLDOWN_MS)) return;
                        if (!this.routeController.isRouteAvailable(from0, to0)) return;
                        this.transportModel.markDeparted('train', from0);
                        this.transportModel.markDepartedRoutePair(from0, to0);
                        this.createMultiStopTrain(multiRoute.routes);
                    } else {
                        // Fallback to single route with constraints
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
                } else {
                    let selectedRoute;
                    const rand = Math.random();
                    
                    if (rand < 0.30) {
                        const aatlisRoutes = routeCurves.filter(r => r.from === 'Aatlis' || r.to === 'Aatlis');
                        if (aatlisRoutes.length > 0) {
                            selectedRoute = aatlisRoutes[Math.floor(Math.random() * aatlisRoutes.length)];
                        }
                    } else if (rand < 0.45) {
                        const midtownRoutes = routeCurves.filter(r => r.from === 'Midtown' || r.to === 'Midtown');
                        if (midtownRoutes.length > 0) {
                            selectedRoute = midtownRoutes[Math.floor(Math.random() * midtownRoutes.length)];
                        }
                    }
                    
                    if (!selectedRoute) {
                        selectedRoute = routeCurves[Math.floor(Math.random() * routeCurves.length)];
                    }

                    // Enforce: no two trains depart the same origin within 8s, and no duplicate segment.
                    if (!selectedRoute?.from || !selectedRoute?.to) return;
                    if (!this.routeController.isRouteAvailable(selectedRoute.from, selectedRoute.to)) return;
                    if (!this.transportModel.canDepart('train', selectedRoute.from, DEPARTURE_COOLDOWN_MS)) return;
                    if (!this.transportModel.canDepartRoutePair(selectedRoute.from, selectedRoute.to, DEPARTURE_COOLDOWN_MS)) return;
                    this.transportModel.markDeparted('train', selectedRoute.from);
                    this.transportModel.markDepartedRoutePair(selectedRoute.from, selectedRoute.to);
                    this.createTrain(selectedRoute);
                }
            }
        }, 1000);
    }
    
    /**
     * Stop spawning trains
     */
    stopSpawning() {
        if (this.trainSpawnInterval) {
            clearInterval(this.trainSpawnInterval);
            this.trainSpawnInterval = null;
        }
    }
}
