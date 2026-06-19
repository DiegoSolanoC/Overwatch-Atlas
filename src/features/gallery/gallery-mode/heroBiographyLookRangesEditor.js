/**
 * Per-look event range inputs (heroes + factions): two predictive fields + Confirm.
 */

import {
    findStoryTimelineIndexByEventName,
    getLookRangeTimelineBounds,
} from './heroBiographyLookRangesResolve.js';
import {
    getBioBiographyLookRange,
    saveBioBiographyLookRange,
} from './bioBiographyLookRangesStorage.js';
import { normalizeBioBiographyCategory } from './bioBiographyCategories.js';
import {
    isStoryEventNameKnown,
    resolveCanonicalStoryEventName,
    wireStoryEventNameAutocomplete,
} from './heroBiographyEventNameAutocomplete.js';
import { isHeroBiographyLocalDev } from './heroBiographyLocalDev.js';

/** @type {boolean} */
let editorEnabled = false;

/** @type {HTMLElement | null} */
let rangeBlockEl = null;

/** @type {HTMLInputElement | null} */
let startInput = null;

/** @type {HTMLInputElement | null} */
let endInput = null;

/** @type {HTMLButtonElement | null} */
let confirmBtn = null;

/** @type {HTMLElement | null} */
let statusEl = null;

/** @type {import('./bioBiographyCategories.js').BioBiographyArchiveCategory | null} */
let activeCategory = null;

/** @type {string | null} */
let activeEntityId = null;

/** @type {string | null} */
let activeLook = null;

/**
 * @param {string} startName
 * @param {string} endName
 * @returns {string}
 */
function formatRangeStatus(startName, endName) {
    const startIdx = findStoryTimelineIndexByEventName(startName);
    const endIdx = findStoryTimelineIndexByEventName(endName);
    const parts = [];

    if (startName && startIdx < 0) parts.push(`“${startName}” not found`);
    if (endName && endIdx < 0) parts.push(`“${endName}” not found`);

    if (startIdx >= 0 && endIdx >= 0) {
        const lo = Math.min(startIdx, endIdx) + 1;
        const hi = Math.max(startIdx, endIdx) + 1;
        parts.push(lo === hi ? `Timeline slot ${lo}` : `Slots ${lo}–${hi}`);
    } else if (startIdx >= 0) {
        parts.push(`From slot ${startIdx + 1}`);
    } else if (endIdx >= 0) {
        parts.push(`Through slot ${endIdx + 1}`);
    }

    return parts.length ? parts.join(' · ') : '';
}

function updateConfirmButtonState() {
    if (!confirmBtn || !startInput || !endInput) return;

    const start = startInput.value.trim();
    const end = endInput.value.trim();
    const startOk = start && isStoryEventNameKnown(start);
    const endOk = end && isStoryEventNameKnown(end);
    const canConfirm = startOk || endOk;

    confirmBtn.disabled = !canConfirm || !activeEntityId || !activeLook || !activeCategory;
}

function updateStatusFromInputs() {
    if (!statusEl || !startInput || !endInput) return;

    const startEvent = startInput.value.trim();
    const endEvent = endInput.value.trim();
    const saved = activeCategory && activeEntityId && activeLook
        ? getLookRangeTimelineBounds(activeCategory, activeEntityId, activeLook)
        : null;

    if (saved) {
        const range = getBioBiographyLookRange(activeCategory, activeEntityId, activeLook);
        statusEl.textContent = formatRangeStatus(
            range?.startEvent || '',
            range?.endEvent || '',
        ) || 'Range saved — hover dock events to preview';
        statusEl.classList.add('is-valid');
        statusEl.classList.remove('is-invalid');
    } else if (startEvent || endEvent) {
        const preview = formatRangeStatus(startEvent, endEvent);
        statusEl.textContent = preview || 'Match at least one event name, then Confirm';
        const startOk = startEvent && isStoryEventNameKnown(startEvent);
        const endOk = endEvent && isStoryEventNameKnown(endEvent);
        statusEl.classList.toggle('is-valid', startOk || endOk);
        statusEl.classList.toggle('is-invalid', !startOk && !endOk);
    } else {
        statusEl.textContent = 'Set events for this look, then Confirm';
        statusEl.classList.remove('is-valid', 'is-invalid');
    }
}

/**
 * @param {string} lookName
 */
function loadInputsForLook(lookName) {
    activeLook = lookName || null;
    if (!startInput || !endInput) return;

    const range = activeCategory && activeEntityId && lookName
        ? getBioBiographyLookRange(activeCategory, activeEntityId, lookName)
        : null;

    startInput.value = range?.startEvent || '';
    endInput.value = range?.endEvent || '';
    updateConfirmButtonState();
    updateStatusFromInputs();
}

function onConfirm() {
    if (!activeCategory || !activeEntityId || !activeLook || !startInput || !endInput || !confirmBtn) return;

    const startRaw = startInput.value.trim();
    const endRaw = endInput.value.trim();
    const startCanonical = startRaw ? resolveCanonicalStoryEventName(startRaw) : null;
    const endCanonical = endRaw ? resolveCanonicalStoryEventName(endRaw) : null;

    if (!startCanonical && !endCanonical) return;

    saveBioBiographyLookRange(activeCategory, activeEntityId, activeLook, {
        startEvent: startCanonical || '',
        endEvent: endCanonical || '',
    });

    if (startCanonical) startInput.value = startCanonical;
    if (endCanonical) endInput.value = endCanonical;

    updateStatusFromInputs();
    updateConfirmButtonState();

    if (window.flashButton) {
        window.flashButton(confirmBtn, 'flash-green');
    }
    window.SoundEffectsManager?.play?.('filterButton');
}

