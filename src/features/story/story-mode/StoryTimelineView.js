/**
 * Story timeline view — year markers and event previews on a pannable track.
 */

import { buildStoryTimelineYearLayout } from './StoryTimelineYears.js';
import {
    buildStoryTimelineEventLayout,
    TIMELINE_CARD_SLOT_PX,
} from './StoryTimelineEventLayout.js';
import { createEventItem } from '../../system-interface/interface-left-panel/event-system/render/createEventItem.js';
import { setupEventManagerImageLazyLoading, flushVisibleLazyPreviewImages } from '../../system-interface/interface-left-panel/event-system/render/eventManagerImageLazyLoad.js';
import { computeOverlapIndexSet } from '../../system-interface/interface-left-panel/event-system/render/overlapDetection.js';
import { filterEventsByStandaloneActiveFilters } from '../../system-interface/interface-left-panel/coordinator/search/filterEvents.js';
import { refreshStoryArchiveEraTintIfActive } from './StoryArchiveEraTint.js';
import {
    applyDockEraTimelineFilter,
    isDockEraFilterActive,
} from '../../system-interface/interface-bottom-dock/dockEraTimelineFilter.js';
import {
    buildTimelineEraLineGradient,
    getEraStripeColorHexForEvent,
    hexColorToRgbCsv,
} from '../../system-interface/interface-shared/hover-badge/eraHoverPreviewTheme.js';

const TRACK_PADDING_PX = 80;
const DOCK_EVENTS_PER_PAGE = 10;
const TIMELINE_CARD_BATCH_SIZE = 24;
/** How far connector stems tuck under the main era bar (masks rounded caps). */
const CONNECTOR_LINE_OVERLAP_PX = 10;

/** @type {(() => void) | null} */
let panTeardown = null;

/** @type {(() => void) | null} */
let resizeTeardown = null;

/** @type {(() => void) | null} */
let connectorStemTeardown = null;

/**
 * Extend each connector stem from the main line to the center of its preview thumb.
 *
 * @param {HTMLElement} track
 */
function syncTimelineConnectorStems(track) {
    const line = track.querySelector('.story-timeline-view__line');
    if (!line) return;

    const lineRect = line.getBoundingClientRect();

    for (const connector of track.querySelectorAll('.story-timeline-connector')) {
        const index = connector.dataset.index;
        if (!index) continue;

        const slot = track.querySelector(`.story-timeline-event[data-index="${index}"]`);
        const thumbShell = slot?.querySelector('.event-item__thumb-shell');
        if (!slot || !thumbShell) continue;

        const thumbRect = thumbShell.getBoundingClientRect();
        const thumbCenterY = thumbRect.top + thumbRect.height / 2;
        const isAbove = connector.classList.contains('story-timeline-connector--above');
        const span = isAbove
            ? lineRect.top - thumbCenterY
            : thumbCenterY - lineRect.bottom;

        connector.style.marginTop = isAbove
            ? `${CONNECTOR_LINE_OVERLAP_PX}px`
            : `-${CONNECTOR_LINE_OVERLAP_PX}px`;
        connector.style.height = `${Math.max(6, Math.round(span + CONNECTOR_LINE_OVERLAP_PX))}px`;
        connector.style.opacity = span > 0 ? '1' : '0';
    }
}

/**
 * @param {HTMLElement} track
 */
function scheduleTimelineConnectorStemSync(track) {
    requestAnimationFrame(() => {
        syncTimelineConnectorStems(track);
        requestAnimationFrame(() => syncTimelineConnectorStems(track));
    });
}

/**
 * @param {HTMLElement} track
 * @param {HTMLElement | null} [viewport]
 */
