/**
 * renderEventsList — per-render pipeline for the Event Manager list.
 *
 *   1. Clamp the page index against the total event count.
 *   2. Update the `#eventsCount` chip with the canonical "N Events (Page X/Y)" string.
 *   3. Reset `#eventsList` and (when entrance animation was requested) scroll panels to top.
 *   4. Early-return with a friendly empty-state message when there's nothing to render.
 *   5. Resolve `actualIndex` against the *unfiltered* manager list (because edit/open use
 *      indices into the full list, but `events` here is already filtered).
 *   6. Sort grouped archives in place (faction-type / hero-role) so separator emission below
 *      matches the rendered order.
 *   7. Compute the overlap-index set so cards can opt into the red `--overlap` badge style.
 *   8. Walk the slice, emitting grouped-archive separators before each event whose bucket
 *      key changed (see `groupedArchiveSeparatorInjector.js`), and building each card with
 *      `createEventItem`.
 *   9. Install the image lazy-loader (`setupEventManagerImageLazyLoading`).
 *  10. **DEV ONLY**: defensive re-apply of `--overlap` styling — browsers occasionally drop
 *      `!important` rules under heavy reflow on localhost; production hosts never see this.
 *  11. Optionally play the staggered entrance animation (only when the caller previously
 *      primed `_animateNextPageRender`).
 *  12. Fire `onRenderComplete` callback for drag/drop re-wiring.
 *  13. Update the news ticker from the just-rendered slice.
 *  14. Render the bottom pagination controls.
 */

import { computeOverlapIndexSet } from './overlapDetection.js';
import { runStaggeredEntranceAnimation } from './staggeredEntranceAnimation.js';
import { setupEventManagerImageLazyLoading } from './eventManagerImageLazyLoad.js';
import { updateNewsTicker } from './newsTicker.js';
import { renderPaginationControls } from './paginationControls.js';
import {
    createFactionArchiveTypeSeparator,
    createHeroArchiveRoleSeparator,
    createHeroArchiveSubroleSeparator,
    createNpcArchiveCategorySeparator,
} from './archiveSeparators.js';
import { createEventItem } from './createEventItem.js';
import { createGroupedArchiveSeparatorInjector } from './groupedArchiveSeparatorInjector.js';

/** @returns {typeof window.FactionArchiveGroupOrderHelpers|null} */
function factionArchiveGroupOrder() {
    return typeof window !== 'undefined' ? window.FactionArchiveGroupOrderHelpers || null : null;
}

/** @returns {typeof window.HeroArchiveRoleOrderHelpers|null} */
function heroArchiveRoleOrder() {
    return typeof window !== 'undefined' ? window.HeroArchiveRoleOrderHelpers || null : null;
}

/** @returns {typeof window.NpcArchiveGroupOrderHelpers|null} */
function npcArchiveGroupOrder() {
    return typeof window !== 'undefined' ? window.NpcArchiveGroupOrderHelpers || null : null;
}

/**
 * @param {any} renderService Owning EventRenderService.
 * @param {Array} events Post-filter event slice supplied by the caller.
 * @param {number} currentPage
 * @param {number} eventsPerPage
 * @param {Function} [onRenderComplete] Drag/drop wire-up etc; fires after DOM insert.
 */
