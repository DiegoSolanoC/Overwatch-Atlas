/**
 * Shared helpers for resolving dialogue line character render URLs.
 */

import {
    pickHeroicRenderForHero,
    renderImageUrl,
    resolveRenderHeroFolder,
} from '../data/loadDialogueTheaterAssets.js';
import { resolveActiveConversationLines } from '../data/dialogueTheaterPathHelpers.js';
import { isBeforeTheCrisisConversation } from '../dialogue-theater-info-panel/beforeTheCrisisPathConfig.js';
import { FAVORITE_ANIMAL_CONVERSATION_ID } from '../dialogue-theater-info-panel/dialogueTheaterGroupedPathPicker.js';
import { isPeriodicTableConversation } from '../dialogue-theater-info-panel/periodicTablePathConfig.js';
import { isChatterEntry } from '../data/dialogueTheaterEntryType.js';

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
 * Idle preview shows one character only (Lúcio for Favorite Animals, Zenyatta for Before the Crisis).
 *
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {boolean}
 */
export function usesSoloSpeakerPreview(conversation) {
    return (
        isChatterEntry(conversation) ||
        usesFirstSpeakerOnlyPreview(conversation) ||
        isBeforeTheCrisisConversation(conversation) ||
        isPeriodicTableConversation(conversation)
    );
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine} line
 * @returns {import('../data/DialogueTheaterDataService.js').DialogueLine}
 */
function withDefaultRender(line, fallbackRender) {
    const render = String(line?.render || '').trim();
    if (render) return line;
    return { ...line, render: fallbackRender };
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {import('../data/DialogueTheaterDataService.js').DialogueLine|null}
 */
export function getSoloPreviewLine(conversation) {
    if (isChatterEntry(conversation)) {
        const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
        const first = lines.find((line) => String(line?.hero || '').trim());
        if (first) return withDefaultRender(first, 'Heroic.png');
        const hero = String(conversation?.name || '').trim();
        if (!hero) return null;
        return { id: 'chatter-preview', hero, voice: '', subtitles: '', render: 'Heroic.png' };
    }

    if (isBeforeTheCrisisConversation(conversation)) {
        const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
        const zenLine = lines.find((line) => String(line?.hero || '').trim() === 'Zenyatta');
        if (zenLine) return withDefaultRender(zenLine, 'Heroic.png');
        return { id: 'zenyatta-preview', hero: 'Zenyatta', voice: '', subtitles: '', render: 'Heroic.png' };
    }

    if (isPeriodicTableConversation(conversation)) {
        const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
        const winstonLine = lines.find((line) => String(line?.hero || '').trim() === 'Winston');
        if (winstonLine) return withDefaultRender(winstonLine, 'Heroic.png');
        return { id: 'winston-preview', hero: 'Winston', voice: '', subtitles: '', render: 'Heroic.png' };
    }

    const lines = resolveActiveConversationLines(conversation);
    return lines[0] || null;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine[]} lines
 * @returns {Map<string, 'left'|'right'>}
 */
export function buildSpeakerSideMap(lines) {
    /** @type {Map<string, 'left'|'right'>} */
    const map = new Map();
    for (const line of lines) {
        const hero = String(line?.hero || '').trim();
        if (!hero || map.has(hero)) continue;
        map.set(hero, map.size === 0 ? 'left' : 'right');
        if (map.size >= 2) break;
    }
    return map;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine[]} lines
 * @param {number} lineIndex
 * @returns {'left'|'right'}
 */
export function sideForLineIndex(lineIndex, lines = []) {
    const hero = String(lines[lineIndex]?.hero || '').trim();
    if (hero) {
        const sideMap = buildSpeakerSideMap(lines);
        const side = sideMap.get(hero);
        if (side) return side;
    }
    return lineIndex % 2 === 0 ? 'left' : 'right';
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine} line
 * @param {Record<string, string[]>} rendersMap
 * @returns {string}
 */
export function getLineRenderSrc(line, rendersMap) {
    const hero = String(line?.hero || '').trim();
    if (!hero) return '';
    let render = String(line?.render || '').trim();
    if (!render) {
        render = pickHeroicRenderForHero(hero, rendersMap);
        if (!render) return '';
    }
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
    if (usesSoloSpeakerPreview(conversation)) {
        const line = getSoloPreviewLine(conversation);
        const left = line ? getLineRenderSrc(line, rendersMap) : '';
        return { left, right: '' };
    }

    const lines = resolveActiveConversationLines(conversation);
    const sideMap = buildSpeakerSideMap(lines);
    const speakers = [...sideMap.keys()];
    const leftLine =
        speakers[0] != null
            ? lines.find((line) => String(line?.hero || '').trim() === speakers[0]) || lines[0]
            : lines[0] || null;
    const rightLine =
        speakers[1] != null
            ? lines.find((line) => String(line?.hero || '').trim() === speakers[1]) || lines[1]
            : lines[1] || null;
    const left = leftLine ? getLineRenderSrc(leftLine, rendersMap) : '';
    const right = rightLine ? getLineRenderSrc(rightLine, rendersMap) : '';
    return { left, right };
}
