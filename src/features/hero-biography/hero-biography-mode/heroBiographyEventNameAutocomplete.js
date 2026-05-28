/**
 * Predictive dropdown for story event names (hero bio look ranges, bio archive connection ranges).
 */

import { normalizeEventNameForMatch } from './heroBiographyLookRangesStorage.js';
import { findStoryTimelineIndexByEventName } from './heroBiographyLookRangesResolve.js';

/** @type {string[] | null} */
let cachedEventNames = null;

/**
 * @returns {string[]}
 */
export function getStoryEventNameOptions() {
    if (cachedEventNames) return cachedEventNames;

    const events = window.eventManager?.getDockTimelineEvents?.() || [];
    const seen = new Set();
    /** @type {string[]} */
    const names = [];

    for (const event of events) {
        const name = String(event?.name || '').replace(/<[^>]*>/g, '').trim();
        if (!name) continue;
        const key = normalizeEventNameForMatch(name);
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(name);
    }

    cachedEventNames = names;
    return names;
}

export function clearStoryEventNameOptionsCache() {
    cachedEventNames = null;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isStoryEventNameKnown(value) {
    return findStoryTimelineIndexByEventName(value) >= 0;
}

/**
 * @param {string} value
 * @returns {string | null} Canonical timeline name, or null if unknown.
 */
export function resolveCanonicalStoryEventName(value) {
    const idx = findStoryTimelineIndexByEventName(value);
    if (idx < 0) return null;
    const events = window.eventManager?.getDockTimelineEvents?.() || [];
    const name = String(events[idx]?.name || '').replace(/<[^>]*>/g, '').trim();
    return name || null;
}

/**
 * @param {string} query
 * @param {number} [limit]
 * @returns {string[]}
 */
export function matchStoryEventNames(query, limit = 12) {
    const options = getStoryEventNameOptions();
    const q = normalizeEventNameForMatch(query);
    if (!q) return options.slice(0, limit);

    /** @type {{ name: string, rank: number }[]} */
    const scored = [];

    for (const name of options) {
        const norm = normalizeEventNameForMatch(name);
        if (!norm.includes(q)) continue;
        let rank = 2;
        if (norm === q) rank = 0;
        else if (norm.startsWith(q)) rank = 1;
        scored.push({ name, rank });
    }

    scored.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
    });

    return scored.slice(0, limit).map((s) => s.name);
}

/**
 * @param {HTMLInputElement} input
 */
function syncStoryEventInputValidity(input) {
    const raw = String(input.value || '').trim();
    input.classList.toggle('no-story-event-match', Boolean(raw) && !isStoryEventNameKnown(raw));
}

/**
 * @param {HTMLInputElement} input
 * @param {(value: string) => void} [onPick]
 */
export function wireStoryEventNameAutocomplete(input, onPick) {
    if (input.dataset.heroBioEventAutocomplete === 'true') return;
    input.dataset.heroBioEventAutocomplete = 'true';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');

    let listEl = null;

    const removeList = () => {
        listEl?.remove();
        listEl = null;
        input.removeAttribute('aria-expanded');
    };

    const positionList = () => {
        if (!listEl) return;
        const rect = input.getBoundingClientRect();
        listEl.style.left = `${rect.left}px`;
        listEl.style.top = `${rect.bottom + 4}px`;
        listEl.style.width = `${Math.max(rect.width, 220)}px`;
    };

    const applyPick = (name) => {
        const canonical = resolveCanonicalStoryEventName(name) || name;
        input.value = canonical;
        removeList();
        syncStoryEventInputValidity(input);
        input.dispatchEvent(new Event('change', { bubbles: true }));
        onPick?.(canonical);
    };

    const renderMatches = () => {
        removeList();
        const matches = matchStoryEventNames(input.value);
        if (!matches.length) {
            syncStoryEventInputValidity(input);
            return;
        }

        listEl = document.createElement('div');
        listEl.className =
            'story-event-name-autocomplete-list filter-autocomplete-list hero-biography-look-ranges__autocomplete-list';
        listEl.setAttribute('role', 'listbox');
        positionList();

        for (const name of matches) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'filter-autocomplete-item hero-biography-look-ranges__autocomplete-item';
            btn.textContent = name;
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                applyPick(name);
            });
            listEl.appendChild(btn);
        }

        document.body.appendChild(listEl);
        input.setAttribute('aria-expanded', 'true');
    };

    const onViewportChange = () => {
        if (listEl) positionList();
    };

    input.addEventListener('input', () => {
        renderMatches();
        syncStoryEventInputValidity(input);
    });
    input.addEventListener('focus', renderMatches);
    input.addEventListener('blur', () => {
        setTimeout(() => {
            removeList();
            const raw = String(input.value || '').trim();
            if (raw) {
                const canonical = resolveCanonicalStoryEventName(raw);
                if (canonical) input.value = canonical;
            }
            syncStoryEventInputValidity(input);
        }, 200);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') removeList();
    });

    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);

    syncStoryEventInputValidity(input);
}
