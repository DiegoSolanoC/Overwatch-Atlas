/**
 * Rules for which archive `connections[]` rows are real narrative links vs codex/mirror stubs.
 */

import { connectionRowHasNarrativeText } from './bioArchiveConnectionRanges.js';

/**
 * @param {object | null | undefined} c
 * @returns {boolean}
 */
export function bioConnectionRowHasNarrativeText(c) {
    return connectionRowHasNarrativeText(c);
}

/**
 * @param {object | null | undefined} c
 * @returns {boolean}
 */
export function bioConnectionRowIsPruned(c) {
    return !!(c && c.pruned === true);
}

/**
 * Archive row participates in Codex link sync / board authorization.
 * @param {object | null | undefined} c
 * @returns {boolean}
 */
export function bioConnectionRowIsActiveForCodex(c) {
    if (!c || bioConnectionRowIsPruned(c)) return false;
    return c.showInCodex === true;
}

/**
 * Row exists only for Codex / reciprocal mirror with no relationship copy.
 * @param {object | null | undefined} c
 * @returns {boolean}
 */
export function bioConnectionRowIsCodexOnlyStub(c) {
    if (!c) return false;
    return bioConnectionRowIsActiveForCodex(c) && !bioConnectionRowHasNarrativeText(c);
}

/**
 * Biography slides and intel panels: narrative rows and explicit Codex picks.
 * @param {object | null | undefined} c
 * @returns {boolean}
 */
export function bioConnectionRowIsDisplayable(c) {
    if (!c || bioConnectionRowIsPruned(c)) return false;
    const name = c.name != null ? String(c.name).trim() : '';
    if (!name) return false;
    if (bioConnectionRowHasNarrativeText(c)) return true;
    if (Array.isArray(c.ranges) && c.ranges.length > 0) return true;
    return true;
}

/**
 * Reciprocal mirrors: relationship text only (each entry owns its own `showInCodex` flags).
 * @param {object | null | undefined} c
 * @returns {boolean}
 */
export function shouldMirrorBioConnectionRow(c) {
    return bioConnectionRowHasNarrativeText(c);
}

/**
 * Empty mirror stubs left by old sync / junction reachability — safe to delete from JSON.
 * @param {object | null | undefined} c
 * @returns {boolean}
 */
export function bioConnectionRowIsJunctionPhantomStub(c) {
    if (!c) return false;
    const name = c.name != null ? String(c.name).trim() : '';
    if (!name) return false;
    return !bioConnectionRowIsDisplayable(c);
}
