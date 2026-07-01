/**
 * FormTokenAutocomplete — comma-token autocomplete for the edit modal and inline slide editor.
 *
 * Thin orchestrator that owns the lifecycle (one dropdown per input, removed on blur), wires
 * the input listener, and delegates the heavy lifting:
 *
 *   - `tokenInputMatching.js` — pure: trailing-segment parsing, dedupe set, substring rank,
 *                               and the per-type matcher (`heroes` / `factions` / `npcs` /
 *                               `countries`).
 *   - `renderTokenPickRow.js` — DOM: one `<button class="filter-autocomplete-item">` row with
 *                               the right icon, label, and detail badge.
 *
 * On pick, the chosen text replaces only the trailing segment of the input value
 * (everything after the final comma) and a `", "` separator is appended so the user can
 * keep typing the next token.
 *
 * Exposed as `window.FormTokenAutocomplete` (class) for classic-script consumers.
 */

import { buildMatches } from './tokenInputMatching.js';
import { renderTokenPickRow } from './renderTokenPickRow.js';

const ANCHOR_CLASS = 'filter-autocomplete-anchor';
const LIST_ANCHORED_CLASS = 'filter-autocomplete-list--anchored';

/**
 * Wrap the input once so the suggestion list can sit directly beneath it.
 * @param {HTMLInputElement} input
 * @returns {HTMLElement}
 */
function ensureAutocompleteAnchor(input) {
    const parent = input.parentElement;
    if (parent?.classList?.contains(ANCHOR_CLASS)) {
        return parent;
    }
    const anchor = document.createElement('div');
    anchor.className = ANCHOR_CLASS;
    input.parentNode?.insertBefore(anchor, input);
    anchor.appendChild(input);
    return anchor;
}

/**
 * @param {HTMLInputElement} input
 * @param {HTMLElement} listEl
 */
function mountAnchoredAutocompleteList(input, listEl) {
    const anchor = ensureAutocompleteAnchor(input);
    listEl.classList.add(LIST_ANCHORED_CLASS);
    listEl.style.left = '';
    listEl.style.top = '';
    listEl.style.width = '';
    anchor.appendChild(listEl);
}

class FormTokenAutocomplete {
    constructor() {
        this.autocompleteLists = new Map();
    }

    /**
     * @param {HTMLElement} input
     * @param {Array} options Heroes: `string[]`; factions: `{ filename, displayName }[]`; countries / npcs: `string[]`.
     * @param {'heroes'|'factions'|'npcs'|'countries'|'heroesAndNpcs'} type
     */
    setupAutocomplete(input, options, type) {
        if (input.dataset.autocompleteSetup === 'true') return;
        input.dataset.autocompleteSetup = 'true';

        let autocompleteList = null;

        const removeList = () => {
            if (autocompleteList) {
                autocompleteList.remove();
                autocompleteList = null;
            }
            this.autocompleteLists.delete(input);
        };

        input.addEventListener('input', () => {
            const value = input.value;
            const lastComma = value.lastIndexOf(',');
            removeList();

            const matches = buildMatches(value, options, type);
            if (matches.length === 0) return;

            autocompleteList = document.createElement('div');
            autocompleteList.className = 'filter-autocomplete-list';
            mountAnchoredAutocompleteList(input, autocompleteList);

            // Replace only the trailing segment (post-last-comma) with the picked text.
            const applyPick = (insertText) => {
                const before = lastComma >= 0 ? value.slice(0, lastComma + 1) + ' ' : '';
                input.value = `${before}${insertText}, `;
                input.focus();
                removeList();
            };

            if (type === 'heroes') {
                matches.forEach((h) => renderTokenPickRow(autocompleteList, {
                    matchHeroName: h, onPick: () => applyPick(h),
                }));
            } else if (type === 'factions') {
                matches.forEach((f) => renderTokenPickRow(autocompleteList, {
                    matchFaction: f, onPick: () => applyPick(f.displayName),
                }));
            } else if (type === 'npcs') {
                matches.forEach((n) => renderTokenPickRow(autocompleteList, {
                    matchNpcName: n, onPick: () => applyPick(n),
                }));
            } else if (type === 'countries') {
                matches.forEach((name) => renderTokenPickRow(autocompleteList, {
                    matchCountry: name, onPick: () => applyPick(name),
                }));
            } else if (type === 'heroesAndNpcs') {
                matches.forEach((entry) => {
                    if (entry.kind === 'npc') {
                        renderTokenPickRow(autocompleteList, {
                            matchNpcName: entry.name,
                            onPick: () => applyPick(entry.name),
                        });
                    } else {
                        renderTokenPickRow(autocompleteList, {
                            matchHeroName: entry.name,
                            onPick: () => applyPick(entry.name),
                        });
                    }
                });
            }

            this.autocompleteLists.set(input, autocompleteList);
        });

        // 200ms tail gives the click handler on the dropdown a chance to fire before
        // blur tears it down.
        input.addEventListener('blur', () => {
            setTimeout(removeList, 200);
        });
    }

    clearAll() {
        this.autocompleteLists.forEach((list) => {
            if (list && list.parentNode) list.remove();
        });
        this.autocompleteLists.clear();
    }
}

if (typeof window !== 'undefined') {
    window.FormTokenAutocomplete = FormTokenAutocomplete;
}

export default FormTokenAutocomplete;
