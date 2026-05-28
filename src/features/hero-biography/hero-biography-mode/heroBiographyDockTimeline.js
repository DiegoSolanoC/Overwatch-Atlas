/**
 * Biography mode — curated dock timeline (events matching the selected archive entity).
 */

import {
    getStoryEventFactionTokens,
    getStoryEventHeroTokens,
    getStoryEventNpcTokens,
} from '../../system-interface/interface-shared/storyEventFilterPlaces.js';
import { normalizeBioBiographyCategory } from './bioBiographyCategories.js';

const HOST_ID = 'atlasHeroBiographyHost';

/** @type {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} */
let activeCategory = 'heroes';

/** @type {string | null} */
let activeFilterKey = null;

/** @type {string} */
let activeDisplayName = '';

export function isHeroBiographyModeActive() {
    return !!document.getElementById(HOST_ID);
}

export function isHeroBiographyDockFilterActive() {
    return isHeroBiographyModeActive() && !!activeFilterKey;
}

export function getActiveHeroBiographyDockHeroFilter() {
    return activeCategory === 'heroes' ? activeFilterKey : null;
}

export function getActiveBioBiographyDockSelection() {
    if (!activeFilterKey) return null;
    return {
        category: activeCategory,
        filterKey: activeFilterKey,
        displayName: activeDisplayName,
    };
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory | null} category
 * @param {string | null} filterKey
 * @param {string} [displayName]
 */
export function setBioBiographyDockFilter(category, filterKey, displayName = '') {
    activeCategory = category ? normalizeBioBiographyCategory(category) : 'heroes';
    const key = filterKey != null ? String(filterKey).trim() : '';
    activeFilterKey = key || null;
    activeDisplayName = key ? String(displayName || key).trim() : '';
}

/**
 * @param {string | null} heroFilterKey — manifest hero id (e.g. "Ana").
 */
export function setHeroBiographyDockHeroFilter(heroFilterKey) {
    setBioBiographyDockFilter('heroes', heroFilterKey);
}

export function clearHeroBiographyDockHeroFilter() {
    activeCategory = 'heroes';
    activeFilterKey = null;
    activeDisplayName = '';
}

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

/**
 * @param {object | null | undefined} entity
 * @param {string} factionFilterKey
 * @param {string} displayName
 */
function entityIncludesFaction(entity, factionFilterKey, displayName) {
    if (!entity) return false;
    const fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
    const tokens = getStoryEventFactionTokens(entity);
    for (let i = 0; i < tokens.length; i += 1) {
        const token = String(tokens[i] || '').trim();
        if (!token) continue;
        if (fh && typeof fh.factionIdsMatch === 'function') {
            if (fh.factionIdsMatch(factionFilterKey, token)) return true;
            if (displayName && fh.factionIdsMatch(displayName, token)) return true;
        }
        if (displayName && token.toLowerCase() === displayName.toLowerCase()) return true;
    }
    return false;
}

/**
 * @param {object | null | undefined} entity
 * @param {string} npcFilterKey
 */
function entityIncludesNpc(entity, npcFilterKey) {
    if (!entity) return false;
    const keyLower = String(npcFilterKey || '').trim().toLowerCase();
    if (!keyLower) return false;
    return getStoryEventNpcTokens(entity).some(
        (token) => String(token || '').trim().toLowerCase() === keyLower,
    );
}

/**
 * @param {object} event
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {string} filterKey
 * @param {string} displayName
 */
export function eventMatchesBioBiographyFilter(event, category, filterKey, displayName = '') {
    const cat = normalizeBioBiographyCategory(category);
    const key = String(filterKey || '').trim();
    if (!key || !event) return false;

    const testEntity = (entity) => {
        if (cat === 'factions') return entityIncludesFaction(entity, key, displayName);
        if (cat === 'npcs') return entityIncludesNpc(entity, key);
        return entityIncludesHero(entity, key);
    };

    if (testEntity(event)) return true;

    const variants = event.variants;
    if (Array.isArray(variants)) {
        return variants.some((variant) => testEntity(variant));
    }

    return false;
}

export function eventMatchesHeroBiographyFilter(event, heroFilterKey) {
    return eventMatchesBioBiographyFilter(event, 'heroes', heroFilterKey);
}

/**
 * @param {object[]} baseEvents — full story dock timeline from EventManager.
 * @returns {object[]}
 */
export function resolveDockTimelineEventsForDisplay(baseEvents) {
    const list = Array.isArray(baseEvents) ? baseEvents : [];
    if (!isHeroBiographyDockFilterActive() || !activeFilterKey) {
        return list;
    }
    if (activeCategory === 'locations') {
        return list;
    }
    return list.filter((event) =>
        eventMatchesBioBiographyFilter(
            event,
            activeCategory,
            activeFilterKey,
            activeDisplayName,
        ),
    );
}

/**
 * @returns {object[]}
 */
export function getDockTimelineEventsForPagination() {
    const base = window.eventManager?.getDockTimelineEvents?.() || [];
    return resolveDockTimelineEventsForDisplay(base);
}

/**
 * Rebuild dock pagination for the current entity filter (or full timeline after clear).
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

    window.dispatchEvent(
        new CustomEvent('atlas-dock-timeline-page-changed', {
            detail: { page: pagination?.getCurrentPage?.() || 1 },
        }),
    );
}
