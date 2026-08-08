/**
 * Pair search — find conversations where two named characters both speak.
 * Independent of additive globe/chip hero filters.
 *
 * For multipath conversations, both characters must share at least one path —
 * separate branches of the same multi do not count as a shared interaction.
 */

import { resolveManifestHeroId } from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { heroNamesMatch } from './dialogueTheaterHeroFilter.js';

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {string[]}
 */
export function getConversationSpeakerNames(conversation) {
    const seen = new Set();
    /** @type {string[]} */
    const names = [];

    for (const line of conversation?.lines || []) {
        const hero = String(line?.hero || '').trim();
        if (!hero) continue;
        const key = hero.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(hero);
    }

    return names;
}

/**
 * Resolve typed Character A/B text to a roster hero only when it is a full valid name
 * (or known alias like McCree → Cassidy). Incomplete typing returns ''.
 *
 * @param {string} query
 * @param {string[]} manifestHeroes
 * @returns {string}
 */
export function resolveExactRosterHero(query, manifestHeroes = []) {
    const trimmed = String(query || '').trim();
    if (!trimmed) return '';

    const heroes = Array.isArray(manifestHeroes) ? manifestHeroes : [];
    for (const hero of heroes) {
        const label = String(hero || '').trim();
        if (!label) continue;
        if (heroNamesMatch(label, trimmed, heroes)) return label;
    }
    return '';
}

/**
 * Exact / alias equality for two character labels.
 *
 * @param {string} a
 * @param {string} b
 * @param {string[]} manifestHeroes
 * @returns {boolean}
 */
export function characterNamesMatch(a, b, manifestHeroes = []) {
    const left = String(a || '').trim();
    const right = String(b || '').trim();
    if (!left || !right) return false;
    return heroNamesMatch(left, right, manifestHeroes);
}

/**
 * @param {string} label
 * @returns {string}
 */
function parseHeroFromPathLabel(label) {
    const text = String(label || '').trim();
    const sep = text.indexOf(' — ');
    return sep >= 0 ? text.slice(0, sep).trim() : text;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {import('../data/DialogueTheaterDataService.js').DialoguePath} path
 * @returns {string[]}
 */
function speakersOnConversationPath(conversation, path) {
    const seen = new Set();
    /** @type {string[]} */
    const names = [];

    const add = (name) => {
        const hero = String(name || '').trim();
        if (!hero) return;
        const key = hero.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        names.push(hero);
    };

    add(parseHeroFromPathLabel(path?.label));

    const byId = new Map((conversation?.lines || []).map((line) => [line.id, line]));
    for (const lineId of path?.lineIds || []) {
        const line = byId.get(lineId);
        if (line) add(line.hero);
    }

    return names;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {import('../data/DialogueTheaterDataService.js').DialoguePath} path
 * @param {string} characterName
 * @param {string[]} manifestHeroes
 * @returns {boolean}
 */
export function pathIncludesCharacter(conversation, path, characterName, manifestHeroes = []) {
    const query = String(characterName || '').trim();
    if (!query) return true;

    const resolved = resolveExactRosterHero(query, manifestHeroes);
    // Still typing / not a roster name — do not blank the list.
    if (!resolved) return true;

    return speakersOnConversationPath(conversation, path).some((hero) =>
        characterNamesMatch(hero, resolved, manifestHeroes),
    );
}

/**
 * True when both characters share at least one variation path (or the linear line set).
 * Separate multipath branches do not count as a shared interaction.
 *
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} charA
 * @param {string} charB
 * @param {string[]} manifestHeroes
 * @returns {boolean}
 */
export function conversationHasSharedPathForPair(conversation, charA, charB, manifestHeroes = []) {
    const a = String(charA || '').trim();
    const b = String(charB || '').trim();
    if (!a || !b) return false;

    const paths = conversation?.paths;
    if (!Array.isArray(paths) || paths.length === 0) {
        return (
            conversationIncludesCharacter(conversation, a, manifestHeroes) &&
            conversationIncludesCharacter(conversation, b, manifestHeroes)
        );
    }

    return paths.some(
        (path) =>
            pathIncludesCharacter(conversation, path, a, manifestHeroes) &&
            pathIncludesCharacter(conversation, path, b, manifestHeroes),
    );
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} characterName
 * @param {string[]} manifestHeroes
 * @returns {boolean}
 */
export function conversationIncludesCharacter(conversation, characterName, manifestHeroes = []) {
    const query = String(characterName || '').trim();
    if (!query) return true;

    const resolved = resolveExactRosterHero(query, manifestHeroes);
    // Incomplete typing should keep the current list, not show "no conversations".
    if (!resolved) return true;

    for (const line of conversation?.lines || []) {
        const hero = String(line?.hero || '').trim();
        if (hero && characterNamesMatch(hero, resolved, manifestHeroes)) return true;
    }

    // Multipath labels can name a speaker even when their lines are sparse.
    for (const path of conversation?.paths || []) {
        const labelHero = parseHeroFromPathLabel(path?.label);
        if (labelHero && characterNamesMatch(labelHero, resolved, manifestHeroes)) return true;
    }

    return false;
}

/**
 * True only when at least one field is a completed roster hero name.
 * Incomplete typing does not count as an active pair filter.
 *
 * @param {string} charA
 * @param {string} charB
 * @param {string[]} manifestHeroes
 * @returns {boolean}
 */
export function isDialogueTheaterPairSearchActive(charA, charB, manifestHeroes = []) {
    return Boolean(
        resolveExactRosterHero(charA, manifestHeroes) ||
            resolveExactRosterHero(charB, manifestHeroes),
    );
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} charA
 * @param {string} charB
 * @param {string[]} [manifestHeroes]
 * @returns {boolean}
 */
export function conversationMatchesCharacterPair(conversation, charA, charB, manifestHeroes = []) {
    const a = String(charA || '').trim();
    const b = String(charB || '').trim();

    const resolvedA = resolveExactRosterHero(a, manifestHeroes);
    const resolvedB = resolveExactRosterHero(b, manifestHeroes);

    if (!resolvedA && !resolvedB) return true;
    if (resolvedA && !resolvedB) {
        return conversationIncludesCharacter(conversation, resolvedA, manifestHeroes);
    }
    if (!resolvedA && resolvedB) {
        return conversationIncludesCharacter(conversation, resolvedB, manifestHeroes);
    }

    return conversationHasSharedPathForPair(conversation, resolvedA, resolvedB, manifestHeroes);
}

/**
 * Autocomplete options for Character A/B — atlas roster only (no NPC/one-off speakers).
 *
 * @param {string[]} manifestHeroes
 * @returns {string[]}
 */
export function buildDialogueTheaterSpeakerOptions(manifestHeroes) {
    const seen = new Set();
    /** @type {string[]} */
    const options = [];

    for (const hero of manifestHeroes || []) {
        const label = resolveManifestHeroId(hero, manifestHeroes) || String(hero || '').trim();
        if (!label) continue;
        // resolveManifestHeroId returns the input when unknown — only keep real roster ids.
        const isRoster = (manifestHeroes || []).some((entry) =>
            heroNamesMatch(entry, label, manifestHeroes),
        );
        if (!isRoster) continue;
        const key = label.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        options.push(label);
    }

    return options.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
}
