/**
 * NPC display-name aliases for manifest spellings vs legacy typos in saved data.
 * Canonical name is always the manifest / filter PNG basename (e.g. Chikasa).
 */

/** @type {Readonly<Record<string, string>>} lowercased legacy token → canonical manifest name */
export const NPC_NAME_LEGACY_TO_CANONICAL = Object.freeze({
    chisaka: 'Chikasa',
});

/**
 * @param {unknown} name
 * @returns {string}
 */
export function resolveNpcCanonicalName(name) {
    const raw = String(name ?? '').trim();
    if (!raw) return '';

    const legacy = NPC_NAME_LEGACY_TO_CANONICAL[raw.toLowerCase()];
    if (legacy) return legacy;

    const manifestNpcs =
        typeof window !== 'undefined'
            ? window.eventManager?.npcs || window.globeController?.dataModel?.npcs || []
            : [];
    const lower = raw.toLowerCase();
    for (let i = 0; i < manifestNpcs.length; i += 1) {
        const entry = String(manifestNpcs[i] ?? '');
        if (entry.toLowerCase() === lower) return entry;
    }
    return raw;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function npcNamesLooselyEqual(a, b) {
    const ca = resolveNpcCanonicalName(a).toLowerCase();
    const cb = resolveNpcCanonicalName(b).toLowerCase();
    return ca !== '' && ca === cb;
}

/**
 * True when an active filter chip matches this NPC token (handles legacy spellings).
 * @param {Set<string>|null|undefined} activeFilters
 * @param {unknown} npcId
 * @returns {boolean}
 */
export function activeFilterSetMatchesNpcId(activeFilters, npcId) {
    if (!activeFilters || activeFilters.size === 0 || npcId == null) return false;
    const canon = resolveNpcCanonicalName(npcId);
    if (!canon) return false;
    if (activeFilters.has(canon)) return true;
    const raw = String(npcId).trim();
    if (raw && activeFilters.has(raw)) return true;
    for (const f of activeFilters) {
        if (resolveNpcCanonicalName(f) === canon) return true;
    }
    return false;
}

if (typeof window !== 'undefined') {
    window.NpcNameAliasHelpers = {
        NPC_NAME_LEGACY_TO_CANONICAL,
        resolveNpcCanonicalName,
        npcNamesLooselyEqual,
        activeFilterSetMatchesNpcId,
    };
}
