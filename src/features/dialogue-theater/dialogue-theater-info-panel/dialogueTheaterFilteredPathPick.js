/**
 * Pick a multi-route path based on active character search filters.
 */

import { resolveActiveConversationLines } from '../data/dialogueTheaterPathHelpers.js';
import { characterNamesMatch } from '../dialogue-theater-list/dialogueTheaterPairSearch.js';
import { pickRandomConversationPathId } from './dialogueTheaterRandomRoutePlay.js';

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
 * @param {string} characterName
 * @param {string[]} manifestHeroes
 * @returns {boolean}
 */
export function pathIncludesCharacter(conversation, path, characterName, manifestHeroes = []) {
    const query = String(characterName || '').trim();
    if (!query) return true;

    const labelHero = parseHeroFromPathLabel(path?.label);
    if (labelHero && characterNamesMatch(labelHero, query, manifestHeroes)) {
        return true;
    }

    const lines = resolveActiveConversationLines({
        ...conversation,
        selectedPathId: path.id,
    });

    return lines.some((line) => characterNamesMatch(String(line?.hero || ''), query, manifestHeroes));
}

/**
 * Pick a route when character filters are active.
 * - One matching route → that route
 * - Several matching routes → random among matches
 * - Character appears in every route (or no matches) → random among all routes
 *
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string[]} filterCharacters
 * @param {string[]} [manifestHeroes]
 * @returns {string}
 */
export function pickConversationPathForCharacterFilters(
    conversation,
    filterCharacters,
    manifestHeroes = [],
) {
    const paths = conversation?.paths || [];
    if (paths.length === 0) return '';
    if (paths.length === 1) return paths[0].id;

    const characters = (filterCharacters || []).map((value) => String(value || '').trim()).filter(Boolean);
    if (characters.length === 0) {
        return pickRandomConversationPathId(conversation);
    }

    const matchingPaths = paths.filter((path) =>
        characters.every((character) => pathIncludesCharacter(conversation, path, character, manifestHeroes)),
    );

    if (matchingPaths.length === 0 || matchingPaths.length === paths.length) {
        return pickRandomConversationPathId(conversation);
    }

    return matchingPaths[Math.floor(Math.random() * matchingPaths.length)].id;
}