function ensureConnectorStemSync(track, viewport = null) {
    if (typeof connectorStemTeardown === 'function') {
        connectorStemTeardown();
        connectorStemTeardown = null;
    }

    scheduleTimelineConnectorStemSync(track);

    const ac = new AbortController();
    const { signal } = ac;

    const resizeObserver = new ResizeObserver(() => {
        syncTimelineConnectorStems(track);
    });
    resizeObserver.observe(track);
    if (viewport) {
        resizeObserver.observe(viewport);
    }

    track.addEventListener('load', () => {
        syncTimelineConnectorStems(track);
    }, { capture: true, signal });

    const panViewport = track.parentElement;
    if (panViewport) {
        panViewport.addEventListener('story-timeline-pan', () => {
            syncTimelineConnectorStems(track);
        }, { signal });
    }

    connectorStemTeardown = () => {
        ac.abort();
        resizeObserver.disconnect();
        connectorStemTeardown = null;
    };
}

/** @type {{ scrollToStart: () => void, scrollToDockPage: (page: number, perPage?: number) => void, scrollToDockSliderProgress: (progress: number) => void, scrollToProgress: (progress: number) => void } | null} */
let panApi = null;

/** Layout snapshot for pan math before / without DOM cards. */
/** @type {{ sourceIndices: number[], positions: { index: number, x: number }[] } | null} */
let timelinePanLayoutCache = null;

/**
 * @returns {{
 *   dockEvents: unknown[],
 *   allEvents: unknown[],
 *   eventsPerPage: number,
 *   totalPages: number,
 * }}
 */
function getDockPaginationContext() {
    const eventsPerPage = window.standaloneDockPagination?.eventsPerPage ?? DOCK_EVENTS_PER_PAGE;
    const dockEvents = getCuratedDockTimelineEvents();
    const allEvents = window.eventManager?.dataService?.getEvents?.()
        ?? window.eventManager?.events
        ?? [];
    const totalPages = Math.max(1, Math.ceil(dockEvents.length / eventsPerPage));
    return {
        dockEvents,
        allEvents: Array.isArray(allEvents) ? allEvents : [],
        eventsPerPage,
        totalPages,
    };
}

/**
 * @param {number} sourceIndex
 * @returns {number|null}
 */
function findLayoutXForSourceIndex(sourceIndex) {
    if (!timelinePanLayoutCache) return null;
    const { sourceIndices, positions } = timelinePanLayoutCache;
    const filteredIdx = sourceIndices.indexOf(sourceIndex);
    if (filteredIdx < 0) return null;
    const pos = positions.find((p) => p.index === filteredIdx);
    return pos != null ? pos.x : null;
}

/**
 * First story-list index on a dock page that exists on the visible timeline track.
 *
 * @param {number} page1Based
 * @param {number} [eventsPerPage]
 * @returns {number|null}
 */
function getFirstVisibleSourceIndexOnPage(page1Based, eventsPerPage = DOCK_EVENTS_PER_PAGE) {
    const ctx = getDockPaginationContext();
    const perPage = eventsPerPage || ctx.eventsPerPage;
    const page = Math.min(Math.max(1, page1Based | 0), ctx.totalPages);
    const start = (page - 1) * perPage;
    const pageSlice = ctx.dockEvents.slice(start, start + perPage);
    const { sourceIndices, filterActive } = getStoryTimelineEventSet();
    const visible = filterActive ? new Set(sourceIndices) : null;

    for (const event of pageSlice) {
        const idx = ctx.allEvents.indexOf(event);
        if (idx < 0) continue;
        if (visible && !visible.has(idx)) continue;
        if (findLayoutXForSourceIndex(idx) != null || timelinePanLayoutCache == null) {
            return idx;
        }
    }
    return null;
}

/**
 * @param {number} x
 * @param {HTMLElement} viewport
 * @param {number} [cardWidth]
 * @returns {number}
 */
function panOffsetToCenterX(x, viewport, cardWidth = TIMELINE_CARD_SLOT_PX) {
    const viewportCenter = viewport.clientWidth / 2;
    return viewportCenter - x - cardWidth / 2;
}

/**
 * @param {number} sourceIndex
 * @param {HTMLElement} viewport
 * @param {HTMLElement} track
 * @returns {number|null}
 */
