/**
 * Dialogue Theater conversation tags (multi-select).
 *
 * Base tag "Overwatch" is applied to every entry. Extra tags classify
 * special cases (classic OW1, map-only, removed, skin, multipath).
 */

/** Canonical tag labels — order used in filters / editors. */
export const DIALOGUE_THEATER_TAG_OPTIONS = Object.freeze([
    'Overwatch',
    'Classic',
    'Map Exclusive',
    'Removed',
    'Skin Specific',
    'Multi Path',
]);

/** Tags the editor can toggle; Overwatch + Multi Path are managed automatically. */
export const DIALOGUE_THEATER_EDITABLE_TAGS = Object.freeze([
    'Classic',
    'Map Exclusive',
    'Removed',
    'Skin Specific',
]);

export const DIALOGUE_THEATER_BASE_TAG = 'Overwatch';
export const DIALOGUE_THEATER_MULTI_PATH_TAG = 'Multi Path';

/** @deprecated Timeline eras no longer used as conversation tags. */
export const DIALOGUE_THEATER_TIMELINE_ERA_OPTIONS = Object.freeze([]);

/** @deprecated Working YouTube tags retired — use DIALOGUE_THEATER_TAG_OPTIONS. */
export const DIALOGUE_THEATER_WORKING_TAG_OPTIONS = Object.freeze([]);

/**
 * Retired working tags — file copy wins over stale localStorage for these.
 * Kept so old localStorage eraName values still get cleared on merge.
 */
export const DIALOGUE_THEATER_RETIRED_WORKING_TAGS = Object.freeze([
    'Midseason 3 (YouTube placeholder)',
    'Season 3 launch (YouTube placeholder)',
]);

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeDialogueTheaterTags(value) {
    const allowed = new Set(DIALOGUE_THEATER_TAG_OPTIONS);
    const seen = new Set();
    /** @type {string[]} */
    const out = [];
    const list = Array.isArray(value) ? value : value != null && value !== '' ? [value] : [];
    for (const raw of list) {
        const tag = String(raw || '').trim();
        if (!tag || !allowed.has(tag) || seen.has(tag)) continue;
        seen.add(tag);
        out.push(tag);
    }
    return out;
}

/**
 * Ensure base Overwatch tag; sync Multi Path from route data.
 * @param {string[]} tags
 * @param {boolean} hasPaths
 * @returns {string[]}
 */
export function finalizeDialogueTheaterTags(tags, hasPaths) {
    const set = new Set(normalizeDialogueTheaterTags(tags));
    set.add(DIALOGUE_THEATER_BASE_TAG);
    if (hasPaths) set.add(DIALOGUE_THEATER_MULTI_PATH_TAG);
    else set.delete(DIALOGUE_THEATER_MULTI_PATH_TAG);
    return DIALOGUE_THEATER_TAG_OPTIONS.filter((tag) => set.has(tag));
}

/**
 * @param {{ tags?: string[], eraName?: string, paths?: unknown[] }|null|undefined} conversation
 * @returns {string[]}
 */
export function getConversationTags(conversation) {
    const hasPaths = Array.isArray(conversation?.paths) && conversation.paths.length > 0;
    const rawTags = Array.isArray(conversation?.tags) ? conversation.tags : [];
    if (rawTags.length > 0) {
        return finalizeDialogueTheaterTags(rawTags, hasPaths);
    }
    // Legacy single eraName → ignore (cleared); still return base + multipath.
    return finalizeDialogueTheaterTags([], hasPaths);
}

/**
 * @param {Array<{ tags?: string[] }>} conversations
 * @returns {string[]}
 */
export function collectDialogueTheaterEraFilterOptions(conversations) {
    const set = new Set(DIALOGUE_THEATER_TAG_OPTIONS);
    for (const conversation of conversations || []) {
        for (const tag of getConversationTags(conversation)) set.add(tag);
    }
    return DIALOGUE_THEATER_TAG_OPTIONS.filter((tag) => set.has(tag));
}

/**
 * Filter: conversation must include the selected tag (or be untagged if sentinel).
 * @param {{ tags?: string[], eraName?: string, paths?: unknown[] }} conversation
 * @param {string} eraFilter
 * @returns {boolean}
 */
export function conversationMatchesEraFilter(conversation, eraFilter) {
    const filter = String(eraFilter || '').trim();
    if (!filter) return true;
    const tags = getConversationTags(conversation);
    if (filter === '__untagged__') {
        return tags.length === 0;
    }
    return tags.includes(filter);
}
