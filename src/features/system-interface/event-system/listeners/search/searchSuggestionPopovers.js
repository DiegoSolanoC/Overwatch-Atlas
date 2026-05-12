/**
 * searchSuggestionPopovers — render + show/hide the two suggestion popovers under the
 * Event Manager search inputs:
 *
 *   - **Filter popover** (`#eventsSearchFiltersSuggestions`): heroes / npcs / factions.
 *     Each row shows the filter icon (`Heroes/<name>.png`, `NPCs/<name>.png`, or
 *     `Factions/<filename>.png`), the label, and the detail badge ("Hero" / "NPC" / "Faction").
 *
 *   - **Country popover** (`#eventsSearchCountrySuggestions`): every country whose
 *     `commonLower` substring-matches the in-progress token. Rows show the flag + label.
 *
 * Both popovers are re-parented to `document.body` and absolutely positioned with the
 * input's bottom edge — needed because the manager panel uses `overflow:hidden` and would
 * clip a child-positioned menu.
 *
 * The popovers share the `ctx.state` carrier with the rest of the search wiring so that
 * the hover index and currently-rendered payload can be read by the keyboard `Enter`
 * handler in `wireSearchInputs.js`.
 */

import {
    buildFilterIndex,
    isFilterIndexStale,
    buildFlagIndex,
    getCountryCandidates,
    getTokenCandidates,
} from './searchIndexes.js';
import { getCurrentTokenInfo } from './searchTokenUtils.js';

/**
 * Build the filter (hero/faction/npc) popover for the orchestration `ctx`.
 * Returns the closed-over methods the rest of the wiring uses.
 */
export function createFilterSuggestionPopover(ctx) {
    const { suggestionsEl, filtersInput, useSelectionCheckbox, eventManager, state } = ctx;

    const hide = () => {
        if (!suggestionsEl) return;
        state.filterSuggestionHoverIndex = -1;
        state.lastFilterSuggestionPayload = { items: [], beforePart: '' };
        suggestionsEl.style.display = 'none';
        suggestionsEl.innerHTML = '';
    };

    const show = (items, beforePart) => {
        if (!suggestionsEl) return;
        suggestionsEl.innerHTML = '';
        const max = Math.min(items.length, 8);
        const slice = items.slice(0, max);
        state.lastFilterSuggestionPayload = { items: slice, beforePart };
        state.filterSuggestionHoverIndex = -1;
        for (let i = 0; i < max; i++) {
            const item = items[i];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'events-search-suggestion events-search-suggestion--with-flag';
            const img = document.createElement('img');
            img.className = 'events-search-suggestion-flag events-search-suggestion-flag--filter-icon';
            img.alt = '';
            if (item.kind === 'faction' && item.factionFilename) {
                img.src = `src/assets/images/Filters/Factions/${encodeURIComponent(item.factionFilename)}.png`;
            } else if (item.kind === 'npc' && item.npcKey) {
                img.src = `src/assets/images/Filters/NPCs/${encodeURIComponent(item.npcKey)}.png`;
            } else {
                const hk = item.heroKey || item.label;
                img.src = `src/assets/images/Filters/Heroes/${encodeURIComponent(hk)}.png`;
            }
            img.decoding = 'async';
            img.onerror = () => { img.style.visibility = 'hidden'; };
            const labelSpan = document.createElement('span');
            labelSpan.className = 'events-search-suggestion-label';
            labelSpan.textContent = item.label;
            const detailSpan = document.createElement('span');
            detailSpan.className = 'muted';
            detailSpan.textContent = item.detail || '';
            btn.appendChild(img);
            btn.appendChild(labelSpan);
            btn.appendChild(detailSpan);
            btn.addEventListener('mouseenter', () => { state.filterSuggestionHoverIndex = i; });
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (ctx.applyFilterSuggestionPick) ctx.applyFilterSuggestionPick(item, beforePart);
            });
            suggestionsEl.appendChild(btn);
        }
        suggestionsEl.style.display = max > 0 ? 'block' : 'none';

        if (max > 0) {
            if (suggestionsEl.parentNode !== document.body) {
                document.body.appendChild(suggestionsEl);
            }
            const rect = filtersInput.getBoundingClientRect();
            suggestionsEl.style.left = `auto`;
            suggestionsEl.style.right = `20px`;
            suggestionsEl.style.top = `${rect.bottom + 6}px`;
            suggestionsEl.style.width = `300px`;
        }
    };

    const updatePredictions = () => {
        if (!filtersInput) return;
        if (useSelectionCheckbox && useSelectionCheckbox.checked) {
            hide();
            return;
        }
        if (isFilterIndexStale(state.filterIndex, eventManager)) {
            state.filterIndex = buildFilterIndex(eventManager);
        }
        const { before, current } = getCurrentTokenInfo(filtersInput.value || '');
        const prefix = (current || '').trim();
        if (!prefix) {
            filtersInput.classList.remove('no-filter-match');
            hide();
            return;
        }
        const candidates = getTokenCandidates(prefix.toLowerCase(), state.filterIndex);
        if (candidates.length === 0) {
            // Free-text tokens (e.g. title keywords like "Iris") are allowed; not every
            // segment is a known id, so we don't flag a no-match here.
            filtersInput.classList.remove('no-filter-match');
            hide();
        } else {
            filtersInput.classList.remove('no-filter-match');
            show(candidates, before);
        }
    };

    // One-time hover-clear binding so the keyboard `Enter` falls through to slot 0 when the
    // mouse leaves the popover.
    if (suggestionsEl && !suggestionsEl._owtlSuggestionHoverBound) {
        suggestionsEl._owtlSuggestionHoverBound = true;
        suggestionsEl.addEventListener('mouseleave', () => {
            state.filterSuggestionHoverIndex = -1;
        });
    }

    return { show, hide, updatePredictions };
}

