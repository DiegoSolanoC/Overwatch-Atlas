/**
 * Single-value predictive text (hero / voiceline) — same row UI as filter autocomplete.
 */

import { buildMatches } from '../../system-interface/interface-left-panel/event-system/form/autocomplete/tokenInputMatching.js';
import { renderTokenPickRow } from '../../system-interface/interface-left-panel/event-system/form/autocomplete/renderTokenPickRow.js';

/**
 * @param {HTMLInputElement} input
 * @param {string[]} options
 * @param {'heroes'|'voicelines'} type
 * @param {{ placement?: 'fixed'|'inline'|'overlay' }} [config]
 */
export function setupSingleValueAutocomplete(input, options, type, config = {}) {
    if (!input || input.dataset.singleAutocompleteWired === '1') return;
    input.dataset.singleAutocompleteWired = '1';

    const placement =
        config.placement === 'overlay'
            ? 'overlay'
            : config.placement === 'inline'
              ? 'inline'
              : 'fixed';

    /** @type {HTMLElement|null} */
    let listEl = null;

    const removeList = () => {
        listEl?.remove();
        listEl = null;
    };

    const getOverlayAnchor = () => {
        const col = input.closest('.dialogue-theater-pair-search-col');
        if (col instanceof HTMLElement) return col;
        const wrap = input.closest('.dialogue-theater-pair-search-slot__input-wrap');
        if (wrap instanceof HTMLElement) return wrap;
        const field = input.closest('.dialogue-theater-pair-search-slot__field');
        return field instanceof HTMLElement ? field : input.parentElement;
    };

    const getInlineAnchor = () => {
        const col = input.closest('.dialogue-theater-pair-search-col');
        if (col instanceof HTMLElement) return col;
        const field = input.closest('.dialogue-theater-pair-search-slot__field');
        return field instanceof HTMLElement ? field : input.parentElement;
    };

    const positionOverlayList = () => {
        if (!(listEl instanceof HTMLElement) || placement !== 'overlay') return;
        const anchor = getOverlayAnchor();
        if (!(anchor instanceof HTMLElement)) return;

        const anchorRect = anchor.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();
        listEl.style.position = 'absolute';
        listEl.style.left = '0';
        listEl.style.right = '0';
        listEl.style.top = `${inputRect.bottom - anchorRect.top + 4}px`;
        listEl.style.width = '100%';
    };

    input.addEventListener('input', () => {
        removeList();
        const value = input.value;
        const matchType = type === 'heroes' ? 'heroes' : 'countries';
        const matches = buildMatches(value, options, matchType).slice(0, 8);
        if (matches.length === 0) return;

        listEl = document.createElement('div');
        listEl.className = 'filter-autocomplete-list dialogue-theater-autocomplete-list';
        if (placement === 'overlay') {
            listEl.classList.add('dialogue-theater-autocomplete-list--overlay');
        } else if (placement === 'inline') {
            listEl.classList.add('dialogue-theater-autocomplete-list--inline');
        } else {
            const rect = input.getBoundingClientRect();
            listEl.style.left = `${rect.left}px`;
            listEl.style.top = `${rect.bottom + 4}px`;
            listEl.style.width = `${Math.max(rect.width, 220)}px`;
        }

        if (type === 'heroes') {
            matches.forEach((hero) => {
                renderTokenPickRow(listEl, {
                    matchHeroName: hero,
                    onPick: () => {
                        input.value = hero;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        removeList();
                        input.focus();
                    },
                });
            });
        } else {
            matches.forEach((file) => {
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'filter-autocomplete-item dialogue-theater-voice-item';
                row.textContent = file;
                row.addEventListener('mousedown', (e) => e.preventDefault());
                row.addEventListener('click', () => {
                    input.value = file;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    removeList();
                    input.focus();
                });
                listEl.appendChild(row);
            });
        }

        if (placement === 'overlay') {
            getOverlayAnchor()?.appendChild(listEl);
            positionOverlayList();
        } else if (placement === 'inline') {
            getInlineAnchor()?.appendChild(listEl);
        } else {
            document.body.appendChild(listEl);
        }
    });

    input.addEventListener('blur', () => {
        setTimeout(removeList, 200);
    });
}
