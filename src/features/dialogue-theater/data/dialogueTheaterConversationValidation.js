/**
 * Dialogue Theater list validation — unfinished conversation heuristics.
 */

import { resolveLineVoiceFile } from './theaterVoicelineParsing.js';
import { isChatterEntry } from './dialogueTheaterEntryType.js';
import { getConversationEraTag } from '../dialogue-theater-list/dialogueTheaterEraFilter.js';

/**
 * Normalize a voiceline filename for duplicate comparison.
 *
 * @param {string} voice
 * @returns {string}
 */
function normalizeVoiceFilenameForFingerprint(voice) {
    const trimmed = String(voice || '').trim();
    if (!trimmed) return '';
    const base = trimmed.split(/[/\\]/).pop() || trimmed;
    return base.toLowerCase();
}

/**
 * Fingerprint a conversation's voiceline set (order-independent).
 * Matches import dedupe logic in scripts/import-interaction-folder.mjs.
 *
 * @param {import('./DialogueTheaterDataService.js').DialogueLine[]} lines
 * @returns {string}
 */
export function conversationVoiceFingerprint(lines) {
    const voices = (Array.isArray(lines) ? lines : [])
        .map((line) => normalizeVoiceFilenameForFingerprint(line?.voice))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

    if (voices.length > 0) return voices.join('|');

    return (Array.isArray(lines) ? lines : [])
        .map((line) => {
            const hero = String(line?.hero || '').trim().toLowerCase();
            const subtitles = String(line?.subtitles || '')
                .trim()
                .toLowerCase()
                .replace(/\s+/g, ' ');
            if (!hero && !subtitles) return '';
            return `${hero}\x01${subtitles}`;
        })
        .filter(Boolean)
        .join('\x02');
}

/**
 * @param {import('./DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @returns {Map<string, string[]>} conversation id -> other ids with the same voiceline fingerprint
 */
export function buildConversationDuplicateLookup(conversations) {
    /** @type {Map<string, string[]>} */
    const byFingerprint = new Map();

    const rows = Array.isArray(conversations) ? conversations : [];
    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const voiceFp = conversationVoiceFingerprint(row?.lines || []);
        if (!voiceFp) continue;
        // Same dialogue can exist in Classic + Overwatch; only flag within an era.
        const fingerprint = `${getConversationEraTag(row) || ''}\x00${voiceFp}`;

        const bucket = byFingerprint.get(fingerprint) || [];
        bucket.push(String(row.id || ''));
        byFingerprint.set(fingerprint, bucket);
    }

    /** @type {Map<string, string[]>} */
    const duplicateLookup = new Map();
    for (const ids of byFingerprint.values()) {
        if (ids.length < 2) continue;
        for (let i = 0; i < ids.length; i += 1) {
            duplicateLookup.set(
                ids[i],
                ids.filter((otherId) => otherId !== ids[i]),
            );
        }
    }

    return duplicateLookup;
}

/**
 * @param {string} conversationId
 * @param {Map<string, string[]>} duplicateLookup
 * @returns {boolean}
 */
export function conversationIsDuplicate(conversationId, duplicateLookup) {
    return duplicateLookup.has(conversationId);
}

/**
 * @param {string} conversationId
 * @param {Map<string, string[]>} duplicateLookup
 * @param {import('./DialogueTheaterDataService.js').DialogueConversation[]} [conversations]
 * @returns {string}
 */
