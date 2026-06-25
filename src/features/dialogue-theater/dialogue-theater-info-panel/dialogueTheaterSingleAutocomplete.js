/**
 * Single-value predictive text (hero / voiceline) — same row UI as filter autocomplete.
 */

import { buildMatches } from '../../system-interface/interface-left-panel/event-system/form/autocomplete/tokenInputMatching.js';
import { renderTokenPickRow } from '../../system-interface/interface-left-panel/event-system/form/autocomplete/renderTokenPickRow.js';
import {
    dismissOtherDialogueTheaterAutocompletes,
    registerAutocompleteDismiss,
    unregisterAutocompleteDismiss,
} from './dialogueTheaterAutocompleteDismiss.js';

function playFilterPickSound() {
    if (typeof window !== 'undefined') {
        window.SoundEffectsManager?.play?.('filterPick');
    }
}

/**
 * @param {string} value
 * @param {string[]} options
 * @returns {string|null}
 */
function findExactHeroMatch(value, options) {
    const needle = String(value || '').trim().toLowerCase();
    if (!needle) return null;
    const match = options.find((option) => String(option || '').trim().toLowerCase() === needle);
    return match ? String(match).trim() : null;
}

/**
 * @param {HTMLInputElement} input
 * @param {string[]} options
 */
function maybePlayFilterPickForExactHero(input, options) {
    const exact = findExactHeroMatch(input.value, options);
    if (!exact) {
        input.dataset.heroFilterSoundMatch = '';
        return;
    }
    const key = exact.toLowerCase();
    if (input.dataset.heroFilterSoundMatch === key) return;
    input.dataset.heroFilterSoundMatch = key;
    playFilterPickSound();
}

/**
 * @param {HTMLInputElement} input
 * @param {string[]} options
 */
export function updateSingleValueAutocompleteOptions(input, options) {
    if (input) input._singleAutocompleteOptions = options;
}

/**
 * @param {HTMLInputElement} input
 * @param {string[]} options
 * @param {'heroes'|'voicelines'} type
 * @param {{ placement?: 'fixed'|'inline'|'overlay' }} [config]
 */
export function setupSingleValueAutocomplete(input, options, type, config = {}) {
    if (!input) return;

    if (input.dataset.singleAutocompleteWired === '1') {
        updateSingleValueAutocompleteOptions(input, options);
        return;
    }
    input.dataset.singleAutocompleteWired = '1';
    input._singleAutocompleteOptions = options;

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
        unregisterAutocompleteDismiss(removeList);
    };

    const getOptions = () =>
        Array.isArray(input._singleAutocompleteOptions) ? input._singleAutocompleteOptions : options;

    const getOverlayAnchor = () => {
        const heroWrap = input.closest('.dialogue-theater-line__hero-input-wrap');
        if (heroWrap instanceof HTMLElement) return heroWrap;
        const pairWrap = input.closest('.dialogue-theater-pair-search-col__input-wrap');
        if (pairWrap instanceof HTMLElement) return pairWrap;
        const heroField = input.closest('.dialogue-theater-line__hero-field');
        if (heroField instanceof HTMLElement) return heroField;
        const col = input.closest('.dialogue-theater-pair-search-col');
        if (col instanceof HTMLElement) return col;
        const wrap = input.closest('.dialogue-theater-pair-search-slot__input-wrap');
        if (wrap instanceof HTMLElement) return wrap;
        const field = input.closest('.dialogue-theater-pair-search-slot__field');
        return field instanceof HTMLElement ? field : input.parentElement;
    };

    const getInlineAnchor = () => {
        const heroWrap = input.closest('.dialogue-theater-line__hero-input-wrap');
        if (heroWrap instanceof HTMLElement) return heroWrap;
        const pairWrap = input.closest('.dialogue-theater-pair-search-col__input-wrap');
        if (pairWrap instanceof HTMLElement) return pairWrap;
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

    const onInput = () => {
        removeList();
        const value = input.value;
        const matchType = type === 'heroes' ? 'heroes' : 'countries';
        const currentOptions = getOptions();
        const matches = buildMatches(value, currentOptions, matchType).slice(0, 8);
        if (type === 'heroes') {
            maybePlayFilterPickForExactHero(input, currentOptions);
        }
        if (matches.length === 0) return;

        dismissOtherDialogueTheaterAutocompletes(removeList);

        listEl = document.createElement('div');
        listEl.className = 'filter-autocomplete-list dialogue-theater-autocomplete-list';
        if (placement === 'overlay') {
            listEl.classList.add('dialogue-theater-autocomplete-list--overlay');
            listEl.style.minWidth = '0';
        } else if (placement === 'inline') {
            listEl.classList.add('dialogue-theater-autocomplete-list--inline');
            listEl.style.minWidth = '0';
            listEl.style.width = '100%';
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
                        input.dataset.heroFilterSoundMatch = String(hero).trim().toLowerCase();
                        playFilterPickSound();
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

        registerAutocompleteDismiss(removeList);

        if (placement === 'overlay') {
            getOverlayAnchor()?.appendChild(listEl);
            positionOverlayList();
        } else if (placement === 'inline') {
            getInlineAnchor()?.appendChild(listEl);
        } else {
            document.body.appendChild(listEl);
        }
    };

    const onBlur = () => {
        setTimeout(removeList, 200);
    };

    input.addEventListener('input', onInput);
    input.addEventListener('blur', onBlur);
}
