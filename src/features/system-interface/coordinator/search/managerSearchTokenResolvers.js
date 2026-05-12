/**
 * Pure mappings from manifest filenames to the readable tokens used by the Event Manager
 * search inputs (#eventsSearchFilters / #eventsSearchCountry).
 */

/**
 * Faction manifest filename → readable display token (matches `parseFilterTokens`).
 * Falls back to a stripped filename so unknown entries still produce a usable token.
 * @param {object} mgr — EventManager (uses `mgr.factions` manifest)
 * @param {string} filename
 */
export function factionFilenameToDisplayToken(mgr, filename) {
    const fn = String(filename || '').trim();
    if (!fn) return '';
    const nk = fn.toLowerCase();
    const factions = mgr.factions || [];
    const f = factions.find((x) => String(x?.filename || '').toLowerCase() === nk);
    if (f?.displayName) return String(f.displayName).trim();
    const base = fn.replace(/\.png$/i, '').replace(/^\d+/, '').replace(/_/g, ' ').trim();
    return base || fn;
}

/**
 * `FLAG_FILE_BY_COMMON` value (e.g. `France.png`) → common name key for the country search input.
 * @param {string} flagFile
 * @returns {string|null}
 */
export function flagFilenameToCommonCountryName(flagFile) {
    const file = String(flagFile || '').trim();
    if (!file) return null;
    const map = typeof window !== 'undefined' ? window.FLAG_FILE_BY_COMMON : null;
    if (!map) return null;
    for (const common of Object.keys(map).sort()) {
        if (map[common] === file) return common;
    }
    return null;
}
