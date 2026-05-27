/**
 * TransportView - Handles transport rendering (trains, planes, boats) and trails
 */
import { latLonToVector3, latLonToMapPlanePosition } from '../../worldview-shared-assets/utils/GeometryUtils.js';

export class TransportView {
    constructor(sceneModel, transportModel) {
        this.sceneModel = sceneModel;
        this.transportModel = transportModel;
        this.airportMarkers = [];
        this.trainStationMarkers = [];
        this.seaportMarkers = [];
    }

    /**
     * Get train color based on journey progress
     * @param {number} progress - Journey progress (0-1)
     * @returns {number} - Color hex value
     */
    getTrainColor(progress) {
        // Red (0xcc0000) -> Green (0x00cc00) gradient
        const r = Math.floor(0xcc * (1 - progress));
        const g = Math.floor(0xcc * progress);
        const b = 0x00;
        return (r << 16) | (g << 8) | b;
    }

    /**
     * Update train color based on journey progress
     * @param {Object} train - Train object
     */
    updateTrainColor(train) {
        const data = train.userData;
        if (!data || !data.curve) return;
        
        const progress = data.progress || 0;
        const color = this.getTrainColor(progress);
        
        // Update all wagons
        train.children.forEach(wagon => {
            if (wagon.material) {
                wagon.material.color.setHex(color);
            }
        });
    }

    /**
     * Create a trail segment for planes
     * @param {THREE.Vector3} position - Position
     * @param {THREE.Vector3} direction - Direction vector
     */
    createTrailSegment(position, direction) {
        if (!this.sceneModel.getHyperloopVisible()) return;

        const globe = this.sceneModel.getGlobe();
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        
        // Calculate position behind the plane
        const trailOffset = 0.015;
        const backPosition = position.clone().add(direction.clone().multiplyScalar(trailOffset));
        
        const segmentGeometry = new THREE.SphereGeometry(0.004, 6, 6);
        const segmentMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        const segment = new THREE.Mesh(segmentGeometry, segmentMaterial);
        segment.position.copy(backPosition);
        
        segment.userData = {
            age: 0,
            maxAge: 180 // 3 seconds at 60fps
        };
        
        segment.visible = hyperloopVisible;
        if (globe) globe.add(segment);
        this.transportModel.addPlaneTrail(segment);
    }

    /**
     * Update all plane trail segments
     */
    updateTrailSegments() {
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        const planeTrails = this.transportModel.getPlaneTrails();

        for (let i = planeTrails.length - 1; i >= 0; i--) {
            const trail = planeTrails[i];
            trail.userData.age += 1;
            
            const fadeProgress = trail.userData.age / trail.userData.maxAge;
            trail.material.opacity = 0.8 * (1 - fadeProgress);
            
            if (trail.userData.age >= trail.userData.maxAge) {
                if (trail.parent) {
                    trail.parent.remove(trail);
                }
                this.transportModel.removePlaneTrail(trail);
            }
            
            trail.visible = hyperloopVisible;
        }
    }

    /**
     * Create a delta/triangle trail segment for boats
     * @param {THREE.Vector3} position - Position
     * @param {THREE.Vector3} forward - Forward direction
     * @param {THREE.Vector3} right - Right direction
     * @param {THREE.Vector3} up - Up direction
     */
    createBoatTrailSegment(position, forward, right, up) {
        if (!this.sceneModel.getHyperloopVisible()) return;

        const globe = this.sceneModel.getGlobe();
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        
        const triangleSize = 0.006; // Triangle size (reverted to original)
        const triangleGeometry = new THREE.BufferGeometry();
        
        // Triangle vertices: point forward, two points behind forming a V
        const vertices = new Float32Array([
            // Front point (tip of delta)
            position.x + forward.x * triangleSize * 1.5,
            position.y + forward.y * triangleSize * 1.5,
            position.z + forward.z * triangleSize * 1.5,
            // Left back point
            position.x - forward.x * triangleSize * 0.5 + right.x * triangleSize,
            position.y - forward.y * triangleSize * 0.5 + right.y * triangleSize,
            position.z - forward.z * triangleSize * 0.5 + right.z * triangleSize,
            // Right back point
            position.x - forward.x * triangleSize * 0.5 - right.x * triangleSize,
            position.y - forward.y * triangleSize * 0.5 - right.y * triangleSize,
            position.z - forward.z * triangleSize * 0.5 - right.z * triangleSize
        ]);
        
        triangleGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        triangleGeometry.setIndex([0, 1, 2]);
        
        const triangleMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff, // White color for boat trails
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        
        const triangle = new THREE.Mesh(triangleGeometry, triangleMaterial);
        
        triangle.userData = {
            age: 0,
            maxAge: 45 // Frames before fully faded (0.75 seconds at 60fps)
        };
        
        triangle.visible = hyperloopVisible;
        if (globe) globe.add(triangle);
        this.transportModel.addBoatTrail(triangle);
    }

