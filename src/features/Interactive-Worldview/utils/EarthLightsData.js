/**
 * City / hub coordinates for Earth night-lights: transport infrastructure + Earth event locations.
 */

/** Hubs at |lat| ≥ this are treated as polar (North/South Pole stations, etc.). */
const EXCLUDE_POLE_LAT = 89;

/**
 * No city lights: poles, Antarctic fiction/event pins, or bad coordinates.
 * @param {{ lat: number, lon: number, name?: string }} h
 * @returns {boolean}
 */
export function isExcludedEarthLightHub(h) {
    if (!h || !Number.isFinite(h.lat) || !Number.isFinite(h.lon)) return true;
    if (h.lon < -180 || h.lon > 180) return true;
    if (Math.abs(h.lat) >= EXCLUDE_POLE_LAT) return true;

    const n = String(h.name || '').toLowerCase();
    if (n.includes('north pole station') || n.includes('south pole station')) return true;
    if (n.includes('secret omnium')) return true;
    if ((n.includes('ecoopint') && n.includes('antartica')) || (n.includes('ecopoint') && n.includes('antarctica'))) {
        return true;
    }

    if (Math.abs(h.lat - -75.1) < 0.3 && Math.abs(h.lon - 123.35) < 0.3) return true;

    /* Lights-only: sparse / overlit fiction or overlapping Caribbean pins (transport & events unchanged). */
    if (n.includes('great basin')) return true;
    if (n.includes('grand mesa')) return true;
    if (n.includes('haiti')) return true;
    if (n.includes('tortuga')) return true;
    if (n.includes('port-au-prince') || n.includes('port-de-paix')) return true;

    if (n.includes('grímsvötn') || n.includes('grimsvotn')) return true;
    if (n.includes('kerguelen')) return true;
    if (n.includes('apia') && n.includes('samoa')) return true;
    if (n.includes('junkertown')) return true;
    if (n.includes('outback wasteland') || n.includes('the outback, australia')) return true;

    return false;
}

/**
 * Extra hubs only for city-light scatter (sparse real-world anchors).
 * @type {Array<{ lat: number, lon: number, name: string }>}
 */
export const SUPPLEMENTAL_EARTH_LIGHT_HUBS = [
    { lat: 8.4657, lon: -13.2317, name: 'Freetown, Sierra Leone' },
    { lat: 41.7151, lon: 44.8271, name: 'Tbilisi, Georgia' },
    { lat: 40.1792, lon: 44.4991, name: 'Yerevan, Armenia' },
    { lat: 40.4093, lon: 49.8671, name: 'Baku, Azerbaijan' },
    { lat: 4.1755, lon: 73.5093, name: 'Malé, Maldives' },
    { lat: 51.1694, lon: 71.4491, name: 'Astana, Kazakhstan' },
    { lat: 43.222, lon: 76.8512, name: 'Almaty, Kazakhstan' },
    { lat: 41.2995, lon: 69.2401, name: 'Tashkent, Uzbekistan' },
    { lat: 34.5553, lon: 69.2075, name: 'Kabul, Afghanistan' },
    { lat: 37.9601, lon: 58.3261, name: 'Ashgabat, Turkmenistan' },
    { lat: 43.8171, lon: 125.3235, name: 'Changchun, China' }
];

/**
 * @param {number} lat
 * @param {number} lon
 * @param {number} south
 * @param {number} north
 * @param {number} west
 * @param {number} east
 */
function inLatLonBox(lat, lon, south, north, west, east) {
    if (lat < south || lat > north) return false;
    if (west <= east) return lon >= west && lon <= east;
    return lon >= west || lon <= east;
}

/**
 * Drop scattered dots that would land in North Korea (Seoul/Busan hubs use a wide disk).
 * @param {number} lat
 * @param {number} lon
 * @returns {boolean}
 */
