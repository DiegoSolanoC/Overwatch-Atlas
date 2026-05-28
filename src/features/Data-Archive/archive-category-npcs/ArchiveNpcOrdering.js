/**
 * NPCs archive: canonical category order for Event Manager list, filters, and biography strip.
 */

/** @type {readonly string[]} */
export const NPC_ARCHIVE_CATEGORY_ORDER = Object.freeze([
    'MEKA',
    'Phreaks',
    'Deadlock',
    'Yokai',
    'Shimada',
    'Junkers',
    'Lucheng',
    'Overwatch',
    'Talon',
    'Historical Figures',
    'Civilians',
    'Other',
]);

/** @type {Readonly<Record<string, string>>} */
const NPC_ARCHIVE_CATEGORY_ALIASES = Object.freeze({
    mka: 'MEKA',
    meka: 'MEKA',
    phreak: 'Phreaks',
    phreaks: 'Phreaks',
    deadlock: 'Deadlock',
    yokai: 'Yokai',
    shimada: 'Shimada',
    junker: 'Junkers',
    junkers: 'Junkers',
    lucheng: 'Lucheng',
    overwatch: 'Overwatch',
    talon: 'Talon',
    'historical figure': 'Historical Figures',
    'historical figures': 'Historical Figures',
    civilian: 'Civilians',
    civilians: 'Civilians',
    other: 'Other',
    none: 'Other',
});

/**
 * Default category for a known NPC name (manifest / archive spelling).
 * Unlisted names resolve to {@link defaultNpcCategoryForName} → Other.
 * @type {Readonly<Record<string, string>>}
 */
export const NPC_ARCHIVE_CATEGORY_BY_NAME = Object.freeze({
    'D.mon': 'MEKA',
    Casino: 'MEKA',
    Overlord: 'MEKA',
    King: 'MEKA',
    'Dae-Hyun': 'MEKA',
    Susannah: 'Phreaks',
    Boomslang: 'Phreaks',
    'Touch Up': 'Phreaks',
    Jackdaw: 'Phreaks',
    'B.O.B': 'Deadlock',
    Bars: 'Deadlock',
    Bez: 'Deadlock',
    Frankie: 'Deadlock',
    'The Triplets': 'Deadlock',
    Ryota: 'Yokai',
    Nobuto: 'Yokai',
    Sakura: 'Yokai',
    Chisaka: 'Yokai',
    Sojiro: 'Shimada',
    Toshiro: 'Shimada',
    Asa: 'Shimada',
    'Kamori-san': 'Shimada',
    Mason: 'Junkers',
    Meri: 'Junkers',
    Geiger: 'Junkers',
    Chao: 'Lucheng',
    Harold: 'Lucheng',
    Jiayi: 'Lucheng',
    Athena: 'Overwatch',
    Adawe: 'Overwatch',
    Gérard: 'Overwatch',
    Gerard: 'Overwatch',
    Liao: 'Overwatch',
    Efi: 'Overwatch',
    Hector: 'Overwatch',
    Claudio: 'Overwatch',
    Maximillien: 'Talon',
    Antonio: 'Talon',
    Vialli: 'Talon',
    Ngumi: 'Talon',
    Adeyemi: 'Talon',
    Aurora: 'Historical Figures',
    Anubis: 'Historical Figures',
    Mondatta: 'Historical Figures',
    Alisa: 'Historical Figures',
    Katya: 'Historical Figures',
    Bhatt: 'Historical Figures',
    Naughton: 'Historical Figures',
    Portero: 'Historical Figures',
    Osai: 'Historical Figures',
    Balderich: 'Historical Figures',
    Ingrid: 'Civilians',
    Emily: 'Civilians',
    Vincent: 'Civilians',
    Iggy: 'Civilians',
    Nameless: 'Civilians',
    Kendra: 'Civilians',
    Kace: 'Other',
    Lanet: 'Other',
    'Lynx 17': 'Other',
    Revel: 'Other',
    Sanjay: 'Other',
    Sven: 'Other',
    Zera: 'Other',
});

/**
 * @param {string} npcCategory
 * @returns {string}
 */
export function normalizeNpcArchiveCategory(npcCategory) {
    if (npcCategory == null) return '';
    const collapsed = String(npcCategory).trim().replace(/\s+/g, ' ');
    if (!collapsed) return '';
    const alias = NPC_ARCHIVE_CATEGORY_ALIASES[collapsed.toLowerCase()];
    if (alias) return alias;
    for (let i = 0; i < NPC_ARCHIVE_CATEGORY_ORDER.length; i++) {
        const canon = NPC_ARCHIVE_CATEGORY_ORDER[i];
        if (collapsed.toLowerCase() === canon.toLowerCase()) return canon;
    }
    return collapsed;
}

/**
 * Read `npcCategory` from a satellite archive row (supports legacy `variants[]`).
 * @param {unknown} ev
 * @returns {{ name: string, npcCategory: string }}
 */