function computePanOffsetForSourceIndex(sourceIndex, viewport, track) {
    const slot = track.querySelector(`.story-timeline-event[data-index="${sourceIndex}"]`);
    if (slot) {
        const x = parseFloat(slot.style.left) || 0;
        const w = slot.offsetWidth || TIMELINE_CARD_SLOT_PX;
        return panOffsetToCenterX(x, viewport, w);
    }
    const layoutX = findLayoutXForSourceIndex(sourceIndex);
    if (layoutX != null) {
        return panOffsetToCenterX(layoutX, viewport, TIMELINE_CARD_SLOT_PX);
    }
    return null;
}

/**
 * @param {{
 *   searchQuery?: string,
 *   searchHeroFilters?: string[],
 *   searchFactionFilters?: string[],
 *   searchNpcFilters?: string[],
 *   searchCountryFilters?: string[],
 *   searchUnmatchedFilterTokens?: string[],
 * } | undefined} em
 */
function eventManagerSearchActive(em) {
    if (!em) return false;
    return !!(
        (em.searchQuery || '').trim()
        || em.searchHeroFilters?.length
        || em.searchFactionFilters?.length
        || em.searchNpcFilters?.length
        || em.searchCountryFilters?.length
        || em.searchUnmatchedFilterTokens?.length
    );
}

/**
 * Dock timeline after era (and gallery biography) curation — matches pagination thumbs/slider.
 * @returns {unknown[]}
 */
function getCuratedDockTimelineEvents() {
    const em = window.eventManager;
    const base = em?.getDockTimelineEvents?.() ?? [];
    return applyDockEraTimelineFilter(Array.isArray(base) ? base : []);
}

/**
 * @returns {boolean}
 */
function storyTimelineFilterActive() {
    if (isDockEraFilterActive()) return true;
    const activeFilters = window.standaloneActiveFilters;
    if (activeFilters?.size > 0) return true;
    return eventManagerSearchActive(window.eventManager);
}

/**
 * Visible timeline events — full story list, or only entries matching active filters.
 * Filter selection uses the same `shouldEventBeLocked` pass as the dock timeline.
 *
 * @returns {{
 *   events: unknown[],
 *   sourceIndices: number[],
 *   allEvents: unknown[],
 *   filterActive: boolean,
 * }}
 */
function getStoryTimelineEventSet() {
    const em = window.eventManager;
    if (!em?.dataService) {
        return { events: [], sourceIndices: [], allEvents: [], filterActive: false };
    }
    if (em.dataService.getArchiveSource?.() !== 'story') {
        return { events: [], sourceIndices: [], allEvents: [], filterActive: false };
    }

    const allEvents = em.dataService.getEvents?.() ?? em.events;
    if (!Array.isArray(allEvents)) {
        return { events: [], sourceIndices: [], allEvents: [], filterActive: false };
    }

    const fullDock = em.getDockTimelineEvents?.() ?? allEvents;
    let events = allEvents;
    let filterActive = false;

    if (isDockEraFilterActive()) {
        events = applyDockEraTimelineFilter(Array.isArray(fullDock) ? fullDock : []);
        filterActive = true;
    }

    const activeFilters = window.standaloneActiveFilters;
    if (activeFilters?.size > 0) {
        events = filterEventsByStandaloneActiveFilters(events, activeFilters);
        filterActive = true;
    }

    if (eventManagerSearchActive(em)) {
        const searchFiltered = new Set(em.getFilteredEvents?.() ?? allEvents);
        events = events.filter((event) => searchFiltered.has(event));
        filterActive = true;
    }

    const sourceIndices = [];
    const resolvedEvents = [];
    for (const event of events) {
        const sourceIndex = allEvents.indexOf(event);
        if (sourceIndex === -1) continue;
        resolvedEvents.push(event);
        sourceIndices.push(sourceIndex);
    }

    return {
        events: resolvedEvents,
        sourceIndices,
        allEvents,
        filterActive,
    };
}

function isStoryTimelineViewActive() {
    const panel = document.getElementById('eventsManagePanel');
    return !!panel?.classList.contains('story-viewer-panel-embedded--timeline-view')
        && window.eventManager?.dataService?.getArchiveSource?.() === 'story';
}

