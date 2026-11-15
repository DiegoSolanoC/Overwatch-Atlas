/**
 * Predictive text for Dialogue Theater interaction names on story Commentary rows.
 * Same anchored dropdown pattern as story source-name autocomplete.
 */

import {
    ensureAutocompleteAnchor,
    mountAnchoredAutocompleteList,
} from '../interface-left-panel/event-system/form/autocomplete/autocompleteListAnchor.js';
import { dialogueTheaterDataService } from '../../dialogue-theater/data/DialogueTheaterDataService.js?v=105';
import {
    listStoryCommentaryTheaterOptions,
    stampCommentaryTheaterIds,
} from './storyEventCommentaryTheater.js';
import { buildCommentaryNameMatches } from './storyEventCommentaryMatch.js';
import {
    applyCommentaryEntryToNameInput,
    looksLikeChatterCommentaryName,
} from './storyEventCommentary.js';

/** @type {{ name: string, listLabel: string, theaterId?: string, lineId?: string }[] | null} */
let cachedOptions = null;
/** @type {Promise<{ name: string, listLabel: string, theaterId?: string, lineId?: string }[]> | null} */
let loadPromise = null;

/**
 * Show / hide the simplified label field when the theater name is a chatter line.
 * Also stamps theaterId / lineId on the name input when a match resolves.
 * @param {HTMLInputElement} nameInput
 * @returns {Promise<void>}
 */
export async function syncCommentaryChatterLabelVisibility(nameInput) {
    const row = nameInput?.closest?.('.event-slide-inline-editor__commentary-row');
    if (!row) return;
    const labelInput = row.querySelector('[data-role="commentary-label"]');
    if (!(labelInput instanceof HTMLInputElement)) return;
    const isChatter = looksLikeChatterCommentaryName(nameInput.value);
    row.classList.toggle('event-slide-inline-editor__commentary-row--chatter', isChatter);
    labelInput.hidden = !isChatter;
    if (!isChatter) labelInput.value = '';

    // Wait for theater data — stamping against [] leaves names unlinked.
    const options = await ensureDialogueTheaterInteractionOptions();
    let name = nameInput.value.trim();
    let theaterId = nameInput.dataset.theaterId || undefined;
    let lineId = nameInput.dataset.lineId || undefined;

    // If the field still holds a disambiguated dropdown label, map it back.
    if (!theaterId && name) {
        const byLabel = options.find((opt) => opt.listLabel === name);
        if (byLabel) {
            name = byLabel.name;
            nameInput.value = byLabel.name;
            theaterId = byLabel.theaterId;
            lineId = byLabel.lineId;
        }
    }

    const stamped = stampCommentaryTheaterIds(
        [{ name, theaterId, lineId }],
        dialogueTheaterDataService?.conversations || [],
    )[0];
    applyCommentaryEntryToNameInput(nameInput, stamped || null);
}

/**
 * Dialogue interaction names + active Hero Chatter line labels.
 * @returns {Promise<{ name: string, listLabel: string, theaterId?: string, lineId?: string }[]>}
 */
export async function ensureDialogueTheaterInteractionOptions() {
    if (Array.isArray(cachedOptions) && cachedOptions.length > 0) return cachedOptions;
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
        const options = listStoryCommentaryTheaterOptions(
            dialogueTheaterDataService.conversations,
        );
        cachedOptions = options;
        return options;
    })();

    try {
        return await loadPromise;
    } finally {
        loadPromise = null;
    }
}

/** @deprecated Prefer {@link ensureDialogueTheaterInteractionOptions} */
export async function ensureDialogueTheaterInteractionNames() {
    const options = await ensureDialogueTheaterInteractionOptions();
    return options.map((opt) => opt.listLabel);
}

export function clearDialogueTheaterInteractionNamesCache() {
    cachedOptions = null;
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
    /** @type {{ name: string, listLabel: string, theaterId?: string, lineId?: string }[]} */
    let currentMatches = [];
    const removeList = () => {
        listEl?.remove();
        listEl = null;
        currentMatches = [];
    };

    /**
     * @param {{ name: string, listLabel: string, theaterId?: string, lineId?: string } | null | undefined} opt
     * @param {string} [fallbackLabel]
     */
    const commitOption = (opt, fallbackLabel = '') => {
        if (!opt && !fallbackLabel) return;
        nameInput.value = opt?.name || fallbackLabel;
        if (opt?.theaterId) nameInput.dataset.theaterId = opt.theaterId;
        else delete nameInput.dataset.theaterId;
        if (opt?.lineId) nameInput.dataset.lineId = opt.lineId;
        else delete nameInput.dataset.lineId;
        removeList();
        void syncCommentaryChatterLabelVisibility(nameInput);
        nameInput.dispatchEvent(new Event('change', { bubbles: true }));
        window.SoundEffectsManager?.play?.('filterPick');
    };

    const renderSuggestions = async () => {
        removeList();
        const options = await ensureDialogueTheaterInteractionOptions();
        const byLabel = new Map(options.map((opt) => [opt.listLabel, opt]));
        const labels = buildCommentaryNameMatches(nameInput.value, options, 8);
        currentMatches = labels.map((label) => byLabel.get(label)).filter(Boolean);
        if (!currentMatches.length) return;

        listEl = document.createElement('div');
        listEl.className = 'filter-autocomplete-list';
        currentMatches.forEach((opt) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'filter-autocomplete-item';
            btn.textContent = opt.listLabel;
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                // Always commit the real conversation/chatter name + stable ids.
                commitOption(opt);
            });
            listEl.appendChild(btn);
        });
        mountAnchoredAutocompleteList(nameInput, listEl);
    };

    nameInput.addEventListener('focus', () => {
        void ensureDialogueTheaterInteractionOptions().then(() => {
            void syncCommentaryChatterLabelVisibility(nameInput);
        });
    });
    nameInput.addEventListener('input', () => {
        // Typing invalidates a previous pick's theaterId unless it still exact-matches.
        delete nameInput.dataset.theaterId;
        delete nameInput.dataset.lineId;
        void syncCommentaryChatterLabelVisibility(nameInput);
        void renderSuggestions();
    });
    nameInput.addEventListener('change', () => {
        void syncCommentaryChatterLabelVisibility(nameInput);
    });
    nameInput.addEventListener('blur', () => {
        window.setTimeout(removeList, 120);
        void syncCommentaryChatterLabelVisibility(nameInput);
    });
    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            removeList();
            return;
        }
        // Enter commits the top-ranked suggestion (exact titles sort first).
        if (e.key === 'Enter' && currentMatches.length) {
            e.preventDefault();
            commitOption(currentMatches[0]);
        }
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
