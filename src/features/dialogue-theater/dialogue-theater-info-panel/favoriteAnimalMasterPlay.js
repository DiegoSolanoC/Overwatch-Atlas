/**
 * Favorite Animal — master play sequence (opening → responses A–Z → closing → epilogues).
 */

import { buildPathGroupsByHero } from './dialogueTheaterGroupedPathPicker.js';

export const FAVORITE_ANIMAL_OPENING_LINE_ID = '8a7a057c-db4f-4edc-8280-d9b6756d6ac1';
export const FAVORITE_ANIMAL_STANDARD_CLOSING_LINE_ID = 'fc50de03-59a5-48e4-9262-3b2a48e8e682';
export const FAVORITE_ANIMAL_DOMINA_PATH_ID = '34ecf3dc-68ec-4c0e-87a1-3d3668fd0d21';
export const FAVORITE_ANIMAL_LUCIO_TREE_FROG_PATH_ID = '9961c3dd-9f0b-40a2-bf25-827d9a8bf1e7';

const SPECIAL_MAIN_BATCH_PATH_IDS = new Set([
    FAVORITE_ANIMAL_DOMINA_PATH_ID,
    FAVORITE_ANIMAL_LUCIO_TREE_FROG_PATH_ID,
]);

/**
 * @typedef {{ kind: 'line', lineId: string, pathId?: string }} MasterPlayLineStep
 * @typedef {{ kind: 'path', pathId: string }} MasterPlayPathStep
 * @typedef {MasterPlayLineStep | MasterPlayPathStep} MasterPlayStep
 */

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {import('../data/DialogueTheaterDataService.js').DialoguePath} path
 * @returns {string|null}
 */
function getMainBatchResponseLineId(conversation, path) {
    const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
    const byId = new Map(lines.map((line) => [line.id, line]));
    const pathLines = (path.lineIds || []).map((id) => byId.get(id)).filter(Boolean);
    if (pathLines.length === 0) return null;

    const openHero = String(pathLines[0]?.hero || '').trim();
    const closeHero = String(pathLines[pathLines.length - 1]?.hero || '').trim();
    if (openHero === 'Lúcio' && pathLines.length === 3 && closeHero === 'Lúcio') {
        return pathLines[1]?.id || null;
    }

    return pathLines[1]?.id || pathLines[0]?.id || null;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {import('../data/DialogueTheaterDataService.js').DialoguePath} path
 * @returns {boolean}
 */
function hasRecordedFavoriteAnimalResponse(conversation, path) {
    const lineId = getMainBatchResponseLineId(conversation, path);
    if (!lineId) return false;
    const line = getConversationLineById(conversation, lineId);
    return Boolean(String(line?.voice || '').trim());
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialoguePath[]} paths
 * @returns {import('../data/DialogueTheaterDataService.js').DialoguePath}
 */
function pickRandomPath(paths) {
    return paths[Math.floor(Math.random() * paths.length)];
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {MasterPlayStep[]}
 */
export function buildFavoriteAnimalMasterPlayQueue(conversation) {
    /** @type {MasterPlayStep[]} */
    const queue = [{ kind: 'line', lineId: FAVORITE_ANIMAL_OPENING_LINE_ID }];

    const groups = buildPathGroupsByHero(conversation);
    for (const group of groups) {
        const batchPaths = group.paths.filter(
            (path) =>
                !SPECIAL_MAIN_BATCH_PATH_IDS.has(path.id) &&
                hasRecordedFavoriteAnimalResponse(conversation, path),
        );
        if (batchPaths.length === 0) continue;

        const path = batchPaths.length === 1 ? batchPaths[0] : pickRandomPath(batchPaths);
        const lineId = getMainBatchResponseLineId(conversation, path);
        if (!lineId) continue;

        queue.push({ kind: 'line', lineId, pathId: path.id });
    }

    queue.push({ kind: 'line', lineId: FAVORITE_ANIMAL_STANDARD_CLOSING_LINE_ID });
    queue.push({ kind: 'path', pathId: FAVORITE_ANIMAL_DOMINA_PATH_ID });
    queue.push({ kind: 'path', pathId: FAVORITE_ANIMAL_LUCIO_TREE_FROG_PATH_ID });

    return queue;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} lineId
 * @returns {import('../data/DialogueTheaterDataService.js').DialogueLine|null}
 */
export function getConversationLineById(conversation, lineId) {
    const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
    return lines.find((line) => line.id === lineId) || null;
}
