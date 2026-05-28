/**
 * Data Archive categories supported in Biography mode chip strip.
 */

/** @typedef {'heroes'|'factions'|'npcs'|'locations'} BioBiographyArchiveCategory */

/** @type {readonly BioBiographyArchiveCategory[]} */
export const BIO_BIOGRAPHY_ARCHIVE_CATEGORIES = Object.freeze([
    'heroes',
    'factions',
    'npcs',
    'locations',
]);

/** @type {Record<BioBiographyArchiveCategory, string>} */
export const BIO_BIOGRAPHY_CATEGORY_LABELS = Object.freeze({
    heroes: 'Heroes',
    factions: 'Factions',
    npcs: 'NPCs',
    locations: 'Locations',
});

/** @type {Record<BioBiographyArchiveCategory, string>} */
export const BIO_BIOGRAPHY_CATEGORY_ARIA = Object.freeze({
    heroes: 'Heroes archive',
    factions: 'Factions archive',
    npcs: 'NPCs archive',
    locations: 'Locations archive',
});

/**
 * @param {string} raw
 * @returns {BioBiographyArchiveCategory}
 */
export function normalizeBioBiographyCategory(raw) {
    const k = String(raw || '').trim().toLowerCase();
    if (k === 'factions' || k === 'faction') return 'factions';
    if (k === 'npcs' || k === 'npc') return 'npcs';
    if (k === 'locations' || k === 'location') return 'locations';
    return 'heroes';
}
