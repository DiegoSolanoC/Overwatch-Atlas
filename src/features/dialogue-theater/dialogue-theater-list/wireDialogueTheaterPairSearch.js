/**
 * Character A ↔ B pair search controls beside the title search bar.
 */

import { loadDialogueTheaterHeroes, heroFilterIconUrl } from '../data/loadDialogueTheaterAssets.js';
import { setupSingleValueAutocomplete, updateSingleValueAutocompleteOptions } from '../dialogue-theater-info-panel/dialogueTheaterSingleAutocomplete.js';
import { buildDialogueTheaterSpeakerOptions } from './dialogueTheaterPairSearch.js';

const PAIR_SEARCH_AUTOCOMPLETE = { placement: 'overlay' };
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
 */
function syncPairSearchIcon(img, characterName) {
    if (!(img instanceof HTMLImageElement)) return;

    const trimmed = String(characterName || '').trim();
    if (!trimmed) {
        img.hidden = true;
        img.removeAttribute('src');
        img.alt = '';
        return;
    }

    img.hidden = false;
    img.alt = trimmed;
    img.src = heroFilterIconUrl(trimmed);
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
    const speakerOptions = buildDialogueTheaterSpeakerOptions(manifestHeroes, handlers.getConversations());

    if (inputA instanceof HTMLInputElement) {
        wirePairSearchAutocomplete(inputA, speakerOptions);
    }
    if (inputB instanceof HTMLInputElement) {
        wirePairSearchAutocomplete(inputB, speakerOptions);
    }

    const refreshIcons = () => {
        const valueA = inputA instanceof HTMLInputElement ? inputA.value : '';
        const valueB = inputB instanceof HTMLInputElement ? inputB.value : '';
        syncPairSearchIcon(iconA instanceof HTMLImageElement ? iconA : null, valueA);
        syncPairSearchIcon(iconB instanceof HTMLImageElement ? iconB : null, valueB);
    };

    const notify = () => {
        refreshIcons();
        handlers.onChange();
    };

    inputA?.addEventListener('input', notify);
    inputB?.addEventListener('input', notify);
    inputA?.addEventListener('change', notify);
    inputB?.addEventListener('change', notify);

    refreshIcons();

    return {
        getPairA: () => (inputA instanceof HTMLInputElement ? inputA.value : ''),
        getPairB: () => (inputB instanceof HTMLInputElement ? inputB.value : ''),
        refreshSpeakerOptions: () => {
            const nextOptions = buildDialogueTheaterSpeakerOptions(manifestHeroes, handlers.getConversations());
            if (inputA instanceof HTMLInputElement) {
                updateSingleValueAutocompleteOptions(inputA, nextOptions);
            }
            if (inputB instanceof HTMLInputElement) {
                updateSingleValueAutocompleteOptions(inputB, nextOptions);
            }
        },
    };
}