    /**
     * Update all boat trail segments
     */
    updateBoatTrailSegments() {
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        const boatTrails = this.transportModel.getBoatTrails();

        for (let i = boatTrails.length - 1; i >= 0; i--) {
            const trail = boatTrails[i];
            trail.userData.age += 1;
            
            // Fade out over time (faster fade, especially for longer trails)
            const fadeProgress = trail.userData.age / trail.userData.maxAge;
            // Use exponential fade for faster disappearance
            const fadeFactor = Math.pow(fadeProgress, 1.5);
            trail.material.opacity = 0.6 * (1 - fadeFactor);
            
            // Remove when fully faded
            if (trail.userData.age >= trail.userData.maxAge) {
                if (trail.parent) {
                    trail.parent.remove(trail);
                }
                this.transportModel.removeBoatTrail(trail);
            }
            
            // Hide if transport toggle is off
            trail.visible = hyperloopVisible;
        }
    }

    /**
     * Update visibility of all transport elements
     */
    /**
     * Remove plane/boat/satellite streak meshes when transport is disabled (free GPU objects, stop fade loops).
     */
    purgePlaneTrails() {
        const planeTrails = this.transportModel.getPlaneTrails();
        for (let i = planeTrails.length - 1; i >= 0; i--) {
            const trail = planeTrails[i];
            if (trail?.parent) trail.parent.remove(trail);
            if (trail?.geometry) trail.geometry.dispose();
            if (trail?.material) trail.material.dispose();
            this.transportModel.removePlaneTrail(trail);
        }
    }

    purgeBoatTrails() {
        const boatTrails = this.transportModel.getBoatTrails();
        for (let i = boatTrails.length - 1; i >= 0; i--) {
            const trail = boatTrails[i];
            if (trail?.parent) trail.parent.remove(trail);
            if (trail?.geometry) trail.geometry.dispose();
            if (trail?.material) trail.material.dispose();
            this.transportModel.removeBoatTrail(trail);
        }
    }

