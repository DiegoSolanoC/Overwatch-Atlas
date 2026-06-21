/**
 * Variation path helpers — pick one route through a conversation's dialogue lines.
 */

/**
 * @param {import('./DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {boolean}
 */
export function hasConversationVariationPaths(conversation) {
    return Array.isArray(conversation?.paths) && conversation.paths.length > 0;
}

/**
 * @param {import('./DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {import('./DialogueTheaterDataService.js').DialoguePath|null}
 */
export function getSelectedConversationPath(conversation) {
    const paths = conversation?.paths;
    if (!Array.isArray(paths) || paths.length === 0) return null;

    const selectedId = resolveSelectedPathId(conversation);
    return paths.find((path) => path.id === selectedId) || paths[0] || null;
}

/**
 * @param {import('./DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {string}
 */
export function resolveDefaultSelectedPathId(conversation) {
    const paths = conversation?.paths || [];
    if (paths.length === 0) return '';

    const sorted = [...paths].sort((a, b) =>
        String(a.label || '').localeCompare(String(b.label || ''), undefined, { sensitivity: 'base' }),
    );
    return sorted[0]?.id || paths[0].id;
}

/**
 * @param {import('./DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {string}
 */
export function resolveSelectedPathId(conversation) {
    const paths = conversation?.paths || [];
    const selectedId = String(conversation?.selectedPathId || '').trim();
    if (selectedId && paths.some((path) => path.id === selectedId)) {
        return selectedId;
    }
    return resolveDefaultSelectedPathId(conversation);
}

/**
 * Active lines for playback, list thumbs, and the view panel.
 *
 * @param {import('./DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {import('./DialogueTheaterDataService.js').DialogueLine[]}
 */
export function resolveActiveConversationLines(conversation) {
    const allLines = Array.isArray(conversation?.lines) ? conversation.lines : [];
    const path = getSelectedConversationPath(conversation);
    if (!path) return allLines;

    const byId = new Map(allLines.map((line) => [line.id, line]));
    /** @type {import('./DialogueTheaterDataService.js').DialogueLine[]} */
    const resolved = [];

    for (const lineId of path.lineIds) {
        const line = byId.get(lineId);
        if (line) resolved.push(line);
    }

    return resolved.length > 0 ? resolved : allLines;
}

/**
 * @param {import('./DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {import('./DialogueTheaterDataService.js').DialogueConversation}
 */
export function withResolvedConversationLines(conversation) {
    return {
        ...conversation,
        lines: resolveActiveConversationLines(conversation),
    };
}

/**
 * @param {string} text
 * @param {number} [maxLen=72]
 * @returns {string}
 */
export function summarizeDialogueLine(text, maxLen = 72) {
    const collapsed = String(text || '')
        .replace(/\*+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!collapsed) return 'No dialogue text';
    if (collapsed.length <= maxLen) return collapsed;
    return `${collapsed.slice(0, maxLen - 1)}…`;
}

/**
 * @param {import('./DialogueTheaterDataService.js').DialogueLine} line
 * @returns {string}
 */
export function labelForDialogueLineOption(line) {
    const hero = String(line?.hero || '').trim() || 'Unknown';
    const text = summarizeDialogueLine(line?.subtitles || '', 56);
    return `${hero}: ${text}`;
}