export { isStoryTimelineViewActive };

/**
 * @param {HTMLElement} track
 */
function readTrackPanOffset(track) {
    const transform = track.style.transform || '';
    const match = transform.match(/translate3d\((-?\d+(?:\.\d+)?)px/);
    return match ? parseFloat(match[1]) : null;
}

/**
 * @param {HTMLElement} layer
 * @returns {HTMLElement}
 */
function ensureTimelineViewport(layer) {
    let viewport = layer.querySelector('.story-timeline-view__viewport');
    if (viewport) return viewport;

    viewport = document.createElement('div');
    viewport.className = 'story-timeline-view__viewport';
    viewport.id = 'storyTimelineViewport';

    const track = document.createElement('div');
    track.className = 'story-timeline-view__track';
    track.id = 'storyTimelineTrack';
    viewport.appendChild(track);

    layer.replaceChildren(viewport);
    return viewport;
}

/**
 * @param {HTMLElement} track
 * @param {ReturnType<typeof buildStoryTimelineYearLayout>} layout
 * @param {number} trackWidth
 * @param {unknown[]} events
 * @param {number[]} sourceIndices
 * @param {unknown[]} allEvents
 * @param {ReturnType<typeof buildStoryTimelineEventLayout>} eventLayout
 * @param {HTMLElement} viewport
 * @param {boolean} filterActive
 * @param {(() => void) | undefined} onReady
 */
function renderTimelineTrack(track, layout, trackWidth, events, sourceIndices, allEvents, eventLayout, viewport, filterActive, onReady) {
    track.replaceChildren();
    track.classList.toggle('story-timeline-view__track--filtered', filterActive);
    track.style.width = `${trackWidth}px`;

    const line = document.createElement('div');
    line.className = 'story-timeline-view__line';
    line.setAttribute('aria-hidden', 'true');
    const eraGradient = buildTimelineEraLineGradient(events, eventLayout.positions, trackWidth);
    if (eraGradient) {
        line.style.background = eraGradient;
    }
    track.appendChild(line);

    const connectorsWrap = document.createElement('div');
    connectorsWrap.className = 'story-timeline-view__connectors';
    connectorsWrap.setAttribute('aria-hidden', 'true');
    track.appendChild(connectorsWrap);

    const markersWrap = document.createElement('div');
    markersWrap.className = 'story-timeline-view__markers';
    track.appendChild(markersWrap);

    for (const marker of layout.markers) {
        const el = document.createElement('div');
        el.className = `story-timeline-year story-timeline-year--${marker.role}`;
        el.dataset.year = String(marker.year);
        el.style.left = `${marker.x}px`;

        const label = document.createElement('span');
        label.className = 'story-timeline-year__label';
        label.textContent = String(marker.year);

        el.append(label);
        markersWrap.appendChild(el);
    }

    const eventsWrap = document.createElement('div');
    eventsWrap.className = 'story-timeline-view__events';
    eventsWrap.id = 'storyTimelineEvents';
    track.appendChild(eventsWrap);

    const renderService = window.EventRenderService;
    const positions = eventLayout.positions;

    if (!renderService?.eventManager || positions.length === 0) {
        onReady?.();
        return;
    }

    const overlapSet = computeOverlapIndexSet(events, events, null);

    onReady?.();

    let batchIndex = 0;

    const appendTimelineCardBatch = () => {
        const end = Math.min(batchIndex + TIMELINE_CARD_BATCH_SIZE, positions.length);

        for (; batchIndex < end; batchIndex += 1) {
            const pos = positions[batchIndex];
            const event = events[pos.index];
            const sourceIndex = sourceIndices[pos.index];
            if (!event || sourceIndex == null) continue;

            const slot = document.createElement('div');
            slot.className = `story-timeline-event story-timeline-event--${pos.side}`;
            slot.style.left = `${pos.x}px`;
            slot.dataset.index = String(sourceIndex);
            slot.dataset.anchorYear = String(pos.anchorYear);

            const connector = document.createElement('span');
            connector.className = `story-timeline-connector story-timeline-connector--${pos.side}`;
            connector.dataset.index = String(sourceIndex);
            connector.style.left = `${pos.x}px`;
            connector.style.setProperty('--stem-phase', String((pos.index % 7) * 0.21));
            const eraHex = getEraStripeColorHexForEvent(event);
            const eraRgb = hexColorToRgbCsv(eraHex);
            connector.style.setProperty('--stem-era-rgb', eraRgb);
            connector.style.backgroundColor = `rgba(${eraRgb}, 0.92)`;
            connector.style.boxShadow = `0 0 10px rgba(${eraRgb}, 0.5)`;
            connectorsWrap.appendChild(connector);

            const card = createEventItem(renderService, event, sourceIndex, allEvents, {
                hasOverlap: overlapSet.has(pos.index),
            });
            card.classList.add('story-timeline-event__card');
            slot.append(card);
            eventsWrap.appendChild(slot);
        }

        if (batchIndex < positions.length) {
            flushVisibleLazyPreviewImages(viewport, 240);
            requestAnimationFrame(appendTimelineCardBatch);
            return;
        }

        setupEventManagerImageLazyLoading(renderService, viewport);
        flushVisibleLazyPreviewImages(viewport, 240);
        ensureConnectorStemSync(track, viewport);

        const dockPage = window.standaloneDockPagination?.getCurrentPage?.();
        if (dockPage && isStoryTimelineViewActive()) {
            requestAnimationFrame(() => {
                scrollStoryTimelineToDockPage(dockPage, DOCK_EVENTS_PER_PAGE);
            });
        }
    };

    appendTimelineCardBatch();
}

/**
 * @typedef {'start'|'offset'|'page'|'progress'|'dockProgress'} StoryTimelinePanMode
 * @typedef {{ mode?: StoryTimelinePanMode, offset?: number|null, page?: number, eventsPerPage?: number, scrollToProgress?: number, scrollToDockProgress?: number }} StoryTimelinePanConfig
 */

/**
 * @param {HTMLElement} viewport
 * @param {HTMLElement} track
 * @param {StoryTimelinePanConfig} [panConfig]
 */
function attachPanHandlers(viewport, track, panConfig = {}) {
    let offsetX = 0;
    let dragging = false;
    let startX = 0;
    let startOffset = 0;
    const ac = new AbortController();
    const { signal } = ac;

    function trackFitsInViewport() {
        return track.offsetWidth <= viewport.clientWidth;
    }

    function centeredTrackOffset() {
        return Math.max(0, (viewport.clientWidth - track.offsetWidth) / 2);
    }

    /**
     * @param {number} next
     */
    function clampOffset(next) {
        if (trackFitsInViewport()) {
            return centeredTrackOffset();
        }
        const maxOffset = 0;
        const minOffset = viewport.clientWidth - track.offsetWidth;
        return Math.max(minOffset, Math.min(maxOffset, next));
    }

    /**
     * @param {number} next
     */
    function applyOffset(next) {
        offsetX = clampOffset(next);
        track.style.transform = `translate3d(${offsetX}px, 0, 0)`;

        let progress = 0;
        if (!trackFitsInViewport()) {
            const minOffset = viewport.clientWidth - track.offsetWidth;
            if (minOffset < 0) {
                progress = Math.max(0, Math.min(1, offsetX / minOffset));
            }
        }
        viewport.dispatchEvent(new CustomEvent('story-timeline-pan', {
            bubbles: true,
            detail: { progress },
        }));
        flushVisibleLazyPreviewImages(viewport, 240);
    }

    /**
     * @param {HTMLElement | null} slot
     */
    function panOffsetForSlot(slot) {
        if (!slot) return 0;
        const x = parseFloat(slot.style.left) || 0;
        const cardWidth = slot.offsetWidth || TIMELINE_CARD_SLOT_PX;
        return panOffsetToCenterX(x, viewport, cardWidth);
    }

    /**
     * @param {number} sourceIndex
     * @returns {number|null}
     */
    function panOffsetForSourceIndex(sourceIndex) {
        return computePanOffsetForSourceIndex(sourceIndex, viewport, track);
    }

    /**
     * @param {number} page1Based
     * @param {number} eventsPerPage
     * @returns {number|null}
     */
    function panOffsetForPageFirstEvent(page1Based, eventsPerPage = DOCK_EVENTS_PER_PAGE) {
        const sourceIndex = getFirstVisibleSourceIndexOnPage(page1Based, eventsPerPage);
        if (sourceIndex == null) return null;
        return panOffsetForSourceIndex(sourceIndex);
    }

    function scrollToTimelineStart() {
        if (trackFitsInViewport()) {
            applyOffset(centeredTrackOffset());
            return;
        }
        const first = track.querySelector('.story-timeline-event');
        applyOffset(panOffsetForSlot(first));
    }

    /**
     * @param {number} progress 0 = timeline start, 1 = timeline end
     */
    function scrollToProgress(progress) {
        const t = Math.max(0, Math.min(1, Number(progress) || 0));
        if (trackFitsInViewport()) {
            applyOffset(centeredTrackOffset());
            return;
        }
        const minOffset = viewport.clientWidth - track.offsetWidth;
        applyOffset(minOffset * t);
    }

    /**
     * @param {number} page1Based
     * @param {number} eventsPerPage
     */
    function scrollToDockPage(page1Based, eventsPerPage = DOCK_EVENTS_PER_PAGE) {
        const { totalPages } = getDockPaginationContext();
        if (totalPages <= 1) {
            scrollToTimelineStart();
            return;
        }
        const page = Math.min(Math.max(1, page1Based | 0), totalPages);
        const offset = panOffsetForPageFirstEvent(page, eventsPerPage);
        if (offset != null) {
            applyOffset(offset);
            return;
        }
        scrollToProgress((page - 0.5) / totalPages);
    }

    /**
     * Map dock slider progress (0..1) to pan between page anchor events.
     *
     * @param {number} progress
     */
    function scrollToDockSliderProgress(progress) {
        const { totalPages, eventsPerPage } = getDockPaginationContext();
        if (totalPages <= 1) {
            scrollToTimelineStart();
            return;
        }

        const t = Math.max(0, Math.min(1, Number(progress) || 0));
        const fractionalPage = t * totalPages;
        const pageLow = Math.min(totalPages - 1, Math.max(0, Math.floor(fractionalPage)));
        const frac = fractionalPage - pageLow;

        const offsetLow = panOffsetForPageFirstEvent(pageLow + 1, eventsPerPage);
        const offsetHigh = pageLow + 1 < totalPages
            ? panOffsetForPageFirstEvent(pageLow + 2, eventsPerPage)
            : panOffsetForPageFirstEvent(totalPages, eventsPerPage);

        if (offsetLow != null && offsetHigh != null) {
            applyOffset(offsetLow + (offsetHigh - offsetLow) * frac);
            return;
        }
        if (offsetLow != null) {
            applyOffset(offsetLow);
            return;
        }
        scrollToProgress(t);
    }

    function applyPanConfig() {
        const mode = panConfig.mode || 'start';
        if (mode === 'dockProgress' && Number.isFinite(panConfig.scrollToDockProgress)) {
            scrollToDockSliderProgress(/** @type {number} */ (panConfig.scrollToDockProgress));
            return;
        }
        if (mode === 'progress' && Number.isFinite(panConfig.scrollToProgress)) {
            scrollToProgress(/** @type {number} */ (panConfig.scrollToProgress));
            return;
        }
        if (mode === 'offset' && Number.isFinite(panConfig.offset)) {
            applyOffset(/** @type {number} */ (panConfig.offset));
            return;
        }
        if (mode === 'page' && panConfig.page) {
            scrollToDockPage(panConfig.page, panConfig.eventsPerPage ?? DOCK_EVENTS_PER_PAGE);
            return;
        }
        scrollToTimelineStart();
    }

    viewport.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        if (event.target instanceof Element && event.target.closest('.event-item, .story-timeline-event')) {
            return;
        }
        dragging = true;
        startX = event.clientX;
        startOffset = offsetX;
        viewport.setPointerCapture(event.pointerId);
        viewport.classList.add('story-timeline-view__viewport--dragging');
    }, { signal });

    viewport.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        applyOffset(startOffset + (event.clientX - startX));
    }, { signal });

    /**
     * @param {PointerEvent} event
     */
    const endDrag = (event) => {
        if (!dragging) return;
        dragging = false;
        viewport.classList.remove('story-timeline-view__viewport--dragging');
        try {
            viewport.releasePointerCapture(event.pointerId);
        } catch (_) { /* ignore */ }
    };

    viewport.addEventListener('pointerup', endDrag, { signal });
    viewport.addEventListener('pointercancel', endDrag, { signal });

    applyPanConfig();

    panApi = {
        scrollToStart: scrollToTimelineStart,
        scrollToDockPage,
        scrollToDockSliderProgress,
        scrollToProgress,
    };

    return () => {
        ac.abort();
        panApi = null;
        track.style.removeProperty('transform');
        track.style.removeProperty('width');
    };
}

