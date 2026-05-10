/**
 * SatelliteManager - Manages satellite creation, updates, and initialization
 */

import { getTransportVehicleColors, getMarsShipEmissiveHex } from '../../utils/TransportPaletteColors.js';

/** ISS and Mars Ship — used for event placement when transport is on; visibility follows transport toggle. */
function isEventHostSatelliteType(type) {
    return type === 'ISS' || type === 'MarsShip';
}

/** Roll rate vs orbital `effectiveSpeed` (rad/frame) for ISS barrel rotation. */
const ISS_AXIS_SPIN_FACTOR = 22;

export class SatelliteManager {
    constructor(sceneModel, transportModel, transportView) {
        this.sceneModel = sceneModel;
        this.transportModel = transportModel;
        this.transportView = transportView;
        /** Cache ISS/Mars Ship speed flags — invalidates when event page or list length changes */
        this._satellitePageKey = null;
        this._satellitePageHasStation = false;
        this._satellitePageHasMarsShip = false;
        this._issLocalRollQuat = new THREE.Quaternion();
        this._issLocalRollAxis = new THREE.Vector3(0, 0, 1);
    }

    setMapViewEnabled(enabled) {
        const globe = this.sceneModel.getGlobe();
        const satellites = this.transportModel.getSatellites();
        const isMapView = !!enabled;

        satellites.forEach(satellite => {
            if (!satellite?.userData?.isSatellite) return;
            const data = satellite.userData;

            const orbitTube = satellite.userData.orbitLine;
            if (orbitTube) orbitTube.visible = false;

            if (satellite.userData.mapOrbitLines) {
                satellite.userData.mapOrbitLines.forEach(line => {
                    if (line?.parent) line.parent.remove(line);
                });
                satellite.userData.mapOrbitLines = [];
            }

            if (globe && typeof globe.attach === 'function' && satellite.parent !== globe) {
                globe.attach(satellite);
            }

            satellite.scale.setScalar(1);

            const transportOn = this.sceneModel.getHyperloopVisible();
            data.hideInMap = isMapView && data.type === 'small';
            satellite.visible = transportOn && !(isMapView && data.hideInMap);
        });
    }
    
