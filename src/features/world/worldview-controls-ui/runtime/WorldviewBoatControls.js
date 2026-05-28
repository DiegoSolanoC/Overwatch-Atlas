/**
 * WorldviewBoatControls - Handles boat creation, updates, and spawning
 */
class WorldviewBoatControls {
    constructor(sceneModel, transportModel, routeController, transportView) {
        this.sceneModel = sceneModel;
        this.transportModel = transportModel;
        this.routeController = routeController;
        this.transportView = transportView;
        this.boatSpawnInterval = null;
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
     * Create a boat
     * @param {Object} routeData - Route data
     * @param {boolean} isMultiStop - Is multi-stop route
     * @returns {Object} Boat object
     */
    createBoat(routeData, isMultiStop = false) {
        const globe = this.sceneModel.getGlobe();
        const gltfLoader = this.sceneModel.getGLTFLoader();
        const curve = routeData.curve;
        const distance = this.calculateRouteDistance(curve);
        const speed = distance > 1.0 ? 0.004 : 0.005;
        
        const boatGroup = new THREE.Group();
        
        if (gltfLoader) {
            gltfLoader.load('src/assets/models/Boat.glb', 
                (gltf) => {
                    const model = gltf.scene;
                    model.scale.set(0.02, 0.02, 0.02);
                    model.visible = true;
                    
                    const boatColor = 0x0088cc;
                    const boatEmissive = 0x004488;
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.material = new THREE.MeshStandardMaterial({
                                color: boatColor,
                                emissive: boatColor,
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
                    
                    boatGroup.add(model);
                }, 
                undefined,
                (error) => {
                    console.warn('⚠️ Boat model not found, using fallback geometry');
                    const boatGeometry = new THREE.BoxGeometry(0.03, 0.01, 0.08);
                    const boatMaterial = new THREE.MeshStandardMaterial({
                        color: 0x0088cc,
                        emissive: 0x0088cc,
                        emissiveIntensity: 1.0,
                        transparent: true,
                        opacity: 0.85,
                        roughness: 0.5,
                        metalness: 0.5
                    });
                    const boatMesh = new THREE.Mesh(boatGeometry, boatMaterial);
                    boatMesh.rotation.x = Math.PI / 2;
                    boatGroup.add(boatMesh);
                }
            );
        } else {
            const boatGeometry = new THREE.BoxGeometry(0.03, 0.01, 0.08);
            const boatMaterial = new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 1.0,
                transparent: true,
                opacity: 0.85,
                roughness: 0.5,
                metalness: 0.5
            });
            const boatMesh = new THREE.Mesh(boatGeometry, boatMaterial);
            boatMesh.rotation.x = Math.PI / 2;
            boatGroup.add(boatMesh);
        }
        
        const routeDistance = this.calculateRouteDistance(curve);
        let trailSpawnInterval = 1;
        if (routeDistance < 0.3) {
            trailSpawnInterval = 0.5;
        } else if (routeDistance < 0.6) {
            trailSpawnInterval = 0.75;
        }
        
        boatGroup.userData = {
            curve: curve,
            progress: 0,
            speed: speed,
            from: routeData.from,
            to: routeData.to,
            isBoat: true,
            isMultiStop: isMultiStop,
            isNewlySpawned: true,
            boatId: Math.random().toString(36).substr(2, 9),
            lastTrailSpawn: 0,
            trailSpawnInterval: trailSpawnInterval,
            routeDistance: routeDistance
        };
        
        if (!isMultiStop) {
            this.routeController.reserveBoatRoute(routeData.from, routeData.to, boatGroup.userData.boatId);
        }
        
        boatGroup.visible = false;
        boatGroup.position.set(0, 0, 0);
        globe.add(boatGroup);
        this.transportModel.addBoat(boatGroup);
        
        return boatGroup;
    }

    /**
     * Create a multi-stop boat
     * @param {Array} routes - Array of route data
     * @returns {Object} Boat object
     */
    createMultiStopBoat(routes) {
        const firstRoute = routes[0];
        const boat = this.createBoat(firstRoute, true);
        
        boat.userData.isMultiStop = true;
        boat.userData.routes = routes;
        boat.userData.currentRouteIndex = 0;
        boat.userData.totalRoutes = routes.length;
        boat.userData.boatId = Math.random().toString(36).substr(2, 9);
        boat.userData.finalDestination = routes[routes.length - 1].to;
        boat.userData.previousPort = null;
        boat.userData.isWaiting = false;
        boat.userData.isTransitioning = false;
        
        this.routeController.reserveBoatRoute(firstRoute.from, firstRoute.to, boat.userData.boatId);
        
        return boat;
    }

    /**
     * Update boats - handles movement, multi-stop transitions, and trail spawning
     */
    updateBoats() {
        const globe = this.sceneModel.getGlobe();
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        const boats = this.transportModel.getBoats();
        
        for (let i = boats.length - 1; i >= 0; i--) {
            const boat = boats[i];
            const data = boat.userData;
            
            if (data.isNewlySpawned) {
                data.isNewlySpawned = false;
                continue;
            }
            
            if (!data.isWaiting) {
                data.progress += data.speed;
            }
            
            if (data.isMultiStop && data.progress >= 1.0 && !data.isTransitioning) {
                if (data.currentRouteIndex < data.routes.length - 1) {
                    const currentFrom = data.from;
                    const currentTo = data.to;
                    
                    this.routeController.releaseBoatRoute(currentFrom, currentTo, data.boatId);
                    
                    let nextRoute = data.routes[data.currentRouteIndex + 1];
                    let canDepart = false;
                    
                    if (!this.routeController.isBoatRouteAvailable(nextRoute.from, nextRoute.to)) {
                        if (!data.isWaiting) {
                            data.isWaiting = true;
                            data.progress = 1.0;
                        }
                        canDepart = false;
                    } else {
                        canDepart = true;
                    }
                    
                    if (canDepart) {
                        data.isTransitioning = true;
                        if (data.isWaiting) {
                            data.isWaiting = false;
                        }
                        
                        this.routeController.reserveBoatRoute(nextRoute.from, nextRoute.to, data.boatId);
                        data.currentRouteIndex++;
                        
                        data.curve = nextRoute.curve;
                        data.from = nextRoute.from;
                        data.to = nextRoute.to;
                        data.previousPort = currentFrom;
                        data.needsReverse = nextRoute.needsReverse;
                        data.progress = 0;
                        
                        const routeDistance = this.calculateRouteDistance(nextRoute.curve);
                        data.speed = routeDistance > 1.0 ? 0.004 : 0.005;
                    }
                } else {
                    this.routeController.releaseBoatRoute(data.from, data.to, data.boatId);
                    globe.remove(boat);
                    this.transportModel.removeBoat(boat);
                    continue;
                }
            } else if (!data.isMultiStop && data.progress >= 1.0) {
                if (data.boatId) {
                    this.routeController.releaseBoatRoute(data.from, data.to, data.boatId);
                }
                globe.remove(boat);
                this.transportModel.removeBoat(boat);
                continue;
            }
            
            if (data.isMultiStop && data.progress > 0.1 && data.progress < 0.9 && data.isTransitioning) {
                data.isTransitioning = false;
            }
            
            if (data.progress > 0 && data.progress <= 1) {
                const position = data.curve.getPointAt(data.progress);
                boat.position.copy(position);
                
                const tangent = data.curve.getTangentAt(data.progress).normalize();
                const up = position.clone().normalize();
                const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
                const correctedUp = new THREE.Vector3().crossVectors(right, tangent).normalize();
                
                const rotationMatrix = new THREE.Matrix4();
                rotationMatrix.makeBasis(right, correctedUp, tangent.negate());
                boat.quaternion.setFromRotationMatrix(rotationMatrix);
                
                if (!data.lastTrailSpawn) data.lastTrailSpawn = 0;
                if (!data.trailSpawnInterval) data.trailSpawnInterval = 1;
                
                data.lastTrailSpawn += 1;
                if (data.lastTrailSpawn >= data.trailSpawnInterval) {
                    const forward = tangent.clone().negate();
                    this.transportView.createBoatTrailSegment(position, forward, right, correctedUp);
                    data.lastTrailSpawn = 0;
                }
                
                boat.visible = hyperloopVisible;
            }
        }
    }

    /**
     * Spawn boats randomly
     */
    spawnBoatsRandomly() {
        this.routeController.buildBoatRouteGraph();
        
        const boatRouteCurves = this.transportModel.getBoatRouteCurves();
        const boatRouteGraph = this.transportModel.getBoatRouteGraph();
        
        this.boatSpawnInterval = setInterval(() => {
            const isPageVisible = this.sceneModel.getPageVisible();
            const hyperloopVisible = this.sceneModel.getHyperloopVisible();
            
            if (!isPageVisible || !hyperloopVisible) return;
            
            const MAX_BOATS = 15;
            const boats = this.transportModel.getBoats();
            if (boats.length >= MAX_BOATS) return;
            
            if (boatRouteCurves.length === 0) return;
            
            const randomRoute = boatRouteCurves[Math.floor(Math.random() * boatRouteCurves.length)];
            const isMultiStop = Math.random() < 0.75;
            
            if (isMultiStop && Object.keys(boatRouteGraph).length > 0) {
                const numStops = Math.floor(Math.random() * 5) + 2;
                const multiRoute = this.routeController.findMultiStopBoatRoute(numStops);
                
                if (multiRoute && multiRoute.routes.length >= 2) {
                    this.createMultiStopBoat(multiRoute.routes);
                } else {
                    this.createBoat(randomRoute);
                }
            } else {
                this.createBoat(randomRoute);
            }
        }, 800);
    }

    /**
     * Stop spawning boats
     */
    stopSpawning() {
        if (this.boatSpawnInterval) {
            clearInterval(this.boatSpawnInterval);
            this.boatSpawnInterval = null;
        }
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.WorldviewBoatControls = WorldviewBoatControls;
}