    updateHyperloopVisibility() {
        const scene = this.sceneModel.getScene();
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        const transportController = typeof window !== 'undefined' && window.globeController
            ? window.globeController.transportController
            : null;

        if (!hyperloopVisible) {
            this.purgePlaneTrails();
            this.purgeBoatTrails();
            if (transportController && typeof transportController.disposeDecorSatellites === 'function') {
                transportController.disposeDecorSatellites();
            }
        } else if (transportController && typeof transportController.ensureDecorSatellitesLoaded === 'function') {
            transportController.ensureDecorSatellitesLoaded();
        }
        const markers = this.sceneModel.getMarkers();
        const trains = this.transportModel.getTrains();
        const planes = this.transportModel.getPlanes();
        const boats = this.transportModel.getBoats();
        const boatTrails = this.transportModel.getBoatTrails();

        // Toggle markers visibility (but keep main event markers always visible)
        // Variant markers (pink) should maintain their current visibility state
        markers.forEach(marker => {
            if (marker.userData && marker.userData.isEventMarker) {
                // Only main variant markers should always be visible
                // Variant markers (isMainVariant === false) should keep their current state
                // (they're only visible when their event is open)
                if (marker.userData.isMainVariant !== false) {
                    marker.visible = true;
                }
                // If it's a variant marker (isMainVariant === false), don't change its visibility
                // Let VariantMarkerManager control it
            } else if (marker.userData && marker.userData.isSatelliteMarker) {
                // Reserved for future rocket UI; never show as purple dots (see GlobeView.addSatelliteMarkers)
                marker.visible = false;
            } else {
                marker.visible = hyperloopVisible;
            }
        });
        
        // Toggle connection lines and marker pins visibility
        scene.traverse((object) => {
            if (object.userData) {
                // Seaport connection lines, markers, and pins always hidden
                if (object.userData.isSeaportConnectionLine || object.userData.isSeaportMarker || object.userData.isSeaportMarkerPin) {
                    object.visible = false;
                } else if (object.userData.isEventMarkerPin) {
                    // Event marker pins should always be visible
                    object.visible = true;
                } else if (object.userData.isConnectionLine || object.userData.isSecondaryLine || object.userData.isMarkerPin) {
                    object.visible = hyperloopVisible;
                }
            }
        });
        
        // Toggle train visibility
        trains.forEach(train => {
            if (hyperloopVisible) {
                const data = train.userData;
                if (data && data.progress > 0 && data.progress <= 1 && !data.isWaiting) {
                    train.visible = true;
                }
            } else {
                train.visible = false;
            }
        });
        
        // Toggle plane visibility
        planes.forEach(plane => {
            if (hyperloopVisible) {
                const data = plane.userData;
                if (data && data.progress > 0 && data.progress <= 1) {
                    plane.visible = true;
                }
            } else {
                plane.visible = false;
            }
        });
        
        // Toggle boat visibility
        boats.forEach(boat => {
            if (hyperloopVisible) {
                const data = boat.userData;
                if (data && data.progress > 0 && data.progress <= 1 && !data.isWaiting) {
                    boat.visible = true;
                }
            } else {
                boat.visible = false;
            }
        });
        
        // Toggle boat trail visibility
        boatTrails.forEach(trail => {
            trail.visible = hyperloopVisible;
        });
        
        // Update all transport markers visibility (airports, train stations, seaports)
        this.updateAllTransportMarkersVisibility();
    }

    /**
     * Create a small dot trail for satellites, offset to the sides randomly
     * @param {THREE.Vector3} position - Position
     */
    createSatelliteTrailDot(position) {
        if (!this.sceneModel.getHyperloopVisible()) return;

        const globe = this.sceneModel.getGlobe();
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        
        // Calculate random offset to the sides
        // Get a random perpendicular direction
        const randomAngle = Math.random() * Math.PI * 2;
        const offsetDistance = 0.01 + Math.random() * 0.015; // 0.01 to 0.025 offset
        
        // Create a random perpendicular vector
        const offsetX = Math.cos(randomAngle) * offsetDistance;
        const offsetY = Math.sin(randomAngle) * offsetDistance;
        const offsetZ = (Math.random() - 0.5) * offsetDistance * 0.5; // Slight Z offset too
        
        const dotGeometry = new THREE.SphereGeometry(0.002, 6, 6); // Small dot
        const dotMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        
        // Position with random side offset
        dot.position.set(position.x + offsetX, position.y + offsetY, position.z + offsetZ);
        
        dot.userData = {
            age: 0,
            maxAge: 180 // 3 seconds at 60fps
        };
        
        dot.visible = hyperloopVisible;
        if (globe) globe.add(dot);
        this.transportModel.addPlaneTrail(dot); // Use plane trail system
    }

    /**
     * Create airport markers for all airports
     * @param {Array} airports - Array of airport objects with lat/lon
     */
    createAirportMarkers(airports) {
        if (!airports || airports.length === 0) return;
        
        const globe = this.sceneModel.getGlobe();
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        
        // Remove existing airport markers first
        this.removeAirportMarkers();
        
        airports.forEach(airport => {
            // Create marker for globe view
            const globePosition = latLonToVector3(airport.lat, airport.lon, 1.008);
            const globeMarkerGeometry = new THREE.SphereGeometry(0.015, 16, 16);
            const globeMarkerMaterial = new THREE.MeshBasicMaterial({
                color: 0x00bfff, // Light blue for airports
                transparent: true,
                opacity: 0.9
            });
            const globeMarker = new THREE.Mesh(globeMarkerGeometry, globeMarkerMaterial);
            globeMarker.position.copy(globePosition);
            globeMarker.userData = { type: 'airport', name: airport.name };
            globeMarker.visible = hyperloopVisible && !isMapView;
            if (globe) globe.add(globeMarker);
            
            // Create marker for map view
            const mapPosition = latLonToMapPlanePosition(airport.lat, airport.lon, 2.0, 1.0, 0.008);
            const mapMarkerGeometry = new THREE.SphereGeometry(0.012, 16, 16);
            const mapMarkerMaterial = new THREE.MeshBasicMaterial({
                color: 0x00bfff, // Light blue for airports
                transparent: true,
                opacity: 0.9
            });
            const mapMarker = new THREE.Mesh(mapMarkerGeometry, mapMarkerMaterial);
            mapMarker.position.copy(mapPosition);
            mapMarker.userData = { type: 'airport', name: airport.name, isMapMarker: true };
            mapMarker.visible = false;
            if (globe) globe.add(mapMarker);
            
            this.airportMarkers.push({ globe: globeMarker, map: mapMarker, airport });
        });
        
        console.log(`✈️ Created ${this.airportMarkers.length} airport markers`);
    }