    /**
     * Create a satellite
     * @param {Object} config - Satellite configuration {type, orbitRadius, orbitSpeed, inclination, startAngle, rotationAngle, name}
     * @returns {Object} Satellite object
     */
    createSatellite(config) {
        const globe = this.sceneModel.getGlobe();
        const { type = 'small', orbitRadius = 1.15, orbitSpeed = 0.001, inclination = 0, startAngle = 0, rotationAngle = 0, name = 'Satellite' } = config;
        
        // Create satellite model using GLTF
        const satelliteGroup = new THREE.Group();
        const gltfLoader = this.sceneModel.getGLTFLoader();

        // SpaceShip.glb is oriented "backwards" relative to our path-facing basis.
        // Apply a one-time 180° Y rotation to the model root.
        const applyMarsShipFacingFix = (obj) => {
            if (!obj) return;
            if (!obj.userData) obj.userData = {};
            if (obj.userData._marsShipFacingFixed) return;
            obj.rotation.y += Math.PI;
            obj.userData._marsShipFacingFixed = true;
        };
        
        const vehicleColors = getTransportVehicleColors();
        const color = vehicleColors.color;
        const satEmissive = type === 'MarsShip' ? getMarsShipEmissiveHex() : vehicleColors.emissive;
        const shouldAlignWithPath = type === 'ISS' || type === 'MarsShip';
        
        const applySatelliteMaterial = (model) => {
            model.traverse((child) => {
                if (child.isMesh) {
                    child.material = new THREE.MeshPhongMaterial({
                        color: color,
                        emissive: satEmissive,
                        emissiveIntensity: 0.3,
                        transparent: true,
                        opacity: 0.9,
                        shininess: 30
                    });
                    child.visible = true;
                    if (child.geometry) {
                        child.geometry.computeBoundingBox();
                        child.geometry.computeBoundingSphere();
                    }
                }
            });
        };
        
        // For ISS, use Station.glb; for MarsShip use SpaceShip.glb; for others, use Satellite.glb
        if (type === 'ISS') {
            // Use Station model for ISS
            const stationModelCache = this.transportModel.getStationModelCache();
            
            if (stationModelCache && gltfLoader) {
                // Use cached Station model
                const stationModel = stationModelCache.clone();
                stationModel.scale.set(0.02, 0.02, 0.02);
                stationModel.visible = true;
                applySatelliteMaterial(stationModel);
                satelliteGroup.add(stationModel);
            } else if (gltfLoader) {
                // Load Station model for first time
                gltfLoader.load('src/assets/models/Station.glb', (gltf) => {
                    const model = gltf.scene;
                    const cached = model.clone();
                    this.transportModel.setStationModelCache(cached);
                    
                    model.scale.set(0.02, 0.02, 0.02);
                    model.visible = true;
                    applySatelliteMaterial(model);
                    satelliteGroup.add(model);
                }, undefined, (error) => {
                    console.error('Error loading Station.glb:', error);
                    // Fallback to simple box
                    const size = 0.015;
                    const geometry = new THREE.BoxGeometry(size, size, size * 1.5);
                    const material = new THREE.MeshPhongMaterial({
                        color: color,
                        emissive: satEmissive,
                        emissiveIntensity: 0.3,
                        transparent: true,
                        opacity: 0.9
                    });
                    const satelliteMesh = new THREE.Mesh(geometry, material);
                    satelliteGroup.add(satelliteMesh);
                });
            } else {
                // Fallback to simple box if no loader
                const size = 0.015;
                const geometry = new THREE.BoxGeometry(size, size, size * 1.5);
                const material = new THREE.MeshPhongMaterial({
                    color: color,
                    emissive: satEmissive,
                    emissiveIntensity: 0.3,
                    transparent: true,
                    opacity: 0.9
                });
                const satelliteMesh = new THREE.Mesh(geometry, material);
                satelliteGroup.add(satelliteMesh);
            }
        } else {
            const isMarsShip = type === 'MarsShip';
            const cache = isMarsShip
                ? (this.transportModel.getSpaceShipModelCache ? this.transportModel.getSpaceShipModelCache() : null)
                : (this.transportModel.getSatelliteModelCache ? this.transportModel.getSatelliteModelCache() : null);
            const baseScale = 0.02;
            const modelScale = isMarsShip ? (baseScale * 0.8) : baseScale;

            if (cache && gltfLoader) {
                // Use cached model
                const m = cache.clone();
                m.scale.set(modelScale, modelScale, modelScale);
                m.visible = true;
                if (isMarsShip) applyMarsShipFacingFix(m);
                applySatelliteMaterial(m);

                // Random rotation for small satellites (not ISS or Mars Ship)
                if (!shouldAlignWithPath) {
                    m.rotation.x = Math.random() * Math.PI * 2;
                    m.rotation.y = Math.random() * Math.PI * 2;
                    m.rotation.z = Math.random() * Math.PI * 2;
                }

                satelliteGroup.add(m);
            } else if (gltfLoader) {
                // Load model for first time
                const path = isMarsShip ? 'src/assets/models/SpaceShip.glb' : 'src/assets/models/Satellite.glb';
                gltfLoader.load(path, (gltf) => {
                    const model = gltf.scene;
                    if (isMarsShip) applyMarsShipFacingFix(model);
                    const cached = model.clone();
                    if (isMarsShip) applyMarsShipFacingFix(cached);
                    if (isMarsShip) {
                        if (this.transportModel.setSpaceShipModelCache) this.transportModel.setSpaceShipModelCache(cached);
                    } else {
                        if (this.transportModel.setSatelliteModelCache) this.transportModel.setSatelliteModelCache(cached);
                    }

                    model.scale.set(modelScale, modelScale, modelScale);
                    model.visible = true;
                    applySatelliteMaterial(model);

                    // Random rotation for small satellites (not ISS or Mars Ship)
                    if (!shouldAlignWithPath) {
                        model.rotation.x = Math.random() * Math.PI * 2;
                        model.rotation.y = Math.random() * Math.PI * 2;
                        model.rotation.z = Math.random() * Math.PI * 2;
                    }

                    satelliteGroup.add(model);
                }, undefined, (error) => {
                    console.error(`Error loading ${isMarsShip ? 'SpaceShip.glb' : 'Satellite.glb'}:`, error);
                    // Fallback to simple box
                    const size = type === 'MarsShip' ? (0.010 * 0.8) : 0.006;
                    const geometry = new THREE.BoxGeometry(size, size, size * 1.5);
                    const material = new THREE.MeshPhongMaterial({
                        color: color,
                        emissive: satEmissive,
                        emissiveIntensity: 0.3,
                        transparent: true,
                        opacity: 0.9
                    });
                    const satelliteMesh = new THREE.Mesh(geometry, material);
                    satelliteGroup.add(satelliteMesh);
                });
            } else {
                // Fallback to simple box if no loader
                const size = type === 'MarsShip' ? (0.010 * 0.8) : 0.006;
                const geometry = new THREE.BoxGeometry(size, size, size * 1.5);
                const material = new THREE.MeshPhongMaterial({
                    color: color,
                    emissive: satEmissive,
                    emissiveIntensity: 0.3,
                    transparent: true,
                    opacity: 0.9
                });
                const satelliteMesh = new THREE.Mesh(geometry, material);
                satelliteGroup.add(satelliteMesh);
            }
        }
        
        // Validate orbit to ensure it doesn't go through Earth
        // Minimum safe radius considering inclination
        const minSafeRadius = 1.01 + Math.abs(Math.sin(inclination)) * 0.02;
        const safeOrbitRadius = Math.max(orbitRadius, minSafeRadius);
        
        // Create orbit line (purple or green) with rotation angle and inclination
        // Perfect circle in 3D space, tilted by inclination - maintain constant radius
        const orbitPoints = [];
        const segments = 100;
        
        // Normal vector for the orbit plane (tilted by inclination, rotated by rotationAngle)
        const normalX = Math.sin(inclination) * Math.sin(rotationAngle);
        const normalY = Math.sin(inclination) * Math.cos(rotationAngle);
        const normalZ = Math.cos(inclination);
        const normal = new THREE.Vector3(normalX, normalY, normalZ).normalize();
        
        // Create two perpendicular vectors in the orbit plane
        const up = new THREE.Vector3(0, 0, 1);
        const right = new THREE.Vector3().crossVectors(normal, up).normalize();
        if (right.length() < 0.1) {
            // If normal is parallel to up, use different reference
            const forward = new THREE.Vector3(1, 0, 0);
            right.crossVectors(normal, forward).normalize();
        }
        const forward = new THREE.Vector3().crossVectors(right, normal).normalize();
        
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            // Create perfect circle in the orbit plane
            const point = new THREE.Vector3()
                .addScaledVector(right, safeOrbitRadius * Math.cos(angle))
                .addScaledVector(forward, safeOrbitRadius * Math.sin(angle));
            
            orbitPoints.push(point);
        }
        
