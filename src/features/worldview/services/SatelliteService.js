/**
 * SatelliteService - Handles satellite creation, updates, and initialization
 */
class SatelliteService {
    constructor(sceneModel, transportModel, transportView) {
        this.sceneModel = sceneModel;
        this.transportModel = transportModel;
        this.transportView = transportView;
    }

    /**
     * Create a satellite
     * @param {Object} config - Satellite configuration {type, orbitRadius, orbitSpeed, inclination, startAngle, rotationAngle, name}
     * @returns {Object} Satellite object
     */
    createSatellite(config) {
        const globe = this.sceneModel.getGlobe();
        const { type = 'small', orbitRadius = 1.15, orbitSpeed = 0.001, inclination = 0, startAngle = 0, rotationAngle = 0, name = 'Satellite' } = config;
        
        const satelliteGroup = new THREE.Group();
        const gltfLoader = this.sceneModel.getGLTFLoader();
        
        let color;
        let shouldAlignWithPath = false;
        
        if (type === 'ISS') {
            color = 0x0088cc;
            shouldAlignWithPath = true;
        } else if (type === 'MarsShip') {
            color = 0xff0000;
            shouldAlignWithPath = true;
        } else {
            color = 0x0088cc;
            shouldAlignWithPath = false;
        }
        
        const applySatelliteMaterial = (model) => {
            model.traverse((child) => {
                if (child.isMesh) {
                    child.material = new THREE.MeshStandardMaterial({
                        color: color,
                        emissive: color,
                        emissiveIntensity: 1.0,
                        transparent: true,
                        opacity: 0.9,
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
        };
        
        if (type === 'ISS') {
            const stationModelCache = this.transportModel.getStationModelCache();
            
            if (stationModelCache && gltfLoader) {
                const stationModel = stationModelCache.clone();
                stationModel.scale.set(0.02, 0.02, 0.02);
                stationModel.visible = true;
                applySatelliteMaterial(stationModel);
                satelliteGroup.add(stationModel);
            } else if (gltfLoader) {
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
                    const size = 0.015;
                    const geometry = new THREE.BoxGeometry(size, size, size * 1.5);
                    const material = new THREE.MeshStandardMaterial({
                        color: color,
                        emissive: color,
                        emissiveIntensity: 1.0,
                        transparent: true,
                        opacity: 0.9,
                        roughness: 0.5,
                        metalness: 0.5
                    });
                    const satelliteMesh = new THREE.Mesh(geometry, material);
                    satelliteGroup.add(satelliteMesh);
                });
            } else {
                const size = 0.015;
                const geometry = new THREE.BoxGeometry(size, size, size * 1.5);
                const material = new THREE.MeshStandardMaterial({
                    color: color,
                    emissive: color,
                    emissiveIntensity: 1.0,
                    transparent: true,
                    opacity: 0.9,
                    roughness: 0.5,
                    metalness: 0.5
                });
                const satelliteMesh = new THREE.Mesh(geometry, material);
                satelliteGroup.add(satelliteMesh);
            }
        } else {
            const satelliteModelCache = this.transportModel.getSatelliteModelCache();
        
            if (satelliteModelCache && gltfLoader) {
                const satelliteModel = satelliteModelCache.clone();
                satelliteModel.scale.set(0.02, 0.02, 0.02);
                satelliteModel.visible = true;
                applySatelliteMaterial(satelliteModel);
                
                if (!shouldAlignWithPath) {
                    satelliteModel.rotation.x = Math.random() * Math.PI * 2;
                    satelliteModel.rotation.y = Math.random() * Math.PI * 2;
                    satelliteModel.rotation.z = Math.random() * Math.PI * 2;
                }
                
                satelliteGroup.add(satelliteModel);
            } else if (gltfLoader) {
                gltfLoader.load('src/assets/models/Satellite.glb', (gltf) => {
                    const model = gltf.scene;
                    const cached = model.clone();
                    this.transportModel.setSatelliteModelCache(cached);
                    
                    model.scale.set(0.02, 0.02, 0.02);
                    model.visible = true;
                    applySatelliteMaterial(model);
                    
                    if (!shouldAlignWithPath) {
                        model.rotation.x = Math.random() * Math.PI * 2;
                        model.rotation.y = Math.random() * Math.PI * 2;
                        model.rotation.z = Math.random() * Math.PI * 2;
                    }
                    
                    satelliteGroup.add(model);
                }, undefined, (error) => {
                    console.error('Error loading Satellite.glb:', error);
                    const size = type === 'MarsShip' ? 0.010 : 0.006;
                    const geometry = new THREE.BoxGeometry(size, size, size * 1.5);
                    const material = new THREE.MeshStandardMaterial({
                        color: color,
                        emissive: color,
                        emissiveIntensity: 1.0,
                        transparent: true,
                        opacity: 0.9,
                        roughness: 0.5,
                        metalness: 0.5
                    });
                    const satelliteMesh = new THREE.Mesh(geometry, material);
                    satelliteGroup.add(satelliteMesh);
                });
            } else {
                const size = type === 'MarsShip' ? 0.010 : 0.006;
                const geometry = new THREE.BoxGeometry(size, size, size * 1.5);
                const material = new THREE.MeshStandardMaterial({
                    color: color,
                    emissive: color,
                    emissiveIntensity: 1.0,
                    transparent: true,
                    opacity: 0.9,
                    roughness: 0.5,
                    metalness: 0.5
                });
                const satelliteMesh = new THREE.Mesh(geometry, material);
                satelliteGroup.add(satelliteMesh);
            }
        }
        
        const minSafeRadius = 1.01 + Math.abs(Math.sin(inclination)) * 0.02;
        const safeOrbitRadius = Math.max(orbitRadius, minSafeRadius);
        
        const orbitPoints = [];
        const segments = 100;
        
        const normalX = Math.sin(inclination) * Math.sin(rotationAngle);
        const normalY = Math.sin(inclination) * Math.cos(rotationAngle);
        const normalZ = Math.cos(inclination);
        const normal = new THREE.Vector3(normalX, normalY, normalZ).normalize();
        
        const up = new THREE.Vector3(0, 0, 1);
        const right = new THREE.Vector3().crossVectors(normal, up).normalize();
        if (right.length() < 0.1) {
            const forward = new THREE.Vector3(1, 0, 0);
            right.crossVectors(normal, forward).normalize();
        }
        const forward = new THREE.Vector3().crossVectors(right, normal).normalize();
        
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const point = new THREE.Vector3()
                .addScaledVector(right, safeOrbitRadius * Math.cos(angle))
                .addScaledVector(forward, safeOrbitRadius * Math.sin(angle));
            
            orbitPoints.push(point);
        }
        
        const orbitCurve = new THREE.CatmullRomCurve3(orbitPoints);
        const orbitGeometry = new THREE.TubeGeometry(orbitCurve, segments, 0.001, 8, false);
        const orbitColor = type === 'ISS' ? 0x0088cc : 0x9b59b6;
        const orbitMaterial = new THREE.MeshBasicMaterial({
            color: orbitColor,
            transparent: true,
            opacity: 0.6
        });
        const orbitLine = new THREE.Mesh(orbitGeometry, orbitMaterial);
        orbitLine.userData.isSatelliteOrbit = true;
        orbitLine.userData.orbitColor = orbitColor;
        orbitLine.userData.satelliteName = name;
        orbitLine.visible = false;
        globe.add(orbitLine);
        this.transportModel.addSatelliteOrbitLine(orbitLine);
        
        satelliteGroup.userData = {
            type: type,
            name: name,
            orbitRadius: safeOrbitRadius,
            orbitSpeed: orbitSpeed,
            inclination: inclination,
            rotationAngle: rotationAngle,
            angle: startAngle,
            isSatellite: true,
            lastTrailSpawn: 0,
            trailSpawnInterval: Math.floor(Math.random() * 7) + 3,
            orbitLine: orbitLine
        };
        
        const initialPosition = new THREE.Vector3()
            .addScaledVector(right, safeOrbitRadius * Math.cos(startAngle))
            .addScaledVector(forward, safeOrbitRadius * Math.sin(startAngle));
        
        satelliteGroup.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
        
        satelliteGroup.visible = this.sceneModel.getHyperloopVisible();
        globe.add(satelliteGroup);
        this.transportModel.addSatellite(satelliteGroup);
        
        return satelliteGroup;
    }

    /**
     * Update satellites - handle orbital motion with speed variation and rotation angle changes
     * NOTE: Now uses Event System data when available, falls back to Globe dataModel
     */
    updateSatellites() {
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        const satellites = this.transportModel.getSatellites();
        
        let hasStationMarkerOnPage = false;
        let isHoveringStationMarker = false;
        let hasMarsShipMarkerOnPage = false;
        let isHoveringMarsShipMarker = false;
        
        // Get current page events - prefer Event System data
        let currentPageEvents = [];
        let dataSource = 'none';
        
        if (window.eventManager?.events && window.standaloneEventSlide?.currentPage) {
            const allEvents = window.eventManager.events;
            const currentPage = window.standaloneEventSlide.currentPage;
            const eventsPerPage = 10;
            const startIndex = (currentPage - 1) * eventsPerPage;
            const endIndex = startIndex + eventsPerPage;
            currentPageEvents = allEvents.slice(startIndex, endIndex);
            dataSource = `EventSystem (page ${currentPage})`;
        } else if (window.globeController?.dataModel?.getEventsForCurrentPage) {
            const dataModel = window.globeController.dataModel;
            currentPageEvents = dataModel.getEventsForCurrentPage();
            dataSource = 'Globe dataModel';
        }
        
        hasStationMarkerOnPage = currentPageEvents.some(event => {
            const eventLocationType = event.locationType || 'earth';
            if (eventLocationType === 'station') return true;
            if (event.variants) {
                return event.variants.some(variant => (variant.locationType || eventLocationType) === 'station');
            }
            return false;
        });

        hasMarsShipMarkerOnPage = currentPageEvents.some(event => {
            const eventLocationType = event.locationType || 'earth';
            if (eventLocationType === 'marsShip') return true;
            if (event.variants) {
                return event.variants.some(variant => (variant.locationType || eventLocationType) === 'marsShip');
            }
            return false;
        });
        
        if (window.globeController && window.globeController.interactionController) {
            const hoveredMarker = window.globeController.interactionController.hoveredEventMarker;
            if (hoveredMarker && hoveredMarker.userData && hoveredMarker.userData.locationType === 'station') {
                isHoveringStationMarker = true;
            }
            if (hoveredMarker && hoveredMarker.userData && hoveredMarker.userData.locationType === 'marsShip') {
                isHoveringMarsShipMarker = true;
            }
        }
        
        let stationSpeedMultiplier = 1.0;
        if (hasStationMarkerOnPage) {
            stationSpeedMultiplier = 0.5;
        }
        if (isHoveringStationMarker) {
            stationSpeedMultiplier *= 0.5;
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
            
            const effectiveSpeed =
                data.type === 'ISS' ? data.orbitSpeed * stationSpeedMultiplier
                : data.type === 'MarsShip' ? data.orbitSpeed * marsShipSpeedMultiplier
                : data.orbitSpeed;
            
            data.angle += effectiveSpeed;
            
            if (data.angle > Math.PI * 2) {
                data.angle -= Math.PI * 2;
            }
            
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
            
            const position = new THREE.Vector3()
                .addScaledVector(right, data.orbitRadius * Math.cos(data.angle))
                .addScaledVector(forward, data.orbitRadius * Math.sin(data.angle));
            
            satellite.position.set(position.x, position.y, position.z);
            
            if (data.type === 'ISS' || data.type === 'MarsShip') {
                const nextAngle = data.angle + effectiveSpeed;
                
                const nextPosition = new THREE.Vector3()
                    .addScaledVector(right, data.orbitRadius * Math.cos(nextAngle))
                    .addScaledVector(forward, data.orbitRadius * Math.sin(nextAngle));
                
                const direction = new THREE.Vector3().subVectors(nextPosition, position).normalize();
                const up = satellite.position.clone().normalize();
                const rightDir = new THREE.Vector3().crossVectors(direction, up).normalize();
                const correctedUp = new THREE.Vector3().crossVectors(rightDir, direction).normalize();
                
                const rotationMatrix = new THREE.Matrix4();
                rotationMatrix.makeBasis(rightDir, correctedUp, direction.negate());
                satellite.quaternion.setFromRotationMatrix(rotationMatrix);
            }
            
            data.lastTrailSpawn++;
            if (data.lastTrailSpawn >= data.trailSpawnInterval) {
                if (Math.random() < 0.25) {
                    this.transportView.createSatelliteTrailDot(satellite.position);
                }
                data.lastTrailSpawn = 0;
                data.trailSpawnInterval = Math.floor(Math.random() * 7) + 3;
            }
            
            satellite.visible = hyperloopVisible;
        });
    }

    /**
     * Initialize satellites
     */
    initializeSatellites() {
        const uniformOrbitRadius = 1.22;
        
        for (let i = 1; i <= 25; i++) {
            const orbitSpeed = 0.0008 + Math.random() * 0.0015;
            const startAngle = Math.random() * Math.PI * 2;
            const rotationAngle = Math.random() * Math.PI * 2;
            const inclination = (Math.random() - 0.5) * Math.PI;
            
            this.createSatellite({
                type: 'small',
                orbitRadius: uniformOrbitRadius,
                orbitSpeed: orbitSpeed,
                inclination: inclination,
                startAngle: startAngle,
                rotationAngle: rotationAngle,
                name: `Satellite ${i}`
            });
        }
        
        const issOrbitRadius = 1.25;
        this.createSatellite({
            type: 'ISS',
            orbitRadius: issOrbitRadius,
            orbitSpeed: 0.0008 + Math.random() * 0.0015,
            inclination: Math.PI / 6,
            startAngle: Math.random() * Math.PI * 2,
            rotationAngle: Math.random() * Math.PI * 2,
            name: 'ISS'
        });
        
        const marsShipOrbitRadius = 1.28;
        const marsInclination = Math.PI / 1.5;
        const veracruzLon = -96.1342;
        const gibraltarLon = -5.3536;
        const avgLon = (veracruzLon + gibraltarLon) / 2;
        const marsRotationAngle = (avgLon * Math.PI / 180) + 0.2;
        const marsStartAngle = veracruzLon * Math.PI / 180;
        
        this.createSatellite({
            type: 'MarsShip',
            orbitRadius: marsShipOrbitRadius,
            orbitSpeed: 0.0008 + Math.random() * 0.0015,
            inclination: marsInclination,
            startAngle: marsStartAngle,
            rotationAngle: marsRotationAngle,
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
}

// Make available globally
if (typeof window !== 'undefined') {
    window.SatelliteService = SatelliteService;
}
