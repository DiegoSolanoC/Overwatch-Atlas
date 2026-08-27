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
 * True when any line opts into mirror staging (same hero, separate stage instances).
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine[]} lines
 * @returns {boolean}
 */
export function conversationHasMirrorLines(lines) {
    return (Array.isArray(lines) ? lines : []).some((line) => line?.mirror === true);
}

/**
 * Side-map key for a line. When mirror is active for that hero, each appearance
 * is a distinct instance so the same character can sit left and right.
 *
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine[]} lines
 * @param {number} lineIndex
 * @returns {string}
 */
export function speakerSideKeyAt(lines, lineIndex) {
    const line = Array.isArray(lines) ? lines[lineIndex] : null;
    const hero = String(line?.hero || '').trim();
    if (!hero) return '';
    const mirrorHeroes = new Set(
        (Array.isArray(lines) ? lines : [])
            .filter((row) => row?.mirror === true)
            .map((row) => String(row?.hero || '').trim())
            .filter(Boolean),
    );
    if (!mirrorHeroes.has(hero)) return hero;
    let appearance = 0;
    for (let i = 0; i < lineIndex; i += 1) {
        if (String(lines[i]?.hero || '').trim() === hero) appearance += 1;
    }
    return appearance === 0 ? hero : `${hero}::mirror:${appearance}`;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine[]} lines
 * @returns {Map<string, 'left'|'right'>}
 */
export function buildSpeakerSideMap(lines) {
    /** @type {Map<string, 'left'|'right'>} */
    const map = new Map();
    const rows = Array.isArray(lines) ? lines : [];
    for (let i = 0; i < rows.length; i += 1) {
        const key = speakerSideKeyAt(rows, i);
        if (!key || map.has(key)) continue;
        map.set(key, map.size === 0 ? 'left' : 'right');
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
    const key = speakerSideKeyAt(lines, lineIndex);
    if (key) {
        const sideMap = buildSpeakerSideMap(lines);
        const side = sideMap.get(key);
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
    /** @param {string} key */
    const lineForSideKey = (key) => {
        for (let i = 0; i < lines.length; i += 1) {
            if (speakerSideKeyAt(lines, i) === key) return lines[i];
        }
        return null;
    };
    const leftLine =
        speakers[0] != null ? lineForSideKey(speakers[0]) || lines[0] : lines[0] || null;
    const rightLine =
        speakers[1] != null ? lineForSideKey(speakers[1]) || lines[1] : lines[1] || null;
    const left = leftLine ? getLineRenderSrc(leftLine, rendersMap) : '';
    const right = rightLine ? getLineRenderSrc(rightLine, rendersMap) : '';
    return { left, right };
}