        const orbitCurve = new THREE.CatmullRomCurve3(orbitPoints);
        const orbitGeometry = new THREE.TubeGeometry(orbitCurve, segments, 0.001, 8, false);
        const usesPaletteOrbit = type === 'ISS' || type === 'MarsShip';
        const orbitColor = usesPaletteOrbit ? vehicleColors.color : 0x9b59b6;
        const orbitMaterial = new THREE.MeshBasicMaterial({
            color: orbitColor,
            transparent: true,
            opacity: 0.6
        });
        const orbitLine = new THREE.Mesh(orbitGeometry, orbitMaterial);
        orbitLine.userData.isSatelliteOrbit = true;
        orbitLine.userData.orbitUsesTransportPalette = usesPaletteOrbit;
        orbitLine.userData.orbitColor = orbitColor; // Track current color
        orbitLine.userData.satelliteName = name; // Store satellite name for filtering
        // Hide orbit line (was visible for alignment, now hidden)
        orbitLine.visible = false;
        if (globe) globe.add(orbitLine);
        this.transportModel.addSatelliteOrbitLine(orbitLine);
        
        satelliteGroup.userData = {
            type: type,
            name: name,
            orbitRadius: safeOrbitRadius, // Use safe radius
            orbitSpeed: orbitSpeed, // Constant speed per satellite instance
            inclination: inclination,
            rotationAngle: rotationAngle, // Rotation of orbit plane
            angle: startAngle,
            isSatellite: true,
            lastTrailSpawn: 0,
            trailSpawnInterval: Math.floor(Math.random() * 7) + 3, // Random initial interval (3-10 frames)
            orbitLine: orbitLine // Reference to orbit line for color changes
        };
        
