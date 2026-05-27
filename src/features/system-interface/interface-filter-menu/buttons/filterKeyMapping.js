/**
 * Map a manifest entry (string id, faction object, country object, etc.) to
 * the `{ filterKey, displayName }` pair used by chips:
 *   - `filterKey`   : the canonical token stored in the state set
 *                     (e.g. `25Shambali Order`, `country:Mexico/MX.png`)
 *   - `displayName` : human-readable label rendered on the chip
 *
 * Also includes the manifest <-> archive matchers used by the grouped layouts
 * to find which manifest faction / hero corresponds to a given archive row.
 */

const HERO_DISPLAY_NAME_OVERRIDES = {
    /* Manifest filename has no colon (filesystem-safe), display has one. */
    'Soldier 76': 'Soldier: 76'
};

export function getHeroDisplayName(heroName) {
    return HERO_DISPLAY_NAME_OVERRIDES[heroName] || heroName;
}

/**
 * @param {*} item
 * @param {'heroes'|'factions'|'npcs'|'countries'|'music'} type
 * @returns {{ filterKey: string, displayName: string }}
 */
export function getFilterKeyAndDisplayName(item, type) {
    if (type === 'factions') {
        return { filterKey: item.filename, displayName: item.displayName };
    }
    if (type === 'npcs') {
        return { filterKey: item, displayName: getHeroDisplayName(item) };
    }
    if (type === 'countries') {
        const flagFile = item && item.flagFile != null ? String(item.flagFile).trim() : '';
        const commonName = item && item.commonName != null ? String(item.commonName).trim() : '';
        return {
            filterKey: flagFile ? `country:${flagFile}` : '',
            displayName: commonName || flagFile
        };
    }
    if (type === 'music') {
        return {
            filterKey: `src/assets/audio/music/${item.filename}`,
            displayName: item.name
        };
    }
    /* heroes */
    return { filterKey: item, displayName: getHeroDisplayName(item) };
}

/**
 * Find the manifest faction whose filename or displayName matches an archive
 * row's `name`. Tries `FactionMatchHelpers.factionIdsMatch` first (which knows
 * about pre-migration tokens) and falls back to a case-insensitive
 * displayName compare so brand-new factions still match.
 */
export function matchFactionManifestToArchiveRowName(rowName, factions) {
    const raw = String(rowName || '').trim();
    if (!raw || !Array.isArray(factions) || factions.length === 0) return null;
    const fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
    for (let i = 0; i < factions.length; i++) {
        const f = factions[i];
        if (!f?.filename) continue;
        if (fh && typeof fh.factionIdsMatch === 'function') {
            if (fh.factionIdsMatch(raw, f.filename) || fh.factionIdsMatch(raw, f.displayName)) {
                return f;
            }
        }
    }
    const rl = raw.toLowerCase();
    for (let i = 0; i < factions.length; i++) {
        const f = factions[i];
        if (!f?.filename) continue;
        const d = String(f.displayName || '').trim().toLowerCase();
        if (d && rl === d) return f;
    }
    return null;
}

/**
 * Find the manifest hero id matching an archive row's `name`. Uses
 * `eventManager._heroArchiveNamesLooselyEqual` if available (handles a few
 * idiosyncratic spellings like "D.Va" vs "D Va"), else case-insensitive eq.
 */
export function matchHeroManifestToArchiveRowName(rowName, heroes) {
    if (!Array.isArray(heroes) || heroes.length === 0) return null;
    const em = typeof window !== 'undefined' ? window.eventManager : null;
    if (em && typeof em._heroArchiveNamesLooselyEqual === 'function') {
        for (let i = 0; i < heroes.length; i++) {
            const h = heroes[i];
            if (em._heroArchiveNamesLooselyEqual(rowName, h)) return h;
        }
        return null;
    }
    const rl = String(rowName || '').trim().toLowerCase();
    if (!rl) return null;
    for (let i = 0; i < heroes.length; i++) {
        const h = heroes[i];
        if (String(h || '').trim().toLowerCase() === rl) return h;
    }
    return null;
}
