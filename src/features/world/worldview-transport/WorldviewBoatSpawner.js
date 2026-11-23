/**
 * WorldviewBoatSpawner - Manages boat creation, updates, and spawning
 */

import { latLonToMapPlanePosition } from '../worldview-shared-assets/utils/WorldviewGeometry.js';
import { getTransportVehicleColors } from '../worldview-shared-assets/utils/TransportPaletteColors.js';
import { getGlobeQualitySnapshot, getTransportCaps } from '../worldview-shared-assets/constants/WorldviewQualitySettings.js';

const _boatUp = new THREE.Vector3();
const _boatRight = new THREE.Vector3();
const _boatCorrectedUp = new THREE.Vector3();
const _boatTangent = new THREE.Vector3();
const _boatForward = new THREE.Vector3();
const _boatRotMat = new THREE.Matrix4();
const _boatPos = new THREE.Vector3();
const _boatAway = new THREE.Vector3();
const _boatOtherTangent = new THREE.Vector3();
const _planeUpConst = new THREE.Vector3(0, 0, 1);

/** Surface separation — closer than aircraft; boats halt instead of veering. */
const BOAT_SEP = 0.038;

export class WorldviewBoatSpawner {
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
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const gltfLoader = this.sceneModel.getGLTFLoader();
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

        const curve = (isMapView && routeData?.fromLat != null && routeData?.fromLon != null && routeData?.toLat != null && routeData?.toLon != null)
            ? buildWrappedMapLineCurve(routeData.fromLat, routeData.fromLon, routeData.toLat, routeData.toLon)
            : routeData.curve;
        const distance = this.calculateRouteDistance(curve);
        const speed = distance > 1.0 ? 0.004 : 0.005;
        const modelScale = isMapView ? (0.02 / 2) : 0.02;
        const fallbackScale = isMapView ? (1 / 2) : 1;
        
        const boatGroup = new THREE.Group();
        const { color: boatColor, emissive: boatEmissive } = getTransportVehicleColors();
        
