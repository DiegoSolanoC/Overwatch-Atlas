/**
 * Pair search — find conversations where two named characters both speak.
 * Independent of additive globe/chip hero filters.
 *
 * For multipath conversations, both characters must share at least one path —
 * separate branches of the same multi do not count as a shared interaction.
 */

import { resolveManifestHeroId } from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { resolveNpcCanonicalName } from '../../system-interface/interface-shared/npcNameAliases.js';
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
 * @param {string} a
 * @param {string} b
 * @param {string[]} manifestHeroes
 * @returns {boolean}
 */
export function characterNamesMatch(a, b, manifestHeroes = []) {
    const left = String(a || '').trim();
    const right = String(b || '').trim();
    if (!left || !right) return false;
    if (heroNamesMatch(left, right, manifestHeroes)) return true;

    const npcLeft = resolveNpcCanonicalName(left);
    const npcRight = resolveNpcCanonicalName(right);
    if (npcLeft && npcRight && npcLeft.toLowerCase() === npcRight.toLowerCase()) return true;

    return heroNamesMatch(npcLeft, npcRight, manifestHeroes);
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

    return speakersOnConversationPath(conversation, path).some((hero) =>
        characterNamesMatch(hero, query, manifestHeroes),
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

    for (const line of conversation?.lines || []) {
        const hero = String(line?.hero || '').trim();
        if (hero && characterNamesMatch(hero, query, manifestHeroes)) return true;
    }

    // Multipath labels can name a speaker even when their lines are sparse.
    for (const path of conversation?.paths || []) {
        const labelHero = parseHeroFromPathLabel(path?.label);
        if (labelHero && characterNamesMatch(labelHero, query, manifestHeroes)) return true;
    }

    return false;
}

/**
 * @param {string} charA
 * @param {string} charB
 * @returns {boolean}
 */
export function isDialogueTheaterPairSearchActive(charA, charB) {
    return Boolean(String(charA || '').trim() || String(charB || '').trim());
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

    if (!a && !b) return true;
    if (a && !b) return conversationIncludesCharacter(conversation, a, manifestHeroes);
    if (!a && b) return conversationIncludesCharacter(conversation, b, manifestHeroes);

    return conversationHasSharedPathForPair(conversation, a, b, manifestHeroes);
}

/**
 * @param {string[]} manifestHeroes
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @returns {string[]}
 */
export function buildDialogueTheaterSpeakerOptions(manifestHeroes, conversations) {
    const seen = new Set();
    /** @type {string[]} */
    const options = [];

    const add = (name) => {
        const trimmed = String(name || '').trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        options.push(trimmed);
    };

    for (const hero of manifestHeroes) {
        add(resolveManifestHeroId(hero, manifestHeroes) || hero);
    }

    for (const conversation of conversations) {
        for (const speaker of getConversationSpeakerNames(conversation)) {
            add(speaker);
        }
    }

    return options.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
}
