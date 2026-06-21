/**
 * Dialogue Theater list filtering — hero chips from `standaloneActiveFilters` only.
 * Faction, NPC, and country filters are ignored in this mode.
 */

import {
    heroNamesLooselyEqual,
    resolveManifestHeroId,
} from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';

/**
 * @param {string} a
 * @param {string} b
 * @param {string[]} manifestHeroes
 * @returns {boolean}
 */
export function heroNamesMatch(a, b, manifestHeroes = []) {
    const left = String(a || '').trim();
    const right = String(b || '').trim();
    if (!left || !right) return false;
    if (left === right) return true;
    if (heroNamesLooselyEqual(left, right)) return true;

    const leftId = resolveManifestHeroId(left, manifestHeroes);
    const rightId = resolveManifestHeroId(right, manifestHeroes);
    if (leftId && rightId && leftId === rightId) return true;

    return heroNamesLooselyEqual(leftId, rightId);
}

/**
 * Bucket filter chip ids the same way as `FilterSelectionState.getCounts`.
 *
 * @param {Set<string>|undefined|null} activeFilters
 * @returns {string[]}
 */
export function getHeroFiltersFromStandaloneActiveFilters(activeFilters) {
    if (!activeFilters?.size) return [];

    const fs = typeof window !== 'undefined' ? window.FilterService : null;
    const heroes = Array.isArray(fs?.heroes) ? fs.heroes : [];
    const manifestNpcs = Array.isArray(fs?.npcs) ? fs.npcs : [];
    const manifestFactions = Array.isArray(fs?.factions) ? fs.factions : [];
    const heroSet = new Set(heroes.map((h) => String(h)));
    const npcSet = new Set(manifestNpcs.map((n) => String(n)));
    const factionFilenameSet = new Set(manifestFactions.map((f) => f?.filename).filter(Boolean));

    const fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
    const factionNormSet = new Set();
    if (fh && typeof fh.normalizeFactionMatchKey === 'function') {
        manifestFactions.forEach((f) => {
            const nk = fh.normalizeFactionMatchKey(f?.filename);
            if (nk) factionNormSet.add(nk);
            const dk = fh.normalizeFactionMatchKey(f?.displayName);
            if (dk) factionNormSet.add(dk);
        });
    }

    /** @type {string[]} */
    const heroFilters = [];
    activeFilters.forEach((filter) => {
        const f = String(filter ?? '');
        if (!f || f.startsWith('country:')) return;

        const manifestHeroId = resolveManifestHeroId(f, heroes);
        if (manifestHeroId && heroSet.has(manifestHeroId)) {
            heroFilters.push(manifestHeroId);
            return;
        }
        if (heroSet.has(f)) {
            heroFilters.push(f);
            return;
        }
        if (npcSet.has(f)) return;
        if (factionFilenameSet.has(f)) return;
        if (fh && typeof fh.normalizeFactionMatchKey === 'function') {
            const nk = fh.normalizeFactionMatchKey(f);
            if (nk && factionNormSet.has(nk)) return;
        }
        if (/^\d+/.test(f)) return;
        if (manifestHeroId && heroes.some((hero) => heroNamesLooselyEqual(manifestHeroId, hero))) {
            heroFilters.push(manifestHeroId);
            return;
        }
        heroFilters.push(f);
    });

    return heroFilters;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string[]} heroFilters
 * @returns {boolean}
 */
export function conversationMatchesHeroFilters(conversation, heroFilters) {
    if (!heroFilters.length) return true;

    const fs = typeof window !== 'undefined' ? window.FilterService : null;
    const manifestHeroes = Array.isArray(fs?.heroes) ? fs.heroes : [];

    const lineHeroes = (conversation?.lines || [])
        .map((line) => String(line?.hero || '').trim())
        .filter(Boolean);

    if (!lineHeroes.length) return false;

    return lineHeroes.some((lineHero) =>
        heroFilters.some((filterHero) => heroNamesMatch(lineHero, filterHero, manifestHeroes)),
    );
}

/**
 * @param {Set<string>|undefined|null} activeFilters
 * @returns {boolean}
 */
export function isDialogueTheaterHeroFilterActive(activeFilters) {
    return getHeroFiltersFromStandaloneActiveFilters(activeFilters).length > 0;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {Set<string>|undefined|null} [activeFilters]
 * @returns {boolean}
 */
export function conversationPassesDialogueTheaterFilters(
    conversation,
    activeFilters = typeof window !== 'undefined' ? window.standaloneActiveFilters : null,
) {
    const heroFilters = getHeroFiltersFromStandaloneActiveFilters(activeFilters);
    return conversationMatchesHeroFilters(conversation, heroFilters);
}
