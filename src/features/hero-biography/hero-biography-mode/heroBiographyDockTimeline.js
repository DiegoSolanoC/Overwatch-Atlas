/**
 * Hero Biography — curated dock timeline (events that include the selected hero in filters).
 */

import { getStoryEventHeroTokens } from '../../system-interface/interface-shared/storyEventFilterPlaces.js';

const HOST_ID = 'atlasHeroBiographyHost';

/** @type {string | null} */
let activeHeroFilterKey = null;

export function isHeroBiographyModeActive() {
    return !!document.getElementById(HOST_ID);
}

export function isHeroBiographyDockFilterActive() {
    return isHeroBiographyModeActive() && !!activeHeroFilterKey;
}

export function getActiveHeroBiographyDockHeroFilter() {
    return activeHeroFilterKey;
}

/**
 * @param {string | null} heroFilterKey — manifest hero id (e.g. "Ana").
 */
export function setHeroBiographyDockHeroFilter(heroFilterKey) {
    const key = heroFilterKey != null ? String(heroFilterKey).trim() : '';
    activeHeroFilterKey = key || null;
}

export function clearHeroBiographyDockHeroFilter() {
    activeHeroFilterKey = null;
}

/**
 * @param {object} event
 * @param {string} heroFilterKey
 * @returns {boolean}
 */
/**
 * @param {object | null | undefined} entity
 * @param {string} heroFilterKey
 * @returns {boolean}
 */
function entityIncludesHero(entity, heroFilterKey) {
    if (!entity) return false;
    const keyLower = String(heroFilterKey || '').trim().toLowerCase();
    if (!keyLower) return false;
    return getStoryEventHeroTokens(entity).some(
        (token) => String(token || '').trim().toLowerCase() === keyLower,
    );
}

export function eventMatchesHeroBiographyFilter(event, heroFilterKey) {
    const key = String(heroFilterKey || '').trim();
    if (!key || !event) return false;

    if (entityIncludesHero(event, key)) return true;

    const variants = event.variants;
    if (Array.isArray(variants)) {
        return variants.some((variant) => entityIncludesHero(variant, key));
    }

    return false;
}

/**
 * @param {object[]} baseEvents — full story dock timeline from EventManager.
 * @returns {object[]}
 */
export function resolveDockTimelineEventsForDisplay(baseEvents) {
    const list = Array.isArray(baseEvents) ? baseEvents : [];
    if (!isHeroBiographyDockFilterActive() || !activeHeroFilterKey) {
        return list;
    }
    return list.filter((event) => eventMatchesHeroBiographyFilter(event, activeHeroFilterKey));
}

/**
 * @returns {object[]}
 */
export function getDockTimelineEventsForPagination() {
    const base = window.eventManager?.getDockTimelineEvents?.() || [];
    return resolveDockTimelineEventsForDisplay(base);
}

/**
 * Rebuild dock pagination for the current hero filter (or full timeline after clear).
 */
export function refreshHeroBiographyDockPagination() {
    const slide = window.standaloneEventSlide;
    const pagination = window.standaloneDockPagination;

    if (
        slide &&
        Number.isFinite(slide.currentEventIndex) &&
        slide.currentEventIndex >= 0 &&
        isHeroBiographyDockFilterActive()
    ) {
        const curated = getDockTimelineEventsForPagination();
        const openEvent = slide.allEvents?.[slide.currentEventIndex];
        if (openEvent && !curated.includes(openEvent)) {
            slide.hideEventSlide?.();
        }
    }

    if (pagination?.goToPage) {
        pagination.goToPage(1, { skipSound: true });
    }
    if (slide?.updatePaginationUI) {
        slide.updatePaginationUI({ animate: false });
    }

    if (window.newsTickerService && pagination?.getDockEvents) {
        const page = pagination.getCurrentPage?.() || 1;
        const perPage = pagination.eventsPerPage || 10;
        const events = pagination.getDockEvents();
        const start = (page - 1) * perPage;
        window.newsTickerService.updateTicker(events.slice(start, start + perPage));
    }

    window.globeEventMarkerManager?.refreshEventMarkers?.(true);
    window.globeController?.map2dLite?.syncMarkers?.({ mode: 'pageTurn' });
}
