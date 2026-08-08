/**
 * Biography mode — curated dock timeline (events matching the selected archive entity).
 */

import {
    getStoryEventFactionTokens,
    getStoryEventHeroTokens,
    getStoryEventNpcTokens,
} from '../../system-interface/interface-shared/storyEventFilterPlaces.js';
import { normalizeBioBiographyCategory } from './bioBiographyCategories.js';
import { applyDockEraTimelineFilter } from '../../system-interface/interface-bottom-dock/dockEraTimelineFilter.js';
import { refreshDockTimelinePagination } from '../../system-interface/interface-bottom-dock/refreshDockTimelinePagination.js';

const HOST_ID = 'atlasGalleryHost';

/** @type {import('./bioBiographyCategories.js').BioBiographyArchiveCategory | 'countries'} */
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
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory | 'countries' | null} category
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
 * @param {object | null | undefined} entity
 * @param {string} countryFilterKey — `country:<flagFile>` or bare flag filename
 */
function entityIncludesCountry(entity, countryFilterKey) {
    if (!entity) return false;
    const raw = String(countryFilterKey || '').trim();
    if (!raw) return false;
    const want = raw.toLowerCase().startsWith('country:')
        ? raw.slice('country:'.length).trim()
        : raw;
    if (!want) return false;

    const lh = typeof window !== 'undefined' ? window.LocationFlagHelpers : null;
    const sec = typeof window !== 'undefined' ? window.__SecondaryCountryFlags : null;
    const collect = lh?.collectCountryFlagFilesForEntity ?? sec?.collectCountryFlagFilesForEntity;
    const files = collect ? collect(entity) : [];
    if (!Array.isArray(files) || files.length === 0) return false;

    const norm = (v) => String(v || '').trim().toLowerCase().replace(/\.png$/i, '');
    const wantN = norm(want);
    return files.some((f) => {
        const have = norm(f);
        return have && (have === wantN || have.endsWith(`/${wantN}`) || wantN.endsWith(`/${have}`));
    });
}

/**
 * @param {object} event
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory | 'countries'} category
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
        if (cat === 'countries') return entityIncludesCountry(entity, key);
        if (cat === 'locations') return false;
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
    let filtered = list;
    if (isHeroBiographyDockFilterActive() && activeFilterKey && activeCategory !== 'locations') {
        filtered = list.filter((event) =>
            eventMatchesBioBiographyFilter(
                event,
                activeCategory,
                activeFilterKey,
                activeDisplayName,
            ),
        );
    }
    return applyDockEraTimelineFilter(filtered);
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
    refreshDockTimelinePagination();
}
