/**
 * Before the Crisis — master play (one random full route through all four tiers).
 */

import {
    findPathIdForSegments,
    pickRandomBeforeTheCrisisSegments,
} from './beforeTheCrisisPathConfig.js';

/**
 * @typedef {{ kind: 'path', pathId: string }} MasterPlayPathStep
 * @typedef {MasterPlayPathStep} MasterPlayStep
 */

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {MasterPlayStep[]}
 */
export function buildBeforeTheCrisisMasterPlayQueue(conversation) {
    const segments = pickRandomBeforeTheCrisisSegments(conversation);
    const pathId = findPathIdForSegments(conversation, segments);
    if (!pathId) return [];

    return [{ kind: 'path', pathId }];
}

/**
 * Pick a new random route and return its path id (for shuffle / re-roll).
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {string}
 */
export function pickRandomBeforeTheCrisisPathId(conversation) {
    const segments = pickRandomBeforeTheCrisisSegments(conversation);
    return findPathIdForSegments(conversation, segments);
}
