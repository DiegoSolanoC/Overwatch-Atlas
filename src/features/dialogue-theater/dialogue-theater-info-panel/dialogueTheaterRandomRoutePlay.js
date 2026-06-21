/**
 * Standard multi-route random play — pick one path at random (not Favorite Animals / Before the Crisis).
 */

import { hasConversationVariationPaths } from '../data/dialogueTheaterPathHelpers.js';
import { isBeforeTheCrisisConversation } from './beforeTheCrisisPathConfig.js';
import { isFavoriteAnimalConversation } from './dialogueTheaterGroupedPathPicker.js';
import { isPeriodicTableConversation } from './periodicTablePathConfig.js';

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {boolean}
 */
export function isSpecialMultiRouteConversation(conversation) {
    return (
        isFavoriteAnimalConversation(conversation) ||
        isBeforeTheCrisisConversation(conversation) ||
        isPeriodicTableConversation(conversation)
    );
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {boolean}
 */
export function usesStandardRandomRoutePlay(conversation) {
    if (isSpecialMultiRouteConversation(conversation)) return false;
    const paths = conversation?.paths || [];
    return paths.length > 1;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {string}
 */
export function pickRandomConversationPathId(conversation) {
    const paths = conversation?.paths || [];
    if (paths.length === 0) return '';
    return paths[Math.floor(Math.random() * paths.length)].id;
}

/**
 * @returns {string}
 */
export function renderStandardRandomRouteControlsHtml() {
    return `
        <button
            type="button"
            id="dialogueTheaterRandomRouteBtn"
            class="dialogue-theater-path-switch__master-play dialogue-theater-path-switch__random-route"
            aria-label="Pick a random route"
        >🎲 Random route</button>
        <button
            type="button"
            id="dialogueTheaterRandomPlayBtn"
            class="dialogue-theater-path-switch__master-play"
            aria-label="Pick a random route and play it"
        >▶ Random play</button>
    `;
}
