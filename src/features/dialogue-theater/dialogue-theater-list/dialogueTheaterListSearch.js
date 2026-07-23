/**
 * Title + dialogue-line search for the conversation list.
 */

import { stripDialogueSubtitleMarkup } from '../data/dialogueSubtitleFormatting.js';
import { normalizeSubtitlesForMatch } from '../data/theaterVoicelineParsing.js';

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} query
 * @returns {boolean}
 */
export function conversationMatchesListSearch(conversation, query) {
    const q = String(query || '').trim();
    if (!q) return true;

    const qLower = q.toLowerCase();
    if (String(conversation?.name || '').toLowerCase().includes(qLower)) return true;
    if (String(conversation?.eraName || '').toLowerCase().includes(qLower)) return true;

    const normalizedQuery = normalizeSubtitlesForMatch(q);
    const strippedQuery = stripDialogueSubtitleMarkup(q).toLowerCase();

    const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
    for (const line of lines) {
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
