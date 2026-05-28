/**
 * Rules for which archive `connections[]` rows are real narrative links vs codex/mirror stubs.
 */

/**
 * @param {object | null | undefined} c
 * @returns {boolean}
 */
export function bioConnectionRowHasNarrativeText(c) {
    if (!c) return false;
    const toLinked =
        c.reasoningSubjectToLinked != null ? String(c.reasoningSubjectToLinked).trim() : '';
    const toSubject =
        c.reasoningLinkedToSubject != null ? String(c.reasoningLinkedToSubject).trim() : '';
    const legacy = c.reasoning != null ? String(c.reasoning).trim() : '';
    return Boolean(toLinked || toSubject || legacy);
}

/**
 * Row exists only for Codex / reciprocal mirror with no relationship copy.
 * @param {object | null | undefined} c
 * @returns {boolean}
 */
export function bioConnectionRowIsCodexOnlyStub(c) {
    if (!c) return false;
    return c.showInCodex === true && !bioConnectionRowHasNarrativeText(c);
}

/**
 * Biography slides and intel panels: narrative rows and explicit Codex picks.
 * @param {object | null | undefined} c
 * @returns {boolean}
 */
export function bioConnectionRowIsDisplayable(c) {
    if (!c) return false;
    const name = c.name != null ? String(c.name).trim() : '';
    if (!name) return false;
    if (bioConnectionRowHasNarrativeText(c)) return true;
    if (c.showInCodex === true) return true;
    return false;
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