function ensureResizeListener() {
    if (resizeTeardown) return;

    const ac = new AbortController();
    window.addEventListener('resize', () => {
        if (isStoryTimelineViewActive()) {
            refreshStoryTimelineView({ preservePan: true });
        }
    }, { signal: ac.signal });

    resizeTeardown = () => {
        ac.abort();
        resizeTeardown = null;
    };
}

/** Slider range matches dock `#eventPageSlider` (see pageSliderMath.js). */
const DOCK_SLIDER_RESOLUTION = 10000;

/** @returns {number} Normalized 0..1 position from the dock page slider. */
export function getStoryTimelineProgressFromDockSlider() {
    const dockPage = window.standaloneDockPagination?.getCurrentPage?.() ?? 1;
    if (dockPage <= 1) return 0;

    const slider = document.getElementById('eventPageSlider');
    if (!slider) return 0;
    const value = Number(slider.value);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value / DOCK_SLIDER_RESOLUTION));
}

/**
 * Pan the story timeline to a normalized position along the scrollable track.
 *
 * @param {number} progress 0 = start, 1 = end
 */
export function scrollStoryTimelineToProgress(progress) {
    if (!isStoryTimelineViewActive()) return;

    if (panApi) {
        panApi.scrollToProgress(progress);
        return;
    }

    refreshStoryTimelineView({
        scrollToProgress: progress,
    });
}

