/**
 * searchIndexes — pure parsing and index-building functions for the Event Manager search bar.
 *
 * Two index shapes are built lazily, each from a different live data source:
 *
 *   - **filterIndex** = heroes/npcs/factions metadata derived from `EventManager.{heroes,npcs,factions}`.
 *     Includes lowercase-keyed lookup maps for fast case-insensitive token matching and a
 *     pre-tokenized faction list (filename + manifest displayName + their lowercase mirrors).
 *
 *   - **flagIndex** = `[{ common, file, commonLower, keyNorm }]` derived from the
 *     `window.FLAG_FILE_BY_COMMON` global, sorted alphabetically by display name.
 *
 * On top of those, this module exposes the parse/candidate functions the input wiring calls
 * on every keystroke. Everything here is stateless: callers pass the index in.
 */

import {
    defaultFactionDisplayName,
    normalizeFlagKey,
    tokenSubstringRank,
    countrySubstringRank,
} from './searchTokenUtils.js';

/** Build the heroes/npcs/factions index from the live `EventManager`. */
export function buildFilterIndex(eventManager) {
    const heroes = eventManager.heroes || [];
    const npcs = eventManager.npcs || [];
    const factions = eventManager.factions || [];
    const heroByLower = new Map();
    heroes.forEach((h) => {
        const key = (h || '').toString().toLowerCase();
        if (key) heroByLower.set(key, h);
    });
    const npcByLower = new Map();
    npcs.forEach((n) => {
        const key = (n || '').toString().toLowerCase();
        if (key) npcByLower.set(key, n);
    });
    const factionEntries = (factions || []).map((f) => {
        const filename = typeof f === 'object' && f !== null && f.filename != null ? f.filename : f;
        const fn = (filename || '').toString();
        const rawDisplay = typeof f === 'object' && f !== null && f.displayName != null
            ? String(f.displayName).trim()
            : '';
        let displayName = rawDisplay;
        if (!displayName || displayName === fn || displayName.toLowerCase() === fn.toLowerCase()) {
            displayName = defaultFactionDisplayName(fn);
        }
        return {
            filename: fn,
            displayName,
            filenameLower: fn.toLowerCase(),
            displayLower: displayName.toLowerCase(),
        };
    });
    return { heroes, npcs, heroByLower, npcByLower, factionEntries };
}

/** True when the index looks stale because hero/npc data landed after we built it. */
export function isFilterIndexStale(filterIndex, eventManager) {
    if (!filterIndex) return true;
    if ((filterIndex.heroes?.length === 0) && ((eventManager.heroes || []).length > 0)) return true;
    if ((filterIndex.npcs?.length === 0) && ((eventManager.npcs || []).length > 0)) return true;
    return false;
}

/** Build the country/flag index off `window.FLAG_FILE_BY_COMMON`. */
export function buildFlagIndex() {
    const map = typeof window !== 'undefined' && window.FLAG_FILE_BY_COMMON ? window.FLAG_FILE_BY_COMMON : null;
    if (!map) return [];
    return Object.keys(map)
        .map((common) => ({
            common,
            file: map[common],
            commonLower: common.toLowerCase(),
            keyNorm: normalizeFlagKey(common),
        }))
        .sort((a, b) => a.common.localeCompare(b.common));
}

/**
 * Match user-typed CSV tokens against the flag index. Tries three lookups per token in
 * order: exact common name, exact filename, normalized key. First hit wins; duplicates are
 * de-duped by flag filename.
 *
 * @returns {string[]} Flag filenames (e.g. `"jp.png"`).
 */
export function parseCountryTokens(text, flagIndex) {
    const tokens = (text || '').split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    const matchedFiles = [];
    const seen = new Set();
    tokens.forEach((token) => {
        const lower = token.toLowerCase();
        let hit = flagIndex.find((e) => e.commonLower === lower);
        if (!hit) hit = flagIndex.find((e) => e.file.toLowerCase() === lower);
        if (!hit) {
            const nk = normalizeFlagKey(token);
            hit = flagIndex.find((e) => e.keyNorm === nk);
        }
        if (hit && hit.file && !seen.has(hit.file)) {
            seen.add(hit.file);
            matchedFiles.push(hit.file);
        }
    });
    return matchedFiles;
}

/**
 * Match user-typed CSV tokens against the filter index. Order of lookup per token:
 *   1. Hero by lowercase name.
 *   2. NPC by lowercase name.
 *   3. Faction via displayName / filename / `FactionMatchHelpers.factionIdsMatch`.
 *
 * Anything that doesn't match goes into `unmatchedTokens` so callers can still apply them
 * as free-text title keywords (e.g. typing `"Iris"` filters by title even when no hero
 * named "Iris" exists yet).
 *
 * @returns {{ matchedHeroes: string[], matchedFactions: string[], matchedNpcs: string[], unmatchedTokens: string[] }}
 */
