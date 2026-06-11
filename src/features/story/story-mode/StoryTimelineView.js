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

const TRACK_PADDING_PX = 80;
const VIEWPORT_LEADING_PAD_PX = 40;
const DOCK_EVENTS_PER_PAGE = 10;
const TIMELINE_CARD_BATCH_SIZE = 24;

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
        const height = isAbove
            ? lineRect.top - thumbCenterY
            : thumbCenterY - lineRect.bottom;

        connector.style.height = `${Math.max(6, Math.round(height))}px`;
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

    connectorStemTeardown = () => {
        ac.abort();
        resizeObserver.disconnect();
        connectorStemTeardown = null;
    };
}

/** @type {{ scrollToStart: () => void, scrollToDockPage: (page: number, perPage?: number) => void, scrollToProgress: (progress: number) => void } | null} */
let panApi = null;

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
 * @returns {boolean}
 */
function storyTimelineFilterActive() {
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

    const activeFilters = window.standaloneActiveFilters;
    if (activeFilters?.size > 0) {
        const filtered = filterEventsByStandaloneActiveFilters(allEvents, activeFilters);
        const sourceIndices = filtered.map((event) => allEvents.indexOf(event));
        return {
            events: filtered,
            sourceIndices,
            allEvents,
            filterActive: true,
        };
    }

    if (eventManagerSearchActive(em)) {
        const filtered = em.getFilteredEvents?.() ?? allEvents;
        /** @type {unknown[]} */
        const events = [];
        /** @type {number[]} */
        const sourceIndices = [];
        for (const event of filtered) {
            const sourceIndex = allEvents.indexOf(event);
            if (sourceIndex !== -1) {
                events.push(event);
                sourceIndices.push(sourceIndex);
            }
        }
        return { events, sourceIndices, allEvents, filterActive: true };
    }

    return {
        events: allEvents,
        sourceIndices: allEvents.map((_, index) => index),
        allEvents,
        filterActive: false,
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
    };

    appendTimelineCardBatch();
}

/**
 * @typedef {'start'|'offset'|'page'|'progress'} StoryTimelinePanMode
 * @typedef {{ mode?: StoryTimelinePanMode, offset?: number|null, page?: number, eventsPerPage?: number, scrollToProgress?: number }} StoryTimelinePanConfig
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
        const cardHalf = (slot.offsetWidth || TIMELINE_CARD_SLOT_PX) / 2;
        return -(x - cardHalf - VIEWPORT_LEADING_PAD_PX);
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
        const em = window.eventManager;
        const totalPages = em?.getTotalEventPages?.() ?? 1;
        if (totalPages <= 1) {
            scrollToProgress(0);
            return;
        }
        scrollToProgress((page1Based - 0.5) / totalPages);
    }

    function applyPanConfig() {
        const mode = panConfig.mode || 'start';
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

export function syncStoryTimelineIfActive() {
    if (!isStoryTimelineViewActive()) return;
    refreshStoryTimelineView({
        preservePan: !storyTimelineFilterActive(),
    });
}

/**
 * @param {{ preservePan?: boolean, scrollToPage?: number, eventsPerPage?: number, scrollToProgress?: number }} [options]
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
    const layout = buildStoryTimelineYearLayout(events, eventLayout);

    if (!events.length) {
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
            if (options.scrollToProgress != null && Number.isFinite(options.scrollToProgress)) {
                panConfig = {
                    mode: 'progress',
                    scrollToProgress: options.scrollToProgress,
                };
            } else if (options.scrollToPage) {
                panConfig = {
                    mode: 'page',
                    page: options.scrollToPage,
                    eventsPerPage: options.eventsPerPage ?? DOCK_EVENTS_PER_PAGE,
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
}

if (typeof window !== 'undefined') {
    window.scrollStoryTimelineToDockPage = scrollStoryTimelineToDockPage;
    window.scrollStoryTimelineToProgress = scrollStoryTimelineToProgress;
}
