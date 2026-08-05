/**
 * Title + dialogue-line search for the conversation list.
 */

import { stripDialogueSubtitleMarkup } from '../data/dialogueSubtitleFormatting.js';
import { normalizeSubtitlesForMatch } from '../data/theaterVoicelineParsing.js';
import { normalizeForPredictiveMatch } from '../../system-interface/interface-left-panel/event-system/form/autocomplete/tokenInputMatching.js';
import { getConversationTags } from './dialogueTheaterEraFilter.js';

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} query
 * @returns {boolean}
 */
export function conversationMatchesListSearch(conversation, query) {
    const q = String(query || '').trim();
    if (!q) return true;

    const qLower = q.toLowerCase();
    const qFold = normalizeForPredictiveMatch(q);
    const name = String(conversation?.name || '');
    const tags = getConversationTags(conversation);
    const tagsJoined = tags.join(' ');
    const mapsJoined = Array.isArray(conversation?.mapChoices) ? conversation.mapChoices.join(' ') : '';
    const skinsJoined = Array.isArray(conversation?.skinChoices) ? conversation.skinChoices.join(' ') : '';
    if (name.toLowerCase().includes(qLower) || tagsJoined.toLowerCase().includes(qLower)) return true;
    if (mapsJoined && mapsJoined.toLowerCase().includes(qLower)) return true;
    if (skinsJoined && skinsJoined.toLowerCase().includes(qLower)) return true;
    if (qFold) {
        if (normalizeForPredictiveMatch(name).includes(qFold)) return true;
        if (normalizeForPredictiveMatch(tagsJoined).includes(qFold)) return true;
        if (mapsJoined && normalizeForPredictiveMatch(mapsJoined).includes(qFold)) return true;
        if (skinsJoined && normalizeForPredictiveMatch(skinsJoined).includes(qFold)) return true;
    }
    for (const tag of tags) {
        if (tag.toLowerCase().includes(qLower)) return true;
        if (qFold && normalizeForPredictiveMatch(tag).includes(qFold)) return true;
    }

    const normalizedQuery = normalizeSubtitlesForMatch(q);
    const strippedQuery = stripDialogueSubtitleMarkup(q).toLowerCase();

    const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
    for (const line of lines) {
        const hero = String(line?.hero || '');
        if (hero) {
            if (hero.toLowerCase().includes(qLower)) return true;
            if (qFold && normalizeForPredictiveMatch(hero).includes(qFold)) return true;
        }

        const subtitles = String(line?.subtitles || '');
        if (!subtitles) continue;

        if (subtitles.toLowerCase().includes(qLower)) return true;

        const stripped = stripDialogueSubtitleMarkup(subtitles).toLowerCase();
        if (strippedQuery && stripped.includes(strippedQuery)) return true;

        if (normalizedQuery) {
            const normalizedLine = normalizeSubtitlesForMatch(subtitles);
            if (normalizedLine.includes(normalizedQuery)) return true;
        }
    }

    return false;
}
