/**
 * Dialogue Theater conversation tags + status helpers.
 *
 * Status (separate field): Active | Removed  (legacy value `outdated` ≡ Removed)
 *
 * Era pair (exactly one): Overwatch | Classic
 * Stackable tags: Map Specific, Skin Specific, Multi Path (auto from routes)
 */

import { isChatterEntry } from '../data/dialogueTheaterEntryType.js';

/** @typedef {'active'|'removed'} DialogueTheaterStatus */

/** Canonical stackable + era tags — order used in editors / badges. */
export const DIALOGUE_THEATER_TAG_OPTIONS = Object.freeze([
    'Overwatch',
    'Classic',
    'Map Specific',
    'Skin Specific',
    'Multi Path',
]);

/** Stackable tags the editor can toggle (era is a radio pair). */
export const DIALOGUE_THEATER_STACKABLE_TAGS = Object.freeze([
    'Map Specific',
    'Skin Specific',
]);

/** @deprecated Use DIALOGUE_THEATER_STACKABLE_TAGS — kept for older imports. */
export const DIALOGUE_THEATER_EDITABLE_TAGS = DIALOGUE_THEATER_STACKABLE_TAGS;

export const DIALOGUE_THEATER_ERA_OVERWATCH = 'Overwatch';
export const DIALOGUE_THEATER_ERA_CLASSIC = 'Classic';
export const DIALOGUE_THEATER_BASE_TAG = DIALOGUE_THEATER_ERA_OVERWATCH;
export const DIALOGUE_THEATER_MULTI_PATH_TAG = 'Multi Path';
export const DIALOGUE_THEATER_MAP_SPECIFIC_TAG = 'Map Specific';
/** @deprecated Prefer DIALOGUE_THEATER_MAP_SPECIFIC_TAG */
export const DIALOGUE_THEATER_MAP_EXCLUSIVE_TAG = DIALOGUE_THEATER_MAP_SPECIFIC_TAG;
export const DIALOGUE_THEATER_SKIN_SPECIFIC_TAG = 'Skin Specific';

/** Retired tag → becomes status Removed on normalize. */
export const DIALOGUE_THEATER_RETIRED_REMOVED_TAG = 'Removed';

/** Legacy label kept only for reading old saves. */
export const DIALOGUE_THEATER_LEGACY_MAP_TAG = 'Map Exclusive';

/**
 * Parse map/skin choice labels from a free-text field (comma / semicolon / newline separated).
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeDialogueTheaterChoiceList(value) {
    /** @type {string[]} */
    const rawParts = [];
    if (Array.isArray(value)) {
        for (const item of value) {
            const text = String(item ?? '').trim();
            if (text) rawParts.push(text);
        }
    } else if (value != null && value !== '') {
        rawParts.push(
            ...String(value)
                .split(/[,;\n]+/)
                .map((part) => part.trim())
                .filter(Boolean),
        );
    }
    /** @type {string[]} */
    const out = [];
    const seen = new Set();
    for (const part of rawParts) {
        const key = part.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(part);
    }
    return out;
}

/** @deprecated Prefer normalizeDialogueTheaterChoiceList */
export function normalizeDialogueTheaterMapChoices(value) {
    return normalizeDialogueTheaterChoiceList(value);
}

/**
 * @param {unknown} raw
 * @returns {DialogueTheaterStatus}
 */
export function normalizeDialogueTheaterStatus(raw) {
    const value = String(raw != null ? raw : 'active').trim().toLowerCase();
    if (value === 'removed' || value === 'outdated') return 'removed';
    return 'active';
}

/**
 * @param {DialogueTheaterStatus|string|null|undefined} status
 * @returns {string}
 */
export function labelForDialogueTheaterStatus(status) {
    return normalizeDialogueTheaterStatus(status) === 'removed' ? 'Removed' : 'Active';
}

/**
 * @param {{ tags?: string[], mapChoices?: unknown }|null|undefined} conversation
 * @returns {string[]}
 */
