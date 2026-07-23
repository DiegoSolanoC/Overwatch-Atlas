/**
 * Era / tag options used by Dialogue Theater list filter + edit dropdown extras.
 *
 * Batch import protocol:
 * 1. Add placeholders from a compilation video (temporary working tag)
 * 2. Wire audio from wiki / MatchTalk
 * 3. Manually rename entries and fix inconsistencies / missing files
 * 4. When the batch is clean, clear the working tag (untag) and retire it here
 */

import { DOCK_ERA_MENU_OPTIONS } from '../../system-interface/interface-bottom-dock/dockEraTimelineFilter.js';

/** Canonical timeline eras (excludes Complete Timeline). */
export const DIALOGUE_THEATER_TIMELINE_ERA_OPTIONS = DOCK_ERA_MENU_OPTIONS.filter(
    (o) => o.id !== 'complete',
).map((o) => o.label);

/** Active working tags for YouTube / import placeholder batches still in review. */
export const DIALOGUE_THEATER_WORKING_TAG_OPTIONS = Object.freeze([]);

/**
 * Retired working tags — file copy wins over stale localStorage for these.
 * Keep entries here after a batch is finalized so hard-refresh picks up untagging + line fixes.
 */
export const DIALOGUE_THEATER_RETIRED_WORKING_TAGS = Object.freeze([
    'Midseason 3 (YouTube placeholder)',
    'Season 3 launch (YouTube placeholder)',
]);

/**
 * @param {Array<{ eraName?: string }>} conversations
 * @returns {string[]}
 */
export function collectDialogueTheaterEraFilterOptions(conversations) {
    const set = new Set();
    for (const label of DIALOGUE_THEATER_TIMELINE_ERA_OPTIONS) set.add(label);
    for (const label of DIALOGUE_THEATER_WORKING_TAG_OPTIONS) set.add(label);
    const retired = new Set(DIALOGUE_THEATER_RETIRED_WORKING_TAGS);
    for (const conversation of conversations || []) {
        const era = String(conversation?.eraName || '').trim();
        if (era && !retired.has(era)) set.add(era);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} eraFilter
 * @returns {boolean}
 */
export function conversationMatchesEraFilter(conversation, eraFilter) {
    const filter = String(eraFilter || '').trim();
    if (!filter) return true;
    if (filter === '__untagged__') {
        return !String(conversation?.eraName || '').trim();
    }
    return String(conversation?.eraName || '').trim() === filter;
}
