/**
 * Locate a row in the currently-loaded Data Archive list (`mgr.events`) by name.
 * Each archive uses its own matching policy (loose for heroes, FactionMatchHelpers for factions, etc.).
 * @param {object} mgr — EventManager
 */

function normalizeArchiveNameLoose(s) {
    return String(s || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function heroArchiveNamesLooselyEqual(a, b) {
    const na = normalizeArchiveNameLoose(a);
    const nb = normalizeArchiveNameLoose(b);
    if (na && na === nb) return true;
    const la = na.replace(/:/g, '').replace(/\s/g, '');
    const lb = nb.replace(/:/g, '').replace(/\s/g, '');
    return la.length > 0 && la === lb;
}

/** @returns {number} -1 when not found */
export function findHeroArchiveEventIndex(mgr, heroNameFromFilter) {
    const events = mgr.events;
    if (!Array.isArray(events) || !events.length) return -1;
    for (let i = 0; i < events.length; i += 1) {
        const rowName = events[i] && events[i].name != null ? String(events[i].name) : '';
        if (heroArchiveNamesLooselyEqual(rowName, heroNameFromFilter)) return i;
    }
    return -1;
}

/** @returns {number} -1 when not found */
export function findFactionArchiveEventIndex(mgr, nameFromFilter) {
    const events = mgr.events;
    const raw = String(nameFromFilter || '').trim();
    if (!Array.isArray(events) || !events.length || !raw) return -1;
    const fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
    for (let i = 0; i < events.length; i += 1) {
        const rowName = events[i] && events[i].name != null ? String(events[i].name).trim() : '';
        if (!rowName) continue;
        if (fh && typeof fh.factionIdsMatch === 'function') {
            if (fh.factionIdsMatch(rowName, raw)) return i;
        } else if (rowName.toLowerCase() === raw.toLowerCase()) {
            return i;
        }
    }
    return -1;
}

/** @returns {number} -1 when not found */
export function findNpcArchiveEventIndex(mgr, nameFromFilter) {
    const events = mgr.events;
    const raw = String(nameFromFilter || '').trim();
    if (!Array.isArray(events) || !events.length || !raw) return -1;
    const nb = normalizeArchiveNameLoose(raw);
    for (let i = 0; i < events.length; i += 1) {
        const rowName = events[i] && events[i].name != null ? String(events[i].name) : '';
        const na = normalizeArchiveNameLoose(rowName);
        if (na && na === nb) return i;
    }
    return -1;
}

/** @returns {number} -1 when not found */
export function findLocationArchiveEventIndex(mgr, locationNameToken) {
    const want = String(locationNameToken || '').trim().toLowerCase();
    if (!want) return -1;
    const events = mgr.events || [];
    for (let i = 0; i < events.length; i += 1) {
        const rowName = events[i] && events[i].name != null ? String(events[i].name).trim().toLowerCase() : '';
        if (rowName && rowName === want) return i;
    }
    return -1;
}
