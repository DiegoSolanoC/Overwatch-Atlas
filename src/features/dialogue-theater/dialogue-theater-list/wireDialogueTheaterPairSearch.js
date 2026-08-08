/**
 * Character A ↔ B pair search controls beside the title search bar.
 */

import { loadDialogueTheaterHeroes, heroFilterIconUrl } from '../data/loadDialogueTheaterAssets.js';
import { setupSingleValueAutocomplete, updateSingleValueAutocompleteOptions } from '../dialogue-theater-info-panel/dialogueTheaterSingleAutocomplete.js';
import {
    buildDialogueTheaterSpeakerOptions,
    resolveExactRosterHero,
} from './dialogueTheaterPairSearch.js';

const PAIR_SEARCH_AUTOCOMPLETE = { placement: 'fixed' };
const HERO_ICON_FALLBACK = 'src/assets/images/Icons/Filter Icons/Heroes Icon.png';

/**
 * @param {HTMLInputElement} input
 * @param {string[]} speakerOptions
 */
function wirePairSearchAutocomplete(input, speakerOptions) {
    setupSingleValueAutocomplete(input, speakerOptions, 'heroes', PAIR_SEARCH_AUTOCOMPLETE);
}

/**
 * @param {HTMLImageElement|null} img
 * @param {string} characterName
 * @param {string[]} manifestHeroes
 */
function syncPairSearchIcon(img, characterName, manifestHeroes) {
    if (!(img instanceof HTMLImageElement)) return;

    const iconHero = resolveExactRosterHero(characterName, manifestHeroes);
    if (!iconHero) {
        img.hidden = true;
        img.removeAttribute('src');
        img.alt = '';
        return;
    }

    img.hidden = false;
    img.alt = iconHero;
    img.src = heroFilterIconUrl(iconHero);
    img.onerror = () => {
        img.onerror = null;
        img.src = HERO_ICON_FALLBACK;
    };
}

/**
 * @param {HTMLElement} root
 * @param {{ getConversations: () => import('../data/DialogueTheaterDataService.js').DialogueConversation[], onChange: () => void }} handlers
 * @returns {Promise<{ getPairA: () => string, getPairB: () => string }>}
 */
export async function wireDialogueTheaterPairSearch(root, handlers) {
    const inputA = root.querySelector('#dialogueTheaterPairSearchA');
    const inputB = root.querySelector('#dialogueTheaterPairSearchB');
    const iconA = root.querySelector('#dialogueTheaterPairSearchIconA');
    const iconB = root.querySelector('#dialogueTheaterPairSearchIconB');

    const manifestHeroes = await loadDialogueTheaterHeroes();
    const speakerOptions = buildDialogueTheaterSpeakerOptions(manifestHeroes);

    if (inputA instanceof HTMLInputElement) {
        wirePairSearchAutocomplete(inputA, speakerOptions);
    }
    if (inputB instanceof HTMLInputElement) {
        wirePairSearchAutocomplete(inputB, speakerOptions);
    }

    const refreshIcons = () => {
        const valueA = inputA instanceof HTMLInputElement ? inputA.value : '';
        const valueB = inputB instanceof HTMLInputElement ? inputB.value : '';
        syncPairSearchIcon(iconA instanceof HTMLImageElement ? iconA : null, valueA, manifestHeroes);
        syncPairSearchIcon(iconB instanceof HTMLImageElement ? iconB : null, valueB, manifestHeroes);
    };

    /** Only refilter when a completed roster hero selection actually changes. */
    let lastResolvedKey = `${resolveExactRosterHero('', manifestHeroes)}\0`;

    const resolvedFilterKey = () => {
        const valueA = inputA instanceof HTMLInputElement ? inputA.value : '';
        const valueB = inputB instanceof HTMLInputElement ? inputB.value : '';
        return `${resolveExactRosterHero(valueA, manifestHeroes)}\0${resolveExactRosterHero(valueB, manifestHeroes)}`;
    };

    const notifyIfResolvedChanged = () => {
        refreshIcons();
        const key = resolvedFilterKey();
        if (key === lastResolvedKey) return;
        lastResolvedKey = key;
        handlers.onChange();
    };

    /** Debounce typing; skip list work until a full valid hero name appears/clears. */
    let debounceTimer = 0;
    const notifyDebounced = () => {
        refreshIcons();
        window.clearTimeout(debounceTimer);
        debounceTimer = window.setTimeout(() => {
            notifyIfResolvedChanged();
        }, 120);
    };

    inputA?.addEventListener('input', notifyDebounced);
    inputB?.addEventListener('input', notifyDebounced);
    inputA?.addEventListener('change', notifyIfResolvedChanged);
    inputB?.addEventListener('change', notifyIfResolvedChanged);

    refreshIcons();
    lastResolvedKey = resolvedFilterKey();

    return {
        getPairA: () => (inputA instanceof HTMLInputElement ? inputA.value : ''),
        getPairB: () => (inputB instanceof HTMLInputElement ? inputB.value : ''),
        refreshSpeakerOptions: () => {
            const nextOptions = buildDialogueTheaterSpeakerOptions(manifestHeroes);
            if (inputA instanceof HTMLInputElement) {
                updateSingleValueAutocompleteOptions(inputA, nextOptions);
            }
            if (inputB instanceof HTMLInputElement) {
                updateSingleValueAutocompleteOptions(inputB, nextOptions);
            }
        },
    };
}