/**
 * @param {number} page1Based
 * @param {number} [eventsPerPage]
 */
export function scrollStoryTimelineToDockPage(page1Based, eventsPerPage = DOCK_EVENTS_PER_PAGE) {
    if (!isStoryTimelineViewActive()) return;

    if (panApi) {
        panApi.scrollToDockPage(page1Based, eventsPerPage);
        return;
    }

    refreshStoryTimelineView({
        scrollToPage: page1Based,
        eventsPerPage,
    });
}

/**
 * Pan timeline from dock slider progress (0 = page 1 anchor, 1 = last page anchor).
 *
 * @param {number} progress
 */
export function scrollStoryTimelineToDockSliderProgress(progress) {
    if (!isStoryTimelineViewActive()) return;

    if (panApi) {
        panApi.scrollToDockSliderProgress(progress);
        return;
    }

    refreshStoryTimelineView({
        scrollToDockProgress: progress,
    });
}

export function syncStoryTimelineIfActive(options = {}) {
    if (!isStoryTimelineViewActive()) return;
    refreshStoryTimelineView({
        preservePan: options.preservePan ?? !storyTimelineFilterActive(),
        scrollToPage: options.scrollToPage,
        eventsPerPage: options.eventsPerPage,
        scrollToProgress: options.scrollToProgress,
        scrollToDockProgress: options.scrollToDockProgress,
    });
}