export function parseFilterTokens(text, filterIndex) {
    const heroByLower = filterIndex.heroByLower || new Map();
    const npcByLower = filterIndex.npcByLower || new Map();
    const factionEntries = filterIndex.factionEntries || [];

    const tokens = (text || '').split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    const matchedHeroes = [];
    const matchedFactions = [];
    const matchedNpcs = [];
    const unmatchedTokens = [];
    const seenHero = new Set();
    const seenFaction = new Set();
    const seenNpc = new Set();
    const seenUnmatched = new Set();

    tokens.forEach((token) => {
        const lower = token.toLowerCase();
        if (heroByLower.has(lower)) {
            const heroName = heroByLower.get(lower);
            if (heroName && !seenHero.has(heroName)) {
                seenHero.add(heroName);
                matchedHeroes.push(heroName);
            }
        } else if (npcByLower.has(lower)) {
            const npcName = npcByLower.get(lower);
            if (npcName && !seenNpc.has(npcName)) {
                seenNpc.add(npcName);
                matchedNpcs.push(npcName);
            }
        } else {
            const fh = typeof window !== 'undefined' && window.FactionMatchHelpers;
            const match = factionEntries.find((fe) => (
                fe.displayLower === lower
                || fe.filenameLower === lower
                || (fh && typeof fh.factionIdsMatch === 'function' && (
                    fh.factionIdsMatch(token, fe.filename)
                    || fh.factionIdsMatch(token, fe.displayName)
                ))
            ));
            if (match && match.filename && !seenFaction.has(match.filename)) {
                seenFaction.add(match.filename);
                matchedFactions.push(match.filename);
            } else {
                const t = token.trim();
                if (t && !seenUnmatched.has(lower)) {
                    seenUnmatched.add(lower);
                    unmatchedTokens.push(t);
                }
            }
        }
    });

    return { matchedHeroes, matchedFactions, matchedNpcs, unmatchedTokens };
}

/**
 * Return up to 10 country-name suggestions for the partial token `prefixLower`.
 * Sorted by substring rank first (`countrySubstringRank`), then alphabetically.
 */
export function getCountryCandidates(prefixLower, flagIndex) {
    if (!prefixLower) return [];
    return flagIndex
        .filter((e) => e.commonLower.includes(prefixLower))
        .sort(
            (a, b) =>
                countrySubstringRank(a.commonLower, prefixLower)
                - countrySubstringRank(b.commonLower, prefixLower)
                || a.common.length - b.common.length
        )
        .slice(0, 10);
}

/**
 * Return hero / npc / faction suggestions for the partial token `prefixLower`.
 * Each result carries `kind`, `label`, `detail` (display category), and per-kind metadata
 * (`heroKey`, `npcKey`, or `factionFilename`) the popover uses to load the correct image.
 */
export function getTokenCandidates(prefixLower, filterIndex) {
    const results = [];
    (filterIndex.heroes || []).forEach((h) => {
        const label = (h || '').toString();
        if (!label) return;
        const ll = label.toLowerCase();
        if (ll.includes(prefixLower)) {
            results.push({
                kind: 'hero',
                label,
                detail: 'Hero',
                insert: label,
                heroKey: label,
                _rank: tokenSubstringRank(ll, prefixLower)
            });
        }
    });
    (filterIndex.npcs || []).forEach((n) => {
        const label = (n || '').toString();
        if (!label) return;
        const ll = label.toLowerCase();
        if (ll.includes(prefixLower)) {
            results.push({
                kind: 'npc',
                label,
                detail: 'NPC',
                insert: label,
                npcKey: label,
                _rank: tokenSubstringRank(ll, prefixLower)
            });
        }
    });
    (filterIndex.factionEntries || []).forEach((f) => {
        if (!f.displayName && !f.filename) return;
        const match = f.displayLower.includes(prefixLower) || f.filenameLower.includes(prefixLower);
        if (match) {
            const label = f.displayName || defaultFactionDisplayName(f.filename) || f.filename;
            const rank = Math.min(
                tokenSubstringRank(f.displayLower || '', prefixLower),
                tokenSubstringRank(f.filenameLower || '', prefixLower)
            );
            results.push({
                kind: 'faction',
                label,
                detail: 'Faction',
                insert: label,
                factionFilename: f.filename,
                _rank: rank
            });
        }
    });
    results.sort(
        (a, b) =>
            (a._rank - b._rank)
            || (a.label.length - b.label.length)
            || a.label.localeCompare(b.label)
    );
    results.forEach((r) => { delete r._rank; });
    return results;
}
