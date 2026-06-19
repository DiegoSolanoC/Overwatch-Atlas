/**
 * Faction filter / biography logo paths under
 * src/assets/images/Filters/Factions/<factionId>/<look>.png
 */

export const FACTION_IMAGE_ROOT = 'src/assets/images/Filters/Factions';
export const DEFAULT_FACTION_LOOK = 'Default';

/**
 * Default first, then A–Z.
 * @param {string[]} lookNames — basenames (no .png).
 * @returns {string[]}
 */
export function sortFactionLookNames(lookNames) {
    const seen = new Set();
    const unique = [];
    for (const name of lookNames) {
        const base = String(name).replace(/\.png$/i, '').trim();
        if (!base || seen.has(base)) continue;
        seen.add(base);
        unique.push(base);
    }
    const norm = (s) => s.toLowerCase();
    const defaults = unique.filter((x) => norm(x) === 'default');
    const rest = unique.filter((x) => norm(x) !== 'default');
    rest.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
    return [...defaults, ...rest];
}

/**
 * @param {string} factionFilename — manifest faction `filename` (folder name).
 * @param {string} [lookName]
 * @returns {string}
 */
export function buildFactionImagePath(factionFilename, lookName = DEFAULT_FACTION_LOOK) {
    const key = String(factionFilename || '').trim();
    const look = String(lookName || DEFAULT_FACTION_LOOK).trim();
    if (!key || !look) return '';
    return `${FACTION_IMAGE_ROOT}/${encodeURIComponent(key)}/${encodeURIComponent(look)}.png`;
}

/**
 * @param {string} factionFilename
 * @returns {string}
 */
export function buildFactionDefaultImagePath(factionFilename) {
    return buildFactionImagePath(factionFilename, DEFAULT_FACTION_LOOK);
}

/**
 * @param {*} item — `{ filename, look? }` or legacy `{ filename }`.
 * @param {string} [folder]
 * @returns {string}
 */
export function buildFactionFilterImagePath(item, folder = FACTION_IMAGE_ROOT) {
    const filename = item && item.filename != null ? String(item.filename).trim() : '';
    const look = item && item.look != null ? String(item.look).trim() : DEFAULT_FACTION_LOOK;
    if (!filename) return `${folder}/`;
    return `${folder}/${encodeURIComponent(filename)}/${encodeURIComponent(look)}.png`;
}
