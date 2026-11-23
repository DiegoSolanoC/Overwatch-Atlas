/**
 * Atlas-wide Filters match mode — OR (any chip) vs AND (all chips).
 *
 * OR  = current behavior: show/lock based on any selected filter.
 * AND = intersection: only results that satisfy every selected chip.
 *      In Codex, AND also enables Linking (shortest paths between chips).
 */

import { applyStandaloneFiltersLive } from '../../interface-load-unload/applyStandaloneFiltersLive.js';

export const FILTERS_MATCH_MODE_OR = 'or';
export const FILTERS_MATCH_MODE_AND = 'and';

export const FILTERS_MATCH_MODE_STORAGE_KEY = 'atlasFiltersMatchMode';
export const FILTERS_MATCH_MODE_CHANGE_EVENT = 'atlas-filters-match-mode-change';

/** Legacy Codex-only Linking pref — migrate once into atlas match mode. */
const LEGACY_CODEX_LINK_FILTERS_KEY = 'timelineCodexLinkFilters';

/**
 * @param {unknown} value
 * @returns {'or'|'and'}
 */
export function normalizeFiltersMatchMode(value) {
    const raw = String(value ?? '')
        .trim()
        .toLowerCase();
    return raw === FILTERS_MATCH_MODE_AND ? FILTERS_MATCH_MODE_AND : FILTERS_MATCH_MODE_OR;
}

/**
 * @returns {'or'|'and'}
 */
export function getFiltersMatchMode() {
    try {
        const stored = localStorage.getItem(FILTERS_MATCH_MODE_STORAGE_KEY);
        if (stored != null && stored !== '') {
            return normalizeFiltersMatchMode(stored);
        }
        /* One-shot migrate: old Codex Linking-on → AND. */
        const legacy = localStorage.getItem(LEGACY_CODEX_LINK_FILTERS_KEY);
        if (legacy === '1' || legacy === 'true') {
            localStorage.setItem(FILTERS_MATCH_MODE_STORAGE_KEY, FILTERS_MATCH_MODE_AND);
            return FILTERS_MATCH_MODE_AND;
        }
    } catch (_) {
        /* private mode / quota */
    }
    return FILTERS_MATCH_MODE_OR;
}

/**
 * @returns {boolean}
 */
export function isFiltersMatchModeAnd() {
    return getFiltersMatchMode() === FILTERS_MATCH_MODE_AND;
}

/**
 * @param {'or'|'and'|boolean|string} mode
 * @param {{ apply?: boolean, flash?: boolean }} [opts]
 * @returns {'or'|'and'}
 */
export function setFiltersMatchMode(mode, opts = {}) {
    const next =
        typeof mode === 'boolean'
            ? mode
                ? FILTERS_MATCH_MODE_AND
                : FILTERS_MATCH_MODE_OR
            : normalizeFiltersMatchMode(mode);
    const prev = getFiltersMatchMode();
    try {
        localStorage.setItem(FILTERS_MATCH_MODE_STORAGE_KEY, next);
    } catch (_) {
        /* ignore */
    }

    document.documentElement.dataset.filtersMatchMode = next;
    syncFiltersMatchModeControls();

    window.dispatchEvent(
        new CustomEvent(FILTERS_MATCH_MODE_CHANGE_EVENT, {
            detail: { mode: next, previous: prev },
        }),
    );

    if (opts.apply !== false) {
        applyStandaloneFiltersLive({ immediate: true });
    }

    return next;
}

/**
 * @returns {'or'|'and'}
 */
export function toggleFiltersMatchMode(opts = {}) {
    const next =
        getFiltersMatchMode() === FILTERS_MATCH_MODE_AND
            ? FILTERS_MATCH_MODE_OR
            : FILTERS_MATCH_MODE_AND;
    setFiltersMatchMode(next, opts);
    return next;
}

/**
 * Codex Linking boolean — driven by Filters AND mode (dock toggle removed).
 * @returns {boolean}
 */
export function isCodexLinkFiltersEnabledFromMatchMode() {
    return isFiltersMatchModeAnd();
}