        // Set initial position with rotation angle and inclination (perfect circle in 3D)
        // Reuse the same orbit plane vectors (normal, right, forward) calculated above
        const initialPosition = new THREE.Vector3()
            .addScaledVector(right, safeOrbitRadius * Math.cos(startAngle))
            .addScaledVector(forward, safeOrbitRadius * Math.sin(startAngle));
        
        satelliteGroup.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
        
        satelliteGroup.visible = this.sceneModel.getHyperloopVisible();
        if (globe) globe.add(satelliteGroup);
        this.transportModel.addSatellite(satelliteGroup);
        
        return satelliteGroup;
    }

    /**
     * Update satellites - handle orbital motion with speed variation and rotation angle changes
     */
    updateSatellites() {
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        const satellites = this.transportModel.getSatellites();
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        if (isMapView) return;

        const globe = this.sceneModel.getGlobe();

        // Check if any station / marsShip markers are on the current page
        let hasStationMarkerOnPage = false;
        let isHoveringStationMarker = false;
        let hasMarsShipMarkerOnPage = false;
        let isHoveringMarsShipMarker = false;
        
        if (window.globeController && window.globeController.dataModel) {
            const dataModel = window.globeController.dataModel;
            const pageNum = typeof dataModel.getCurrentEventPage === 'function'
                ? dataModel.getCurrentEventPage()
                : dataModel.currentEventPage;
            const pageKey = `${pageNum}\0${dataModel.eventsPerPage}\0${dataModel.events.length}`;
            if (pageKey !== this._satellitePageKey) {
                this._satellitePageKey = pageKey;
                const currentPageEvents = dataModel.getEventsForCurrentPage();
                this._satellitePageHasStation = currentPageEvents.some(event => {
                    const eventLocationType = event.locationType || 'earth';
                    if (eventLocationType === 'station') return true;
                    if (event.variants) {
                        return event.variants.some(variant => (variant.locationType || eventLocationType) === 'station');
                    }
                    return false;
                });
                this._satellitePageHasMarsShip = currentPageEvents.some(event => {
                    const eventLocationType = event.locationType || 'earth';
                    if (eventLocationType === 'marsShip') return true;
                    if (event.variants) {
                        return event.variants.some(variant => (variant.locationType || eventLocationType) === 'marsShip');
                    }
                    return false;
                });
            }
            hasStationMarkerOnPage = this._satellitePageHasStation;
            hasMarsShipMarkerOnPage = this._satellitePageHasMarsShip;
        }
        
        // Check if hovering over a station marker
        if (window.globeController && window.globeController.interactionController) {
            const hoveredMarker = window.globeController.interactionController.hoveredEventMarker;
            if (hoveredMarker && hoveredMarker.userData && hoveredMarker.userData.locationType === 'station') {
                isHoveringStationMarker = true;
            }
            if (hoveredMarker && hoveredMarker.userData && hoveredMarker.userData.locationType === 'marsShip') {
                isHoveringMarsShipMarker = true;
            }
        }
        
        // Calculate speed multipliers: halve if on page, halve again if hovering (total 1/4)
        let stationSpeedMultiplier = 1.0;
        if (hasStationMarkerOnPage) {
            stationSpeedMultiplier = 0.5; // Halve when station marker is on current page
        }
        if (isHoveringStationMarker) {
            stationSpeedMultiplier *= 0.5; // Halve again when hovering (total 1/4)
        }

        let marsShipSpeedMultiplier = 1.0;
        if (hasMarsShipMarkerOnPage) {
            marsShipSpeedMultiplier = 0.5;
        }
        if (isHoveringMarsShipMarker) {
            marsShipSpeedMultiplier *= 0.5;
        }
        
        satellites.forEach(satellite => {
            const data = satellite.userData;
            if (!data?.isSatellite) return;

            if (data.type === 'small' && !hyperloopVisible) {
                return;
            }

            // Apply speed multiplier (ISS for station events, MarsShip for marsShip events)
            const effectiveSpeed =
                data.type === 'ISS' ? data.orbitSpeed * stationSpeedMultiplier
                : data.type === 'MarsShip' ? data.orbitSpeed * marsShipSpeedMultiplier
                : data.orbitSpeed;
            
            // Update orbital angle (constant speed per satellite instance)
            data.angle += effectiveSpeed;
            
            // Wrap angle
            if (data.angle > Math.PI * 2) {
                data.angle -= Math.PI * 2;
            }
            
            // Calculate new position with rotation angle and inclination (perfect circle in 3D)
            // Use same orbit plane calculation as orbit line
            const normalX = Math.sin(data.inclination) * Math.sin(data.rotationAngle);
            const normalY = Math.sin(data.inclination) * Math.cos(data.rotationAngle);
            const normalZ = Math.cos(data.inclination);
            const normal = new THREE.Vector3(normalX, normalY, normalZ).normalize();
            
            const up = new THREE.Vector3(0, 0, 1);
            const right = new THREE.Vector3().crossVectors(normal, up).normalize();
            if (right.length() < 0.1) {
                const forward = new THREE.Vector3(1, 0, 0);
                right.crossVectors(normal, forward).normalize();
            }
            const forward = new THREE.Vector3().crossVectors(right, normal).normalize();
            
            const position3d = new THREE.Vector3()
                .addScaledVector(right, data.orbitRadius * Math.cos(data.angle))
                .addScaledVector(forward, data.orbitRadius * Math.sin(data.angle));

            if (globe && satellite.parent !== globe && globe.attach) globe.attach(satellite);
            satellite.position.set(position3d.x, position3d.y, position3d.z);
            
            // Only align ISS and Mars Ship with their path (like planes/trains/boats)
            // Small satellites keep their random rotation
            if (data.type === 'ISS' || data.type === 'MarsShip') {
                // Rotate satellite to face direction of travel
                const nextAngle = data.angle + effectiveSpeed;
                
                const nextPosition3d = new THREE.Vector3()
                    .addScaledVector(right, data.orbitRadius * Math.cos(nextAngle))
                    .addScaledVector(forward, data.orbitRadius * Math.sin(nextAngle));

                const direction = new THREE.Vector3().subVectors(nextPosition3d, position3d).normalize();
                const up3 = satellite.position.clone().normalize();
                const rightDir = new THREE.Vector3().crossVectors(direction, up3).normalize();
                const correctedUp = new THREE.Vector3().crossVectors(rightDir, direction).normalize();

                const rotationMatrix = new THREE.Matrix4();
                rotationMatrix.makeBasis(rightDir, correctedUp, direction.negate());
                satellite.quaternion.setFromRotationMatrix(rotationMatrix);
                if (data.type === 'ISS') {
                    if (typeof data.stationAxisSpin !== 'number') {
                        data.stationAxisSpin = Math.random() * Math.PI * 2;
                    }
                    data.stationAxisSpin += effectiveSpeed * ISS_AXIS_SPIN_FACTOR;
                    this._issLocalRollQuat.setFromAxisAngle(this._issLocalRollAxis, data.stationAxisSpin);
                    satellite.quaternion.multiply(this._issLocalRollQuat);
                }
            }
            // Small satellites keep their random rotation (no alignment with path)
            
            // Trail dots only for decor satellites while transport is on
            if (data.type === 'small' && hyperloopVisible) {
                data.lastTrailSpawn++;
                if (data.lastTrailSpawn >= data.trailSpawnInterval) {
                    const chance = 0.25;
                    if (Math.random() < chance) {
                        this.transportView.createSatelliteTrailDot(satellite.position);
                    }
                    data.lastTrailSpawn = 0;
                    data.trailSpawnInterval = Math.floor(Math.random() * 7) + 3;
                }
            }
            
            satellite.visible = hyperloopVisible;
        });
    }

    /**
     * Remove purple placeholder markers tracked in SceneModel that belong to a satellite group.
     * @param {THREE.Object3D} satellite
     */
    _removeSatelliteMarkersForSatellite(satellite) {
        const markers = this.sceneModel.getMarkers();
        for (let i = markers.length - 1; i >= 0; i--) {
            const m = markers[i];
            if (m.userData?.isSatelliteMarker && m.userData?.parentSatellite === satellite) {
                if (m.parent) m.parent.remove(m);
                if (m.geometry) m.geometry.dispose();
                if (m.material) m.material.dispose();
                markers.splice(i, 1);
            }
        }
    }

    _disposeDecorSatellite(satellite) {
        const data = satellite.userData;
        if (!data) return;

        this._removeSatelliteMarkersForSatellite(satellite);

        if (data.mapOrbitLines && Array.isArray(data.mapOrbitLines)) {
            data.mapOrbitLines.forEach(line => {
                if (line?.parent) line.parent.remove(line);
                if (line?.geometry) line.geometry.dispose();
                if (line?.material) line.material.dispose();
            });
            data.mapOrbitLines = [];
        }

        const orbitLine = data.orbitLine;
        if (orbitLine) {
            if (orbitLine.parent) orbitLine.parent.remove(orbitLine);
            if (orbitLine.geometry) orbitLine.geometry.dispose();
            if (orbitLine.material) orbitLine.material.dispose();
            this.transportModel.removeSatelliteOrbitLine(orbitLine);
            data.orbitLine = null;
        }

        if (satellite.parent) satellite.parent.remove(satellite);
        satellite.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => mat?.dispose?.());
            }
        });
        this.transportModel.removeSatellite(satellite);
    }

    /**
     * Dispose all background "small" satellites. ISS / Mars Ship remain.
     */
    disposeDecorSatellites() {
        const satellites = this.transportModel.getSatellites();
        for (let i = satellites.length - 1; i >= 0; i--) {
            const sat = satellites[i];
            if (sat?.userData?.type === 'small') {
                this._disposeDecorSatellite(sat);
            }
        }
    }

    /**
     * Create the 25 decor satellites; used at init (when transport on) and when turning transport back on.
     * @returns {THREE.Group[]} Created roots (same as transport model order for new items).
     */
    initializeDecorSatellites() {
        const uniformOrbitRadius = 1.22;
        const created = [];
        for (let i = 1; i <= 25; i++) {
            const orbitSpeed = 0.0008 + Math.random() * 0.0015;
            const startAngle = Math.random() * Math.PI * 2;
            const rotationAngle = Math.random() * Math.PI * 2;
            const inclination = (Math.random() - 0.5) * Math.PI;

            const sat = this.createSatellite({
                type: 'small',
                orbitRadius: uniformOrbitRadius,
                orbitSpeed,
                inclination,
                startAngle,
                rotationAngle,
                name: `Satellite ${i}`
            });
            created.push(sat);
        }
        return created;
    }

    /**
     * Recreate decor satellites if transport is enabled and none are loaded (after unload).
     * @returns {THREE.Group[]} Newly created groups (empty if already present or transport off).
     */
    ensureDecorSatellitesLoaded() {
        if (!this.sceneModel.getHyperloopVisible()) {
            return [];
        }
        const sats = this.transportModel.getSatellites();
        const hasVenue = sats.some(s => isEventHostSatelliteType(s?.userData?.type));
        if (!hasVenue) {
            return [];
        }
        const hasSmall = sats.some(s => s?.userData?.type === 'small');
        if (hasSmall) {
            return [];
        }
        return this.initializeDecorSatellites();
    }

    /**
     * Initialize satellites
     */
    initializeSatellites() {
        if (this.sceneModel.getHyperloopVisible()) {
            this.initializeDecorSatellites();
        }

        // ISS (large) — always present (station events)
        const issOrbitRadius = 1.25; // ISS slightly further out
        this.createSatellite({
            type: 'ISS',
            orbitRadius: issOrbitRadius,
            orbitSpeed: 0.0008 + Math.random() * 0.0015, // Random constant speed
            inclination: Math.PI / 6, // 30 degree inclination
            startAngle: Math.random() * Math.PI * 2, // Random start position
            rotationAngle: Math.random() * Math.PI * 2, // Random orbit angle
            name: 'ISS'
        });
        
        // Mars Ship (medium) - uses SpaceShip.glb (blue)
        // Orbit configured to pass over Veracruz and Gibraltar
        const marsShipOrbitRadius = 1.28; // Mars Ship furthest out
        
        // Mars Ship orbit configured to pass over Veracruz and Gibraltar
        // Current working values set by user
        const marsInclination = Math.PI / 1.5; // User-adjusted value for correct orbit tilt
        
        // Calculate orbit to pass over Veracruz (19.1738°N, -96.1342°W) and Gibraltar (36.1408°N, -5.3536°W)
        const veracruzLat = 19.1738;
        const veracruzLon = -96.1342;
        const gibraltarLat = 36.1408;
        const gibraltarLon = -5.3536;
        
        // Rotation angle to align with the path between Veracruz and Gibraltar
        // Average longitude direction, with tilt on red axis (perpendicular to longitude)
        const avgLon = (veracruzLon + gibraltarLon) / 2;
        // Tilt on red axis - current working value
        const marsRotationAngle = (avgLon * Math.PI / 180) + 0.2; // Tilt on red axis
        
        // Start angle - begin at Veracruz's position along the orbit
        const marsStartAngle = veracruzLon * Math.PI / 180;
        
        this.createSatellite({
            type: 'MarsShip',
            orbitRadius: marsShipOrbitRadius,
            orbitSpeed: 0.0008 + Math.random() * 0.0015, // Random constant speed
            inclination: marsInclination, // 45 degree inclination to cross over Mexico and Gibraltar
            startAngle: marsStartAngle, // Start position
            rotationAngle: marsRotationAngle, // Rotation to align with path
            name: 'Mars Ship'
        });
    }

    /**
     * Find the ISS satellite
     * @returns {Object|null} ISS satellite object or null
     */
    findISS() {
        const satellites = this.transportModel.getSatellites();
        for (let satellite of satellites) {
            if (satellite.userData && satellite.userData.type === 'ISS') {
                return satellite;
            }
        }
        return null;
    }

    /**
     * Find the Mars Ship satellite
     * @returns {Object|null} Mars Ship satellite object or null
     */
    findMarsShip() {
        const satellites = this.transportModel.getSatellites();
        for (let satellite of satellites) {
            if (satellite?.userData?.type === 'MarsShip') {
                return satellite;
            }
        }
        return null;
    }
}