    /**
     * Remove all airport markers
     */
    removeAirportMarkers() {
        const globe = this.sceneModel.getGlobe();
        
        this.airportMarkers.forEach(({ globe: globeMarker, map: mapMarker }) => {
            if (globeMarker) {
                if (globeMarker.geometry) globeMarker.geometry.dispose();
                if (globeMarker.material) globeMarker.material.dispose();
                if (globe) globe.remove(globeMarker);
            }
            if (mapMarker) {
                if (mapMarker.geometry) mapMarker.geometry.dispose();
                if (mapMarker.material) mapMarker.material.dispose();
                if (globe) globe.remove(mapMarker);
            }
        });
        
        this.airportMarkers = [];
    }

    /**
     * Update airport marker visibility based on view mode and transport toggle
     */
    updateAirportMarkersVisibility() {
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        
        this.airportMarkers.forEach(({ globe: globeMarker, map: mapMarker }) => {
            if (globeMarker) globeMarker.visible = hyperloopVisible && !isMapView;
            if (mapMarker) mapMarker.visible = false;
        });
    }

    /**
     * Create train station markers for all cities (train stations)
     * @param {Array} cities - Array of city objects with lat/lon
     */
    createTrainStationMarkers(cities) {
        if (!cities || cities.length === 0) return;
        
        const globe = this.sceneModel.getGlobe();
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        
        // Remove existing train station markers first
        this.removeTrainStationMarkers();
        
        cities.forEach(city => {
            // Create marker for globe view
            const globePosition = latLonToVector3(city.lat, city.lon, 1.008);
            const globeMarkerGeometry = new THREE.SphereGeometry(0.012, 16, 16);
            const globeMarkerMaterial = new THREE.MeshBasicMaterial({
                color: 0xff6600, // Orange for train stations
                transparent: true,
                opacity: 0.9
            });
            const globeMarker = new THREE.Mesh(globeMarkerGeometry, globeMarkerMaterial);
            globeMarker.position.copy(globePosition);
            globeMarker.userData = { type: 'trainStation', name: city.name };
            globeMarker.visible = hyperloopVisible && !isMapView;
            if (globe) globe.add(globeMarker);
            
            // Create marker for map view
            const mapPosition = latLonToMapPlanePosition(city.lat, city.lon, 2.0, 1.0, 0.008);
            const mapMarkerGeometry = new THREE.SphereGeometry(0.010, 16, 16);
            const mapMarkerMaterial = new THREE.MeshBasicMaterial({
                color: 0xff6600, // Orange for train stations
                transparent: true,
                opacity: 0.9
            });
            const mapMarker = new THREE.Mesh(mapMarkerGeometry, mapMarkerMaterial);
            mapMarker.position.copy(mapPosition);
            mapMarker.userData = { type: 'trainStation', name: city.name, isMapMarker: true };
            mapMarker.visible = false;
            if (globe) globe.add(mapMarker);
            
            this.trainStationMarkers.push({ globe: globeMarker, map: mapMarker, city });
        });
        
        console.log(`🚂 Created ${this.trainStationMarkers.length} train station markers`);
    }

