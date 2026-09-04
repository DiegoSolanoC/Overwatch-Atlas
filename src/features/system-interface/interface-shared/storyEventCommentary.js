/**
 * Story-timeline Commentary — Dialogue Theater interaction names on an event.
 * Stored as `commentary: string[]` (display names), resolved to conversation ids at play time.
 */

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeCommentaryList(value) {
    if (!Array.isArray(value)) return [];
    /** @type {string[]} */
    const out = [];
    const seen = new Set();
    for (const raw of value) {
        const name = String(raw ?? '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(name);
    }
    return out;
}

/**
 * @param {unknown} event
 * @returns {string[]}
 */
export function getEventCommentaryNames(event) {
    if (!event || typeof event !== 'object') return [];
    return normalizeCommentaryList(/** @type {{ commentary?: unknown }} */ (event).commentary);
}

/**
 * Collect commentary names from inline editor rows.
 * @param {ParentNode | null | undefined} container
 * @returns {string[]}
 */
export function collectCommentaryFromEditor(container) {
    if (!container) return [];
    const inputs = container.querySelectorAll('[data-role="commentary-name"]');
    return normalizeCommentaryList(
        Array.from(inputs).map((el) => (el instanceof HTMLInputElement ? el.value : '')),
    );
}
