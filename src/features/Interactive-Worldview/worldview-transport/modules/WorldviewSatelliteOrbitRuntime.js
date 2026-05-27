import { getTransportVehicleColors, getMarsShipEmissiveHex } from '../../worldview-shared-assets/utils/TransportPaletteColors.js';

const ISS_AXIS_SPIN_FACTOR = 22;

export const worldviewSatelliteOrbitRuntime = {
    setMapViewEnabled(enabled) {
        const globe = this.sceneModel.getGlobe();
        const satellites = this.transportModel.getSatellites();
        const isMapView = !!enabled;
        satellites.forEach((satellite) => {
            if (!satellite?.userData?.isSatellite) return;
            const data = satellite.userData;
            const orbitTube = data.orbitLine;
            if (orbitTube) orbitTube.visible = false;
            if (data.mapOrbitLines) {
                data.mapOrbitLines.forEach((line) => { if (line?.parent) line.parent.remove(line); });
                data.mapOrbitLines = [];
            }
            if (globe && typeof globe.attach === 'function' && satellite.parent !== globe) globe.attach(satellite);
            satellite.scale.setScalar(1);
            const transportOn = this.sceneModel.getHyperloopVisible();
            data.hideInMap = isMapView && data.type === 'small';
            satellite.visible = transportOn && !(isMapView && data.hideInMap);
        });
    },

    createSatellite(config) {
        const globe = this.sceneModel.getGlobe();
        const { type = 'small', orbitRadius = 1.15, orbitSpeed = 0.001, inclination = 0, startAngle = 0, rotationAngle = 0, name = 'Satellite' } = config;
        const satelliteGroup = new THREE.Group();
        const gltfLoader = this.sceneModel.getGLTFLoader();
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
                if (!child.isMesh) return;
                child.material = new THREE.MeshPhongMaterial({ color, emissive: satEmissive, emissiveIntensity: 0.3, transparent: true, opacity: 0.9, shininess: 30 });
                child.visible = true;
                if (child.geometry) {
                    child.geometry.computeBoundingBox();
                    child.geometry.computeBoundingSphere();
                }
            });
        };

        const attachFallback = (size) => satelliteGroup.add(new THREE.Mesh(
            new THREE.BoxGeometry(size, size, size * 1.5),
            new THREE.MeshPhongMaterial({ color, emissive: satEmissive, emissiveIntensity: 0.3, transparent: true, opacity: 0.9 })
        ));

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
                    this.transportModel.setStationModelCache(model.clone());
                    model.scale.set(0.02, 0.02, 0.02);
                    model.visible = true;
                    applySatelliteMaterial(model);
                    satelliteGroup.add(model);
                }, undefined, () => attachFallback(0.015));
            } else attachFallback(0.015);
        } else {
            const isMarsShip = type === 'MarsShip';
            const cache = isMarsShip ? this.transportModel.getSpaceShipModelCache?.() : this.transportModel.getSatelliteModelCache?.();
            const modelScale = isMarsShip ? (0.02 * 0.8) : 0.02;
            if (cache && gltfLoader) {
                const m = cache.clone();
                m.scale.set(modelScale, modelScale, modelScale);
                m.visible = true;
                if (isMarsShip) applyMarsShipFacingFix(m);
                applySatelliteMaterial(m);
                if (!shouldAlignWithPath) {
                    m.rotation.x = Math.random() * Math.PI * 2;
                    m.rotation.y = Math.random() * Math.PI * 2;
                    m.rotation.z = Math.random() * Math.PI * 2;
                }
                satelliteGroup.add(m);
            } else if (gltfLoader) {
                const path = isMarsShip ? 'src/assets/models/SpaceShip.glb' : 'src/assets/models/Satellite.glb';
                gltfLoader.load(path, (gltf) => {
                    const model = gltf.scene;
                    if (isMarsShip) applyMarsShipFacingFix(model);
                    const cached = model.clone();
                    if (isMarsShip) applyMarsShipFacingFix(cached);
                    if (isMarsShip) this.transportModel.setSpaceShipModelCache?.(cached);
                    else this.transportModel.setSatelliteModelCache?.(cached);
                    model.scale.set(modelScale, modelScale, modelScale);
                    model.visible = true;
                    applySatelliteMaterial(model);
                    if (!shouldAlignWithPath) {
                        model.rotation.x = Math.random() * Math.PI * 2;
                        model.rotation.y = Math.random() * Math.PI * 2;
                        model.rotation.z = Math.random() * Math.PI * 2;
                    }
                    satelliteGroup.add(model);
                }, undefined, () => attachFallback(type === 'MarsShip' ? (0.010 * 0.8) : 0.006));
            } else attachFallback(type === 'MarsShip' ? (0.010 * 0.8) : 0.006);
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
        if (right.length() < 0.1) right.crossVectors(normal, new THREE.Vector3(1, 0, 0)).normalize();
        const forward = new THREE.Vector3().crossVectors(right, normal).normalize();
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            orbitPoints.push(new THREE.Vector3().addScaledVector(right, safeOrbitRadius * Math.cos(angle)).addScaledVector(forward, safeOrbitRadius * Math.sin(angle)));
        }
        const orbitCurve = new THREE.CatmullRomCurve3(orbitPoints);
        const orbitGeometry = new THREE.TubeGeometry(orbitCurve, segments, 0.001, 8, false);
        const usesPaletteOrbit = type === 'ISS' || type === 'MarsShip';
        const orbitColor = usesPaletteOrbit ? vehicleColors.color : 0x9b59b6;
        const orbitLine = new THREE.Mesh(orbitGeometry, new THREE.MeshBasicMaterial({ color: orbitColor, transparent: true, opacity: 0.6 }));
        orbitLine.userData.isSatelliteOrbit = true;
        orbitLine.userData.orbitUsesTransportPalette = usesPaletteOrbit;
        orbitLine.userData.orbitColor = orbitColor;
        orbitLine.userData.satelliteName = name;
        orbitLine.visible = false;
        if (globe) globe.add(orbitLine);
        this.transportModel.addSatelliteOrbitLine(orbitLine);

        satelliteGroup.userData = {
            type, name, orbitRadius: safeOrbitRadius, orbitSpeed, inclination, rotationAngle, angle: startAngle, isSatellite: true,
            lastTrailSpawn: 0, trailSpawnInterval: Math.floor(Math.random() * 7) + 3, orbitLine
        };
        const initialPosition = new THREE.Vector3().addScaledVector(right, safeOrbitRadius * Math.cos(startAngle)).addScaledVector(forward, safeOrbitRadius * Math.sin(startAngle));
        satelliteGroup.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
        satelliteGroup.visible = this.sceneModel.getHyperloopVisible();
        if (globe) globe.add(satelliteGroup);
        this.transportModel.addSatellite(satelliteGroup);
        return satelliteGroup;
    },

    updateSatellites() {
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        const satellites = this.transportModel.getSatellites();
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        if (isMapView) return;
        const globe = this.sceneModel.getGlobe();

        let hasStationMarkerOnPage = false;
        let isHoveringStationMarker = false;
        let hasMarsShipMarkerOnPage = false;
        let isHoveringMarsShipMarker = false;
        if (window.globeController && window.globeController.dataModel) {
            const dataModel = window.globeController.dataModel;
            const pageNum = typeof dataModel.getCurrentEventPage === 'function' ? dataModel.getCurrentEventPage() : dataModel.currentEventPage;
            const pageKey = `${pageNum}\0${dataModel.eventsPerPage}\0${dataModel.events.length}`;
            if (pageKey !== this._satellitePageKey) {
                this._satellitePageKey = pageKey;
                const currentPageEvents = dataModel.getEventsForCurrentPage();
                this._satellitePageHasStation = currentPageEvents.some((event) => {
                    const eventLocationType = event.locationType || 'earth';
                    if (eventLocationType === 'station') return true;
                    return !!event.variants?.some((variant) => (variant.locationType || eventLocationType) === 'station');
                });
                this._satellitePageHasMarsShip = currentPageEvents.some((event) => {
                    const eventLocationType = event.locationType || 'earth';
                    if (eventLocationType === 'marsShip') return true;
                    return !!event.variants?.some((variant) => (variant.locationType || eventLocationType) === 'marsShip');
                });
            }
            hasStationMarkerOnPage = this._satellitePageHasStation;
            hasMarsShipMarkerOnPage = this._satellitePageHasMarsShip;
        }
        if (window.globeController?.interactionController) {
            const hoveredMarker = window.globeController.interactionController.hoveredEventMarker;
            if (hoveredMarker?.userData?.locationType === 'station') isHoveringStationMarker = true;
            if (hoveredMarker?.userData?.locationType === 'marsShip') isHoveringMarsShipMarker = true;
        }
        let stationSpeedMultiplier = hasStationMarkerOnPage ? 0.5 : 1.0;
        if (isHoveringStationMarker) stationSpeedMultiplier *= 0.5;
        let marsShipSpeedMultiplier = hasMarsShipMarkerOnPage ? 0.5 : 1.0;
        if (isHoveringMarsShipMarker) marsShipSpeedMultiplier *= 0.5;

        satellites.forEach((satellite) => {
            const data = satellite.userData;
            if (!data?.isSatellite) return;
            if (data.type === 'small' && !hyperloopVisible) return;
            const effectiveSpeed = data.type === 'ISS' ? data.orbitSpeed * stationSpeedMultiplier
                : data.type === 'MarsShip' ? data.orbitSpeed * marsShipSpeedMultiplier
                    : data.orbitSpeed;
            data.angle += effectiveSpeed;
            if (data.angle > Math.PI * 2) data.angle -= Math.PI * 2;
            const normalX = Math.sin(data.inclination) * Math.sin(data.rotationAngle);
            const normalY = Math.sin(data.inclination) * Math.cos(data.rotationAngle);
            const normalZ = Math.cos(data.inclination);
            const normal = new THREE.Vector3(normalX, normalY, normalZ).normalize();
            const up = new THREE.Vector3(0, 0, 1);
            const right = new THREE.Vector3().crossVectors(normal, up).normalize();
            if (right.length() < 0.1) right.crossVectors(normal, new THREE.Vector3(1, 0, 0)).normalize();
            const forward = new THREE.Vector3().crossVectors(right, normal).normalize();
            const position3d = new THREE.Vector3().addScaledVector(right, data.orbitRadius * Math.cos(data.angle)).addScaledVector(forward, data.orbitRadius * Math.sin(data.angle));
            if (globe && satellite.parent !== globe && globe.attach) globe.attach(satellite);
            satellite.position.set(position3d.x, position3d.y, position3d.z);
            if (data.type === 'ISS' || data.type === 'MarsShip') {
                const nextAngle = data.angle + effectiveSpeed;
                const nextPosition3d = new THREE.Vector3().addScaledVector(right, data.orbitRadius * Math.cos(nextAngle)).addScaledVector(forward, data.orbitRadius * Math.sin(nextAngle));
                const direction = new THREE.Vector3().subVectors(nextPosition3d, position3d).normalize();
                const up3 = satellite.position.clone().normalize();
                const rightDir = new THREE.Vector3().crossVectors(direction, up3).normalize();
                const correctedUp = new THREE.Vector3().crossVectors(rightDir, direction).normalize();
                const rotationMatrix = new THREE.Matrix4();
                rotationMatrix.makeBasis(rightDir, correctedUp, direction.negate());
                satellite.quaternion.setFromRotationMatrix(rotationMatrix);
                if (data.type === 'ISS') {
                    if (typeof data.stationAxisSpin !== 'number') data.stationAxisSpin = Math.random() * Math.PI * 2;
                    data.stationAxisSpin += effectiveSpeed * ISS_AXIS_SPIN_FACTOR;
                    this._issLocalRollQuat.setFromAxisAngle(this._issLocalRollAxis, data.stationAxisSpin);
                    satellite.quaternion.multiply(this._issLocalRollQuat);
                }
            }
            if (data.type === 'small' && hyperloopVisible) {
                data.lastTrailSpawn++;
                if (data.lastTrailSpawn >= data.trailSpawnInterval) {
                    if (Math.random() < 0.25) this.transportView.createSatelliteTrailDot(satellite.position);
                    data.lastTrailSpawn = 0;
                    data.trailSpawnInterval = Math.floor(Math.random() * 7) + 3;
                }
            }
            satellite.visible = hyperloopVisible;
        });
    }
};
