/**
 * How many timeline entities reference each flag file (primary, secondary, or
 * explicit `countries[]`). Used to hide unused country chips and grey out
 * zero-match countries during search.
 */

function getCollectCountryFlagsFn() {
    const lh = typeof window !== 'undefined' ? window.LocationFlagHelpers : null;
    if (lh && typeof lh.collectCountryFlagFilesForEntity === 'function') {
        return lh.collectCountryFlagFilesForEntity.bind(lh);
    }
    const sec = typeof window !== 'undefined' ? window.__SecondaryCountryFlags : null;
    if (sec && typeof sec.collectCountryFlagFilesForEntity === 'function') {
        return sec.collectCountryFlagFilesForEntity.bind(sec);
    }
    return null;
}

/**
 * @param {Array<Object>|null|undefined} events
 * @returns {Map<string, number>} flag filename → event count
 */
export function buildCountryFilterUsageMap(events) {
    const counts = new Map();
    const collect = getCollectCountryFlagsFn();
    if (!collect || !Array.isArray(events)) return counts;

    for (const ev of events) {
        const files = collect(ev);
        if (!Array.isArray(files) || files.length === 0) continue;
        const seen = new Set();
        for (const raw of files) {
            const flagFile = String(raw || '').trim();
            if (!flagFile || seen.has(flagFile)) continue;
            seen.add(flagFile);
            counts.set(flagFile, (counts.get(flagFile) || 0) + 1);
        }
    }
    return counts;
}

/** @param {Map<string, number>} usageMap @param {string} flagFile */
export function getCountryEventMatchCount(usageMap, flagFile) {
    if (!usageMap || !flagFile) return 0;
    return usageMap.get(String(flagFile).trim()) || 0;
}
