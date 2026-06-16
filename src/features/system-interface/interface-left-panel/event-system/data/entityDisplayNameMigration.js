/**
 * One-time renames applied to saved story events and bio-archive rows (including localStorage on GitHub Pages).
 * Longest match first so partial tokens are not left behind.
 */

/** @type {readonly [string, string][]} */
export const ENTITY_DISPLAY_NAME_REPLACEMENTS = Object.freeze([
    ['The Anubis Omnic Crisis', 'Anubis Directives'],
    ['Anubis Omnic Crisis', 'Anubis Directives'],
    ['12The Anubis Omnic Crisis', '12Anubis Directives'],
    ['Deep Sea Raiders', 'Deepsea Raiders'],
    ['28Deep Sea Raiders', '28Deepsea Raiders'],
    ['Deep Sea Raider', 'Deepsea Raider'],
    ['Colloseo Gladiatori', 'Colosseo Gladiatori'],
    ['17Colloseo Gladiatori', '17Colosseo Gladiatori'],
    ['Colloseo', 'Colosseo'],
    ['Chisaka', 'Chikasa'],
]);

/**
 * @param {unknown} value
 * @returns {string}
 */
export function migrateEntityDisplayNameString(value) {
    if (value == null) return '';
    let out = String(value);
    if (!out) return out;
    for (let i = 0; i < ENTITY_DISPLAY_NAME_REPLACEMENTS.length; i += 1) {
        const [from, to] = ENTITY_DISPLAY_NAME_REPLACEMENTS[i];
        if (out.includes(from)) {
            out = out.split(from).join(to);
        }
    }
    return out;
}

/**
 * @param {unknown} value
 * @returns {{ value: string, changed: boolean }}
 */
function migrateStringField(value) {
    const before = value == null ? '' : String(value);
    const after = migrateEntityDisplayNameString(before);
    return { value: after, changed: after !== before };
}

/** @param {unknown} rows */
function migratePlaceRows(rows) {
    if (!Array.isArray(rows)) return false;
    let changed = false;
    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (!row || typeof row !== 'object') continue;
        for (const key of ['locationName', 'country', 'reasoning']) {
            if (!(key in row)) continue;
            const next = migrateStringField(row[key]);
            if (next.changed) {
                row[key] = next.value;
                changed = true;
            }
        }
    }
    return changed;
}

/** @param {unknown} list */
function migrateStringList(list) {
    if (!Array.isArray(list)) return false;
    let changed = false;
    for (let i = 0; i < list.length; i += 1) {
        const next = migrateStringField(list[i]);
        if (next.changed) {
            list[i] = next.value;
            changed = true;
        }
    }
    return changed;
}

/** @param {Record<string, unknown>|null|undefined} node */
function migrateStoryEventNode(node) {
    if (!node || typeof node !== 'object') return false;
    let changed = false;

    for (const key of [
        'description',
        'previewBadgeMainCharacter',
        'previewBadgeSecondaryCharacters',
        'previewBadgeFaction',
    ]) {
        if (!(key in node)) continue;
        const next = migrateStringField(node[key]);
        if (next.changed) {
            node[key] = next.value;
            changed = true;
        }
    }

    if (migratePlaceRows(node.secondaryCountryPlaces)) changed = true;
    if (migratePlaceRows(node.heroFilterPlaces)) changed = true;
    if (migratePlaceRows(node.factionFilterPlaces)) changed = true;
    if (migratePlaceRows(node.npcFilterPlaces)) changed = true;
    if (migrateStringList(node.headlines)) changed = true;
    if (migrateStringList(node.filters)) changed = true;
    if (migrateStringList(node.npcs)) changed = true;
    if (migrateStringList(node.factions)) changed = true;

    if (Array.isArray(node.variants)) {
        for (let i = 0; i < node.variants.length; i += 1) {
            if (migrateStoryEventNode(node.variants[i])) changed = true;
        }
    }

    return changed;
}

/** @param {Record<string, unknown>|null|undefined} node */
function migrateBioArchiveEventNode(node) {
    if (!node || typeof node !== 'object') return false;
    let changed = false;

    const entryName = migrateStringField(node.name);
    if (entryName.changed) {
        node.name = entryName.value;
        changed = true;
    }

    const description = migrateStringField(node.description);
    if (description.changed) {
        node.description = description.value;
        changed = true;
    }

    if (migratePlaceRows(node.relevantLocations)) changed = true;

    if (Array.isArray(node.connections)) {
        for (let i = 0; i < node.connections.length; i += 1) {
            const conn = node.connections[i];
            if (!conn || typeof conn !== 'object') continue;
            const linked = migrateStringField(conn.name);
            if (linked.changed) {
                conn.name = linked.value;
                changed = true;
            }
            for (const key of [
                'reasoningSubjectToLinked',
                'reasoningLinkedToSubject',
                'reasoning',
            ]) {
                if (!(key in conn)) continue;
                const next = migrateStringField(conn[key]);
                if (next.changed) {
                    conn[key] = next.value;
                    changed = true;
                }
            }
            if (Array.isArray(conn.ranges)) {
                for (let j = 0; j < conn.ranges.length; j += 1) {
                    const range = conn.ranges[j];
                    if (!range || typeof range !== 'object') continue;
                    for (const key of [
                        'startEvent',
                        'endEvent',
                        'reasoningSubjectToLinked',
                        'reasoningLinkedToSubject',
                        'reasoning',
                    ]) {
                        if (!(key in range)) continue;
                        const next = migrateStringField(range[key]);
                        if (next.changed) {
                            range[key] = next.value;
                            changed = true;
                        }
                    }
                }
            }
        }
    }

    if (Array.isArray(node.variants)) {
        for (let i = 0; i < node.variants.length; i += 1) {
            if (migrateBioArchiveEventNode(node.variants[i])) changed = true;
        }
    }

    return changed;
}

/** @param {unknown[]} events @returns {boolean} */
export function migrateEntityDisplayNamesInStoryEvents(events) {
    if (!Array.isArray(events)) return false;
    let changed = false;
    for (let i = 0; i < events.length; i += 1) {
        if (migrateStoryEventNode(events[i])) changed = true;
    }
    return changed;
}

/** @param {unknown[]} events @returns {boolean} */
export function migrateEntityDisplayNamesInBioArchiveEvents(events) {
    if (!Array.isArray(events)) return false;
    let changed = false;
    for (let i = 0; i < events.length; i += 1) {
        if (migrateBioArchiveEventNode(events[i])) changed = true;
    }
    return changed;
}
