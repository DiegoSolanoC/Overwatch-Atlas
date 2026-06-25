/**
 * Hero-scoped voiceline predictive text — matches dialogue part; spaces in query match `_` in files.
 */

import {
    matchVoicelinesForHero,
    voicelineFilenameToSubtitles,
} from '../data/theaterVoicelineParsing.js';
import {
    dismissOtherDialogueTheaterAutocompletes,
    registerAutocompleteDismiss,
    unregisterAutocompleteDismiss,
} from './dialogueTheaterAutocompleteDismiss.js';

/**
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {HTMLInputElement} input
 * @returns {HTMLElement|null}
 */
function getVoiceFieldWrap(input) {
    const wrap = input.closest('.dialogue-theater-line__voice-field');
    return wrap instanceof HTMLElement ? wrap : null;
}

/**
 * @param {HTMLInputElement} input
 * @param {{
 *   getHero: () => string,
 *   getVoicelines: () => string[],
 *   onPick?: (filename: string, subtitles: string) => void,
 * }} options
 */
export function setupVoicelineAutocomplete(input, options) {
    if (!input || input.dataset.voicelineAutocompleteWired === '1') return;
    input.dataset.voicelineAutocompleteWired = '1';

    const { getHero, getVoicelines, onPick } = options;

    /** @type {HTMLElement|null} */
    let listEl = null;

    const removeList = () => {
        listEl?.remove();
        listEl = null;
        unregisterAutocompleteDismiss(removeList);
    };

    const renderSuggestions = () => {
        removeList();
        const wrap = getVoiceFieldWrap(input);
        if (!wrap) return;

        const hero = getHero().trim();
        if (!hero) return;

        const voicelines = getVoicelines();
        const matches = matchVoicelinesForHero(hero, voicelines, input.value);
        if (matches.length === 0) return;

        dismissOtherDialogueTheaterAutocompletes(removeList);

        listEl = document.createElement('div');
        listEl.className =
            'filter-autocomplete-list dialogue-theater-autocomplete-list dialogue-theater-autocomplete-list--overlay';

        matches.forEach((file) => {
            const preview = voicelineFilenameToSubtitles(file);
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'filter-autocomplete-item dialogue-theater-voice-item';
            row.innerHTML = `<span class="dialogue-theater-voice-item__preview">${escapeHtml(preview)}</span>`;
            row.title = file;
            row.addEventListener('mousedown', (e) => e.preventDefault());
            row.addEventListener('click', () => {
                onPick?.(file, preview);
                input.dispatchEvent(new Event('change', { bubbles: true }));
                removeList();
                input.focus();
            });
            listEl.appendChild(row);
        });

        registerAutocompleteDismiss(removeList);

        wrap.appendChild(listEl);
        const wrapRect = wrap.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();
        listEl.style.top = `${inputRect.bottom - wrapRect.top + 4}px`;
    };

    input.addEventListener('input', renderSuggestions);
    input.addEventListener('focus', renderSuggestions);
    input.addEventListener('blur', () => {
        setTimeout(removeList, 200);
    });
}
