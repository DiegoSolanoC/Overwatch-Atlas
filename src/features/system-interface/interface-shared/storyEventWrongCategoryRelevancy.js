/**
 * Story events whose hero/NPC relevancy lists disagree with current roster kinds
 * (e.g. promoted NPC still listed under npcFilterPlaces).
 */

import {
    getStoryEventHeroTokens,
    getStoryEventNpcTokens,
} from './storyEventFilterPlaces.js';
import { heroNamesLooselyEqual } from '../interface-filter-menu/buttons/filterKeyMapping.js';
import { npcNamesLooselyEqual } from './npcNameAliases.js';

/**
 * @param {Iterable<string>} list
 * @returns {string[]}
 */
function normalizeList(list) {
    const out = [];
    for (const raw of list || []) {
        const n = String(raw || '').trim();
        if (n) out.push(n);
    }
    return out;
}

/**
 * @param {string} token
 * @param {string[]} roster
 * @param {'hero'|'npc'} kind
 */
function rosterHas(token, roster, kind) {
    const t = String(token || '').trim();
    if (!t || !Array.isArray(roster) || !roster.length) return false;
    for (const id of roster) {
        if (kind === 'hero') {
            if (heroNamesLooselyEqual(t, id)) return true;
        } else if (npcNamesLooselyEqual(t, id)) {
            return true;
        }
    }
    return false;
}

/**
 * @returns {{ heroes: string[], npcs: string[] }}
 */
export function getLiveHeroNpcRosters() {
    const fs = typeof window !== 'undefined' ? window.FilterService : null;
    const em = typeof window !== 'undefined' ? window.eventManager : null;
    const heroes = normalizeList(
        fs?.heroes
        || em?.heroes
        || window.globeController?.dataModel?.heroes
        || [],
    );
    const npcs = normalizeList(
        fs?.npcs
        || em?.npcs
        || window.globeController?.dataModel?.npcs
        || [],
    );
    return { heroes, npcs };
}

/**
 * @param {object|null|undefined} target — root event or variant
 * @param {{ heroes?: string[], npcs?: string[] }} [rosters]
 * @returns {boolean}
 */
export function storyTargetHasWrongCategoryRelevancy(target, rosters) {
    if (!target || typeof target !== 'object') return false;
    const { heroes, npcs } = rosters && typeof rosters === 'object'
        ? {
            heroes: normalizeList(rosters.heroes),
            npcs: normalizeList(rosters.npcs),
        }
        : getLiveHeroNpcRosters();

    if (!heroes.length && !npcs.length) return false;

    const heroTokens = getStoryEventHeroTokens(target);
    for (const token of heroTokens) {
        const asHero = rosterHas(token, heroes, 'hero');
        const asNpc = rosterHas(token, npcs, 'npc');
        if (asNpc && !asHero) return true;
    }

    const npcTokens = getStoryEventNpcTokens(target);
    for (const token of npcTokens) {
        const asHero = rosterHas(token, heroes, 'hero');
        const asNpc = rosterHas(token, npcs, 'npc');
        if (asHero && !asNpc) return true;
    }

    return false;
}

/**
 * @param {object|null|undefined} event
 * @param {{ heroes?: string[], npcs?: string[] }} [rosters]
 * @returns {boolean}
 */
export function storyEventHasWrongCategoryRelevancy(event, rosters) {
    if (!event || typeof event !== 'object') return false;
    if (storyTargetHasWrongCategoryRelevancy(event, rosters)) return true;
    const vars = event.variants;
    if (!Array.isArray(vars)) return false;
    for (const v of vars) {
        if (storyTargetHasWrongCategoryRelevancy(v, rosters)) return true;
    }
    return false;
}
