/**
 * Wire `#filtersMenuSearch` so typing filters the visible chips in real time.
 * Search is per-tab and case-insensitive; matching looks at the chip's display
 * label first, falling back to the underlying filter key.
 *
 * Countries tab: chips with zero timeline usage are hidden until the user types
 * in the search box; matching unused countries stay visible but greyed out
 * (`.filter-btn--zero-event-matches`).
 *
 * Section separators (`.filters-grid-type-separator` /
 * `.filters-grid-hero-subrole-separator`) auto-hide when every chip in the
 * section is filtered out, so the grid never shows an orphan header.
 */

const SEARCH_PLACEHOLDERS = {
    heroes: 'Search heroes...',
    factions: 'Search factions...',
    npcs: 'Search NPCs...',
    countries: 'Search countries...'
};

export function placeholderForFilterType(type) {
    return SEARCH_PLACEHOLDERS[type] || SEARCH_PLACEHOLDERS.heroes;
}

export function applyFilterChipSearch(input, grid, currentFilterType) {
    if (!input || !grid) return;
    input.placeholder = placeholderForFilterType(currentFilterType);
    const query = String(input.value || '').trim().toLowerCase();
    const isCountries = currentFilterType === 'countries';
    const buttons = grid.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        const labelEl = btn.querySelector('.filter-label-text');
        const text = String(labelEl?.textContent || btn.dataset.filterKey || '').trim().toLowerCase();
        const textMatch = !query || text.includes(query);

        if (!isCountries) {
            btn.style.display = textMatch ? '' : 'none';
            btn.classList.remove('filter-btn--zero-event-matches');
            return;
        }

        const matchCount = parseInt(btn.dataset.eventMatchCount || '0', 10) || 0;
        const hasEventUsage = matchCount > 0;

        if (!query) {
            btn.style.display = hasEventUsage ? '' : 'none';
            btn.classList.remove('filter-btn--zero-event-matches');
        } else {
            btn.style.display = textMatch ? '' : 'none';
            btn.classList.toggle('filter-btn--zero-event-matches', textMatch && !hasEventUsage);
        }
    });
    grid.querySelectorAll('.filters-grid-type-separator, .filters-grid-hero-subrole-separator').forEach(sep => {
        if (!query) {
            sep.style.display = '';
            return;
        }
        let n = sep.nextElementSibling;
        let any = false;
        while (
            n &&
            !n.classList.contains('filters-grid-type-separator') &&
            !n.classList.contains('filters-grid-hero-subrole-separator')
        ) {
            if (n.classList?.contains('filter-btn') && n.style.display !== 'none') {
                any = true;
                break;
            }
            n = n.nextElementSibling;
        }
        sep.style.display = any ? '' : 'none';
    });
}

/**
 * Bind the search `<input>` once; subsequent calls re-apply the current query
 * (so repaints after a filter rebuild keep the search live).
 */
export function bindFilterSearchInputOnce(input, getCurrentFilterType, getGrid) {
    if (!input) return;
    input.placeholder = placeholderForFilterType(getCurrentFilterType());
    if (input.dataset.searchBound === '1') {
        applyFilterChipSearch(input, getGrid(), getCurrentFilterType());
        return;
    }
    input.dataset.searchBound = '1';
    input.addEventListener('input', () => {
        applyFilterChipSearch(input, getGrid(), getCurrentFilterType());
    });
    applyFilterChipSearch(input, getGrid(), getCurrentFilterType());
}