export function getConversationMapChoices(conversation) {
    const tags = getConversationTags(conversation);
    if (!tags.includes(DIALOGUE_THEATER_MAP_SPECIFIC_TAG)) return [];
    return normalizeDialogueTheaterChoiceList(conversation?.mapChoices);
}

/**
 * @param {{ tags?: string[], skinChoices?: unknown }|null|undefined} conversation
 * @returns {string[]}
 */
export function getConversationSkinChoices(conversation) {
    const tags = getConversationTags(conversation);
    if (!tags.includes(DIALOGUE_THEATER_SKIN_SPECIFIC_TAG)) return [];
    return normalizeDialogueTheaterChoiceList(conversation?.skinChoices);
}

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
 * Map legacy tag labels onto the current vocabulary (before allow-list filter).
 * @param {string} tag
 * @returns {string}
 */
function rewriteLegacyTag(tag) {
    if (tag === DIALOGUE_THEATER_LEGACY_MAP_TAG) return DIALOGUE_THEATER_MAP_SPECIFIC_TAG;
    return tag;
}

/**
 * @param {unknown} value
 * @returns {{ tags: string[], hadRemovedTag: boolean }}
 */
export function normalizeDialogueTheaterTagsWithFlags(value) {
    const allowed = new Set(DIALOGUE_THEATER_TAG_OPTIONS);
    const seen = new Set();
    /** @type {string[]} */
    const out = [];
    let hadRemovedTag = false;
    const list = Array.isArray(value) ? value : value != null && value !== '' ? [value] : [];
    for (const raw of list) {
        let tag = String(raw || '').trim();
        if (!tag) continue;
        if (tag === DIALOGUE_THEATER_RETIRED_REMOVED_TAG) {
            hadRemovedTag = true;
            continue;
        }
        tag = rewriteLegacyTag(tag);
        if (!allowed.has(tag) || seen.has(tag)) continue;
        seen.add(tag);
        out.push(tag);
    }
    return { tags: out, hadRemovedTag };
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeDialogueTheaterTags(value) {
    return normalizeDialogueTheaterTagsWithFlags(value).tags;
}

/**
 * Exactly one era tag; sync Multi Path from route data; drop conflicts.
 * @param {string[]} tags
 * @param {boolean} hasPaths
 * @returns {string[]}
 */
export function finalizeDialogueTheaterTags(tags, hasPaths) {
    const set = new Set(normalizeDialogueTheaterTags(tags));

    const hasClassic = set.has(DIALOGUE_THEATER_ERA_CLASSIC);
    const hasOverwatch = set.has(DIALOGUE_THEATER_ERA_OVERWATCH);
    set.delete(DIALOGUE_THEATER_ERA_CLASSIC);
    set.delete(DIALOGUE_THEATER_ERA_OVERWATCH);
    if (hasClassic && !hasOverwatch) {
        set.add(DIALOGUE_THEATER_ERA_CLASSIC);
    } else if (hasClassic && hasOverwatch) {
        // Prefer Classic when both were somehow set (explicit classic intent).
        set.add(DIALOGUE_THEATER_ERA_CLASSIC);
    } else {
        set.add(DIALOGUE_THEATER_ERA_OVERWATCH);
    }

    if (hasPaths) set.add(DIALOGUE_THEATER_MULTI_PATH_TAG);
    else set.delete(DIALOGUE_THEATER_MULTI_PATH_TAG);

    return DIALOGUE_THEATER_TAG_OPTIONS.filter((tag) => set.has(tag));
}

/**
 * @param {{ tags?: string[], eraName?: string, paths?: unknown[], entryType?: string }|null|undefined} conversation
 * @returns {string[]}
 */
export function getConversationTags(conversation) {
    if (isChatterEntry(conversation)) {
        return normalizeDialogueTheaterTags(
            Array.isArray(conversation?.tags) ? conversation.tags : [],
        );
    }
    const hasPaths = Array.isArray(conversation?.paths) && conversation.paths.length > 0;
    const rawTags = Array.isArray(conversation?.tags) ? conversation.tags : [];
    if (rawTags.length > 0) {
        return finalizeDialogueTheaterTags(rawTags, hasPaths);
    }
    return finalizeDialogueTheaterTags([], hasPaths);
}

/**
 * Era tag for a conversation (Overwatch or Classic).
 * @param {{ tags?: string[], paths?: unknown[], entryType?: string }|null|undefined} conversation
 * @returns {'Overwatch'|'Classic'|''}
 */
export function getConversationEraTag(conversation) {
    const tags = getConversationTags(conversation);
    if (tags.includes(DIALOGUE_THEATER_ERA_CLASSIC)) return DIALOGUE_THEATER_ERA_CLASSIC;
    if (tags.includes(DIALOGUE_THEATER_ERA_OVERWATCH)) return DIALOGUE_THEATER_ERA_OVERWATCH;
    return isChatterEntry(conversation) ? '' : DIALOGUE_THEATER_ERA_OVERWATCH;
}

/**
 * Options for the tag filter dropdown (excludes era duality — use era filter).
 * @param {Array<{ tags?: string[] }>} conversations
 * @returns {string[]}
 */
export function collectDialogueTheaterStackableFilterOptions(conversations) {
    const stackable = new Set([
        ...DIALOGUE_THEATER_STACKABLE_TAGS,
        DIALOGUE_THEATER_MULTI_PATH_TAG,
    ]);
    for (const conversation of conversations || []) {
        for (const tag of getConversationTags(conversation)) {
            if (stackable.has(tag)) stackable.add(tag);
        }
    }
    return [DIALOGUE_THEATER_MULTI_PATH_TAG, ...DIALOGUE_THEATER_STACKABLE_TAGS].filter((tag) =>
        stackable.has(tag),
    );
}

/** @deprecated Prefer collectDialogueTheaterStackableFilterOptions */
export function collectDialogueTheaterEraFilterOptions(conversations) {
    return collectDialogueTheaterStackableFilterOptions(conversations);
}

/**
 * Filter by stackable / legacy tag value.
 * Era pair and status use dedicated filters.
 * @param {{ tags?: string[], eraName?: string, paths?: unknown[], status?: string }} conversation
 * @param {string} eraFilter
 * @returns {boolean}
 */
export function conversationMatchesEraFilter(conversation, eraFilter) {
    const filter = String(eraFilter || '').trim();
    if (!filter) return true;
    const tags = getConversationTags(conversation);
    if (filter === '__untagged__') {
        return !tags.some((tag) =>
            tag === DIALOGUE_THEATER_MULTI_PATH_TAG ||
            DIALOGUE_THEATER_STACKABLE_TAGS.includes(tag),
        );
    }
    if (filter === DIALOGUE_THEATER_ERA_OVERWATCH || filter === DIALOGUE_THEATER_ERA_CLASSIC) {
        return getConversationEraTag(conversation) === filter;
    }
    if (filter === 'Active' || filter === '__status_active__') {
        return normalizeDialogueTheaterStatus(conversation?.status) === 'active';
    }
    if (
        filter === 'Removed' ||
        filter === '__status_removed__' ||
        filter === 'Outdated' ||
        filter === DIALOGUE_THEATER_RETIRED_REMOVED_TAG
    ) {
        return normalizeDialogueTheaterStatus(conversation?.status) === 'removed';
    }
    return tags.includes(filter);
}

/**
 * @param {{ status?: string }|null|undefined} conversation
 * @param {string} statusFilter
 * @returns {boolean}
 */
export function conversationMatchesStatusFilter(conversation, statusFilter) {
    const filter = String(statusFilter || '').trim().toLowerCase();
    if (!filter) return true;
    const status = normalizeDialogueTheaterStatus(conversation?.status);
    if (filter === 'active') return status === 'active';
    if (filter === 'removed' || filter === 'outdated') return status === 'removed';
    return true;
}

/**
 * @param {{ tags?: string[], paths?: unknown[], entryType?: string }|null|undefined} conversation
 * @param {string} eraFilter
 * @returns {boolean}
 */
export function conversationMatchesEraPairFilter(conversation, eraFilter) {
    const filter = String(eraFilter || '').trim();
    if (!filter) return true;
    return getConversationEraTag(conversation) === filter;
}