function syncFiltersMatchModeControls() {
    const mode = getFiltersMatchMode();
    const isAnd = mode === FILTERS_MATCH_MODE_AND;
    document.querySelectorAll('[data-filters-match-mode-root]').forEach((root) => {
        if (!(root instanceof HTMLElement)) return;
        root.dataset.filtersMatchMode = mode;
        root.classList.toggle('is-and', isAnd);
        root.classList.toggle('is-or', !isAnd);
        root.setAttribute('aria-pressed', isAnd ? 'true' : 'false');

        const label = root.querySelector('.filters-match-mode-toggle__label');
        if (label) label.textContent = isAnd ? 'AND' : 'OR';
        /* One glyph (∪); AND flips it 180° so size/weight match exactly. */
        const symbol = root.querySelector('.filters-match-mode-toggle__symbol');
        if (symbol) symbol.textContent = '∪';

        if (isAnd) {
            root.title =
                'AND (∩) — match every selected filter (Codex: link shortest paths between chips)';
            root.setAttribute(
                'aria-label',
                'Match mode AND intersection — click to switch to OR',
            );
        } else {
            root.title = 'OR (∪) — match any selected filter';
            root.setAttribute(
                'aria-label',
                'Match mode OR union — click to switch to AND',
            );
        }
    });
}

/**
 * Wire the slant OR/AND toggle under the selection counters (beside Clear).
 */
export function mountFiltersMatchModeControls() {
    const side = document.querySelector('#filtersPanel .filters-actions-side');
    if (!side) return;

    /* Remove legacy chip-size-bar match controls if a prior build left them. */
    document
        .querySelectorAll('#filtersPanel .filters-chip-size-bar .filters-match-mode')
        .forEach((el) => el.remove());

    let row = side.querySelector('.filters-actions-buttons');
    if (!row) {
        row = document.createElement('div');
        row.className = 'filters-actions-buttons';
        side.append(row);
    }

    /* Relocate Clear out of the tabs row if an older panel layout is still mounted. */
    const clearBtn = document.getElementById('clearFiltersBtn');
    if (clearBtn && clearBtn.parentElement !== row) {
        row.appendChild(clearBtn);
    }

    let btn = document.getElementById('filtersMatchModeToggle');
    if (!(btn instanceof HTMLButtonElement)) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'filtersMatchModeToggle';
        btn.className =
            'filters-action-btn filters-action-btn--slant filters-match-mode-toggle';
        btn.dataset.filtersMatchModeRoot = '1';
        btn.innerHTML =
            '<span class="filters-action-btn__face"><span class="filters-match-mode-toggle__symbol" aria-hidden="true">∪</span><span class="filters-action-btn__label filters-match-mode-toggle__label">OR</span></span>';
    }

    if (btn.parentElement !== row) {
        const clear = document.getElementById('clearFiltersBtn');
        if (clear?.parentElement === row) {
            row.insertBefore(btn, clear);
        } else {
            row.prepend(btn);
        }
    }

    if (btn.dataset.matchModeWired === '1') {
        syncFiltersMatchModeControls();
        return;
    }
    btn.dataset.matchModeWired = '1';
    btn.addEventListener('click', () => {
        toggleFiltersMatchMode({ apply: true });
        if (window.flashButton) {
            window.flashButton(btn, 'flash-orange');
        }
        if (window.SoundEffectsManager) {
            window.SoundEffectsManager.play('filterConfirm');
        }
    });

    syncFiltersMatchModeControls();
}

/** Apply dataset on boot so CSS/JS can read mode before panel mounts. */
export function applyFiltersMatchModeBoot() {
    document.documentElement.dataset.filtersMatchMode = getFiltersMatchMode();
    syncFiltersMatchModeControls();
}

if (typeof window !== 'undefined') {
    window.FiltersMatchMode = {
        get: getFiltersMatchMode,
        set: setFiltersMatchMode,
        toggle: toggleFiltersMatchMode,
        isAnd: isFiltersMatchModeAnd,
        OR: FILTERS_MATCH_MODE_OR,
        AND: FILTERS_MATCH_MODE_AND,
    };
    applyFiltersMatchModeBoot();
}
