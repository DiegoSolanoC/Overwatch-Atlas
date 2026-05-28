/**
 * wireEventManagerSearch — orchestrator for the Event Manager search bar.
 *
 * Owns the **shared state carrier** (`state`) and the **DOM-element bundle**, then hands
 * both to four sibling modules that each own one slice of the behavior:
 *
 *   - `searchIndexes.js`              — pure index/parse functions (no DOM, no closures).
 *   - `searchSelectionSync.js`        — mirrors the FilterService selection → text inputs.
 *   - `searchSuggestionPopovers.js`   — render + show/hide the filter and country popovers.
 *   - `wireSearchInputs.js`           — DOM event wiring (input/change/keydown/click).
 *
 * Closure-shared state lives on the `state` object that gets passed into every module:
 *
 *   filterIndex                 — { heroes, npcs, factions } lookups, rebuilt lazily when data lands.
 *   flagIndex                   — FLAG_FILE_BY_COMMON entries with lowercased + diacritic-stripped keys.
 *   manualFilterText            — last text the user typed before "Use filter selection" took over.
 *   isSyncingSelection          — re-entry guard on syncFiltersInputFromSelection().
 *   lastFilterSuggestionPayload — { items, beforePart } snapshot of currently-rendered filter suggestions.
 *   filterSuggestionHoverIndex  — currently-hovered (or keyboard-active) suggestion index, or -1.
 *   lastCountrySuggestionPayload / countrySuggestionHoverIndex
 *                               — same pair for the country input.
 *
 * "Use filter selection" (`#eventsUseFilterSelectionCheckbox`) is always-on and the control
 * is hidden; the inputs become read-only mirrors of the active FilterService /
 * standaloneActiveFilters state.
 *
 * Sound effects:
 *   - `filterConfirm` on pick / lock toggle.
 *   - `filterClear`   on chip-style Backspace removal + Clear button.
 */

import { buildFilterIndex, buildFlagIndex, parseFilterTokens, parseCountryTokens } from './searchIndexes.js';
import { createSelectionSyncer } from './searchSelectionSync.js';
import {
    createFilterSuggestionPopover,
    createCountrySuggestionPopover,
} from './searchSuggestionPopovers.js';
import {
    wireTitleSearchInput,
    wireFiltersInput,
    wireCountryInput,
    wireClearAndSelection,
    wirePerPageControls,
} from './wireSearchInputs.js';