function onLookRangesUpdated() {
    if (activeCategory && activeEntityId && activeLook) loadInputsForLook(activeLook);
}

export function isHeroBiographyLookRangesEditorEnabled() {
    return editorEnabled;
}

/**
 * @param {HTMLElement} rangesRowEl — localhost-only row under look + phrase controls.
 */
export function initHeroBiographyLookRangesEditor(rangesRowEl) {
    if (rangeBlockEl || !isHeroBiographyLocalDev()) return;

    editorEnabled = true;
    rangesRowEl.classList.add('gallery-mode__ranges-row--active');

    rangeBlockEl = document.createElement('div');
    rangeBlockEl.className = 'gallery-mode__look-event-range';
    rangeBlockEl.hidden = true;

    startInput = document.createElement('input');
    startInput.type = 'text';
    startInput.className = 'gallery-mode__look-event-range-input';
    startInput.placeholder = 'From event';
    startInput.setAttribute('aria-label', 'Range start event');
    startInput.setAttribute('autocomplete', 'off');

    const sep = document.createElement('span');
    sep.className = 'gallery-mode__look-event-range-sep';
    sep.textContent = '—';
    sep.setAttribute('aria-hidden', 'true');

    endInput = document.createElement('input');
    endInput.type = 'text';
    endInput.className = 'gallery-mode__look-event-range-input';
    endInput.placeholder = 'To event';
    endInput.setAttribute('aria-label', 'Range end event');
    endInput.setAttribute('autocomplete', 'off');

    confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'gallery-mode__look-event-range-confirm';
    confirmBtn.textContent = 'Confirm';
    confirmBtn.title = 'Save auto-look range for the selected look';
    confirmBtn.disabled = true;

    statusEl = document.createElement('p');
    statusEl.className = 'gallery-mode__look-event-range-status';

    const startWrap = document.createElement('div');
    startWrap.className = 'gallery-mode__look-event-range-input-wrap';
    startWrap.appendChild(startInput);

    const endWrap = document.createElement('div');
    endWrap.className = 'gallery-mode__look-event-range-input-wrap';
    endWrap.appendChild(endInput);

    const fieldsRow = document.createElement('div');
    fieldsRow.className = 'gallery-mode__look-event-range-fields';
    fieldsRow.append(startWrap, sep, endWrap, confirmBtn);

    rangeBlockEl.append(fieldsRow, statusEl);
    rangesRowEl.appendChild(rangeBlockEl);

    const onInputChange = () => {
        updateConfirmButtonState();
        updateStatusFromInputs();
    };

    wireStoryEventNameAutocomplete(startInput, onInputChange);
    wireStoryEventNameAutocomplete(endInput, onInputChange);
    startInput.addEventListener('input', onInputChange);
    endInput.addEventListener('input', onInputChange);
    confirmBtn.addEventListener('click', onConfirm);

    window.addEventListener('heroBiographyLookRangesUpdated', onLookRangesUpdated);
    window.addEventListener('bioBiographyLookRangesUpdated', onLookRangesUpdated);
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {string | null} filterKey
 * @param {string | null} [lookName]
 */
export function setBioBiographyLookRangesEditorEntity(category, filterKey, lookName = null) {
    if (!editorEnabled) return;

    if (!filterKey || (category !== 'heroes' && category !== 'factions')) {
        activeCategory = null;
        activeEntityId = null;
        if (rangeBlockEl) rangeBlockEl.hidden = true;
        activeLook = null;
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
        updateConfirmButtonState();
        if (statusEl) statusEl.textContent = '';
        return;
    }

    const cat = normalizeBioBiographyCategory(category);
    activeCategory = cat;
    activeEntityId = String(filterKey).trim();

    if (rangeBlockEl) rangeBlockEl.hidden = false;

    if (lookName) loadInputsForLook(lookName);
}

/**
 * @param {string | null} heroFilterKey
 * @param {string | null} [lookName]
 */
export function setHeroBiographyLookRangesEditorHero(heroFilterKey, lookName = null) {
    setBioBiographyLookRangesEditorEntity('heroes', heroFilterKey, lookName);
}

/**
 * Call when the Look dropdown changes.
 * @param {string} lookName
 */
export function syncHeroBiographyLookRangeEditorLook(lookName) {
    if (!editorEnabled || !activeEntityId || !activeCategory) return;
    loadInputsForLook(lookName);
}

export function destroyHeroBiographyLookRangesEditor() {
    window.removeEventListener('heroBiographyLookRangesUpdated', onLookRangesUpdated);
    window.removeEventListener('bioBiographyLookRangesUpdated', onLookRangesUpdated);
    rangeBlockEl?.parentElement?.classList.remove('gallery-mode__ranges-row--active');
    rangeBlockEl?.remove();
    editorEnabled = false;
    rangeBlockEl = null;
    startInput = null;
    endInput = null;
    confirmBtn = null;
    statusEl = null;
    activeCategory = null;
    activeEntityId = null;
    activeLook = null;
}
