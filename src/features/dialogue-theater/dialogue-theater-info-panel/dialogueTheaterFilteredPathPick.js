/**
 * Pick a multi-route path based on active character search filters.
 */

import { pathIncludesCharacter } from '../dialogue-theater-list/dialogueTheaterPairSearch.js';
import { pickRandomConversationPathId } from './dialogueTheaterRandomRoutePlay.js';

export { pathIncludesCharacter };

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
