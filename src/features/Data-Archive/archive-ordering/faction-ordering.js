/**
 * Factions archive: canonical type order for Event Manager list, drag/drop, and stable resort.
 * Unknown / future types sort after known buckets and before empty ("None").
 * Modern ES6 module version of FactionArchiveGroupOrderHelpers.
 */

/** Canonical faction type order */
const FACTION_ARCHIVE_TYPE_ORDER = [
    'Major Player',
    'Criminal Groups',
    'Military Initiatives',
    'Research Institutions'
];

/** Lowercase collapsed whitespace → exact label from FACTION_ARCHIVE_TYPE_ORDER */
const FACTION_ARCHIVE_TYPE_ALIASES = {
    'major player': 'Major Player',
    'major players': 'Major Player',
    'criminal group': 'Criminal Groups',
    'criminal groups': 'Criminal Groups',
    'military initiative': 'Military Initiatives',
    'military initiatives': 'Military Initiatives',
    'military intiative': 'Military Initiatives',
    'military intiatives': 'Military Initiatives',
    'research institution': 'Research Institutions',
    'research institutions': 'Research Institutions',
    'research insitrutions': 'Research Institutions',
    'research insitutions': 'Research Institutions'
};

/**
 * Normalize faction type to canonical form.
 * @param {string} factionType
 * @returns {string}
 */
export function normalizeFactionArchiveType(factionType) {
    if (factionType == null) return '';
    const collapsed = String(factionType).trim().replace(/\s+/g, ' ');
    if (!collapsed) return '';
    const l = collapsed.toLowerCase();
    if (FACTION_ARCHIVE_TYPE_ALIASES[l]) return FACTION_ARCHIVE_TYPE_ALIASES[l];
    for (let i = 0; i < FACTION_ARCHIVE_TYPE_ORDER.length; i++) {
        const canon = FACTION_ARCHIVE_TYPE_ORDER[i];
        if (l === canon.toLowerCase()) return canon;
    }
    return collapsed;
}

/**
 * Get display label for faction type.
 * @param {string} factionType
 * @returns {string}
 */
export function displayLabelForFactionArchiveType(factionType) {
    const normalized = normalizeFactionArchiveType(factionType);
    return normalized || 'None';
}

/**
 * Get rank index for faction type.
 * @param {string} factionType
 * @returns {number}
 */
export function factionArchiveTypeRank(factionType) {
    const normalized = normalizeFactionArchiveType(factionType);
    const index = FACTION_ARCHIVE_TYPE_ORDER.indexOf(normalized);
    return index === -1 ? FACTION_ARCHIVE_TYPE_ORDER.length + 1 : index;
}

/**
 * Sort factions archive events stably.
 * @param {Array} events - Array of event objects with factionType property
 */
export function sortFactionsArchiveEventsStable(events) {
    events.sort((a, b) => {
        const rankA = factionArchiveTypeRank(a?.factionType);
        const rankB = factionArchiveTypeRank(b?.factionType);
        return rankA - rankB;
    });
}

/**
 * Move faction entry to last in its type group.
 * @param {Array} events - Array of events
 * @param {number} index - Index of event to move
 */
export function moveFactionEntryToLastInItsTypeGroup(events, index) {
    const targetEvent = events[index];
    if (!targetEvent) return;
    
    const targetType = normalizeFactionArchiveType(targetEvent.factionType);
    let groupEnd = index;
    
    // Find the end of this faction type group
    for (let i = index + 1; i < events.length; i++) {
        if (normalizeFactionArchiveType(events[i]?.factionType) === targetType) {
            groupEnd = i;
        } else {
            break;
        }
    }
    
    // Move to end of group
    if (groupEnd > index) {
        const [movedEvent] = events.splice(index, 1);
        events.splice(groupEnd, 0, movedEvent);
    }
}

// Legacy compatibility - attach to window for existing code
if (typeof window !== 'undefined') {
    window.FactionArchiveGroupOrderHelpers = {
        normalizeFactionArchiveType,
        displayLabelForFactionArchiveType,
        factionArchiveTypeRank,
        sortFactionsArchiveEventsStable,
        moveFactionEntryToLastInItsTypeGroup
    };
}
