/**
 * Predictive text for Dialogue Theater interaction names on story Commentary rows.
 * Same anchored dropdown pattern as story source-name autocomplete.
 */

import { buildMatches } from '../interface-left-panel/event-system/form/autocomplete/tokenInputMatching.js';
import {
    ensureAutocompleteAnchor,
    mountAnchoredAutocompleteList,
} from '../interface-left-panel/event-system/form/autocomplete/autocompleteListAnchor.js';
import { dialogueTheaterDataService } from '../../dialogue-theater/data/DialogueTheaterDataService.js?v=105';

/** @type {string[] | null} */
let cachedNames = null;
/** @type {Promise<string[]> | null} */
let loadPromise = null;

/**
 * @returns {Promise<string[]>}
 */
export async function ensureDialogueTheaterInteractionNames() {
    if (Array.isArray(cachedNames) && cachedNames.length > 0) return cachedNames;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
        try {
            if (!Array.isArray(dialogueTheaterDataService.conversations)
                || dialogueTheaterDataService.conversations.length === 0) {
                await dialogueTheaterDataService.load();
            }
        } catch (err) {
            console.warn('storyEventCommentaryAutocomplete: failed to load theater data', err);
        }
        const names = dialogueTheaterDataService.conversations
            .map((row) => String(row?.name || '').trim())
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        cachedNames = names;
        return names;
    })();

    try {
        return await loadPromise;
    } finally {
        loadPromise = null;
    }
}

export function clearDialogueTheaterInteractionNamesCache() {
    cachedNames = null;
}

/**
 * @param {HTMLInputElement} nameInput
 */
export function wireStoryEventCommentaryAutocomplete(nameInput) {
    if (!nameInput || nameInput.dataset.storyEventCommentaryAutocomplete === 'true') return;
    nameInput.dataset.storyEventCommentaryAutocomplete = 'true';

    nameInput.setAttribute('autocomplete', 'off');
    nameInput.setAttribute('spellcheck', 'true');
    ensureAutocompleteAnchor(nameInput);

    /** @type {HTMLElement|null} */
    let listEl = null;
    const removeList = () => {
        listEl?.remove();
        listEl = null;
    };

    const renderSuggestions = async () => {
        removeList();
        const names = await ensureDialogueTheaterInteractionNames();
        const matches = buildMatches(nameInput.value, names, 'heroes').slice(0, 8);
        if (!matches.length) return;

        listEl = document.createElement('div');
        listEl.className = 'filter-autocomplete-list';
        matches.forEach((text) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'filter-autocomplete-item';
            btn.textContent = text;
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                nameInput.value = text;
                removeList();
                window.SoundEffectsManager?.play?.('filterPick');
            });
            listEl.appendChild(btn);
        });
        mountAnchoredAutocompleteList(nameInput, listEl);
    };

    nameInput.addEventListener('focus', () => {
        void ensureDialogueTheaterInteractionNames();
    });
    nameInput.addEventListener('input', () => {
        void renderSuggestions();
    });
    nameInput.addEventListener('blur', () => {
        window.setTimeout(removeList, 120);
    });
    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') removeList();
    });
}

/**
 * @param {HTMLElement | null | undefined} container
 */
export function wireCommentaryRowsIn(container) {
    if (!container) return;
    container.querySelectorAll('[data-role="commentary-name"]').forEach((input) => {
        if (input instanceof HTMLInputElement) {
            wireStoryEventCommentaryAutocomplete(input);
        }
    });
}
