/**
 * searchSelectionSync — mirrors the active filter selection (from `FilterService` or the
 * standalone `window.standaloneActiveFilters` set) into the manager's two text inputs.
 *
 * The Event Manager's "Use filter selection" mode (always on, control hidden) means the
 * filters input and country input are **read-only mirrors** of whatever's checked in the
 * Filters panel. Whenever the user clicks a filter chip or hits Confirm/Clear, we re-pull
 * the selected keys, partition them (country vs everything else), and rewrite the input
 * text accordingly.
 *
 * The sync also locks the inputs with `readOnly + opacity` cues so users see they can't
 * type when selection mode is active. `unlockFiltersInput` is the inverse — used when
 * Clear is pressed and the user chooses the legacy free-typing mode.
 */

import { partitionSelectionKeys } from './searchTokenUtils.js';
import { buildFilterIndex, isFilterIndexStale } from './searchIndexes.js';

/** Pull the currently-selected filter keys, preferring in-panel state over the standalone set. */
function getSelectedFilterKeys() {
    try {
        const fs = window.FilterService;
        const selected = fs?.stateManager?.toArray?.();
        if (Array.isArray(selected)) return selected;

        const active = window.standaloneActiveFilters;
        if (active && (active instanceof Set)) return Array.from(active);
        if (Array.isArray(active)) return active;
    } catch (_) { /* no-op */ }
    return [];
}

/** Convert `country:<flagFile>` keys into the display label CSV for the country input. */
function countryKeysToDisplayCsv(countryKeys) {
    const helper = window.LocationFlagHelpers?.commonLabelForFlagFile;
    const names = [];
    const seenFile = new Set();
    (countryKeys || []).forEach((key) => {
        const flagFile = String(key ?? '').replace(/^country:/i, '').trim();
        if (!flagFile) return;
        const lk = flagFile.toLowerCase();
        if (seenFile.has(lk)) return;
        seenFile.add(lk);
        const label = (typeof helper === 'function' && helper(flagFile)) || flagFile.replace(/\.png$/i, '');
        if (label) names.push(label);
    });
    return names.join(', ');
}

/**
 * Convert non-country selection keys into the filter-input CSV. Faction filenames are
 * mapped to their displayName via `filterIndex.factionEntries`; NPC keys are echoed back
 * with their canonical casing from `filterIndex.npcByLower`; anything else passes through.
 */
function selectionKeysToFilterText(keys, filterIndex) {
    const factionEntries = filterIndex.factionEntries || [];
    const factionByFilenameLower = new Map();
    factionEntries.forEach((fe) => {
        if (!fe?.filenameLower) return;
        factionByFilenameLower.set(fe.filenameLower, fe.displayName || fe.filename);
    });
    const npcByLower = filterIndex.npcByLower || new Map();

    const tokens = [];
    (keys || []).forEach((k) => {
        const raw = (k ?? '').toString().trim();
        if (!raw) return;
        if (raw.toLowerCase().startsWith('country:')) return;
        const lower = raw.toLowerCase();
        if (factionByFilenameLower.has(lower)) {
            tokens.push(factionByFilenameLower.get(lower));
        } else if (npcByLower.has(lower)) {
            tokens.push(npcByLower.get(lower));
        } else {
            tokens.push(raw);
        }
    });
    return tokens.join(', ');
}

/**
 * Build a sync controller bound to the given orchestration `ctx` (DOM refs + shared state +
 * input-popover hide callbacks + the `applySearch` step the parent installs).
 *
 * Returned shape:
 *   - `syncFiltersInputFromSelection()` — pulls + writes both inputs, then re-runs search.
 *     Re-entrancy is guarded by `ctx.state.isSyncingSelection` so reentrant `input` events
 *     (we set the value here, which fires `input`) don't spin.
 *   - `unlockFiltersInput()` — strips the read-only + opacity cues so the user can type.
 */
export function createSelectionSyncer(ctx) {
    const {
        filtersInput,
        countryInput,
        useSelectionCheckbox,
        eventManager,
        state,
    } = ctx;

    const syncFiltersInputFromSelection = () => {
        if (!useSelectionCheckbox || !useSelectionCheckbox.checked) return;
        if (state.isSyncingSelection) return;
        state.isSyncingSelection = true;
        try {
            if (isFilterIndexStale(state.filterIndex, eventManager)) {
                state.filterIndex = buildFilterIndex(eventManager);
            }
            const keys = getSelectedFilterKeys();
            const { nonCountryKeys, countryKeys } = partitionSelectionKeys(keys);
            const text = selectionKeysToFilterText(nonCountryKeys, state.filterIndex);
            filtersInput.value = text;
            filtersInput.readOnly = true;
            filtersInput.style.cursor = 'not-allowed';
            filtersInput.style.opacity = '0.75';
            filtersInput.classList.remove('no-filter-match');
            ctx.hideSuggestions();
            if (countryInput) {
                countryInput.value = countryKeysToDisplayCsv(countryKeys);
                countryInput.readOnly = true;
                countryInput.style.cursor = 'not-allowed';
                countryInput.style.opacity = '0.75';
                countryInput.classList.remove('no-filter-match');
                ctx.hideCountrySuggestions();
            }
            ctx.applySearch();
        } finally {
            state.isSyncingSelection = false;
        }
    };

    const unlockFiltersInput = () => {
        filtersInput.readOnly = false;
        filtersInput.style.cursor = '';
        filtersInput.style.opacity = '';
        if (countryInput) {
            countryInput.readOnly = false;
            countryInput.style.cursor = '';
            countryInput.style.opacity = '';
        }
    };

    return { syncFiltersInputFromSelection, unlockFiltersInput };
}
