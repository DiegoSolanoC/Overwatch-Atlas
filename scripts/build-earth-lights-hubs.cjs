/**
 * Builds data/earth-lights-hubs.json — same hub rules as src/features/Interactive-Worldview/utils/EarthLightsData.js (transport + events).
 * Run from repo root: node scripts/build-earth-lights-hubs.cjs
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const locationsPath = path.join(root, 'src', 'data', 'locations.json');
const connectionsPath = path.join(root, 'src', 'data', 'connections.json');
const eventsPath = path.join(root, 'src', 'data', 'events.json');
const outPath = path.join(root, 'src', 'data', 'earth-lights-hubs.json');

/** Keep in sync with src/features/Interactive-Worldview/utils/EarthLightsData.js — isExcludedEarthLightHub */
function isExcludedEarthLightHub(h) {
    if (!h || !Number.isFinite(h.lat) || !Number.isFinite(h.lon)) return true;
    if (h.lon < -180 || h.lon > 180) return true;
    if (Math.abs(h.lat) >= 89) return true;
    const n = String(h.name || '').toLowerCase();
    if (n.includes('north pole station') || n.includes('south pole station')) return true;
    if (n.includes('secret omnium')) return true;
    if ((n.includes('ecoopint') && n.includes('antartica')) || (n.includes('ecopoint') && n.includes('antarctica'))) {
        return true;
    }
    if (Math.abs(h.lat - -75.1) < 0.3 && Math.abs(h.lon - 123.35) < 0.3) return true;
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

const SUPPLEMENTAL_EARTH_LIGHT_HUBS = [
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

function filterSeaports(seaports, seaportConnections) {
    const connectionCounts = {};
    seaports.forEach((port) => {
        connectionCounts[port.name] = 0;
    });
    seaportConnections.forEach((conn) => {
        if (Object.prototype.hasOwnProperty.call(connectionCounts, conn.from)) connectionCounts[conn.from]++;
        if (Object.prototype.hasOwnProperty.call(connectionCounts, conn.to)) connectionCounts[conn.to]++;
    });
    const remove = new Set();
    Object.keys(connectionCounts).forEach((name) => {
        if (connectionCounts[name] === 0) remove.add(name);
    });
    const ports = seaports.filter((p) => !remove.has(p.name));
    const conns = seaportConnections.filter((c) => !remove.has(c.from) && !remove.has(c.to));
    return { ports, conns };
}

function resolveCityLike(name, cities, fictionalCities) {
    const c = cities.find((x) => x.name === name);
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lon)) return { lat: c.lat, lon: c.lon, name: c.name };
    const f = fictionalCities.find((x) => x.name === name);
    if (f && Number.isFinite(f.lat) && Number.isFinite(f.lon)) return { lat: f.lat, lon: f.lon, name: f.name };
    return null;
}

function collectHubs(loc, conn, eventsList) {
    const cities = loc.cities || [];
    const fictionalCities = loc.fictionalCities || [];
    const airports = loc.airports || [];
    const { ports: seaports, conns: seaportConnections } = filterSeaports(loc.seaports || [], conn.seaportConnections || []);

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

    for (const c of conn.trainConnections || []) {
        for (const end of [c.from, c.to]) {
            const r = resolveCityLike(end, cities, fictionalCities);
            if (r) add(r.lat, r.lon, r.name, 'station');
        }
    }

    for (const c of conn.secondaryConnections || []) {
        for (const end of [c.from, c.to]) {
            const r = resolveCityLike(end, cities, fictionalCities);
            if (r) add(r.lat, r.lon, r.name, 'air_route');
        }
    }

    for (const c of seaportConnections) {
        for (const end of [c.from, c.to]) {
            const port = seaports.find((p) => p.name === end);
            if (port && Number.isFinite(port.lat) && Number.isFinite(port.lon)) {
                add(port.lat, port.lon, port.name, 'port');
            }
        }
    }

    for (const a of airports) {
        if (a && Number.isFinite(a.lat) && Number.isFinite(a.lon)) {
            add(a.lat, a.lon, a.name, 'airport');
        }
    }

    for (const ev of eventsList) {
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
            name: h.name,
            lat: h.lat,
            lon: h.lon,
            kinds: Array.from(h.kinds).sort()
        }));
}

function main() {
    const loc = JSON.parse(fs.readFileSync(locationsPath, 'utf8'));
    const conn = JSON.parse(fs.readFileSync(connectionsPath, 'utf8'));
    let eventsWrap = {};
    try {
        eventsWrap = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
    } catch (e) {
        console.warn('No events.json or read error:', e.message);
    }
    const eventsList = eventsWrap.events || [];

    const hubs = collectHubs(loc, conn, eventsList);
    hubs.sort((a, b) => a.name.localeCompare(b.name));

    const payload = {
        description:
            'City-light hubs: train + plane route cities, seaports with connections, all airports in locations.json, and Earth events (from data/events.json). App merges live EventManager events at runtime.',
        generated: new Date().toISOString(),
        count: hubs.length,
        hubs
    };

    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log('Wrote', outPath, '—', hubs.length, 'hubs');
}

main();
