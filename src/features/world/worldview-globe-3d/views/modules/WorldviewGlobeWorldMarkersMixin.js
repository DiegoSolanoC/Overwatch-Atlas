/**
 * Celestial planes, city/seaport markers, and route arcs for {@link WorldviewGlobeView}.
 */
import { createArcBetweenPoints, latLonToVector3 } from '../../../worldview-shared-assets/utils/WorldviewGeometry.js';
import {
    createCelestialPlane,
    getMoonTexturePath,
    getMarsTexturePath
} from '../helpers/WorldviewGlobePlanes.js';
import { createMarkerWithPin } from '../helpers/WorldviewGlobeMarkers.js';
import {
    createConnectionLine,
    createConnectionGlow,
    normalizeViaPoint
} from '../helpers/WorldviewGlobeConnections.js';
import { createEarthCityLightsPoints, disposeEarthCityLights } from '../helpers/WorldviewEarthLights.js';

export const mixin = {
    initCelestialPlanes() {
        const scene = this.sceneModel.getScene();
        const renderer = this.sceneModel.getRenderer();
        const textureLoader = new THREE.TextureLoader();
        const saved = localStorage.getItem('colorPalette');
        const paletteKey = saved === 'gray' ? 'gray' : (saved === 'crimson' ? 'crimson' : (saved === 'nulled' ? 'nulled' : 'blue'));

        // Create Moon plane
        const moonPlane = createCelestialPlane({
            texturePath: getMoonTexturePath(paletteKey),
            paletteKey,
            textureLoader,
            renderer,
            size: 1.5,
            position: new THREE.Vector3(0, 0.6, 0),
            visible: true
        });
        this.sceneModel.setMoonPlane(moonPlane);
        scene.add(moonPlane);
        
        // Create Mars plane
        const marsPlane = createCelestialPlane({
            texturePath: getMarsTexturePath(paletteKey),
            paletteKey,
            textureLoader,
            renderer,
            size: 1.5,
            position: new THREE.Vector3(0, -0.6, 0),
            visible: true
        });
        this.sceneModel.setMarsPlane(marsPlane);
        scene.add(marsPlane);
    },

    addCityMarkers() {
        const globe = this.sceneModel.getGlobe();
        const cities = this.dataModel.getAllCities();
        const markers = this.sceneModel.getMarkers();
        
        // Get all transport connections to check which cities have connections
        const trainConnections = this.dataModel.getTrainConnections();
        const secondaryConnections = this.dataModel.getSecondaryConnections();
        const allConnections = [...trainConnections, ...secondaryConnections];
        
        // Create a set of city names that have connections (either as "from" or "to")
        const citiesWithConnections = new Set();
        allConnections.forEach(conn => {
            citiesWithConnections.add(conn.from);
            citiesWithConnections.add(conn.to);
        });

        cities.forEach(city => {
            // Only create markers for cities that have transport connections
            if (!citiesWithConnections.has(city.name)) {
                return; // Skip cities without connections
            }

            createMarkerWithPin({
                location: city,
                radius: 0.004,
                color: 0xffd700,
                pinColor: 0xffd700,
                elevation: 1.02,
                userData: {
                city: city.name,
                lat: city.lat,
                lon: city.lon,
                isMarker: true
                },
                parent: globe,
                markersArray: markers,
                pinVisible: false  // Only event pins show; avoids loose pins at cities that also have events (e.g. Honolulu, The Hague)
            });
        });
    },

    addEarthCityLights() {
        this.refreshEarthCityLights();
    },

    async refreshEarthCityLights() {
        const globe = this.sceneModel.getGlobe();
        if (!globe) return;
        if (this._earthCityLights) {
            globe.remove(this._earthCityLights);
            disposeEarthCityLights(this._earthCityLights);
            this._earthCityLights = null;
        }
        if (this._earthCityAccentLights && this._earthCityAccentLights.length) {
            for (const L of this._earthCityAccentLights) {
                globe.remove(L);
            }
            this._earthCityAccentLights = null;
        }
        try {
            const pts = await createEarthCityLightsPoints(this.dataModel);
            if (pts && pts.instancedMesh) {
                this._earthCityLights = pts.instancedMesh;
                globe.add(pts.instancedMesh);
                const accent = pts.accentPointLights || [];
                this._earthCityAccentLights = accent;
                for (const L of accent) {
                    globe.add(L);
                }
            }
        } catch (e) {
            console.warn('WorldviewGlobeView: earth city lights failed', e);
        }
        this._syncAtmosphereSunDirection();
    },

    addSeaportMarkers() {
        const globe = this.sceneModel.getGlobe();
        // Use allSeaports (before filtering) to show ports without connections too
        const seaports = this.dataModel.allSeaports || this.dataModel.getAllSeaports();
        const seaportConnections = this.dataModel.getSeaportConnections();
        const boatRoutesOn = this.sceneModel.getBoatRoutesVisible?.()
            ? this.sceneModel.getBoatRoutesVisible()
            : !!this.sceneModel.boatRoutesVisible;

        // Create a set of port names that have connections (either as "from" or "to")
        const portsWithConnections = new Set();
        seaportConnections.forEach(conn => {
            portsWithConnections.add(conn.from);
            portsWithConnections.add(conn.to);
        });

        seaports.forEach(seaport => {
            const hasConnections = portsWithConnections.has(seaport.name);
            const markerColor = hasConnections ? 0x4fc3f7 : 0x66bb6a;

            createMarkerWithPin({
                location: seaport,
                radius: 0.008,
                color: markerColor,
                pinColor: markerColor,
                elevation: 1.012,
                userData: {
                    isSeaportMarker: true,
                    seaportName: seaport.name
                },
                parent: globe,
                markersArray: this.sceneModel.getMarkers(),
                visible: boatRoutesOn,
                pinVisible: false
            });
        });
    },

    /** Airport dots shown with the Flights route toggle. */
    addAirportMarkers() {
        const globe = this.sceneModel.getGlobe();
        if (!globe || !this.dataModel?.getAllAirports) return;
        const airports = this.dataModel.getAllAirports();
        if (!airports?.length) return;

        const planeRoutesOn = this.sceneModel.getPlaneRoutesVisible?.()
            ? this.sceneModel.getPlaneRoutesVisible()
            : !!this.sceneModel.planeRoutesVisible;

        airports.forEach((airport) => {
            createMarkerWithPin({
                location: airport,
                radius: 0.007,
                color: 0xff4444,
                pinColor: 0xff4444,
                elevation: 1.014,
                userData: {
                    isAirportMarker: true,
                    airportName: airport.name
                },
                parent: globe,
                markersArray: this.sceneModel.getMarkers(),
                visible: planeRoutesOn,
                pinVisible: false
            });
        });
    },

    addConnectionLines(onRouteCurveCreated) {
        const globe = this.sceneModel.getGlobe();
        const connections = this.dataModel.getTrainConnections();
        const cities = this.dataModel.getAllCities();

        connections.forEach(connection => {
            const fromCity = cities.find(c => c.name === connection.from);
            const toCity = cities.find(c => c.name === connection.to);
            
            if (!fromCity || !toCity) {
                console.warn(`Connection not found: ${connection.from} to ${connection.to}`);
                return;
            }
            
            const curvePoints = createArcBetweenPoints(fromCity.lat, fromCity.lon, toCity.lat, toCity.lon, 1.02, 50, true);
            const curve = new THREE.CatmullRomCurve3(curvePoints);
            
            if (onRouteCurveCreated) {
                onRouteCurveCreated({
                    curve: curve,
                    from: connection.from,
                    to: connection.to,
                    fromLat: fromCity.lat,
                    fromLon: fromCity.lon,
                    toLat: toCity.lat,
                    toLon: toCity.lon,
                    isMainRoute: true
                });
            }
            
            // Main core line - golden
            const tubeGeometry = new THREE.TubeGeometry(curve, 50, 0.002, 8, false);
            const tubeMaterial = new THREE.MeshBasicMaterial({
                color: 0xffd700,
                transparent: true,
                opacity: 0.95
            });
            const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
            tube.userData.isConnectionLine = true;
            globe.add(tube);
            
            // Create gradient glow
            createConnectionGlow(curve, globe, 0.002, 50, 2);
        });
    },

    addSecondaryConnectionLines() {
        const globe = this.sceneModel.getGlobe();
        const secondaryConnections = this.dataModel.getSecondaryConnections();
        const cities = this.dataModel.getAllCities();

        secondaryConnections.forEach(connection => {
            const fromCity = cities.find(c => c.name === connection.from);
            const toCity = cities.find(c => c.name === connection.to);
            
            if (!fromCity || !toCity) {
                console.warn(`Secondary connection not found: ${connection.from} to ${connection.to}`);
                return;
            }
            
            createConnectionLine({
                fromLocation: { lat: fromCity.lat, lon: fromCity.lon, from: connection.from },
                toLocation: { lat: toCity.lat, lon: toCity.lon, to: connection.to },
                radius: 1.02,
                segments: 50,
                useArc: false,
                parent: globe,
                lineConfig: {
                    radius: 0.0015,
                color: 0xffffff,
                    opacity: 0.7,
                    userDataKey: 'isSecondaryLine'
                }
            });
        });
    },

    addSeaportConnectionLines(onBoatRouteCurveCreated) {
        const globe = this.sceneModel.getGlobe();
        const seaportConnections = this.dataModel.getSeaportConnections();
        const seaports = this.dataModel.getAllSeaports();
        const boatRoutesOn = this.sceneModel.getBoatRoutesVisible?.()
            ? this.sceneModel.getBoatRoutesVisible()
            : !!this.sceneModel.boatRoutesVisible;

        const resolvePort = (name) => seaports.find((p) => p.name === name) || null;

        seaportConnections.forEach(connection => {
            const fromPort = resolvePort(connection.from);
            const toPort = resolvePort(connection.to);

            if (!fromPort || !toPort) {
                console.warn(`Seaport connection not found: ${connection.from} to ${connection.to}`);
                return;
            }

            // Optional midpoints: via: [{lat,lon}|[lat,lon]|"PortName", ...]
            const rawVia = connection.via || connection.waypoints || [];
            const viaLocations = (Array.isArray(rawVia) ? rawVia : [])
                .map((entry) => normalizeViaPoint(entry, resolvePort))
                .filter(Boolean);

            // Special case: Mumbai to Anchorage - force long way (through Africa/Pacific)
            const forceLongWay = viaLocations.length === 0 && (
                (connection.from === 'Mumbai' && connection.to === 'Anchorage') ||
                (connection.from === 'Anchorage' && connection.to === 'Mumbai')
            );

            createConnectionLine({
                fromLocation: { lat: fromPort.lat, lon: fromPort.lon, from: connection.from },
                toLocation: { lat: toPort.lat, lon: toPort.lon, to: connection.to },
                viaLocations,
                radius: 1.0,
                segments: viaLocations.length ? 72 : 50,
                useArc: false,
                forceLongWay,
                parent: globe,
                onCurveCreated: onBoatRouteCurveCreated,
                lineConfig: {
                    radius: 0.002,
                    color: 0x4fc3f7,
                    opacity: 0.75,
                    userDataKey: 'isSeaportConnectionLine',
                    visible: boatRoutesOn
                }
            });

            // Small control-point markers so curved routes are editable in the data
            viaLocations.forEach((via, idx) => {
                const pos = latLonToVector3(via.lat, via.lon, 1.008);
                const geo = new THREE.SphereGeometry(0.005, 10, 10);
                const mat = new THREE.MeshBasicMaterial({
                    color: 0xffcc66,
                    transparent: true,
                    opacity: 0.9
                });
                const marker = new THREE.Mesh(geo, mat);
                marker.position.copy(pos);
                marker.userData = {
                    isBoatViaMarker: true,
                    from: connection.from,
                    to: connection.to,
                    viaIndex: idx
                };
                marker.visible = boatRoutesOn;
                globe.add(marker);
            });
        });
    },

    /**
     * Flight corridors from airportConnections, plus a light nearest-neighbor
     * fill for any airport that still has no explicit edge.
     * Hidden until plane-routes toggle is on.
     */
    addAirportRouteLines() {
        const globe = this.sceneModel.getGlobe();
        if (!globe || !this.dataModel?.getAllAirports) return;
        const airports = this.dataModel.getAllAirports();
        if (!airports || airports.length < 2) return;

        const planeRoutesOn = this.sceneModel.getPlaneRoutesVisible?.()
            ? this.sceneModel.getPlaneRoutesVisible()
            : !!this.sceneModel.planeRoutesVisible;
        const byName = new Map(airports.map((a) => [a.name, a]));
        const edgeKeys = new Set();
        const linked = new Set();

        const drawEdge = (a, b) => {
            if (!a || !b || a.name === b.name) return;
            const key = [a.name, b.name].sort().join('\0');
            if (edgeKeys.has(key)) return;
            edgeKeys.add(key);
            linked.add(a.name);
            linked.add(b.name);
            // Stagger parallel corridor tubes so stacked routes read as separate lanes
            const lane = (edgeKeys.size % 5) - 2;
            createConnectionLine({
                fromLocation: { lat: a.lat, lon: a.lon, from: a.name },
                toLocation: { lat: b.lat, lon: b.lon, to: b.name },
                radius: 1.045,
                segments: 48,
                useArc: true,
                lateralOffset: lane * 0.01,
                parent: globe,
                lineConfig: {
                    radius: 0.0016,
                    color: 0xe53935,
                    opacity: 0.7,
                    userDataKey: 'isPlaneRouteLine',
                    visible: planeRoutesOn
                }
            });
        };

        const explicit = this.dataModel.getAirportConnections?.() || [];
        for (let i = 0; i < explicit.length; i++) {
            const conn = explicit[i];
            drawEdge(byName.get(conn.from), byName.get(conn.to));
        }

        // Fill orphans so lonely airports still get a couple of corridors
        const minD = 0.2;
        const maxD = 1.85;
        airports.forEach((a) => {
            if (linked.has(a.name)) return;
            const ranked = [];
            for (let i = 0; i < airports.length; i++) {
                const b = airports[i];
                if (!b || b === a || b.name === a.name) continue;
                const pa = latLonToVector3(a.lat, a.lon, 1);
                const pb = latLonToVector3(b.lat, b.lon, 1);
                const d = pa.distanceTo(pb);
                if (d < minD || d > maxD) continue;
                ranked.push({ b, d });
            }
            ranked.sort((u, v) => u.d - v.d);
            ranked.slice(0, 2).forEach(({ b }) => drawEdge(a, b));
        });
    },

    /**
     * @param {'plane'|'boat'} kind
     * @param {boolean} visible
     */
    setTransportRoutesVisible(kind, visible) {
        const globe = this.sceneModel.getGlobe();
        const scene = this.sceneModel.getScene?.() || this.sceneModel.scene;
        const on = !!visible;
        if (kind === 'boat') this.sceneModel.setBoatRoutesVisible?.(on);
        else this.sceneModel.setPlaneRoutesVisible?.(on);

        const lineFlag = kind === 'boat' ? 'isSeaportConnectionLine' : 'isPlaneRouteLine';
        const markerFlags = kind === 'boat'
            ? ['isSeaportMarker', 'isSeaportMarkerPin', 'isBoatViaMarker']
            : ['isAirportMarker', 'isAirportMarkerPin'];

        const apply = (root) => {
            if (!root?.traverse) return;
            root.traverse((obj) => {
                const ud = obj?.userData;
                if (!ud) return;
                if (ud[lineFlag]) {
                    obj.visible = on;
                    return;
                }
                for (let i = 0; i < markerFlags.length; i++) {
                    if (ud[markerFlags[i]]) {
                        obj.visible = on;
                        return;
                    }
                }
            });
        };
        apply(globe);
        apply(scene);

        // Keep sceneModel marker list in sync (hyperloop pass reads these)
        const markers = this.sceneModel.getMarkers?.() || [];
        for (let i = 0; i < markers.length; i++) {
            const m = markers[i];
            const ud = m?.userData;
            if (!ud) continue;
            if (kind === 'boat' && ud.isSeaportMarker) m.visible = on;
            if (kind === 'plane' && ud.isAirportMarker) m.visible = on;
        }
    },

    addSatelliteMarkers(satellites) {
        const markers = this.sceneModel.getMarkers();

        satellites.forEach(satellite => {
            const data = satellite.userData;
            if (!data || !data.isSatellite) return;
            
            // Create marker for satellite (smaller than city markers)
            const markerGeometry = new THREE.SphereGeometry(0.003, 12, 12);
            const markerMaterial = new THREE.MeshBasicMaterial({
                color: 0x9b59b6 // Purple to match orbit lines
            });
            
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.userData = {
                satellite: data.name,
                satelliteType: data.type,
                isSatelliteMarker: true,
                parentSatellite: satellite
            };
            
            // Hide satellite markers (they were showing as dots)
            marker.visible = false;
            
            // Marker will be positioned relative to satellite (follows it)
            satellite.add(marker);
            markers.push(marker);
        });
    }
};
