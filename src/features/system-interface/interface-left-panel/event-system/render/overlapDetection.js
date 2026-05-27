/**
 * Detect events that share a location within the same globe page (10-event chronological group).
 *
 * Overlap = same `nameKey` OR same `coordKey` within a chunk of 10 consecutive events. We bucket
 * the full chronological event list into groups of 10 (`Math.floor(idx / 10)`) so the rendered
 * badges match the globe's pagination — flagging a #3 + #14 pair would be misleading because
 * they never share a globe page.
 *
 * For multi-variant events we always pick the **first** variant's location: the main marker on
 * the globe is the primary location, even if the manager card is previewing variant 2.
 *
 * Station / MarsShip skip name-keying unless the event sets `cityDisplayName` explicitly,
 * otherwise every ISS or escape-ship event would falsely register as an overlap.
 *
 * @typedef {{ getLocationName?: (lat:number, lon:number) => string|null }} OverlapResolver
 */

function normalizeLocationNameForOverlap(name) {
    if (!name || typeof name !== 'string') return null;
    const normalized = name.replace(/\s+/g, ' ').trim().toLowerCase();
    return normalized.length ? normalized : null;
}

/** @param {Record<string, any>} event @param {OverlapResolver|null} resolver */
function getPrimaryLocationForOverlap(event, resolver) {
    const isMultiEvent = !!(event && event.variants && event.variants.length > 0);
    const base = isMultiEvent ? event.variants[0] : event;
    const locationType = base.locationType || event.locationType || 'earth';

    const lat = locationType === 'earth'
        ? (base.lat !== undefined ? base.lat : event.lat)
        : undefined;
    const lon = locationType === 'earth'
        ? (base.lon !== undefined ? base.lon : event.lon)
        : undefined;
    const x = (locationType !== 'earth' && locationType !== 'station' && locationType !== 'marsShip')
        ? (base.x !== undefined ? base.x : event.x)
        : undefined;
    const y = (locationType !== 'earth' && locationType !== 'station' && locationType !== 'marsShip')
        ? (base.y !== undefined ? base.y : event.y)
        : undefined;

    let locationName = base.cityDisplayName || event.cityDisplayName || null;

    // Earth fallback: look up by coordinates via the resolver.
    if (!locationName && locationType === 'earth' && lat !== undefined && lon !== undefined) {
        if (resolver && typeof resolver.getLocationName === 'function') {
            locationName = resolver.getLocationName(lat, lon);
        }
    }

    // Station/MarsShip: drop the name key unless explicitly set, so the default labels
    // ("Space Station (ISS)", etc.) don't auto-flag every entry as overlapping.
    if ((locationType === 'station' || locationType === 'marsShip') && !base.cityDisplayName && !event.cityDisplayName) {
        locationName = null;
    }

    return { locationType, lat, lon, x, y, locationName };
}

/** @param {Record<string, any>} event @param {OverlapResolver|null} resolver */
function getOverlapKeysForEvent(event, resolver) {
    const { locationType, lat, lon, x, y, locationName } = getPrimaryLocationForOverlap(event, resolver);
    const nameKey = normalizeLocationNameForOverlap(locationName);

    let coordKey = null;
    if (locationType === 'earth' && Number.isFinite(lat) && Number.isFinite(lon)) {
        coordKey = `earth:${lat.toFixed(4)},${lon.toFixed(4)}`;
    } else if ((locationType === 'moon' || locationType === 'mars') && Number.isFinite(x) && Number.isFinite(y)) {
        coordKey = `${locationType}:${x.toFixed(1)},${y.toFixed(1)}`;
    }
    // Station has no stable coordinates → no coordKey.

    return { nameKey, coordKey };
}

/**
 * Returns the set of full-list indices that overlap any sibling within their globe page.
 * `eventsToRender` is currently unused but kept so callers can pass the rendered slice
 * (debug logging or future per-page optimisations).
 *
 * @param {Array<Record<string, any>>} _eventsToRender
 * @param {Array<Record<string, any>>} fullList
 * @param {OverlapResolver|null} resolver
 * @returns {Set<number>}
 */
export function computeOverlapIndexSet(_eventsToRender, fullList, resolver) {
    const groups = new Map(); // groupId → { nameMap, coordMap }

    const add = (map, key, idx) => {
        if (!key) return;
        const arr = map.get(key);
        if (arr) arr.push(idx);
        else map.set(key, [idx]);
    };

    fullList.forEach((event, actualIndex) => {
        const groupId = Math.floor(actualIndex / 10);
        if (!groups.has(groupId)) {
            groups.set(groupId, { nameMap: new Map(), coordMap: new Map() });
        }
        const { nameKey, coordKey } = getOverlapKeysForEvent(event, resolver);
        const group = groups.get(groupId);
        add(group.nameMap, nameKey, actualIndex);
        add(group.coordMap, coordKey, actualIndex);
    });

    const overlaps = new Set();
    const markDuplicates = (m) => {
        for (const arr of m.values()) {
            if (arr.length > 1) {
                arr.forEach((idx) => overlaps.add(idx));
            }
        }
    };

    for (const group of groups.values()) {
        markDuplicates(group.nameMap);
        markDuplicates(group.coordMap);
    }

    return overlaps;
}
