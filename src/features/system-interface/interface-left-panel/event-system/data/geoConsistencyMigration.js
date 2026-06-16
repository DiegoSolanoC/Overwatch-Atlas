/**
 * Geographic label + coordinate consistency for story timeline events.
 * Applied on load/save so localStorage copies stay aligned with bundled JSON rules.
 */

/** @type {Readonly<Record<string, { lat: number, lon: number }>>} */
export const GEO_CANON = Object.freeze({
    tokyo: { lat: 35.6768601, lon: 139.7638947 },
    rome: { lat: 41.8933203, lon: 12.4829321 },
    venice: { lat: 45.4371908, lon: 12.3345898 },
    london: { lat: 51.5074456, lon: -0.1277653 },
    cairo: { lat: 30.0444, lon: 31.2357 },
    numbani: { lat: 12.0022, lon: 8.5919 },
    nyc: { lat: 40.7579554, lon: -73.9855319 },
    india: { lat: 23.2599, lon: 77.4126 },
    grandMesa: { lat: 39.1131257, lon: -108.0127646 },
    gibraltar: { lat: 36.1407517, lon: -5.345374 },
    paris: { lat: 48.8588897, lon: 2.320041 },
    tortuga: { lat: 20.0410035, lon: -72.785587 },
});

/**
 * @param {string} city
 * @returns {boolean}
 */
export function isJapanClusterCity(city) {
    return /,\s*Japan$/i.test(String(city || '').trim());
}

/**
 * @param {string} city
 * @returns {boolean}
 */
export function isRomeClusterCity(city) {
    return /rome|colosseo/i.test(String(city || ''));
}

/**
 * @param {Record<string, unknown>} obj
 * @param {{ lat: number, lon: number }} coords
 */
function applyCoords(obj, coords) {
    obj.lat = coords.lat;
    obj.lon = coords.lon;
}

/**
 * @param {string} s
 * @returns {string}
 */
export function fixGeoLocationLabel(s) {
    if (!s || typeof s !== 'string') return s;
    let out = s.trim();

    if (/^Watchpoint\s+[^:]+/.test(out) && !/^Watchpoint:\s/.test(out)) {
        out = out.replace(/^Watchpoint\s+/, 'Watchpoint: ');
    }
    if (/^Ecopoint\s+[^:]+/.test(out) && !/^Ecopoint:\s/.test(out)) {
        out = out.replace(/^Ecopoint\s+/, 'Ecopoint: ');
    }

    out = out.replace(/^London, England\b/, 'London, United Kingdom');
    out = out.replace(/^Rome,, Italy\b/, 'Rome, Italy');
    out = out.replace(/^Rome, Roma Capitale, Lazio, Italy\b/, 'Rome, Italy');
    out = out.replace(/^Akihabara, Taito, Tokyo.*$/i, 'Akihabara, Japan');
    out = out.replace(/^Port-de-Paix,, Haiti\b/, 'Port-de-Paix, Haiti');
    out = out.replace(/^Copenhagen,, Denmark\b/, 'Copenhagen, Denmark');
    out = out.replace(/^París, France\b/, 'Paris, France');
    out = out.replace(/^Lijiang City, China\b/, 'Lijiang, China');
    out = out.replace(/^Tortuga Island, Haiti\b/, 'Tortuga, Haiti');
    out = out.replace(/^Roud 66, United States\b/, 'Route 66, United States');
    out = out.replace(/^Manhattan, United States\b/, 'New York City, United States');
    out = out.replace(/^New York, United States\b/, 'New York City, United States');
    if (out === 'Numbani') out = 'City State of Numbani';
    if (out === 'Coral Sea') out = 'Coral Sea, Oceania';

    if (isRomeClusterCity(out) && !/colosseo/i.test(out)) out = 'Rome, Italy';
    if (/colosseo/i.test(out)) out = 'Colosseo, Italy';

    return out;
}

/**
 * @param {string} label
 * @param {Record<string, unknown>} obj
 */