export function readNpcCategoryFieldsFromArchiveRow(ev) {
    if (!ev || typeof ev !== 'object') {
        return { name: '', npcCategory: '' };
    }
    const vars = ev.variants;
    if (Array.isArray(vars) && vars.length > 0) {
        const v0 = vars[0] || {};
        const name = String(v0.name != null ? v0.name : ev.name || '').trim();
        let npcCategory = v0.npcCategory != null ? String(v0.npcCategory).trim() : '';
        if (!npcCategory && ev.npcCategory != null) {
            npcCategory = String(ev.npcCategory).trim();
        }
        return { name, npcCategory };
    }
    return {
        name: String(ev.name != null ? ev.name : '').trim(),
        npcCategory: ev.npcCategory != null ? String(ev.npcCategory).trim() : '',
    };
}

/**
 * Canonical category for grouping / display — fills from bundled file row, then name map, then Other.
 * @param {unknown} ev
 * @param {unknown[]} [fileFallbackRows] Optional bundled `npcs.json` events for stale localStorage.
 * @returns {string}
 */
export function resolveNpcCategoryFromArchiveRow(ev, fileFallbackRows) {
    const { name, npcCategory: rawCategory } = readNpcCategoryFieldsFromArchiveRow(ev);
    let npcCategory = rawCategory;

    if (!npcCategory && name && Array.isArray(fileFallbackRows)) {
        const want = name.toLowerCase();
        for (let i = 0; i < fileFallbackRows.length; i++) {
            const row = fileFallbackRows[i];
            if (!row || typeof row !== 'object') continue;
            const rowName = String(row.name != null ? row.name : '').trim();
            if (rowName.toLowerCase() !== want) continue;
            const fromFile = readNpcCategoryFieldsFromArchiveRow(row).npcCategory;
            if (fromFile) {
                npcCategory = fromFile;
                break;
            }
        }
    }

    if (!npcCategory) {
        npcCategory = defaultNpcCategoryForName(name);
    }

    return normalizeNpcArchiveCategory(npcCategory) || 'Other';
}

/**
 * @param {unknown[]} rows
 * @param {unknown[]} [fileFallbackRows]
 * @returns {Array<{ name: string, npcCategory: string }>}
 */
export function mapNpcArchiveRowsForGrouping(rows, fileFallbackRows) {
    if (!Array.isArray(rows)) return [];
    return rows.map((ev) => {
        const { name } = readNpcCategoryFieldsFromArchiveRow(ev);
        return {
            name,
            npcCategory: resolveNpcCategoryFromArchiveRow(ev, fileFallbackRows),
        };
    });
}

/**
 * @param {string} name
 * @returns {string}
 */
export function defaultNpcCategoryForName(name) {
    const raw = String(name || '').trim();
    if (!raw) return 'Other';
    if (NPC_ARCHIVE_CATEGORY_BY_NAME[raw]) return NPC_ARCHIVE_CATEGORY_BY_NAME[raw];
    const lower = raw.toLowerCase();
    for (const [key, category] of Object.entries(NPC_ARCHIVE_CATEGORY_BY_NAME)) {
        if (key.toLowerCase() === lower) return category;
    }
    return 'Other';
}

/**
 * @param {string} npcCategory
 * @returns {string}
 */
export function displayLabelForNpcArchiveCategory(npcCategory) {
    const normalized = normalizeNpcArchiveCategory(npcCategory);
    return normalized || 'Other';
}

/**
 * @param {string} npcCategory
 * @returns {number}
 */
export function npcArchiveCategoryRank(npcCategory) {
    const normalized = normalizeNpcArchiveCategory(npcCategory);
    const index = NPC_ARCHIVE_CATEGORY_ORDER.indexOf(normalized);
    if (index === -1) {
        if (!normalized) return NPC_ARCHIVE_CATEGORY_ORDER.length;
        return NPC_ARCHIVE_CATEGORY_ORDER.length - 1;
    }
    return index;
}

/**
 * @param {Array} events
 */
export function sortNpcsArchiveEventsStable(events) {
    events.sort((a, b) => {
        const rankA = npcArchiveCategoryRank(a?.npcCategory);
        const rankB = npcArchiveCategoryRank(b?.npcCategory);
        if (rankA !== rankB) return rankA - rankB;
        const nameA = String(a?.name || '').trim();
        const nameB = String(b?.name || '').trim();
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });
}

/**
 * @param {Array} events
 * @param {number} index
 */
export function moveNpcEntryToLastInItsCategoryGroup(events, index) {
    const targetEvent = typeof index === 'number' ? events[index] : index;
    if (!targetEvent) return;
    const idx = typeof index === 'number' ? index : events.indexOf(targetEvent);
    if (idx < 0) return;

    const targetCategory = normalizeNpcArchiveCategory(targetEvent.npcCategory);
    let groupEnd = idx;

    for (let i = idx + 1; i < events.length; i++) {
        if (normalizeNpcArchiveCategory(events[i]?.npcCategory) === targetCategory) {
            groupEnd = i;
        } else {
            break;
        }
    }

    if (groupEnd > idx) {
        const [movedEvent] = events.splice(idx, 1);
        events.splice(groupEnd, 0, movedEvent);
    }
}

/**
 * @param {Array} events
 * @param {string} category
 * @returns {number}
 */
export function findFirstIndexForNpcCategoryInList(events, category) {
    const normalizedCategory = normalizeNpcArchiveCategory(category);
    for (let i = 0; i < events.length; i++) {
        if (normalizeNpcArchiveCategory(events[i]?.npcCategory) === normalizedCategory) {
            return i;
        }
    }
    return events.length;
}