export function isLatLonSuppressedNorthKorea(lat, lon) {
    if (lat < 38.0 || lat > 43.6 || lon < 124.0 || lon > 130.85) return false;
    if (lat >= 38.0 && lat <= 38.95 && lon >= 127.35 && lon <= 129.65) return false;
    if (lat < 38.75 && lon < 127.45) return false;
    return true;
}

/**
 * Interior Australia: suppress scatter from coastal hubs landing in empty desert.
 * @param {number} lat
 * @param {number} lon
 * @returns {boolean}
 */
export function isLatLonSuppressedAustralianInterior(lat, lon) {
    return inLatLonBox(lat, lon, -32.5, -19.5, 125.5, 141.0);
}

/**
 * @param {number} lat
 * @param {number} lon
 * @returns {boolean}
 */
export function isLatLonSuppressedForEarthLights(lat, lon) {
    return isLatLonSuppressedNorthKorea(lat, lon) || isLatLonSuppressedAustralianInterior(lat, lon);
}

/**
 * Per-hub multiplier for instanced city-light count (1 = default).
 * @param {number} lat
 * @param {number} lon
 * @param {string} [name]
 * @returns {number}
 */
export function getEarthLightsPerHubMultiplier(lat, lon, name) {
    const n = String(name || '').toLowerCase();
    let m = 1.0;

    if (inLatLonBox(lat, lon, 63.0, 66.9, -24.5, -12.0)) m *= 0.14;

    if (inLatLonBox(lat, lon, 49.0, 60.9, -10.8, 2.2)) m *= 0.74;
    if (inLatLonBox(lat, lon, 41.0, 51.2, -5.5, 9.8)) m *= 0.8;
    if (inLatLonBox(lat, lon, 47.0, 55.2, 5.8, 15.2)) m *= 0.8;
    if (inLatLonBox(lat, lon, 36.5, 47.6, 6.5, 18.8)) m *= 0.8;

    if (inLatLonBox(lat, lon, 40.8, 45.5, 39.5, 51.5)) m *= 1.55;

    if (inLatLonBox(lat, lon, 29.2, 31.6, 29.5, 33.2)) m *= 0.32;

    if (inLatLonBox(lat, lon, 12.0, 25.8, 41.0, 62.0)) m *= 0.38;

    if (inLatLonBox(lat, lon, 31.5, 37.8, 35.5, 42.2)) m *= 1.42;
    if (inLatLonBox(lat, lon, 29.5, 38.2, 38.5, 49.0)) m *= 1.38;
    if (inLatLonBox(lat, lon, 25.0, 40.0, 44.0, 63.5)) m *= 1.22;

    if (inLatLonBox(lat, lon, 54.0, 76.0, 27.0, 180.0)) m *= 1.32;
    if (inLatLonBox(lat, lon, 54.0, 76.0, -180.0, -168.0)) m *= 1.32;

    if (inLatLonBox(lat, lon, -47.5, -33.5, 166.0, 179.5)) {
        if (lat > -39.0) m *= 0.58;
        else if (lat < -43.0) m *= 1.38;
    }

    if (n.includes('noumea')) m *= 0.22;

    if (inLatLonBox(lat, lon, 30.0, 46.0, 129.0, 146.0)) m *= 0.84;
    if (inLatLonBox(lat, lon, 33.0, 38.95, 124.0, 132.0)) m *= 0.9;

    return Math.max(0, Math.min(2.6, m));
}

/**
 * @param {string} name
 * @param {import('../features/Interactive-Worldview/domain/models/DataModel.js').DataModel} dataModel
 * @returns {{ lat: number, lon: number, name: string }|null}
 */
export function resolveCityOrFictional(name, dataModel) {
    if (!name || !dataModel) return null;
    const city = dataModel.getCity(name);
    if (city && Number.isFinite(city.lat) && Number.isFinite(city.lon)) {
        return { lat: city.lat, lon: city.lon, name: city.name };
    }
    const list = dataModel.fictionalCities || [];
    const f = list.find((c) => c.name === name);
    if (f && Number.isFinite(f.lat) && Number.isFinite(f.lon)) {
        return { lat: f.lat, lon: f.lon, name: f.name };
    }
    return null;
}

