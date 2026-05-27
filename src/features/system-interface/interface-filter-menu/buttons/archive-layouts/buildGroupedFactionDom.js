/**
 * Factions filter tab in "grouped" mode: emit a `.filters-grid-type-separator`
 * header per faction type (in the same order the Event Manager renders them),
 * then the manifest faction chips that belong to that type.
 *
 * Factions present in the manifest but absent from any archive row end up
 * under a final "Other" separator so they still appear in the panel.
 */

import { createFilterButton } from '../createFilterButton.js';
import { matchFactionManifestToArchiveRowName } from '../filterKeyMapping.js';
import { getFactionsArchiveRowsForFilterGrouping } from './archiveLayoutSnapshots.js';

export function buildGroupedFactionArchiveFilterDom(
    items, folder, filtersGrid, stateManager, imageService, soundManager, updateFilterCounts
) {
    const fgo = typeof window !== 'undefined' ? window.FactionArchiveGroupOrderHelpers : null;
    const cachedButtons = [];
    filtersGrid.innerHTML = '';

    if (!fgo || typeof fgo.normalizeFactionArchiveType !== 'function' ||
        !Array.isArray(items) || items.length === 0) {
        return cachedButtons;
    }

    const events = getFactionsArchiveRowsForFilterGrouping();
    if (typeof fgo.sortFactionsArchiveEventsStable === 'function') {
        fgo.sortFactionsArchiveEventsStable(events);
    }

    const usedFilenames = new Set();
    let lastKey = null;
    let pendingLabel = '';
    /** @type {Array<{ filename: string, displayName?: string }>} */
    let pending = [];

    const flush = () => {
        if (pending.length === 0) return;
        const sep = document.createElement('div');
        sep.className = 'filters-grid-type-separator';
        sep.setAttribute('role', 'separator');
        sep.setAttribute('aria-label', pendingLabel);
        sep.textContent = pendingLabel;
        filtersGrid.appendChild(sep);
        cachedButtons.push(sep);
        pending.forEach(entry => {
            usedFilenames.add(entry.filename);
            const btn = createFilterButton(entry, 'factions', folder, stateManager, imageService, soundManager, updateFilterCounts);
            filtersGrid.appendChild(btn);
            cachedButtons.push(btn);
        });
    };

    for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const gKey = `${fgo.factionArchiveTypeRank(ev?.factionType)}|${fgo.normalizeFactionArchiveType(ev?.factionType)}`;
        const gLabel = fgo.displayLabelForFactionArchiveType(ev?.factionType);
        if (lastKey !== null && gKey !== lastKey) {
            flush();
            pending = [];
        }
        lastKey = gKey;
        pendingLabel = gLabel;
        const fe = matchFactionManifestToArchiveRowName(ev?.name, items);
        if (fe && !pending.some(x => x.filename === fe.filename)) {
            pending.push(fe);
        }
    }
    flush();

    /* Manifest factions that didn't match any archive row -> "Other" bucket. */
    const rest = items.filter(f => f?.filename && !usedFilenames.has(f.filename));
    if (rest.length > 0) {
        const sep = document.createElement('div');
        sep.className = 'filters-grid-type-separator';
        sep.setAttribute('role', 'separator');
        sep.setAttribute('aria-label', 'Other');
        sep.textContent = 'Other';
        filtersGrid.appendChild(sep);
        cachedButtons.push(sep);
        rest.forEach(entry => {
            const btn = createFilterButton(entry, 'factions', folder, stateManager, imageService, soundManager, updateFilterCounts);
            filtersGrid.appendChild(btn);
            cachedButtons.push(btn);
        });
    }

    return cachedButtons;
}
