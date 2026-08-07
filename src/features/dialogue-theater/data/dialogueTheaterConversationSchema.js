/**
 * Default background for Dialogue Theater conversations (filename under Theater/Scene).
 */
export const DEFAULT_DIALOGUE_SCENE = 'Default.png';

import {
    DIALOGUE_THEATER_ENTRY_CHATTER,
    DIALOGUE_THEATER_ENTRY_DIALOGUE,
    chatterIdForHero,
    normalizeDialogueTheaterEntryType,
} from './dialogueTheaterEntryType.js';

/**
 * @returns {string}
 */
export function createConversationId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @returns {string}
 */
export function createDialogueLineId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @returns {string}
 */
export function createDialoguePathId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `path-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @returns {import('./DialogueTheaterDataService.js').DialoguePath}
 */
export function buildBlankDialoguePath() {
    return {
        id: createDialoguePathId(),
        label: 'Path 1',
        lineIds: [],
    };
}

/**
 * @returns {{ id: string, hero: string, voice: string, voicePrefix: string, subtitles: string, render: string, era: string, status: string, disclaimer?: string }}
 */
export function buildBlankDialogueLine() {
    return {
        id: createDialogueLineId(),
        hero: '',
        voice: '',
        voicePrefix: '',
        subtitles: '',
        render: '',
        era: 'Overwatch',
        status: 'active',
    };
}

/**
 * @returns {import('./DialogueTheaterDataService.js').DialogueConversation}
 */
export function buildBlankConversationRecord() {
    return {
        id: createConversationId(),
        entryType: DIALOGUE_THEATER_ENTRY_DIALOGUE,
        name: 'Untitled conversation',
        status: 'active',
        eraName: '',
        tags: ['Overwatch'],
        scene: DEFAULT_DIALOGUE_SCENE,
        lines: [],
    };
}

/**
 * Empty Hero Chatter stub — default scene + Heroic render, no audio/dialogue yet.
 * @param {string} heroName
 * @returns {import('./DialogueTheaterDataService.js').DialogueConversation}
 */
export function buildBlankChatterRecord(heroName) {
    const hero = String(heroName || '').trim() || 'Unknown';
    return {
        id: chatterIdForHero(hero),
        entryType: DIALOGUE_THEATER_ENTRY_CHATTER,
        name: hero,
        status: 'active',
        eraName: '',
        tags: [],
        scene: DEFAULT_DIALOGUE_SCENE,
        lines: [
            {
                id: createDialogueLineId(),
                hero,
                voice: '',
                voicePrefix: '',
                subtitles: '',
                render: 'Heroic.png',
                era: 'Overwatch',
                status: 'active',
            },
        ],
    };
}

import { stripWikiOutcomeMarkers } from './dialogueSubtitleFormatting.js';
import {
    DIALOGUE_THEATER_MAP_SPECIFIC_TAG,
    DIALOGUE_THEATER_SKIN_SPECIFIC_TAG,
    normalizeDialogueTheaterStatus,
    normalizeDialogueTheaterTagsWithFlags,
    finalizeDialogueTheaterTags,
    normalizeDialogueTheaterChoiceList,
    normalizeDialogueLineEra,
    normalizeDialogueLineStatus,
} from '../dialogue-theater-list/dialogueTheaterEraFilter.js';
import { normalizeChatterPartnerFields } from './dialogueTheaterChatterPartners.js';

/**
 * @param {unknown} raw
 * @returns {{ id: string, hero: string, voice: string, voicePrefix: string, subtitles: string, render: string, era: string, status: string, disclaimer?: string, partnerMode?: string, partners?: string[], partnerFocus?: string, partnerStackOrder?: string[] }|null}
 */
export function normalizeDialogueLine(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id != null ? raw.id : '').trim() || createDialogueLineId();
    /** @type {{ id: string, hero: string, voice: string, voicePrefix: string, subtitles: string, render: string, era: string, status: string, disclaimer?: string, partnerMode?: string, partners?: string[], partnerFocus?: string, partnerStackOrder?: string[] }} */
    const line = {
        id,
        hero: String(raw.hero != null ? raw.hero : '').trim(),
        voice: String(raw.voice != null ? raw.voice : '').trim(),
        voicePrefix: String(raw.voicePrefix != null ? raw.voicePrefix : '').trim(),
        subtitles: stripWikiOutcomeMarkers(String(raw.subtitles != null ? raw.subtitles : '')),
        render: String(raw.render != null ? raw.render : '').trim(),
        era: normalizeDialogueLineEra(raw.era),
        status: normalizeDialogueLineStatus(raw.status),
    };
    const disclaimer = String(raw.disclaimer != null ? raw.disclaimer : '').trim();
    if (disclaimer) line.disclaimer = disclaimer;
    Object.assign(line, normalizeChatterPartnerFields(raw));
    return line;
}

/**
 * @param {unknown} raw
 * @returns {import('./DialogueTheaterDataService.js').DialoguePath|null}
 */
export function normalizeDialoguePath(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id != null ? raw.id : '').trim() || createDialoguePathId();
    const label = String(raw.label != null ? raw.label : '').trim() || 'Path';
    const lineIdsRaw = Array.isArray(raw.lineIds) ? raw.lineIds : [];
    const lineIds = [];
    const seen = new Set();
    for (let i = 0; i < lineIdsRaw.length; i += 1) {
        const lineId = String(lineIdsRaw[i] || '').trim();
        if (!lineId || seen.has(lineId)) continue;
        seen.add(lineId);
        lineIds.push(lineId);
    }
    /** @type {import('./DialogueTheaterDataService.js').DialoguePath} */
    const path = { id, label, lineIds };
    if (raw.segments && typeof raw.segments === 'object') {
        /** @type {Record<string, string>} */
        const segments = {};
        for (const key of ['asker', 'job', 'reactor', 'epilogue', 'outcome', 'hero', 'variant']) {
            const value = String(raw.segments[key] || '').trim();
            if (value) segments[key] = value;
        }
        if (Object.keys(segments).length > 0) {
            path.segments = segments;
        }
    }
    return path;
}

/**
 * @param {unknown} raw
 * @param {string} [fallbackId]
 * @returns {import('./DialogueTheaterDataService.js').DialogueConversation|null}
 */
export function normalizeConversationRecord(raw, fallbackId) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id != null ? raw.id : fallbackId || '').trim() || createConversationId();
    const entryType = normalizeDialogueTheaterEntryType(raw.entryType);
    const { tags: rawNormalizedTags, hadRemovedTag } = normalizeDialogueTheaterTagsWithFlags(
        raw.tags,
    );
    let status = normalizeDialogueTheaterStatus(raw.status);
    if (hadRemovedTag) status = 'removed';
    const name = String(raw.name != null ? raw.name : raw.title != null ? raw.title : '')
        .trim() || 'Untitled conversation';
    // Legacy eraName cleared — tags is the multi-label field now.
    const eraName = '';
    const sceneRaw = String(raw.scene != null ? raw.scene : '').trim();
    const scene = sceneRaw || DEFAULT_DIALOGUE_SCENE;
    const linesRaw = Array.isArray(raw.lines) ? raw.lines : [];
    const lines = [];
    const seenLineIds = new Set();
    for (let i = 0; i < linesRaw.length; i += 1) {
        const line = normalizeDialogueLine(linesRaw[i]);
        if (!line || seenLineIds.has(line.id)) continue;
        seenLineIds.add(line.id);
        lines.push(line);
    }

    const pathsRaw = Array.isArray(raw.paths) ? raw.paths : [];
    /** @type {import('./DialogueTheaterDataService.js').DialoguePath[]} */
    const paths = [];
    const seenPathIds = new Set();
    for (let i = 0; i < pathsRaw.length; i += 1) {
        const path = normalizeDialoguePath(pathsRaw[i]);
        if (!path || seenPathIds.has(path.id)) continue;
        seenPathIds.add(path.id);
        paths.push(path);
    }

    const lineIdSet = new Set(lines.map((line) => line.id));
    for (let i = 0; i < paths.length; i += 1) {
        paths[i].lineIds = paths[i].lineIds.filter((lineId) => lineIdSet.has(lineId));
    }

    const filteredPaths = paths.filter((path) => path.lineIds.length > 0);
    let selectedPathId = String(raw.selectedPathId != null ? raw.selectedPathId : '').trim();
    if (filteredPaths.length === 0) {
        selectedPathId = '';
    } else if (!filteredPaths.some((path) => path.id === selectedPathId)) {
        const sorted = [...filteredPaths].sort((a, b) =>
            String(a.label || '').localeCompare(String(b.label || ''), undefined, { sensitivity: 'base' }),
        );
        selectedPathId = sorted[0]?.id || filteredPaths[0].id;
    }

    const isChatter = entryType === DIALOGUE_THEATER_ENTRY_CHATTER;
    const tags = isChatter
        ? []
        : finalizeDialogueTheaterTags(rawNormalizedTags, filteredPaths.length > 0);
    const mapChoices = tags.includes(DIALOGUE_THEATER_MAP_SPECIFIC_TAG)
        ? normalizeDialogueTheaterChoiceList(raw.mapChoices)
        : [];
    const skinChoices = tags.includes(DIALOGUE_THEATER_SKIN_SPECIFIC_TAG)
        ? normalizeDialogueTheaterChoiceList(raw.skinChoices)
        : [];

    /** @type {import('./DialogueTheaterDataService.js').DialogueConversation} */
    const conversation = { id, entryType, name, status, eraName, tags, scene, lines };
    if (mapChoices.length > 0) {
        conversation.mapChoices = mapChoices;
    }
    if (skinChoices.length > 0) {
        conversation.skinChoices = skinChoices;
    }
    if (filteredPaths.length > 0) {
        conversation.paths = filteredPaths;
        conversation.selectedPathId = selectedPathId;
    }
    return conversation;
}
