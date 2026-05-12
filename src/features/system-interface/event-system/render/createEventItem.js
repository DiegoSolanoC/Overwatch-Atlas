/**
 * Build a single `<div class="event-item">` for the Event Manager list.
 *
 * Thin orchestrator that:
 *   1. Constructs the bare `.event-item` element with the right `data-*` and classes
 *      (drag flags, archive group keys for grouped lists, "unsaved" / "multi-event").
 *   2. Asks `resolveEventItemLocation.js` for the location label + current-variant context.
 *   3. Asks `renderEventItemMarkup.js` for the inner HTML.
 *   4. Tags the card with search-match classes when the active filter/country search hits.
 *   5. Wires interactions via `wireEventItemInteractions.js` (hover, open, variant cycle).
 *
 * GitHub Pages: drag is disabled, edit affordances skipped, the whole card becomes the
 * "open on globe" target (instead of just the thumb).
 *
 * Multi-event handling: the card always renders the **currently-selected variant** (tracked
 * on `eventManager.eventItemVariantIndices`, default 0). Cycling re-renders the card via
 * `eventManager.cycleEventVariant(index, event, item)`.
 */

import { resolveEventItemLocation } from './resolveEventItemLocation.js';
import { renderEventItemMarkup } from './renderEventItemMarkup.js';
import { wireEventItemInteractions } from './wireEventItemInteractions.js';

/** @returns {typeof window.FactionArchiveGroupOrderHelpers|null} */
function factionArchiveGroupOrder() {
    return typeof window !== 'undefined' ? window.FactionArchiveGroupOrderHelpers || null : null;
}

/** @returns {typeof window.HeroArchiveRoleOrderHelpers|null} */
function heroArchiveRoleOrder() {
    return typeof window !== 'undefined' ? window.HeroArchiveRoleOrderHelpers || null : null;
}

/**
 * @param {any} renderService Owning EventRenderService.
 * @param {Record<string, any>} event
 * @param {number} index Position in the FULL list (post-filter aware).
 * @param {Array<Record<string, any>>} _allEvents Currently unused but kept for API symmetry.
 * @param {{ hasOverlap?: boolean, factionsGroupedList?: boolean, heroesGroupedList?: boolean }} [options]
 */
export function createEventItem(renderService, event, index, _allEvents, options = {}) {
    const eventManager = renderService.eventManager;
    if (!eventManager) {
        console.error('EventRenderService: EventManager not set!');
        return document.createElement('div');
    }

    const item = document.createElement('div');
    item.className = 'event-item';
    const isGitHubPages = eventManager.isGitHubPages ? eventManager.isGitHubPages() : false;
    if (isGitHubPages) item.classList.add('event-item--view-only');
    if (!isGitHubPages) item.draggable = true;
    item.dataset.index = index;

    if (options.factionsGroupedList) {
        const fgo = factionArchiveGroupOrder();
        if (fgo) item.dataset.factionType = fgo.normalizeFactionArchiveType(event?.factionType);
    }
    if (options.heroesGroupedList) {
        const hro = heroArchiveRoleOrder();
        if (hro) {
            const nr = hro.normalizeHeroArchiveRole(event?.heroRole);
            item.dataset.heroRole = nr;
            item.dataset.heroSubRole = hro.normalizeHeroArchiveSubrole(event?.heroSubRole, nr);
        }
    }

    if (eventManager.unsavedEventIndices && eventManager.unsavedEventIndices.has(index)) {
        item.classList.add('unsaved');
    }

    const resolved = resolveEventItemLocation(eventManager, event, index);
    if (resolved.isMultiEvent) item.classList.add('multi-event');

    const isSatelliteArchive =
        typeof eventManager?.dataService?.getArchiveSource === 'function'
        && eventManager.dataService.getArchiveSource() !== 'story';

    const imagePath = eventManager.getEventImagePath
        ? eventManager.getEventImagePath(resolved.displayEvent.name, resolved.displayEvent.image)
        : null;

    // Same heuristic as the info-panel "missing description" placeholder.
    const d = resolved.displayEvent.description;
    let hasDescription = false;
    if (d) {
        const textContent = d.replace(/<[^>]*>/g, '').trim();
        if (textContent !== 'No description available.' && textContent !== 'No description available' && textContent.length > 0) {
            hasDescription = true;
        }
    }
    const isUnfinished = !hasDescription;
    item.classList.toggle('event-item--unfinished', isUnfinished);

    if (eventManager.getSearchMatchAxesForItem) {
        const axes = eventManager.getSearchMatchAxesForItem(resolved.displayEvent);
        if (axes.filterActive || axes.countryActive) {
            if (axes.filterHit) item.classList.add('event-item--search-hit-filter');
            if (axes.countryHit) item.classList.add('event-item--search-hit-country');
        }
    }

    const storyPanel = typeof document !== 'undefined' ? document.getElementById('eventsManagePanel') : null;
    const useStoryArchiveDockTitle = !!(storyPanel?.classList.contains('story-viewer-panel-embedded'));

    item.innerHTML = renderEventItemMarkup({
        event,
        displayEvent: resolved.displayEvent,
        index,
        currentVariantIndex: resolved.currentVariantIndex,
        isMultiEvent: resolved.isMultiEvent,
        locationName: resolved.locationName,
        displayLocationType: resolved.displayLocationType,
        imagePath,
        isSatelliteArchive,
        hasOverlap: !!options.hasOverlap,
        isUnfinished,
        useStoryArchiveDockTitle,
    });

    wireEventItemInteractions({
        item,
        eventManager,
        event,
        displayEvent: resolved.displayEvent,
        index,
        isMultiEvent: resolved.isMultiEvent,
        isGitHubPages,
    });

    return item;
}