export function renderEventsList(renderService, events, currentPage, eventsPerPage, onRenderComplete) {
    const eventsList = document.getElementById('eventsList');
    if (!eventsList) {
        console.error('EventRenderService: eventsList element not found!');
        renderService.updateStatus('EventRenderService: Error - eventsList element not found!', 'error');
        return;
    }

    // Only scroll to top on explicit page navigation, which is what primes the entrance flag.
    const shouldScrollToTop = renderService._animateNextPageRender === true;

    const totalEvents = events.length;
    const totalPages = Math.max(1, Math.ceil(totalEvents / eventsPerPage));
    let validPage = currentPage;
    if (validPage > totalPages) validPage = totalPages;
    if (validPage < 1) validPage = 1;

    const startIndex = (validPage - 1) * eventsPerPage;
    const endIndex = Math.min(startIndex + eventsPerPage, totalEvents);
    const eventsToRender = events.slice(startIndex, endIndex);

    const eventsCountElement = document.getElementById('eventsCount');
    if (eventsCountElement) {
        eventsCountElement.textContent = `${totalEvents} ${totalEvents === 1 ? 'Event' : 'Events'} (Page ${validPage}/${totalPages})`;
    }

    eventsList.innerHTML = '';

    if (shouldScrollToTop) {
        try {
            eventsList.scrollTop = 0;
            const panel = document.getElementById('eventsManagePanel') || document.querySelector('.events-manage-panel');
            if (panel) panel.scrollTop = 0;
        } catch (_) { /* no-op */ }
    }

    if (events.length === 0) {
        const eventManager = renderService.eventManager;
        const hasSearch = eventManager && (
            (eventManager.searchQuery && eventManager.searchQuery.trim()) ||
            (eventManager.searchHeroFilters && eventManager.searchHeroFilters.length > 0) ||
            (eventManager.searchFactionFilters && eventManager.searchFactionFilters.length > 0) ||
            (eventManager.searchNpcFilters && eventManager.searchNpcFilters.length > 0) ||
            (eventManager.searchUnmatchedFilterTokens && eventManager.searchUnmatchedFilterTokens.length > 0) ||
            (eventManager.searchCountryFilters && eventManager.searchCountryFilters.length > 0)
        );
        const msg = hasSearch
            ? 'No matching events. Try changing search or filters.'
            : 'No events yet. Click "Add Event" to add a blank event at 0°,0° and open it—then use Edit on the info panel.';
        eventsList.innerHTML = `<div style="padding: 20px; text-align: center; color: rgba(255,255,255,0.5);">${msg}</div>`;
        renderPaginationControls(renderService, events, validPage, eventsPerPage);
        return;
    }

    const fullList = renderService.eventManager && renderService.eventManager.events
        ? renderService.eventManager.events
        : events;
    const archiveSourceList =
        typeof renderService.eventManager?.dataService?.getArchiveSource === 'function'
            ? renderService.eventManager.dataService.getArchiveSource()
            : 'story';
    const factionsGroupedList = archiveSourceList === 'factions';
    const heroesGroupedList = archiveSourceList === 'heroes';
    const npcsGroupedList = archiveSourceList === 'npcs';
    if (factionsGroupedList) {
        factionArchiveGroupOrder()?.sortFactionsArchiveEventsStable(fullList);
    }
    if (heroesGroupedList) {
        heroArchiveRoleOrder()?.sortHeroesArchiveEventsStable(fullList);
    }
    if (npcsGroupedList) {
        npcArchiveGroupOrder()?.sortNpcsArchiveEventsStable(fullList);
    }

    const overlapIndexSet = computeOverlapIndexSet(eventsToRender, fullList, renderService.eventManager);
    const renderStartTime = performance.now();
    const fragment = document.createDocumentFragment();

    const separators = createGroupedArchiveSeparatorInjector(
        fragment,
        {
            createFactionArchiveTypeSeparator,
            createHeroArchiveRoleSeparator,
            createHeroArchiveSubroleSeparator,
            createNpcArchiveCategorySeparator,
        },
        { factionArchiveGroupOrder, heroArchiveRoleOrder, npcArchiveGroupOrder }
    );

    // Seed last-key state when the page slice starts mid-bucket so the first card on the
    // page doesn't redundantly print its own bucket header.
    if (startIndex > 0) {
        if (factionsGroupedList) separators.seedFromPreviousEvent(events[startIndex - 1], 'factions');
        if (heroesGroupedList) separators.seedFromPreviousEvent(events[startIndex - 1], 'heroes');
        if (npcsGroupedList) separators.seedFromPreviousEvent(events[startIndex - 1], 'npcs');
    }

    eventsToRender.forEach((event) => {
        const actualIndex = fullList.indexOf(event);
        if (actualIndex === -1) return;
        const hasOverlap = overlapIndexSet.has(actualIndex);

        if (factionsGroupedList) separators.maybeEmitForEvent(event, 'factions');
        if (heroesGroupedList) separators.maybeEmitForEvent(event, 'heroes');
        if (npcsGroupedList) separators.maybeEmitForEvent(event, 'npcs');

        const eventItem = createEventItem(renderService, event, actualIndex, fullList, {
            hasOverlap,
            factionsGroupedList,
            heroesGroupedList,
            npcsGroupedList,
        });
        fragment.appendChild(eventItem);
    });
    eventsList.appendChild(fragment);

    setupEventManagerImageLazyLoading(renderService, eventsList);

    // DEV ONLY: defensive re-apply of red overlap styling — CSS `!important` can lose to
    // inline styles under heavy reflow on localhost; production never hits this path.
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setTimeout(() => {
            const overlapBadges = eventsList.querySelectorAll('.event-number-badge--overlap');
            overlapBadges.forEach((badge) => {
                badge.style.setProperty('color', '#ff4444', 'important');
                badge.style.setProperty('text-shadow', '0 1px 3px rgba(0, 0, 0, 0.85), 0 2px 12px rgba(0, 0, 0, 0.45)', 'important');
            });
        }, 100);
    }

    const renderTime = performance.now() - renderStartTime;
    renderService.updateStatus(`EventRenderService: Rendered page ${validPage} (${eventsToRender.length} events, ${renderTime.toFixed(0)}ms)`, 'success');

    const shouldAnimateEntrance = renderService._animateNextPageRender;
    renderService._animateNextPageRender = false;
    if (shouldAnimateEntrance) {
        runStaggeredEntranceAnimation(renderService, eventsList);
    }

    if (onRenderComplete && typeof onRenderComplete === 'function') {
        onRenderComplete();
    }

    updateNewsTicker(eventsToRender);
    renderPaginationControls(renderService, events, validPage, eventsPerPage);
}
