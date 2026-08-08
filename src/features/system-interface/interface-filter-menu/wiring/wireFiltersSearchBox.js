/**
 * Wire `#filtersMenuSearch` so typing filters the visible chips in real time.
 *
 * Countries tab: Unvisited (0 timeline uses) stay hidden until the user types;
 * matching unused countries stay visible but greyed out. Category bands hide
 * when they have no visible chips.
 *
 * Gallery-style boards: hide empty subgroup / subrow / column shells when search
 * filters out their chips.
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

    buttons.forEach((btn) => {
        const labelEl = btn.querySelector('.filter-label-text');
        const text = String(labelEl?.textContent || btn.dataset.filterKey || '').trim().toLowerCase();
        const textMatch = !query || text.includes(query);
        const wrap = btn.closest('.filters-chip-wrap');

        if (!isCountries) {
            const show = textMatch;
            btn.style.display = show ? '' : 'none';
            if (wrap) wrap.style.display = show ? '' : 'none';
            btn.classList.remove('filter-btn--zero-event-matches');
            return;
        }

        const matchCount = parseInt(btn.dataset.eventMatchCount || '0', 10) || 0;
        const hasEventUsage = matchCount > 0;

        if (!query) {
            const show = hasEventUsage;
            btn.style.display = show ? '' : 'none';
            if (wrap) wrap.style.display = show ? '' : 'none';
            btn.classList.remove('filter-btn--zero-event-matches');
        } else {
            const show = textMatch;
            btn.style.display = show ? '' : 'none';
            if (wrap) wrap.style.display = show ? '' : 'none';
            btn.classList.toggle('filter-btn--zero-event-matches', textMatch && !hasEventUsage);
        }
    });

    // Legacy separator headers (if any remain)
    grid.querySelectorAll('.filters-grid-type-separator, .filters-grid-hero-subrole-separator').forEach((sep) => {
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
            const chip = n.classList.contains('filter-btn')
                ? n
                : n.querySelector?.('.filter-btn');
            if (chip && chip.style.display !== 'none') {
                any = true;
                break;
            }
            n = n.nextElementSibling;
        }
        sep.style.display = any ? '' : 'none';
    });

    // Chip-board shells: hide groups/rows/columns with no visible chips while searching.
    grid.querySelectorAll('.filters-chip-board__subrole-group').forEach((group) => {
        if (!(group instanceof HTMLElement)) return;
        if (!query) {
            group.style.display = '';
            return;
        }
        const any = [...group.querySelectorAll('.filter-btn')].some((btn) => btn.style.display !== 'none');
        group.style.display = any ? '' : 'none';
    });

    grid.querySelectorAll('.filters-chip-board__subrow').forEach((row) => {
        if (!(row instanceof HTMLElement)) return;
        if (!query) {
            row.style.display = '';
            return;
        }
        const any = [...row.querySelectorAll('.filters-chip-board__subrole-group')].some(
            (g) => g.style.display !== 'none',
        );
        row.style.display = any ? '' : 'none';
    });

    grid.querySelectorAll('.filters-chip-board__role-column').forEach((col) => {
        if (!(col instanceof HTMLElement)) return;
        const searchOnly = col.dataset.countryVisibility === 'search-only';

        if (!query) {
            if (searchOnly) {
                col.style.display = 'none';
                return;
            }
            const anyVisible = [...col.querySelectorAll('.filter-btn')].some(
                (btn) => btn.style.display !== 'none',
            );
            col.style.display = anyVisible ? '' : 'none';
            return;
        }

        const any = [...col.querySelectorAll('.filter-btn')].some((btn) => btn.style.display !== 'none');
        col.style.display = any ? '' : 'none';
    });
}

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
