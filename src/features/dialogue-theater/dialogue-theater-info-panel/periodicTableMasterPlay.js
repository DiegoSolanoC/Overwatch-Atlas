/**
 * Periodic Table — master play for the active outcome (Failure or Success).
 */

import { getConversationLineById } from './favoriteAnimalMasterPlay.js';
import {
    openingLineIdForOutcome,
    pathsForOutcome,
    PERIODIC_TABLE_SUCCESS_CLOSING_LINE_ID,
    resolveSegmentsForPathId,
} from './periodicTablePathConfig.js';

/**
 * @typedef {{ kind: 'line', lineId: string, pathId?: string }} MasterPlayLineStep
 * @typedef {MasterPlayLineStep} MasterPlayStep
 */

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} [selectedPathId]
 * @returns {MasterPlayStep[]}
 */
export function buildPeriodicTableMasterPlayQueue(conversation, selectedPathId = '') {
    const pathId = selectedPathId || conversation?.selectedPathId || '';
    const segments = resolveSegmentsForPathId(conversation, pathId);
    const outcome = segments.outcome;
    const openingLineId = openingLineIdForOutcome(outcome);

    /** @type {MasterPlayStep[]} */
    const queue = [{ kind: 'line', lineId: openingLineId }];

    for (const path of pathsForOutcome(conversation, outcome)) {
        const responseLineId = path.lineIds?.[1];
        if (!responseLineId) continue;

        const line = getConversationLineById(conversation, responseLineId);
        if (!String(line?.voice || '').trim()) continue;

        queue.push({ kind: 'line', lineId: responseLineId, pathId: path.id });
    }

    if (outcome === 'success') {
        queue.push({ kind: 'line', lineId: PERIODIC_TABLE_SUCCESS_CLOSING_LINE_ID });
    }

    return queue;
}
