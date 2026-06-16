/**
 * When localStorage wins on load, restore timeline rows that are still blank placeholders
 * on disk (e.g. after a git revert) but were filled in the browser cache.
 */

const PLACEHOLDER_DESC = 'No description available.';

/**
 * @param {unknown} row
 * @returns {boolean}
 */
function isBlankPlaceholderRow(row) {
    if (!row || typeof row !== 'object') return false;
    const desc = String(row.description ?? '').trim();
    if (desc !== PLACEHOLDER_DESC && desc !== '') return false;

    const hasHeadlines = Array.isArray(row.headlines) && row.headlines.length > 0;
    const hasSources = Array.isArray(row.sources) && row.sources.length > 0;
    const hasFilters = ['heroFilterPlaces', 'factionFilterPlaces', 'npcFilterPlaces', 'secondaryCountryPlaces']
        .some((key) => Array.isArray(row[key]) && row[key].length > 0);

    return !hasHeadlines && !hasSources && !hasFilters;
}

/**
 * @param {unknown} row
 * @returns {boolean}
 */
function localRowHasFilledContent(row) {
    if (!row || typeof row !== 'object') return false;
    const desc = String(row.description ?? '').trim();
    if (desc && desc !== PLACEHOLDER_DESC) return true;

    if (Array.isArray(row.headlines) && row.headlines.length > 0) return true;
    if (Array.isArray(row.sources) && row.sources.length > 0) return true;

    return ['heroFilterPlaces', 'factionFilterPlaces', 'npcFilterPlaces', 'secondaryCountryPlaces']
        .some((key) => Array.isArray(row[key]) && row[key].length > 0);
}

/**
 * @param {unknown[]} events
 * @param {unknown[]|null} fileEvents
 * @returns {unknown[]}
 */
export function repairStalePlaceholderRowsFromFile(events, fileEvents) {
    if (!Array.isArray(events) || events.length === 0) return events || [];
    if (!Array.isArray(fileEvents) || fileEvents.length === 0) return events;

    /** @type {Map<string, object>} */
    const fileByName = new Map();
    for (const row of fileEvents) {
        if (!row || typeof row !== 'object') continue;
        const name = String(row.name ?? '').trim().toLowerCase();
        if (name) fileByName.set(name, row);
    }

    let changed = false;
    const out = events.map((row) => {
        if (!row || typeof row !== 'object') return row;
        const name = String(row.name ?? '').trim().toLowerCase();
        if (!name) return row;

        const fileRow = fileByName.get(name);
        if (!fileRow || !isBlankPlaceholderRow(fileRow) || !localRowHasFilledContent(row)) {
            return row;
        }

        changed = true;
        return { ...row, ...fileRow };
    });

    return changed ? out : events;
}
