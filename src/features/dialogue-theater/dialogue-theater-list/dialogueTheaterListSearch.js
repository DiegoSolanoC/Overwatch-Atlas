/**
 * Title + dialogue-line search for the conversation list.
 */

import { stripDialogueSubtitleMarkup } from '../data/dialogueSubtitleFormatting.js';
import { normalizeSubtitlesForMatch } from '../data/theaterVoicelineParsing.js';
import { normalizeForPredictiveMatch } from '../../system-interface/interface-left-panel/event-system/form/autocomplete/tokenInputMatching.js';
import { getConversationTags } from './dialogueTheaterEraFilter.js';

/**
 * Precompute a searchable haystack so filter typing does not re-walk every line.
 *
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {{ lower: string, fold: string, stripped: string, normalized: string }}
 */
export function buildConversationSearchHaystack(conversation) {
    const name = String(conversation?.name || '');
    const tags = getConversationTags(conversation);
    const tagsJoined = tags.join(' ');
    const mapsJoined = Array.isArray(conversation?.mapChoices) ? conversation.mapChoices.join(' ') : '';
    const skinsJoined = Array.isArray(conversation?.skinChoices) ? conversation.skinChoices.join(' ') : '';

    /** @type {string[]} */
    const heroes = [];
    /** @type {string[]} */
    const subtitles = [];
    /** @type {string[]} */
    const strippedSubtitles = [];
    /** @type {string[]} */
    const normalizedSubtitles = [];

    const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
    for (const line of lines) {
        const hero = String(line?.hero || '');
        if (hero) heroes.push(hero);
        const text = String(line?.subtitles || '');
        if (!text) continue;
        subtitles.push(text);
        strippedSubtitles.push(stripDialogueSubtitleMarkup(text));
        normalizedSubtitles.push(normalizeSubtitlesForMatch(text));
    }

    const lowerParts = [name, tagsJoined, mapsJoined, skinsJoined, heroes.join(' '), subtitles.join('\n')];
    const lower = lowerParts.join('\n').toLowerCase();
    const fold = normalizeForPredictiveMatch(lowerParts.join(' '));
    const stripped = strippedSubtitles.join('\n').toLowerCase();
    const normalized = normalizedSubtitles.join('\n');

    return { lower, fold, stripped, normalized };
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} query
 * @param {{ lower: string, fold: string, stripped: string, normalized: string }|null} [haystack]
 * @returns {boolean}
 */
export function conversationMatchesListSearch(conversation, query, haystack = null) {
    const q = String(query || '').trim();
    if (!q) return true;

    const pack = haystack || buildConversationSearchHaystack(conversation);
    const qLower = q.toLowerCase();
    if (pack.lower.includes(qLower)) return true;

    const qFold = normalizeForPredictiveMatch(q);
    if (qFold && pack.fold.includes(qFold)) return true;

    const strippedQuery = stripDialogueSubtitleMarkup(q).toLowerCase();
    if (strippedQuery && pack.stripped.includes(strippedQuery)) return true;

    const normalizedQuery = normalizeSubtitlesForMatch(q);
    if (normalizedQuery && pack.normalized.includes(normalizedQuery)) return true;

    return false;
}