/** @param {any} listenerService Owning EventListenerService (carries `this.eventManager`). */
export function wireEventManagerSearch(listenerService) {
    const eventManager = listenerService.eventManager;
    if (!eventManager) return;

    const searchInput = document.getElementById('eventsSearchInput');
    const filtersInput = document.getElementById('eventsSearchFilters');
    const suggestionsEl = document.getElementById('eventsSearchFiltersSuggestions');
    const countryInput = document.getElementById('eventsSearchCountry');
    const countrySuggestionsEl = document.getElementById('eventsSearchCountrySuggestions');
    const useSelectionCheckbox = document.getElementById('eventsUseFilterSelectionCheckbox');
    const perPageInput = document.getElementById('eventsPerPageInput');
    const showAllCheckbox = document.getElementById('eventsShowAllCheckbox');
    const clearBtn = document.getElementById('eventsSearchClear');
    if (!searchInput || !filtersInput) return;

    // "Use filter selection" is always on (control hidden); keep checkbox checked.
    if (useSelectionCheckbox) useSelectionCheckbox.checked = true;

    const state = {
        filterIndex: buildFilterIndex(eventManager),
        flagIndex: buildFlagIndex(),
        manualFilterText: '',
        isSyncingSelection: false,
        lastFilterSuggestionPayload: { items: [], beforePart: '' },
        filterSuggestionHoverIndex: -1,
        lastCountrySuggestionPayload: { items: [], beforePart: '' },
        countrySuggestionHoverIndex: -1,
    };

    /** Read inputs → write EventManager search state → re-render. */
    const applySearch = () => {
        eventManager.searchQuery = (searchInput && searchInput.value) ? searchInput.value.trim() : '';
        const filterText = (filtersInput && filtersInput.value) ? filtersInput.value.trim() : '';
        const { matchedHeroes, matchedFactions, matchedNpcs, unmatchedTokens } =
            parseFilterTokens(filterText, state.filterIndex);
        eventManager.searchHeroFilters = matchedHeroes;
        eventManager.searchFactionFilters = matchedFactions;
        eventManager.searchNpcFilters = matchedNpcs || [];
        eventManager.searchUnmatchedFilterTokens = unmatchedTokens || [];
        if (countryInput) {
            // Lazy rebuild — `FLAG_FILE_BY_COMMON` may arrive after init.
            state.flagIndex = buildFlagIndex();
            const countryText = (countryInput.value || '').trim();
            eventManager.searchCountryFilters = parseCountryTokens(countryText, state.flagIndex);
        } else {
            eventManager.searchCountryFilters = [];
        }
        if (eventManager.applySearchAndRender) eventManager.applySearchAndRender();
    };

    // Shared orchestration ctx — every sub-module reads what it needs from this object.
    const ctx = {
        searchInput, filtersInput, suggestionsEl,
        countryInput, countrySuggestionsEl,
        useSelectionCheckbox, perPageInput, showAllCheckbox, clearBtn,
        eventManager,
        state,
        applySearch,
        // Assigned below — declared up front so the popover modules can read them off ctx.
        applyFilterSuggestionPick: null,
        applyCountrySuggestionPick: null,
        // Filled in after construction so cross-module hide() works inside the syncer.
        hideSuggestions: null,
        hideCountrySuggestions: null,
    };

    const filterPopover = createFilterSuggestionPopover(ctx);
    const countryPopover = createCountrySuggestionPopover(ctx);
    ctx.filterPopover = filterPopover;
    ctx.countryPopover = countryPopover;
    ctx.hideSuggestions = filterPopover.hide;
    ctx.hideCountrySuggestions = countryPopover.hide;

    const selectionSyncer = createSelectionSyncer(ctx);
    ctx.selectionSyncer = selectionSyncer;

    // Suggestion-pick callbacks — close over ctx + popovers, then re-published onto ctx so
    // popover button handlers and keyboard `Enter` handlers can invoke them.
    ctx.applyFilterSuggestionPick = (item, beforePart) => {
        window.SoundEffectsManager?.play?.('filterConfirm');
        const before = (beforePart || '').trim();
        const nextValue = before ? `${before}, ${item.insert}, ` : `${item.insert}, `;
        filtersInput.value = nextValue;
        filtersInput.classList.remove('no-filter-match');
        filterPopover.hide();
        filtersInput.focus();
        applySearch();
        filterPopover.updatePredictions();
    };
    ctx.applyCountrySuggestionPick = (item, beforePart) => {
        window.SoundEffectsManager?.play?.('filterConfirm');
        if (!countryInput) return;
        const before = (beforePart || '').trim();
        const nextValue = before ? `${before}, ${item.common}, ` : `${item.common}, `;
        countryInput.value = nextValue;
        countryInput.classList.remove('no-filter-match');
        countryPopover.hide();
        countryInput.focus();
        applySearch();
        countryPopover.updatePredictions();
    };

    wireTitleSearchInput(ctx);
    wireFiltersInput(ctx);
    wireCountryInput(ctx);
    wireClearAndSelection(ctx);
    const applyPerPageSettings = wirePerPageControls(ctx);
    if (eventManager) {
        eventManager.applyPerPageSettings = applyPerPageSettings;
    }
    applyPerPageSettings();

    // Initial prediction state + selection sync (in case checkbox defaulted on).
    filterPopover.updatePredictions();
    countryPopover.updatePredictions();
    selectionSyncer.syncFiltersInputFromSelection();
}
