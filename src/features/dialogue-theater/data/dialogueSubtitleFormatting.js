/**
 * Wiki-style subtitle markup — **emphasis** and *italics* from Overwatch wiki imports.
 */

/**
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Wiki interaction outcome markers — not spoken dialogue.
 * @param {string} text
 * @returns {string}
 */
export function stripWikiOutcomeMarkers(text) {
    return String(text || '')
        .replace(/\*?\(\s*(?:fails|succeeds)\s*\)\*?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Plain text for summaries, matching, and compact labels.
 * @param {string} text
 * @returns {string}
 */
export function stripDialogueSubtitleMarkup(text) {
    return stripWikiOutcomeMarkers(String(text || ''))
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/\*+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Display HTML for view panel and stage overlay.
 * @param {string} text
 * @returns {string}
 */
export function formatDialogueSubtitleHtml(text) {
    const raw = stripWikiOutcomeMarkers(String(text || '').trim());
    if (!raw) return '';

    let html = escapeHtml(raw);
    html = html.replace(/\*\*([^*]+)\*\*/g, '<em class="dialogue-theater-subtitle__em">$1</em>');
    html = html.replace(/\*([^*]+)\*/g, '<em class="dialogue-theater-subtitle__em">$1</em>');
    return html;
}
