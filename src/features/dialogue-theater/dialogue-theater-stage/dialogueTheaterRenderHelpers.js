/**
 * Shared helpers for resolving dialogue line character render URLs.
 */

import { renderImageUrl, resolveRenderHeroFolder } from '../data/loadDialogueTheaterAssets.js';
import { resolveActiveConversationLines } from '../data/dialogueTheaterPathHelpers.js';
import { FAVORITE_ANIMAL_CONVERSATION_ID } from '../dialogue-theater-info-panel/dialogueTheaterGroupedPathPicker.js';

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {boolean}
 */
export function usesFirstSpeakerOnlyPreview(conversation) {
    return (
        conversation?.id === FAVORITE_ANIMAL_CONVERSATION_ID ||
        String(conversation?.name || '').trim() === 'Favorite Animal'
    );
}
/**
 * @param {number} lineIndex
 * @returns {'left'|'right'}
 */
export function sideForLineIndex(lineIndex) {
    return lineIndex % 2 === 0 ? 'left' : 'right';
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine} line
 * @param {Record<string, string[]>} rendersMap
 * @returns {string}
 */
export function getLineRenderSrc(line, rendersMap) {
    const hero = String(line?.hero || '').trim();
    const render = String(line?.render || '').trim();
    if (!hero || !render) return '';
    const folder = resolveRenderHeroFolder(hero, rendersMap);
    if (!folder) return '';
    return renderImageUrl(folder, render);
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {Record<string, string[]>} rendersMap
 * @returns {{ left: string, right: string }}
 */
export function getConversationIdleRenderPair(conversation, rendersMap) {
    const lines = resolveActiveConversationLines(conversation);
    const left = lines[0] ? getLineRenderSrc(lines[0], rendersMap) : '';
    if (usesFirstSpeakerOnlyPreview(conversation)) {
        return { left, right: '' };
    }
    const right = lines[1] ? getLineRenderSrc(lines[1], rendersMap) : '';
    return { left, right };
}