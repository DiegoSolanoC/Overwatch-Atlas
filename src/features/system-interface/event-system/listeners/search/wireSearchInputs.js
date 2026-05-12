/**
 * wireSearchInputs — DOM event listeners for the Event Manager search controls.
 *
 * Five wiring functions, each fully self-contained but reading the shared orchestration
 * `ctx` for DOM refs, popover handles, selection-sync handles, and the `applySearch`
 * callback:
 *
 *   - `wireTitleSearchInput`    — `#eventsSearchInput` (title text).
 *   - `wireFiltersInput`        — `#eventsSearchFilters` (hero/faction/npc tokens).
 *   - `wireCountryInput`        — `#eventsSearchCountry` (country/flag tokens).
 *   - `wireClearAndSelection`   — `#eventsSearchClear` + always-on selection checkbox +
 *                                 doc-level "click outside" to dismiss popovers.
 *   - `wirePerPageControls`     — per-page input + "show all" checkbox.
 *
 * Backspace chip-style removal lives in `tryRemoveLastCompletedToken` and is shared by both
 * the filters input and country input keydown handlers.
 */

const playFilterConfirmSfx = () => { window.SoundEffectsManager?.play?.('filterConfirm'); };
const playFilterClearSfx = () => { window.SoundEffectsManager?.play?.('filterClear'); };

/**
 * Chip-style Backspace: when the in-progress (post-comma) token is empty, delete the
 * previous completed comma-separated token in one keystroke. Returns true when the event
 * was consumed (caller should preventDefault + re-run predictions/search).
 */
function tryRemoveLastCompletedToken(input, e, useSelectionCheckbox) {
    if (e.key !== 'Backspace' || !input || input.readOnly || (useSelectionCheckbox && useSelectionCheckbox.checked)) {
        return false;
    }
    const start = input.selectionStart;
    const end = input.selectionEnd;
    if (start !== end) return false;
    const v = input.value;
    const lc = v.lastIndexOf(',', start - 1);
    const segStart = lc + 1;
    const segment = v.slice(segStart, start);
    if (segment.trim() !== '') return false;
    if (lc < 0) return false;
    const beforeComma = v.slice(0, lc);
    const tokens = beforeComma.split(',').map((s) => s.trim()).filter(Boolean);
    if (tokens.length === 0) return false;
    e.preventDefault();
    playFilterClearSfx();
    tokens.pop();
    const newVal = tokens.join(', ') + (tokens.length ? ', ' : '');
    input.value = newVal;
    const pos = newVal.length;
    input.setSelectionRange(pos, pos);
    return true;
}

export function wireTitleSearchInput(ctx) {
    const { searchInput, applySearch } = ctx;
    if (!searchInput) return;
    searchInput.addEventListener('input', applySearch);
    searchInput.addEventListener('change', applySearch);
}

export function wireFiltersInput(ctx) {
    const {
        filtersInput,
        suggestionsEl,
        useSelectionCheckbox,
        applySearch,
        applyFilterSuggestionPick,
        filterPopover,
        selectionSyncer,
        state,
    } = ctx;
    if (!filtersInput) return;

    filtersInput.addEventListener('input', () => {
        if (useSelectionCheckbox && useSelectionCheckbox.checked) {
            // Programmatic updates (e.g. prepend from map) must not be overwritten by a resync.
            if (typeof window !== 'undefined' && window.__eventsFiltersInputBypassSelectionSync) {
                filterPopover.updatePredictions();
                applySearch();
                return;
            }
            selectionSyncer.syncFiltersInputFromSelection();
            return;
        }
        filterPopover.updatePredictions();
        applySearch();
    });
    filtersInput.addEventListener('change', () => {
        if (useSelectionCheckbox && useSelectionCheckbox.checked) {
            if (typeof window !== 'undefined' && window.__eventsFiltersInputBypassSelectionSync) {
                filterPopover.updatePredictions();
                applySearch();
                return;
            }
            selectionSyncer.syncFiltersInputFromSelection();
            return;
        }
        filterPopover.updatePredictions();
        applySearch();
    });
    filtersInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            filterPopover.hide();
            return;
        }
        if (tryRemoveLastCompletedToken(filtersInput, e, useSelectionCheckbox)) {
            filterPopover.updatePredictions();
            applySearch();
            return;
        }
        if (e.key === 'Enter') {
            const vis = suggestionsEl && suggestionsEl.style.display !== 'none' && state.lastFilterSuggestionPayload.items.length > 0;
            if (vis) {
                e.preventDefault();
                const idx = state.filterSuggestionHoverIndex >= 0 ? state.filterSuggestionHoverIndex : 0;
                const item = state.lastFilterSuggestionPayload.items[idx];
                if (item && applyFilterSuggestionPick) {
                    applyFilterSuggestionPick(item, state.lastFilterSuggestionPayload.beforePart);
                }
            }
        }
    });
}

