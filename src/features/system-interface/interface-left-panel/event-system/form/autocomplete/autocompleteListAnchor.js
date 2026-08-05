/**
 * Shared anchor helper so autocomplete dropdowns sit under their input
 * (position:absolute) instead of floating with fixed and no coordinates.
 */

export const AUTOCOMPLETE_ANCHOR_CLASS = 'filter-autocomplete-anchor';
export const AUTOCOMPLETE_LIST_ANCHORED_CLASS = 'filter-autocomplete-list--anchored';

/**
 * Wrap the input once so the suggestion list can sit directly beneath it.
 * Safe to call while focused — restores focus after reparenting.
 * @param {HTMLInputElement} input
 * @returns {HTMLElement}
 */
export function ensureAutocompleteAnchor(input) {
    const parent = input.parentElement;
    if (parent?.classList?.contains(AUTOCOMPLETE_ANCHOR_CLASS)) {
        return parent;
    }
    const hadFocus = typeof document !== 'undefined' && document.activeElement === input;
    const anchor = document.createElement('div');
    anchor.className = AUTOCOMPLETE_ANCHOR_CLASS;
    input.parentNode?.insertBefore(anchor, input);
    anchor.appendChild(input);
    if (hadFocus) {
        try {
            input.focus({ preventScroll: true });
        } catch {
            input.focus();
        }
    }
    return anchor;
}

/**
 * @param {HTMLInputElement} input
 * @param {HTMLElement} listEl
 */
export function mountAnchoredAutocompleteList(input, listEl) {
    const anchor = ensureAutocompleteAnchor(input);
    listEl.classList.add(AUTOCOMPLETE_LIST_ANCHORED_CLASS);
    listEl.style.left = '';
    listEl.style.top = '';
    listEl.style.width = '';
    anchor.appendChild(listEl);
}
