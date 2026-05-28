/**
 * NPCs filter tab in "grouped" mode: one separator per archive `npcCategory`,
 * then manifest NPC chips in archive sort order.
 */

import { resolveNpcCategoryFromArchiveRow } from '../../../../Data-Archive/archive-category-npcs/ArchiveNpcOrdering.js';
import { createFilterButton } from '../createFilterButton.js';
import { matchNpcManifestToArchiveRowName } from '../filterKeyMapping.js';
import { getNpcsArchiveRowsForFilterGrouping } from './archiveLayoutSnapshots.js';

export function buildGroupedNpcArchiveFilterDom(
    items, folder, filtersGrid, stateManager, imageService, soundManager, updateFilterCounts
) {
    const ngo = typeof window !== 'undefined' ? window.NpcArchiveGroupOrderHelpers : null;
    const cachedButtons = [];
    filtersGrid.innerHTML = '';

    if (!ngo || typeof ngo.normalizeNpcArchiveCategory !== 'function' ||
        !Array.isArray(items) || items.length === 0) {
        return cachedButtons;
    }

    const events = getNpcsArchiveRowsForFilterGrouping();
    if (typeof ngo.sortNpcsArchiveEventsStable === 'function') {
        ngo.sortNpcsArchiveEventsStable(events);
    }

    const usedNpcIds = new Set();
    let lastKey = null;
    let pendingLabel = '';
    /** @type {string[]} */
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
        pending.forEach(npcId => {
            usedNpcIds.add(npcId);
            const btn = createFilterButton(npcId, 'npcs', folder, stateManager, imageService, soundManager, updateFilterCounts);
            filtersGrid.appendChild(btn);
            cachedButtons.push(btn);
        });
    };

    for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const resolvedCategory = resolveNpcCategoryFromArchiveRow(ev);
        const gKey = `${ngo.npcArchiveCategoryRank(resolvedCategory)}|${ngo.normalizeNpcArchiveCategory(resolvedCategory)}`;
        const gLabel = ngo.displayLabelForNpcArchiveCategory(resolvedCategory);
        if (lastKey !== null && gKey !== lastKey) {
            flush();
            pending = [];
        }
        lastKey = gKey;
        pendingLabel = gLabel;
        const npcId = matchNpcManifestToArchiveRowName(ev?.name, items);
        if (npcId && !pending.includes(npcId)) {
            pending.push(npcId);
        }
    }
    flush();

    const rest = items.filter(id => id && !usedNpcIds.has(id));
    if (rest.length > 0) {
        const sep = document.createElement('div');
        sep.className = 'filters-grid-type-separator';
        sep.setAttribute('role', 'separator');
        sep.setAttribute('aria-label', 'Other');
        sep.textContent = 'Other';
        filtersGrid.appendChild(sep);
        cachedButtons.push(sep);
        rest.forEach(npcId => {
            const btn = createFilterButton(npcId, 'npcs', folder, stateManager, imageService, soundManager, updateFilterCounts);
            filtersGrid.appendChild(btn);
            cachedButtons.push(btn);
        });
    }

    return cachedButtons;
}
