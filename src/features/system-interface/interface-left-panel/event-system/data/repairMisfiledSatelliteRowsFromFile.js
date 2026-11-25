/**
 * Heal story-timeline slots overwritten by satellite (hero/faction/NPC) archive rows.
 *
 * Two failure modes:
 *   1. Raw stubs (`npcCategory` / no year) sitting in `timelineEvents`.
 *   2. Stubs that later received story year/era via mergeTimelineMetadataFromFile —
 *      shape checks miss them, but the names (Lanet / Nameless) are still wrong.
 *
 * Always prefer the bundled file row at the same index when the local name is a
 * known misfile or still satellite-shaped while the file row is a real story event.
 */

/** Lowercase names that must never appear as main-timeline story events. */
export const KNOWN_MISFILED_STORY_NAMES = new Set([
    'lanet',
    'nameless',
]);

/**
 * @param {unknown} row
 * @returns {string}
 */
function rowName(row) {
    return row && row.name != null ? String(row.name).trim() : '';
}

/**
 * @param {unknown} row
 * @returns {boolean}
 */
export function isSatelliteShapedTimelineRow(row) {
    if (!row || typeof row !== 'object') return false;
    const hasNpcCategory = row.npcCategory != null && String(row.npcCategory).trim() !== '';
    const hasHeroRole = row.heroRole != null && String(row.heroRole).trim() !== '';
    const hasFactionType = row.factionType != null && String(row.factionType).trim() !== '';
    const hasYear = row.yearStart != null && String(row.yearStart).trim() !== '';
    const hasEra = row.eraName != null && String(row.eraName).trim() !== '';
    const hasCoords =
        (row.lat != null && row.lon != null)
        || (row.x != null && row.y != null);
    if ((hasNpcCategory || hasHeroRole || hasFactionType) && !hasYear && !hasEra && !hasCoords) {
        return true;
    }
    if (hasNpcCategory && !hasYear) return true;
    return false;
}

/**
 * @param {unknown} row
 * @returns {boolean}
 */
function isStoryShapedTimelineRow(row) {
    if (!row || typeof row !== 'object') return false;
    if (isSatelliteShapedTimelineRow(row)) return false;
    const hasYear = row.yearStart != null && String(row.yearStart).trim() !== '';
    const hasEra = row.eraName != null && String(row.eraName).trim() !== '';
    const hasCoords =
        (row.lat != null && row.lon != null)
        || (row.x != null && row.y != null);
    return hasYear || hasEra || hasCoords;
}

/**
 * @param {unknown} localRow
 * @param {unknown} fileRow
 * @returns {boolean}
 */
function shouldReplaceLocalWithFileRow(localRow, fileRow) {
    if (!isStoryShapedTimelineRow(fileRow)) return false;
    const local = rowName(localRow);
    const file = rowName(fileRow);
    if (!file) return false;
    if (KNOWN_MISFILED_STORY_NAMES.has(local.toLowerCase()) && local.toLowerCase() !== file.toLowerCase()) {
        return true;
    }
    if (isSatelliteShapedTimelineRow(localRow)) return true;
    /* npcCategory leftover even after year/era were merged onto the stub */
    if (
        localRow
        && typeof localRow === 'object'
        && localRow.npcCategory != null
        && String(localRow.npcCategory).trim() !== ''
        && local.toLowerCase() !== file.toLowerCase()
    ) {
        return true;
    }
    return false;
}

/**
 * @param {unknown[]} events
 * @param {unknown[]|null} fileEvents
 * @returns {unknown[]}
 */
export function repairMisfiledSatelliteRowsFromFile(events, fileEvents) {
    if (!Array.isArray(events) || events.length === 0) return events || [];
    if (!Array.isArray(fileEvents) || fileEvents.length === 0) return events;

    let changed = false;
    const out = events.map((row, index) => {
        const fileRow = fileEvents[index];
        if (!shouldReplaceLocalWithFileRow(row, fileRow)) return row;
        changed = true;
        return { ...fileRow };
    });

    /* Also catch misfiled names that drifted to a different index than the file slot. */
    if (changed) {
        return out;
    }

    const byFileName = new Map();
    for (let i = 0; i < fileEvents.length; i++) {
        const n = rowName(fileEvents[i]).toLowerCase();
        if (n) byFileName.set(n, i);
    }

    const drifted = events.slice();
    for (let i = 0; i < drifted.length; i++) {
        const n = rowName(drifted[i]).toLowerCase();
        if (!KNOWN_MISFILED_STORY_NAMES.has(n)) continue;
        /* Prefer same index from file; otherwise leave — index map above already covered equal-length. */
        const fileRow = fileEvents[i];
        if (isStoryShapedTimelineRow(fileRow) && rowName(fileRow).toLowerCase() !== n) {
            drifted[i] = { ...fileRow };
            changed = true;
        }
    }

    return changed ? drifted : events;
}
