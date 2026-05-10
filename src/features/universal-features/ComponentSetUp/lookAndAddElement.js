/**
 * lookAndAddElement — idempotent DOM mounting helper.
 *
 * Looks up the element with the given `id`. If it already exists, returns
 * it without doing anything else. If it doesn't exist, calls `createFn` to
 * build it; when `elementName` is supplied, also emits a status-line toast
 * announcing the creation.
 *
 * The "look first, add only if missing" guarantee is the whole point: it
 * lets loaders and panel factories run more than once across the app's
 * lifetime (mode entry → exit → re-entry) without duplicating panels.
 *
 * Renamed from `getOrCreateElement` to make the look-then-add behavior
 * explicit in the name (a plain "create" name implied unconditional
 * mounting, which would have been a bug if anyone had written it that way).
 */

import { updateStatus } from '../managers/StatusManager.js';

/**
 * @param {string} id - Element ID to look up.
 * @param {() => HTMLElement} createFn - Factory called only when the element doesn't exist yet.
 * @param {string|null} elementName - Optional human-readable name for the success toast.
 * @returns {HTMLElement|null}
 */
export function lookAndAddElement(id, createFn, elementName = null) {
    const existing = document.getElementById(id);
    if (existing) {
        return existing;
    }

    const element = createFn();
    if (elementName) {
        updateStatus(`✓ ${elementName} added`, 'success');
    }
    return element;
}