export function wireCountryInput(ctx) {
    const {
        countryInput,
        countrySuggestionsEl,
        useSelectionCheckbox,
        applySearch,
        applyCountrySuggestionPick,
        countryPopover,
        selectionSyncer,
        state,
    } = ctx;
    if (!countryInput) return;

    countryInput.addEventListener('input', () => {
        if (useSelectionCheckbox && useSelectionCheckbox.checked) {
            if (typeof window !== 'undefined' && window.__eventsFiltersInputBypassSelectionSync) {
                countryPopover.updatePredictions();
                applySearch();
                return;
            }
            selectionSyncer.syncFiltersInputFromSelection();
            return;
        }
        countryPopover.updatePredictions();
        applySearch();
    });
    countryInput.addEventListener('change', () => {
        if (useSelectionCheckbox && useSelectionCheckbox.checked) {
            if (typeof window !== 'undefined' && window.__eventsFiltersInputBypassSelectionSync) {
                countryPopover.updatePredictions();
                applySearch();
                return;
            }
            selectionSyncer.syncFiltersInputFromSelection();
            return;
        }
        countryPopover.updatePredictions();
        applySearch();
    });
    countryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            countryPopover.hide();
            return;
        }
        if (tryRemoveLastCompletedToken(countryInput, e, useSelectionCheckbox)) {
            countryPopover.updatePredictions();
            applySearch();
            return;
        }
        if (e.key === 'Enter') {
            const vis = countrySuggestionsEl && countrySuggestionsEl.style.display !== 'none'
                && state.lastCountrySuggestionPayload.items.length > 0;
            if (vis) {
                e.preventDefault();
                const idx = state.countrySuggestionHoverIndex >= 0 ? state.countrySuggestionHoverIndex : 0;
                const item = state.lastCountrySuggestionPayload.items[idx];
                if (item && applyCountrySuggestionPick) {
                    applyCountrySuggestionPick(item, state.lastCountrySuggestionPayload.beforePart);
                }
            }
        }
    });
}

/**
 * Wire the clear button, the always-on "Use filter selection" checkbox, the doc-level
 * click-outside dismiss, and the cross-panel filter-chip listener that re-syncs after
 * users click chips in the Filters panel.
 */