export function conversationDuplicateSummary(conversationId, duplicateLookup, conversations = []) {
    const otherIds = duplicateLookup.get(conversationId);
    if (!otherIds?.length) return '';

    const byId = new Map(
        (Array.isArray(conversations) ? conversations : []).map((row) => [row.id, row]),
    );
    const labels = otherIds.map((id) => {
        const name = String(byId.get(id)?.name || '').trim();
        return name || id.slice(0, 8);
    });

    if (labels.length === 1) {
        return `Duplicate voicelines: also in "${labels[0]}"`;
    }
    return `Duplicate voicelines: also in ${labels.map((label) => `"${label}"`).join(', ')}`;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isNumberedConversationName(name) {
    const trimmed = String(name || '').trim();
    return /^\d+$/.test(trimmed);
}

/**
 * Placeholder titles still awaiting a manual name during review.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function conversationMissingCustomName(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return true;
    if (trimmed.toLowerCase() === 'untitled conversation') return true;
    return isNumberedConversationName(trimmed);
}

/**
 * @param {import('./DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @returns {number}
 */
export function nextConversationNumber(conversations) {
    let max = 0;
    const rows = Array.isArray(conversations) ? conversations : [];
    for (let i = 0; i < rows.length; i += 1) {
        const trimmed = String(rows[i]?.name || '').trim();
        if (!isNumberedConversationName(trimmed)) continue;
        const value = parseInt(trimmed, 10);
        if (Number.isFinite(value) && value > max) max = value;
    }
    return max + 1;
}

/**
 * Sort numbered titles numerically; named titles alphabetically (natural sort).
 *
 * @param {import('./DialogueTheaterDataService.js').DialogueConversation} a
 * @param {import('./DialogueTheaterDataService.js').DialogueConversation} b
 * @returns {number}
 */
export function compareConversationListOrder(a, b) {
    const na = String(a?.name || '').trim();
    const nb = String(b?.name || '').trim();
    const aNum = isNumberedConversationName(na) ? parseInt(na, 10) : NaN;
    const bNum = isNumberedConversationName(nb) ? parseInt(nb, 10) : NaN;

    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
    if (Number.isFinite(aNum) && !Number.isFinite(bNum)) return -1;
    if (!Number.isFinite(aNum) && Number.isFinite(bNum)) return 1;

    return na.localeCompare(nb, undefined, { sensitivity: 'base', numeric: true });
}

/**
 * @param {string} hero
 * @returns {boolean}
 */
export function isUnknownDialogueHero(hero) {
    const trimmed = String(hero || '').trim();
    if (!trimmed) return true;
    return trimmed.toLowerCase() === 'unknown';
}

/**
 * @param {import('./DialogueTheaterDataService.js').DialogueLine} line
 * @param {string[]} voicelines
 * @returns {boolean}
 */
export function dialogueLineMissingVoice(line, voicelines = []) {
    return !resolveLineVoiceFile(line, voicelines);
}

/**
 * @param {import('./DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string[]} [voicelines]
 * @param {Map<string, string[]>} [duplicateLookup]
 * @returns {boolean}
 */
export function conversationHasUnfinishedIssues(conversation, voicelines = [], duplicateLookup = null) {
    // Empty Hero Chatter stubs are intentional placeholders — skip unfinished chrome for now.
    if (isChatterEntry(conversation)) {
        const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
        const hasStartedContent = lines.some((line) => {
            const voice = String(line?.voice || '').trim();
            const subtitles = String(line?.subtitles || '').trim();
            return Boolean(voice || subtitles);
        });
        if (!hasStartedContent) return false;
    }

    if (conversationMissingCustomName(conversation?.name)) return true;
    if (duplicateLookup && conversationIsDuplicate(conversation?.id, duplicateLookup)) return true;

    const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (isUnknownDialogueHero(line?.hero)) return true;
        if (dialogueLineMissingVoice(line, voicelines)) return true;
    }
    return false;
}

/**
 * @param {import('./DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string[]} [voicelines]
 * @param {Map<string, string[]>} [duplicateLookup]
 * @param {import('./DialogueTheaterDataService.js').DialogueConversation[]} [conversations]
 * @returns {string}
 */
export function conversationUnfinishedSummary(
    conversation,
    voicelines = [],
    duplicateLookup = null,
    conversations = [],
) {
    /** @type {string[]} */
    const parts = [];

    if (conversationMissingCustomName(conversation?.name)) {
        parts.push('needs name');
    }

    if (duplicateLookup && conversationIsDuplicate(conversation?.id, duplicateLookup)) {
        parts.push('duplicate voicelines');
    }

    const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
    let unknownCount = 0;
    let missingVoiceCount = 0;

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (isUnknownDialogueHero(line?.hero)) unknownCount += 1;
        if (dialogueLineMissingVoice(line, voicelines)) missingVoiceCount += 1;
    }

    if (unknownCount > 0) {
        parts.push(unknownCount === 1 ? 'unknown hero' : `${unknownCount} unknown heroes`);
    }
    if (missingVoiceCount > 0) {
        parts.push(missingVoiceCount === 1 ? 'missing audio' : `${missingVoiceCount} missing audio`);
    }

    return parts.length > 0 ? `Unfinished: ${parts.join(', ')}` : '';
}
