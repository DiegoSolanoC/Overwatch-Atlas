/**
 * Normalize event source URLs (single `url` or multi-format `urls`).
 */

/**
 * @param {{ text?: string, url?: string, urls?: string[] } | null | undefined} source
 * @returns {string[]}
 */
export function getSourceUrls(source) {
    const seen = new Set();
    /** @type {string[]} */
    const out = [];
    const add = (raw) => {
        const trimmed = String(raw || '').trim();
        if (!trimmed || seen.has(trimmed)) return;
        seen.add(trimmed);
        out.push(trimmed);
    };

    add(source?.url);
    if (Array.isArray(source?.urls)) {
        for (const entry of source.urls) add(entry);
    }
    return out;
}

/**
 * @param {{ text?: string, url?: string, urls?: string[] } | null | undefined} source
 * @returns {string}
 */
export function getSourcePrimaryUrl(source) {
    const primary = String(source?.url || '').trim();
    if (primary) return primary;
    const urls = getSourceUrls(source);
    return urls[0] || '';
}

/**
 * @param {string} text
 * @param {string[]} linkValues
 * @returns {{ text: string, url?: string, urls?: string[] } | null}
 */
export function serializeSourceLinks(text, linkValues) {
    const name = String(text || '').trim();
    const urls = [...new Set(
        (Array.isArray(linkValues) ? linkValues : [])
            .map((value) => String(value || '').trim())
            .filter(Boolean),
    )];

    if (!name && urls.length === 0) return null;
    if (urls.length === 0) return { text: name };
    if (urls.length === 1) return { text: name, url: urls[0] };
    return { text: name, url: urls[0], urls };
}