    /**
     * Remove all train station markers
     */
    removeTrainStationMarkers() {
        const globe = this.sceneModel.getGlobe();
        
        this.trainStationMarkers.forEach(({ globe: globeMarker, map: mapMarker }) => {
            if (globeMarker) {
                if (globeMarker.geometry) globeMarker.geometry.dispose();
                if (globeMarker.material) globeMarker.material.dispose();
                if (globe) globe.remove(globeMarker);
            }
            if (mapMarker) {
                if (mapMarker.geometry) mapMarker.geometry.dispose();
                if (mapMarker.material) mapMarker.material.dispose();
                if (globe) globe.remove(mapMarker);
            }
        });
        
        this.trainStationMarkers = [];
    }

    /**
     * Update train station marker visibility based on view mode and transport toggle
     */
    updateTrainStationMarkersVisibility() {
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        
        this.trainStationMarkers.forEach(({ globe: globeMarker, map: mapMarker }) => {
            if (globeMarker) globeMarker.visible = hyperloopVisible && !isMapView;
            if (mapMarker) mapMarker.visible = false;
        });
    }

    /**
     * Create seaport markers for all seaports
     * @param {Array} seaports - Array of seaport objects with lat/lon
     */
    createSeaportMarkers(seaports) {
        if (!seaports || seaports.length === 0) return;
        
        const globe = this.sceneModel.getGlobe();
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        
        // Remove existing seaport markers first
        this.removeSeaportMarkers();
        
        seaports.forEach(seaport => {
            // Create marker for globe view
            const globePosition = latLonToVector3(seaport.lat, seaport.lon, 1.008);
            const globeMarkerGeometry = new THREE.SphereGeometry(0.012, 16, 16);
            const globeMarkerMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff88, // Teal/green for seaports
                transparent: true,
                opacity: 0.9
            });
            const globeMarker = new THREE.Mesh(globeMarkerGeometry, globeMarkerMaterial);
            globeMarker.position.copy(globePosition);
            globeMarker.userData = { type: 'seaport', name: seaport.name };
            globeMarker.visible = hyperloopVisible && !isMapView;
            if (globe) globe.add(globeMarker);
            
            // Create marker for map view
            const mapPosition = latLonToMapPlanePosition(seaport.lat, seaport.lon, 2.0, 1.0, 0.008);
            const mapMarkerGeometry = new THREE.SphereGeometry(0.010, 16, 16);
            const mapMarkerMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff88, // Teal/green for seaports
                transparent: true,
                opacity: 0.9
            });
            const mapMarker = new THREE.Mesh(mapMarkerGeometry, mapMarkerMaterial);
            mapMarker.position.copy(mapPosition);
            mapMarker.userData = { type: 'seaport', name: seaport.name, isMapMarker: true };
            mapMarker.visible = false;
            if (globe) globe.add(mapMarker);
            
            this.seaportMarkers.push({ globe: globeMarker, map: mapMarker, seaport });
        });
        
        console.log(`⚓ Created ${this.seaportMarkers.length} seaport markers`);
    }

    /**
     * Remove all seaport markers
     */
    removeSeaportMarkers() {
        const globe = this.sceneModel.getGlobe();
        
        this.seaportMarkers.forEach(({ globe: globeMarker, map: mapMarker }) => {
            if (globeMarker) {
                if (globeMarker.geometry) globeMarker.geometry.dispose();
                if (globeMarker.material) globeMarker.material.dispose();
                if (globe) globe.remove(globeMarker);
            }
            if (mapMarker) {
                if (mapMarker.geometry) mapMarker.geometry.dispose();
                if (mapMarker.material) mapMarker.material.dispose();
                if (globe) globe.remove(mapMarker);
            }
        });
        
        this.seaportMarkers = [];
    }

    /**
     * Update seaport marker visibility based on view mode and transport toggle
     */
    updateSeaportMarkersVisibility() {
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        
        this.seaportMarkers.forEach(({ globe: globeMarker, map: mapMarker }) => {
            if (globeMarker) globeMarker.visible = hyperloopVisible && !isMapView;
            if (mapMarker) mapMarker.visible = false;
        });
    }

    /**
     * Update all transport marker visibility (airports, train stations, seaports)
     */
    updateAllTransportMarkersVisibility() {
        this.updateAirportMarkersVisibility();
        this.updateTrainStationMarkersVisibility();
        this.updateSeaportMarkersVisibility();
    }
}