        if (gltfLoader) {
            gltfLoader.load('src/assets/models/Boat.glb', 
                (gltf) => {
                    const model = gltf.scene;
                    model.scale.set(modelScale, modelScale, modelScale);
                    model.visible = true;
                    
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.material = new THREE.MeshPhongMaterial({
                                color: boatColor,
                                emissive: boatEmissive,
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
                    
                    boatGroup.add(model);
                }, 
                undefined,
                (error) => {
                    console.warn('⚠️ Boat model not found, using fallback geometry');
                    const boatGeometry = new THREE.BoxGeometry(0.03 * fallbackScale, 0.01 * fallbackScale, 0.08 * fallbackScale);
                    const boatMaterial = new THREE.MeshPhongMaterial({
                        color: boatColor,
                        emissive: boatEmissive,
                        emissiveIntensity: 0.3,
                        transparent: true,
                        opacity: 0.85
                    });
                    const boatMesh = new THREE.Mesh(boatGeometry, boatMaterial);
                    boatMesh.rotation.x = Math.PI / 2;
                    boatGroup.add(boatMesh);
                }
            );
        } else {
            const boatGeometry = new THREE.BoxGeometry(0.03 * fallbackScale, 0.01 * fallbackScale, 0.08 * fallbackScale);
            const boatMaterial = new THREE.MeshPhongMaterial({
                color: boatColor,
                emissive: boatEmissive,
                emissiveIntensity: 0.3,
                transparent: true,
                opacity: 0.85
            });
            const boatMesh = new THREE.Mesh(boatGeometry, boatMaterial);
            boatMesh.rotation.x = Math.PI / 2;
            boatGroup.add(boatMesh);
        }
        
        // Adjust trail spawn interval based on route distance for shorter trips
        const routeDistance = this.calculateRouteDistance(curve);
        let trailSpawnInterval = 1;
        if (routeDistance < 0.3) {
            trailSpawnInterval = 0.5; // More frequent for very short trips
        } else if (routeDistance < 0.6) {
            trailSpawnInterval = 0.75; // Slightly more frequent for short trips
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
            isWaiting: false,
            isCongestionWaiting: false,
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
        const parent = globe;
        if (parent) parent.add(boatGroup);
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
        
        const journey = routes.map(r => `${r.from}->${r.to}`).join(' | ');
        
        return boat;
    }

    /**
     * Water traffic control: halt if another boat is too close ahead or head-on.
     * Rear / lower-priority boats wait so congested sea lanes take turns.
     * @param {THREE.Object3D} boat
     * @param {THREE.Object3D[]} boats
     * @returns {boolean}
     */
    _boatShouldYield(boat, boats) {
        const data = boat.userData;
        if (!data?.curve || data.progress <= 0.03 || data.progress >= 0.97) return false;

        let tangent;
        try {
            tangent = data.curve.getTangentAt(data.progress, _boatTangent).normalize();
        } catch (_) {
            return false;
        }

        const pos = boat.position;
        for (let j = 0; j < boats.length; j++) {
            const other = boats[j];
            if (!other || other === boat) continue;
            const od = other.userData;
            if (!od?.isBoat || od.isNewlySpawned) continue;
            if (od.progress <= 0 || od.progress > 1) continue;

            _boatAway.subVectors(other.position, pos);
            const dist = _boatAway.length();
            if (dist >= BOAT_SEP || dist < 1e-8) continue;

            const ahead = _boatAway.dot(tangent) > 0.05;
            let otherTangentOk = false;
            let opposing = false;
            if (od.curve && od.progress > 0 && od.progress <= 1) {
                try {
                    od.curve.getTangentAt(od.progress, _boatOtherTangent).normalize();
                    otherTangentOk = true;
                    opposing = tangent.dot(_boatOtherTangent) < -0.25;
                } catch (_) { /* ignore */ }
            }

            // Boat ahead on a converging path — we stop and let them clear
            if (ahead) return true;

            // Head-on meeting: stable yield by boatId so one always proceeds
            if (opposing && otherTangentOk) {
                if ((data.boatId || '') > (od.boatId || '')) return true;
            } else if (!ahead && dist < BOAT_SEP * 0.7) {
                // Side-by-side stack on crossing routes — lower priority waits
                if ((data.boatId || '') > (od.boatId || '')) return true;
            }
        }
        return false;
    }

    /**
     * Update boats - handles movement, multi-stop transitions, and trail spawning
     */
    updateBoats() {
        if (!this.sceneModel.getHyperloopVisible()) return;

        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        if (isMapView) return;

        const globe = this.sceneModel.getGlobe();
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        const boats = this.transportModel.getBoats();
        const planeUp = _planeUpConst;
        const trailInterval = getGlobeQualitySnapshot().boatTrailInterval || 3;
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
            return new THREE.LineCurve3(
                new THREE.Vector3(a.x, a.y, mapZ),
                new THREE.Vector3(bx, b.y, mapZ)
            );
        };
        
        for (let i = boats.length - 1; i >= 0; i--) {
            const boat = boats[i];
            const data = boat.userData;
            
            if (data.isNewlySpawned) {
                data.isNewlySpawned = false;
                continue;
            }

            // Halt for traffic ahead / head-on; route-reservation waits use isWaiting
            data.isCongestionWaiting = this._boatShouldYield(boat, boats);
            
            if (!data.isWaiting && !data.isCongestionWaiting) {
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
                        
                        data.curve = isMapView ? buildMapCurveForRoute(nextRoute) : nextRoute.curve;
                        data.from = nextRoute.from;
                        data.to = nextRoute.to;
                        data.previousPort = currentFrom;
                        data.needsReverse = nextRoute.needsReverse;
                        data.progress = 0;
                        
                        const routeDistance = this.calculateRouteDistance(data.curve);
                        data.speed = routeDistance > 1.0 ? 0.004 : 0.005;
                    }
                } else {
                    this.routeController.releaseBoatRoute(data.from, data.to, data.boatId);
                    this.transportView?.disposeBoatWake?.(boat);
                    if (boat.parent) boat.parent.remove(boat);
                    this.transportModel.removeBoat(boat);
                    continue;
                }
            } else if (!data.isMultiStop && data.progress >= 1.0) {
                if (data.boatId) {
                    this.routeController.releaseBoatRoute(data.from, data.to, data.boatId);
                }
                this.transportView?.disposeBoatWake?.(boat);
                if (boat.parent) boat.parent.remove(boat);
                this.transportModel.removeBoat(boat);
                continue;
            }
            
            if (data.isMultiStop && data.progress > 0.1 && data.progress < 0.9 && data.isTransitioning) {
                data.isTransitioning = false;
            }
            
            if (data.progress > 0 && data.progress <= 1) {
                const rawPos = data.curve.getPointAt(data.progress);
                const position = isMapView
                    ? _boatPos.set(wrapX(rawPos.x), rawPos.y, rawPos.z)
                    : rawPos;
                boat.position.copy(position);
                
                data.curve.getTangentAt(data.progress, _boatTangent).normalize();
                if (isMapView) _boatUp.copy(planeUp);
                else _boatUp.copy(position).normalize();
                _boatRight.crossVectors(_boatTangent, _boatUp).normalize();
                _boatCorrectedUp.crossVectors(_boatRight, _boatTangent).normalize();
                /* Travel = along path; aft = behind the hull. Wake samples at the bow tip. */
                _boatForward.copy(_boatTangent);
                const bowGap = this.transportView?._wakeBowGap ?? 0.018;
                _boatPos.copy(position).addScaledVector(_boatForward, bowGap);
                _boatForward.negate(); /* aft for Kelvin opening behind the bow */
                
                if (!data.lastTrailSpawn) data.lastTrailSpawn = 0;
                if (!data.trailSpawnInterval) data.trailSpawnInterval = trailInterval;

                // No wake while halted — avoids stacking foam in congested spots
                if (!data.isWaiting && !data.isCongestionWaiting) {
                    data.lastTrailSpawn += 1;
                    if (data.lastTrailSpawn >= data.trailSpawnInterval) {
                        this.transportView.createBoatTrailSegment(boat, _boatPos, _boatForward, _boatRight);
                        data.lastTrailSpawn = 0;
                        data.trailSpawnInterval = trailInterval;
                    }
                }

                _boatRotMat.makeBasis(_boatRight, _boatCorrectedUp, _boatTangent.negate());
                boat.quaternion.setFromRotationMatrix(_boatRotMat);
                
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
        
        console.log(`📊 Total boat routes: ${boatRouteCurves.length}`);
        console.log(`📊 Ports in graph: ${Object.keys(boatRouteGraph).length}`);
        
        const DEPARTURE_COOLDOWN_MS = 8000;
        this.boatSpawnInterval = setInterval(() => {
            const isPageVisible = this.sceneModel.getPageVisible();
            const hyperloopVisible = this.sceneModel.getHyperloopVisible();
            const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
            
            if (!isPageVisible || !hyperloopVisible || isMapView) return;
            
            const MAX_BOATS = getTransportCaps().maxBoats;
            const boats = this.transportModel.getBoats();
            if (boats.length >= MAX_BOATS) return;
            
            if (boatRouteCurves.length === 0) return;
            
            const randomRoute = boatRouteCurves[Math.floor(Math.random() * boatRouteCurves.length)];
            const isMultiStop = Math.random() < 0.75;
            
            if (isMultiStop && Object.keys(boatRouteGraph).length > 0) {
                const numStops = Math.floor(Math.random() * 5) + 2;
                const multiRoute = this.routeController.findMultiStopBoatRoute(numStops);
                
                if (multiRoute && multiRoute.routes.length >= 2) {
                    const from0 = multiRoute.routes[0]?.from;
                    const to0 = multiRoute.routes[0]?.to;
                    if (!from0 || !to0) return;
                    if (!this.transportModel.canDepart('boat', from0, DEPARTURE_COOLDOWN_MS)) return;
                    if (!this.transportModel.canDepartRoutePair(from0, to0, DEPARTURE_COOLDOWN_MS)) return;
                    if (!this.routeController.isBoatRouteAvailable(from0, to0)) return;
                    this.transportModel.markDeparted('boat', from0);
                    this.transportModel.markDepartedRoutePair(from0, to0);
                    this.createMultiStopBoat(multiRoute.routes);
                } else {
                    // Fallback: single route with constraints
                    if (!randomRoute?.from || !randomRoute?.to) return;
                    if (!this.transportModel.canDepart('boat', randomRoute.from, DEPARTURE_COOLDOWN_MS)) return;
                    if (!this.transportModel.canDepartRoutePair(randomRoute.from, randomRoute.to, DEPARTURE_COOLDOWN_MS)) return;
                    if (!this.routeController.isBoatRouteAvailable(randomRoute.from, randomRoute.to)) return;
                    this.transportModel.markDeparted('boat', randomRoute.from);
                    this.transportModel.markDepartedRoutePair(randomRoute.from, randomRoute.to);
                    this.createBoat(randomRoute);
                }
            } else {
                if (!randomRoute?.from || !randomRoute?.to) return;
                if (!this.transportModel.canDepart('boat', randomRoute.from, DEPARTURE_COOLDOWN_MS)) return;
                if (!this.transportModel.canDepartRoutePair(randomRoute.from, randomRoute.to, DEPARTURE_COOLDOWN_MS)) return;
                if (!this.routeController.isBoatRouteAvailable(randomRoute.from, randomRoute.to)) return;
                this.transportModel.markDeparted('boat', randomRoute.from);
                this.transportModel.markDepartedRoutePair(randomRoute.from, randomRoute.to);
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