/**
 * @param {import('../features/Interactive-Worldview/domain/models/DataModel.js').DataModel} dataModel
 * @returns {Array<{ lat: number, lon: number, name: string, kinds: string[] }>}
 */
export function collectEarthLightHubs(dataModel) {
    if (!dataModel) return [];

    const byKey = new Map();

    const add = (lat, lon, name, kind) => {
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
        let h = byKey.get(key);
        if (!h) {
            h = { lat, lon, name: name || key, kinds: new Set() };
            byKey.set(key, h);
        }
        h.kinds.add(kind);
        if (name && String(name).length > String(h.name).length) h.name = name;
    };

    const train = dataModel.getTrainConnections() || [];
    for (const c of train) {
        for (const end of [c.from, c.to]) {
            const r = resolveCityOrFictional(end, dataModel);
            if (r) add(r.lat, r.lon, r.name, 'station');
        }
    }

    const secondary = dataModel.getSecondaryConnections() || [];
    for (const c of secondary) {
        for (const end of [c.from, c.to]) {
            const r = resolveCityOrFictional(end, dataModel);
            if (r) add(r.lat, r.lon, r.name, 'air_route');
        }
    }

    const boat = dataModel.getSeaportConnections() || [];
    for (const c of boat) {
        for (const end of [c.from, c.to]) {
            const port = dataModel.getSeaport(end);
            if (port && Number.isFinite(port.lat) && Number.isFinite(port.lon)) {
                add(port.lat, port.lon, port.name, 'port');
            }
        }
    }

    const airports = dataModel.getAllAirports() || [];
    for (const a of airports) {
        if (a && Number.isFinite(a.lat) && Number.isFinite(a.lon)) {
            add(a.lat, a.lon, a.name, 'airport');
        }
    }

    const events = dataModel.getAllEvents() || [];
    for (const ev of events) {
        if (!ev) continue;
        const baseType = ev.locationType || 'earth';

        const pushEarth = (lat, lon, label) => {
            if (lat == null || lon == null) return;
            add(lat, lon, label || 'event', 'event');
        };

        if (baseType === 'earth' && ev.variants && ev.variants.length) {
            for (const v of ev.variants) {
                const lt = v.locationType || baseType;
                if (lt !== 'earth') continue;
                pushEarth(v.lat, v.lon, v.cityDisplayName || ev.cityDisplayName || ev.name);
            }
        } else if (baseType === 'earth') {
            pushEarth(ev.lat, ev.lon, ev.cityDisplayName || ev.name);
        }
    }

    for (const s of SUPPLEMENTAL_EARTH_LIGHT_HUBS) {
        if (!isExcludedEarthLightHub(s)) add(s.lat, s.lon, s.name, 'supplemental');
    }

    return Array.from(byKey.values())
        .filter((h) => !isExcludedEarthLightHub(h))
        .map((h) => ({
            lat: h.lat,
            lon: h.lon,
            name: h.name,
            kinds: Array.from(h.kinds).sort()
        }));
}

/**
 * Random offset in degrees (approx. uniform disk) for scatter around a hub.
 * @param {number} lat
 * @param {number} lon
 * @param {number} radiusDeg
 */
export function randomLatLonInDisk(lat, lon, radiusDeg) {
    const u = Math.random();
    const v = Math.random();
    const r = radiusDeg * Math.sqrt(u);
    const t = 2 * Math.PI * v;
    const dLat = r * Math.cos(t);
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const safeCos = Math.abs(cosLat) < 0.08 ? 0.08 : cosLat;
    const dLon = (r * Math.sin(t)) / safeCos;
    return { lat: lat + dLat, lon: lon + dLon };
}
