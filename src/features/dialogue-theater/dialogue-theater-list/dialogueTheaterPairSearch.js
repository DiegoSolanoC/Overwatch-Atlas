/**
 * Pair search — find conversations where two named characters both speak.
 * Independent of additive globe/chip hero filters.
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

    return (
        conversationIncludesCharacter(conversation, a, manifestHeroes) &&
        conversationIncludesCharacter(conversation, b, manifestHeroes)
    );
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