/**
 * @param {{ preservePan?: boolean, scrollToPage?: number, eventsPerPage?: number, scrollToProgress?: number, scrollToDockProgress?: number }} [options]
 */
export function refreshStoryTimelineView(options = {}) {
    const layer = document.getElementById('storyTimelineView');
    if (!layer) return;

    const viewport = layer.querySelector('.story-timeline-view__viewport');
    const existingTrack = viewport?.querySelector('.story-timeline-view__track');
    const savedOffset = options.preservePan && existingTrack
        ? readTrackPanOffset(existingTrack)
        : null;

    if (typeof panTeardown === 'function') {
        panTeardown();
        panTeardown = null;
    }

    const nextViewport = ensureTimelineViewport(layer);
    const track = nextViewport.querySelector('.story-timeline-view__track');
    if (!track) return;

    const { events, sourceIndices, allEvents, filterActive } = getStoryTimelineEventSet();
    const eventLayout = buildStoryTimelineEventLayout(events, TRACK_PADDING_PX);
    timelinePanLayoutCache = {
        sourceIndices,
        positions: eventLayout.positions.map((p) => ({ index: p.index, x: p.x })),
    };
    const layout = buildStoryTimelineYearLayout(events, eventLayout);

    if (!events.length) {
        timelinePanLayoutCache = null;
        if (typeof connectorStemTeardown === 'function') {
            connectorStemTeardown();
        }
        track.replaceChildren();
        track.classList.toggle('story-timeline-view__track--filtered', filterActive);
        const empty = document.createElement('p');
        empty.className = 'story-timeline-view__empty';
        empty.textContent = filterActive
            ? 'No story events match the active filters.'
            : 'No timeline years found in story events.';
        track.appendChild(empty);
        return;
    }

    if (layout.startYear == null || layout.endYear == null) {
        if (typeof connectorStemTeardown === 'function') {
            connectorStemTeardown();
        }
        track.replaceChildren();
        track.classList.toggle('story-timeline-view__track--filtered', filterActive);
        const empty = document.createElement('p');
        empty.className = 'story-timeline-view__empty';
        empty.textContent = filterActive
            ? 'Matching events have no timeline years to display.'
            : 'No timeline years found in story events.';
        track.appendChild(empty);
        return;
    }

    renderTimelineTrack(
        track,
        layout,
        eventLayout.trackWidth,
        events,
        sourceIndices,
        allEvents,
        eventLayout,
        nextViewport,
        filterActive,
        () => {
            /** @type {StoryTimelinePanConfig} */
            let panConfig = { mode: 'start' };
            if (options.scrollToDockProgress != null && Number.isFinite(options.scrollToDockProgress)) {
                panConfig = {
                    mode: 'dockProgress',
                    scrollToDockProgress: options.scrollToDockProgress,
                };
            } else if (options.scrollToPage) {
                panConfig = {
                    mode: 'page',
                    page: options.scrollToPage,
                    eventsPerPage: options.eventsPerPage ?? DOCK_EVENTS_PER_PAGE,
                };
            } else if (options.scrollToProgress != null && Number.isFinite(options.scrollToProgress)) {
                panConfig = {
                    mode: 'progress',
                    scrollToProgress: options.scrollToProgress,
                };
            } else if (savedOffset != null && Number.isFinite(savedOffset)) {
                panConfig = { mode: 'offset', offset: savedOffset };
            }

            panTeardown = attachPanHandlers(nextViewport, track, panConfig);
            ensureResizeListener();
            refreshStoryArchiveEraTintIfActive();
        },
    );
}

export function teardownStoryTimelineView() {
    if (typeof panTeardown === 'function') {
        panTeardown();
        panTeardown = null;
    }
    if (typeof connectorStemTeardown === 'function') {
        connectorStemTeardown();
    }
    if (typeof resizeTeardown === 'function') {
        resizeTeardown();
        resizeTeardown = null;
    }
    panApi = null;
    timelinePanLayoutCache = null;
}

if (typeof window !== 'undefined') {
    window.scrollStoryTimelineToDockPage = scrollStoryTimelineToDockPage;
    window.scrollStoryTimelineToDockSliderProgress = scrollStoryTimelineToDockSliderProgress;
    window.scrollStoryTimelineToProgress = scrollStoryTimelineToProgress;
}