export function applyGeoClusterCoords(label, obj) {
    const ln = String(label || '').trim();
    if (!ln) return;

    if (isJapanClusterCity(ln)) {
        applyCoords(obj, GEO_CANON.tokyo);
        return;
    }
    if (isRomeClusterCity(ln) || ln === 'Rome, Italy') {
        applyCoords(obj, GEO_CANON.rome);
        return;
    }
    if (/^Venice, Italy$/i.test(ln) || /^Serenza, Italy$/i.test(ln)) {
        applyCoords(obj, GEO_CANON.venice);
        return;
    }
    if (/^London, United Kingdom$/i.test(ln)) {
        applyCoords(obj, GEO_CANON.london);
        return;
    }
    if (/^Cairo, Egypt$/i.test(ln) || /^Necropolis, Egypt$/i.test(ln)) {
        applyCoords(obj, GEO_CANON.cairo);
        return;
    }
    if (/^City State of Numbani$/i.test(ln)) {
        applyCoords(obj, GEO_CANON.numbani);
        return;
    }
    if (/^New York City, United States$/i.test(ln)) {
        applyCoords(obj, GEO_CANON.nyc);
        return;
    }
    if (/^(Roshani|Suravasa|Utopea), India$/i.test(ln)) {
        applyCoords(obj, GEO_CANON.india);
        return;
    }
    if (/^Watchpoint: Gibraltar/i.test(ln)) {
        applyCoords(obj, GEO_CANON.gibraltar);
        return;
    }
    if (
        /^Watchpoint: Grand Mesa/i.test(ln)
        || /^Deadlock Gorge, United States$/i.test(ln)
        || /^Route 66, United States$/i.test(ln)
    ) {
        applyCoords(obj, GEO_CANON.grandMesa);
        return;
    }
    if (/^Paris, France$/i.test(ln)) {
        applyCoords(obj, GEO_CANON.paris);
        return;
    }
    if (/^Tortuga, Haiti$/i.test(ln)) {
        applyCoords(obj, GEO_CANON.tortuga);
    }
}

/**
 * @param {string} s
 * @returns {string}
 */
function fixGeoProseString(s) {
    if (!s || typeof s !== 'string') return s;
    let out = s;
    out = out.replace(/\bWatchpoint\s+(?!:)(?!branch\b)(?!system\b)/gi, 'Watchpoint: ');
    out = out.replace(/\bEcopoint\s+(?!:)(?!program\b)(?!Program\b)(?!Initiative\b)(?!bases\b)(?!facilities\b)/gi, 'Ecopoint: ');
    out = out.replace(/Watchpoint::\s*/g, 'Watchpoint: ');
    out = out.replace(/Ecopoint::\s*/g, 'Ecopoint: ');
    out = out.replace(/\bLondon, England\b/g, 'London, United Kingdom');
    out = out.replace(/\bRome,, Italy\b/g, 'Rome, Italy');
    out = out.replace(/\bRome, Roma Capitale, Lazio, Italy\b/g, 'Rome, Italy');
    return out;
}

/** @param {Record<string, unknown>} row */
function migratePlaceRow(row) {
    if (!row || typeof row !== 'object') return false;
    let changed = false;
    if (row.locationName) {
        const before = String(row.locationName);
        const after = fixGeoLocationLabel(before);
        if (after !== before) {
            row.locationName = after;
            changed = true;
        }
        applyGeoClusterCoords(after, row);
    }
    for (const key of ['country', 'reasoning']) {
        if (!(key in row) || typeof row[key] !== 'string') continue;
        const next = fixGeoProseString(row[key]);
        if (next !== row[key]) {
            row[key] = next;
            changed = true;
        }
    }
    return changed;
}

/** @param {Record<string, unknown>} event */
function migrateStoryEventNode(event) {
    if (!event || typeof event !== 'object') return false;
    let changed = false;

    if (typeof event.cityDisplayName === 'string') {
        const before = event.cityDisplayName;
        const after = fixGeoLocationLabel(before);
        if (after !== before) {
            event.cityDisplayName = after;
            changed = true;
        }
        applyGeoClusterCoords(after, event);
    }

    for (const key of ['name', 'description', 'eraName']) {
        if (typeof event[key] !== 'string') continue;
        const next = fixGeoProseString(event[key]);
        if (next !== event[key]) {
            event[key] = next;
            changed = true;
        }
    }

    for (const key of ['secondaryCountryPlaces', 'heroFilterPlaces', 'factionFilterPlaces']) {
        if (!Array.isArray(event[key])) continue;
        for (let i = 0; i < event[key].length; i += 1) {
            if (migratePlaceRow(event[key][i])) changed = true;
        }
    }

    if (Array.isArray(event.headlines)) {
        for (let i = 0; i < event.headlines.length; i += 1) {
            if (typeof event.headlines[i] !== 'string') continue;
            const next = fixGeoProseString(event.headlines[i]);
            if (next !== event.headlines[i]) {
                event.headlines[i] = next;
                changed = true;
            }
        }
    }

    return changed;
}

/**
 * @param {unknown[]} events
 * @returns {boolean}
 */
export function migrateGeoConsistencyInStoryEvents(events) {
    if (!Array.isArray(events)) return false;
    let changed = false;
    for (let i = 0; i < events.length; i += 1) {
        if (migrateStoryEventNode(events[i])) changed = true;
    }
    return changed;
}
