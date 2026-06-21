/**
 * Periodic Table — Failure vs Success, then one of many hero responses.
 */

import { normalizeHeroKey } from '../data/theaterVoicelineParsing.js';

export const PERIODIC_TABLE_CONVERSATION_ID = 'c0a0de2e-e5fb-4e7b-aa23-5afa500bcc0d';
export const PERIODIC_TABLE_FAILURE_OPENING_LINE_ID = '9bb006fc-073e-49b3-8e34-cb2e4ac984d6';
export const PERIODIC_TABLE_SUCCESS_OPENING_LINE_ID = 'f1a2b3c4-d005-4000-8000-c0a0de2e0001';
export const PERIODIC_TABLE_SUCCESS_CLOSING_LINE_ID = 'f1a2b3c4-d005-4000-8000-c0a0de2e0002';

/** @deprecated Use PERIODIC_TABLE_FAILURE_OPENING_LINE_ID */
export const PERIODIC_TABLE_OPENING_LINE_ID = PERIODIC_TABLE_FAILURE_OPENING_LINE_ID;

/** @typedef {{ key: string, label: string }} PeriodicTableOutcomeOption */

/** @type {PeriodicTableOutcomeOption[]} */
export const PERIODIC_TABLE_OUTCOMES = [
    { key: 'failure', label: 'Failure' },
    { key: 'success', label: 'Success' },
];

/**
 * @typedef {{ outcome: string, hero: string, variant?: string }} PeriodicTableSegments
 */

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {boolean}
 */
export function isPeriodicTableConversation(conversation) {
    return (
        conversation?.id === PERIODIC_TABLE_CONVERSATION_ID ||
        String(conversation?.name || '').trim() === 'Periodic Table'
    );
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {boolean}
 */
export function shouldUsePeriodicTablePathPicker(conversation) {
    return isPeriodicTableConversation(conversation) && (conversation?.paths?.length || 0) > 0;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialoguePath} path
 * @returns {string}
 */
function inferOutcomeFromPath(path) {
    const openingId = path?.lineIds?.[0];
    if (openingId === PERIODIC_TABLE_SUCCESS_OPENING_LINE_ID) return 'success';
    if (openingId === PERIODIC_TABLE_FAILURE_OPENING_LINE_ID) return 'failure';
    return '';
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialoguePath} path
 * @returns {string}
 */
function inferHeroKeyFromPath(path) {
    const label = String(path?.label || '').trim();
    const sep = label.indexOf(' — ');
    const hero = sep >= 0 ? label.slice(0, sep).trim() : label;
    return normalizeHeroKey(hero);
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialoguePath} path
 * @returns {PeriodicTableSegments|null}
 */
export function getPathSegments(path) {
    const segments = path?.segments;
    const variant =
        segments && typeof segments === 'object' ? String(segments.variant || '').trim() : '';

    let outcome =
        segments && typeof segments === 'object' ? String(segments.outcome || '').trim() : '';
    let hero = segments && typeof segments === 'object' ? String(segments.hero || '').trim() : '';

    if (!outcome) outcome = inferOutcomeFromPath(path);
    if (!hero) hero = inferHeroKeyFromPath(path);

    if (!outcome || !hero) return null;

    return variant ? { outcome, hero, variant } : { outcome, hero };
}

/**
 * @param {PeriodicTableSegments} a
 * @param {PeriodicTableSegments} b
 * @returns {boolean}
 */
function segmentsMatch(a, b) {
    return a.outcome === b.outcome && a.hero === b.hero && (a.variant || '') === (b.variant || '');
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {PeriodicTableSegments} segments
 * @returns {string}
 */
export function findPathIdForSegments(conversation, segments) {
    const paths = conversation?.paths || [];
    const match = paths.find((path) => {
        const row = getPathSegments(path);
        return row && segmentsMatch(row, segments);
    });
    return match?.id || '';
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} pathId
 * @returns {PeriodicTableSegments}
 */
export function resolveSegmentsForPathId(conversation, pathId) {
    const paths = conversation?.paths || [];
    const path = paths.find((row) => row.id === pathId);
    const fromPath = path ? getPathSegments(path) : null;
    if (fromPath) return fromPath;

    const first = paths.find((row) => getPathSegments(row));
    if (first) {
        const segments = getPathSegments(first);
        if (segments) return segments;
    }

    return { outcome: PERIODIC_TABLE_OUTCOMES[0].key, hero: '' };
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} outcome
 * @returns {import('../data/DialogueTheaterDataService.js').DialoguePath[]}
 */
export function pathsForOutcome(conversation, outcome) {
    const key = String(outcome || '').trim();
    return (conversation?.paths || []).filter((path) => getPathSegments(path)?.outcome === key);
}

/**
 * @param {string} outcome
 * @returns {string}
 */
export function openingLineIdForOutcome(outcome) {
    return outcome === 'success'
        ? PERIODIC_TABLE_SUCCESS_OPENING_LINE_ID
        : PERIODIC_TABLE_FAILURE_OPENING_LINE_ID;
}

/**
 * @param {PeriodicTableOutcomeOption[]} options
 * @returns {PeriodicTableOutcomeOption}
 */
export function pickRandomOutcomeOption(options) {
    return options[Math.floor(Math.random() * options.length)];
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {string}
 */
export function pickRandomPeriodicTablePathId(conversation) {
    const outcome = pickRandomOutcomeOption(PERIODIC_TABLE_OUTCOMES).key;
    const pool = pathsForOutcome(conversation, outcome);
    if (pool.length === 0) {
        const paths = conversation?.paths || [];
        return paths[Math.floor(Math.random() * paths.length)]?.id || '';
    }
    return pool[Math.floor(Math.random() * pool.length)].id;
}
