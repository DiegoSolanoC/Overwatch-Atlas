/**
 * Single-value predictive text (hero / voiceline) — same row UI as filter autocomplete.
 */

import { buildMatches } from '../../system-interface/interface-left-panel/event-system/form/autocomplete/tokenInputMatching.js';
import { renderTokenPickRow } from '../../system-interface/interface-left-panel/event-system/form/autocomplete/renderTokenPickRow.js';

/**
 * @param {HTMLInputElement} input
 * @param {string[]} options
 * @param {'heroes'|'voicelines'} type
 */
export function setupSingleValueAutocomplete(input, options, type) {
    if (!input || input.dataset.singleAutocompleteWired === '1') return;
    input.dataset.singleAutocompleteWired = '1';

    /** @type {HTMLElement|null} */
    let listEl = null;

    const removeList = () => {
        listEl?.remove();
        listEl = null;
    };

    input.addEventListener('input', () => {
        removeList();
        const value = input.value;
        const matchType = type === 'heroes' ? 'heroes' : 'countries';
        const matches = buildMatches(value, options, matchType).slice(0, 8);
        if (matches.length === 0) return;

        listEl = document.createElement('div');
        listEl.className = 'filter-autocomplete-list dialogue-theater-autocomplete-list';
        const rect = input.getBoundingClientRect();
        listEl.style.left = `${rect.left}px`;
        listEl.style.top = `${rect.bottom + 4}px`;
        listEl.style.width = `${Math.max(rect.width, 220)}px`;

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

        document.body.appendChild(listEl);
    });

    input.addEventListener('blur', () => {
        setTimeout(removeList, 200);
    });
}
