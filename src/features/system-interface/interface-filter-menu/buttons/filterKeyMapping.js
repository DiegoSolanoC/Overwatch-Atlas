/**
 * Map a manifest entry (string id, faction object, country object, etc.) to
 * the `{ filterKey, displayName }` pair used by chips:
 *   - `filterKey`   : the canonical token stored in the state set
 *                     (e.g. `Shambali Order`, `country:Mexico/MX.png`)
 *   - `displayName` : human-readable label rendered on the chip
 *
 * Also includes the manifest <-> archive matchers used by the grouped layouts
 * to find which manifest faction / hero corresponds to a given archive row.
 */

import { npcNamesLooselyEqual } from '../../interface-shared/npcNameAliases.js';

const HERO_DISPLAY_NAME_OVERRIDES = {
    /* Manifest filename has no colon (filesystem-safe), display has one. */
    'Soldier 76': 'Soldier: 76',
};

/** Emperor / Infinite skin voicelines → manifest hero id (keys: lowercase alnum only). */
const DIALOGUE_SKIN_HERO_ALIASES = {
    emperorsigma: 'Sigma',
    infiniteannihilatorbastion: 'Bastion',
    infinitecaptainbrigitte: 'Brigitte',
    infiniteguardsoldier: 'Soldier 76',
    infiniteseermercy: 'Mercy',
    infiniteadmiralsojourn: 'Sojourn',
};

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeHeroAliasKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]/g, '');
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeHeroNameLoose(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

/**
 * Match manifest ids to wiki/display spellings — e.g. "Soldier 76" ↔ "Soldier: 76".
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function heroNamesLooselyEqual(a, b) {
    const na = normalizeHeroNameLoose(a);
    const nb = normalizeHeroNameLoose(b);
    if (na && na === nb) return true;
    const la = na.replace(/:/g, '').replace(/\s/g, '');
    const lb = nb.replace(/:/g, '').replace(/\s/g, '');
    return la.length > 0 && la === lb;
}

/**
 * @param {string} heroName
 * @param {string[]} [manifestHeroes]
 * @returns {string}
 */
export function resolveManifestHeroId(heroName, manifestHeroes = []) {
    const trimmed = String(heroName || '').trim();
    if (!trimmed) return '';

    const skinAlias = DIALOGUE_SKIN_HERO_ALIASES[normalizeHeroAliasKey(trimmed)];
    const candidate = skinAlias || trimmed;

    for (const id of manifestHeroes) {
        const manifestId = String(id || '').trim();
        if (!manifestId) continue;
        if (heroNamesLooselyEqual(candidate, manifestId)) return manifestId;
        if (heroNamesLooselyEqual(candidate, getHeroDisplayName(manifestId))) return manifestId;
    }

    for (const [manifestId, displayName] of Object.entries(HERO_DISPLAY_NAME_OVERRIDES)) {
        if (heroNamesLooselyEqual(candidate, displayName) || heroNamesLooselyEqual(candidate, manifestId)) {
            return manifestId;
        }
    }

    return skinAlias || trimmed;
}

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
    }
    for (let i = 0; i < heroes.length; i++) {
        const h = heroes[i];
        if (heroNamesLooselyEqual(rowName, h)) return h;
    }
    return null;
}

/** @param {string} rowName @param {string[]} npcs */
export function matchNpcManifestToArchiveRowName(rowName, npcs) {
    if (!Array.isArray(npcs) || npcs.length === 0) return null;
    for (let i = 0; i < npcs.length; i++) {
        const n = npcs[i];
        if (npcNamesLooselyEqual(rowName, n)) return n;
    }
    return null;
}