export function wireClearAndSelection(ctx) {
    const {
        searchInput,
        filtersInput,
        suggestionsEl,
        countryInput,
        countrySuggestionsEl,
        useSelectionCheckbox,
        clearBtn,
        eventManager,
        filterPopover,
        countryPopover,
        selectionSyncer,
        state,
    } = ctx;

    document.addEventListener('click', (e) => {
        if (suggestionsEl && e.target !== filtersInput && !suggestionsEl.contains(e.target)) {
            filterPopover.hide();
        }
        if (countrySuggestionsEl && countryInput && e.target !== countryInput && !countrySuggestionsEl.contains(e.target)) {
            countryPopover.hide();
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (window.SoundEffectsManager) window.SoundEffectsManager.play('filterClear');
            searchInput.value = '';
            if (countryInput) {
                countryInput.value = '';
                countryInput.classList.remove('no-filter-match');
                countryPopover.hide();
            }

            const syncFromSelection = !!(useSelectionCheckbox && useSelectionCheckbox.checked);
            if (syncFromSelection) {
                eventManager.searchQuery = '';
                eventManager.searchCountryFilters = [];
                eventManager.searchUnmatchedFilterTokens = [];
                selectionSyncer.syncFiltersInputFromSelection();
                if (eventManager.applySearchAndRender) eventManager.applySearchAndRender();
            } else {
                if (useSelectionCheckbox) useSelectionCheckbox.checked = false;
                selectionSyncer.unlockFiltersInput();
                filtersInput.value = '';
                filtersInput.classList.remove('no-filter-match');
                filterPopover.hide();
                eventManager.searchQuery = '';
                eventManager.searchHeroFilters = [];
                eventManager.searchFactionFilters = [];
                eventManager.searchNpcFilters = [];
                eventManager.searchUnmatchedFilterTokens = [];
                eventManager.searchCountryFilters = [];
                if (eventManager.applySearchAndRender) eventManager.applySearchAndRender();
            }
        });
    }

    if (useSelectionCheckbox) {
        useSelectionCheckbox.addEventListener('change', () => {
            // The control is hidden and selection sync stays on — ignore turn-off attempts.
            if (!useSelectionCheckbox.checked) {
                useSelectionCheckbox.checked = true;
                playFilterConfirmSfx();
                selectionSyncer.syncFiltersInputFromSelection();
                return;
            }
            playFilterConfirmSfx();
            state.manualFilterText = (filtersInput.value || '').toString();
            selectionSyncer.syncFiltersInputFromSelection();
        });

        // Keep the manager search synced when the user toggles filter chips in the Filters panel.
        document.addEventListener('click', (e) => {
            if (!useSelectionCheckbox.checked) return;
            const t = e.target;
            const isFilterBtn = !!(t && (t.classList?.contains('filter-btn') || t.closest?.('.filter-btn')));
            const isConfirm = !!(t && (t.id === 'confirmFiltersBtn' || t.closest?.('#confirmFiltersBtn')));
            const isClear = !!(t && (t.id === 'clearFiltersBtn' || t.closest?.('#clearFiltersBtn')));
            if (!isFilterBtn && !isConfirm && !isClear) return;
            setTimeout(() => selectionSyncer.syncFiltersInputFromSelection(), 0);
        });
    }
}

/**
 * Wire the per-page input + "show all" checkbox so the manager list re-renders when the
 * user changes pagination preferences. Returns the `applyPerPageSettings` function so the
 * orchestrator can run it once on mount to apply initial state.
 */
export function wirePerPageControls(ctx) {
    const { perPageInput, showAllCheckbox, eventManager } = ctx;

    const applyPerPageSettings = () => {
        if (!eventManager) return;
        const showAll = !!(showAllCheckbox && showAllCheckbox.checked);
        eventManager.showAllEventsInManager = showAll;
        if (perPageInput) {
            perPageInput.disabled = showAll;
            perPageInput.style.opacity = showAll ? '0.5' : '';
            perPageInput.style.cursor = showAll ? 'not-allowed' : '';
        }
        if (!showAll && perPageInput) {
            const value = parseInt(perPageInput.value, 10);
            if (value && value > 0) {
                eventManager.eventsPerPageSetting = value;
            }
        }
        eventManager.currentPage = 1;
        if (eventManager.renderEvents) eventManager.renderEvents();
    };

    if (perPageInput) {
        perPageInput.value = (eventManager.eventsPerPageSetting || eventManager.eventsPerPage || 50).toString();
        perPageInput.addEventListener('input', applyPerPageSettings);
        perPageInput.addEventListener('change', applyPerPageSettings);
    }
    if (showAllCheckbox) {
        showAllCheckbox.checked = !!eventManager.showAllEventsInManager;
        showAllCheckbox.addEventListener('change', (e) => {
            playFilterConfirmSfx();
            applyPerPageSettings(e);
        });
    }

    return applyPerPageSettings;
}
