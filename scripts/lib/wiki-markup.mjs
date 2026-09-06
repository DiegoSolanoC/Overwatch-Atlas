/**
 * Shared MediaWiki quote-cell cleanup for chatter/dialogue imports.
 * Piped wikilinks MUST use the display text ($2), never the page title ($1).
 */

/**
 * @param {string} text
 * @returns {string}
 */
export function stripWikiMarkup(text) {
    return String(text || '')
        .replace(/\{\{Audio\|[^}]+\}\}/gi, ' ')
        .replace(/\{\{[^}]+\}\}/g, ' ')
        // External: [https://example.com Label] → Label
        .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/gi, '$1')
        // Bare external: [https://example.com] → drop
        .replace(/\[https?:\/\/[^\s\]]+\]/gi, ' ')
        // Piped wikilink: [[Page|display]] → display
        .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
        // Simple wikilink: [[Page]] → Page (strip interwiki prefix)
        .replace(/\[\[([^\]]+)\]\]/g, (_, inner) => {
            const page = String(inner || '').trim();
            const colon = page.indexOf(':');
            if (colon > 0 && /^[a-z]+$/i.test(page.slice(0, colon))) {
                return page.slice(colon + 1).trim() || page;
            }
            return page;
        })
        // Leftover interwiki after a bad $1 strip: wikipedia:Malibu → Malibu
        .replace(/\b(?:wikipedia|wikisource|wiktionary|commons):([^\s\]|,;:]+)/gi, '$1')
        .replace(/'''?/g, '')
        .replace(/<\/?[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function hasWikiResidue(text) {
    const s = String(text || '');
    return (
        /\[\[/.test(s)
        || /\[https?:\/\//i.test(s)
        || /\b(?:wikipedia|wikisource|wiktionary):/i.test(s)
        || /\{\{/.test(s)
    );
}

/**
 * Normalize spoken text for fuzzy audio/subtitle matching.
 * @param {string} text
 * @returns {string}
 */
export function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*([^*]+)\*/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}