/**
 * Build the country popover for the orchestration `ctx`.
 * Returns the closed-over methods the rest of the wiring uses.
 */
export function createCountrySuggestionPopover(ctx) {
    const { countrySuggestionsEl, countryInput, useSelectionCheckbox, state } = ctx;

    const hide = () => {
        if (!countrySuggestionsEl) return;
        state.countrySuggestionHoverIndex = -1;
        state.lastCountrySuggestionPayload = { items: [], beforePart: '' };
        countrySuggestionsEl.style.display = 'none';
        countrySuggestionsEl.innerHTML = '';
    };

    const show = (items, beforePart) => {
        if (!countrySuggestionsEl || !window.LocationFlagHelpers || typeof window.LocationFlagHelpers.flagSrc !== 'function') return;
        const flagSrc = window.LocationFlagHelpers.flagSrc;
        countrySuggestionsEl.innerHTML = '';
        const max = Math.min(items.length, 8);
        const slice = items.slice(0, max);
        state.lastCountrySuggestionPayload = { items: slice, beforePart };
        state.countrySuggestionHoverIndex = -1;
        for (let i = 0; i < max; i++) {
            const item = items[i];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'events-search-suggestion events-search-suggestion--with-flag';
            const img = document.createElement('img');
            img.className = 'events-search-suggestion-flag';
            img.src = flagSrc(item.file);
            img.alt = '';
            img.width = 32;
            img.height = 20;
            img.decoding = 'async';
            const labelSpan = document.createElement('span');
            labelSpan.className = 'events-search-suggestion-label';
            labelSpan.textContent = item.common;
            const detailSpan = document.createElement('span');
            detailSpan.className = 'muted';
            detailSpan.textContent = 'Country';
            btn.appendChild(img);
            btn.appendChild(labelSpan);
            btn.appendChild(detailSpan);
            btn.addEventListener('mouseenter', () => { state.countrySuggestionHoverIndex = i; });
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (ctx.applyCountrySuggestionPick) ctx.applyCountrySuggestionPick(item, beforePart);
            });
            countrySuggestionsEl.appendChild(btn);
        }
        countrySuggestionsEl.style.display = max > 0 ? 'block' : 'none';

        if (max > 0) {
            if (countrySuggestionsEl.parentNode !== document.body) {
                document.body.appendChild(countrySuggestionsEl);
            }
            const rect = countryInput.getBoundingClientRect();
            countrySuggestionsEl.style.left = `auto`;
            countrySuggestionsEl.style.right = `20px`;
            countrySuggestionsEl.style.top = `${rect.bottom + 6}px`;
            countrySuggestionsEl.style.width = `300px`;
        }
    };

    const updatePredictions = () => {
        if (!countryInput) return;
        if (useSelectionCheckbox && useSelectionCheckbox.checked) {
            hide();
            return;
        }
        // Rebuild flag index lazily — `FLAG_FILE_BY_COMMON` arrives via a separate script.
        state.flagIndex = buildFlagIndex();
        const { before, current } = getCurrentTokenInfo(countryInput.value || '');
        const prefix = (current || '').trim();
        if (!prefix) {
            countryInput.classList.remove('no-filter-match');
            hide();
            return;
        }
        const candidates = getCountryCandidates(prefix.toLowerCase(), state.flagIndex);
        if (candidates.length === 0) {
            countryInput.classList.add('no-filter-match');
            hide();
        } else {
            countryInput.classList.remove('no-filter-match');
            show(candidates, before);
        }
    };

    if (countrySuggestionsEl && !countrySuggestionsEl._owtlSuggestionHoverBound) {
        countrySuggestionsEl._owtlSuggestionHoverBound = true;
        countrySuggestionsEl.addEventListener('mouseleave', () => {
            state.countrySuggestionHoverIndex = -1;
        });
    }

    return { show, hide, updatePredictions };
}
