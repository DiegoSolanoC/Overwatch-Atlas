/**
 * Story archive background tint — shifts with scroll (list) or pan (timeline)
 * to match the era tone of the story at the current position.
 */

import {
    hexColorToRgbCsv,
    sampleEraStripeColorAtLinearProgress,
} from '../../system-interface/interface-shared/hover-badge/eraHoverPreviewTheme.js';

/** @type {(() => void) | null} */
let tintTeardown = null;

const STORY_VIEW_MODE_KEY = 'storyViewDisplayMode';

/** @returns {'list'|'timeline'} */
function getCurrentStoryViewMode() {
    const panel = document.getElementById('eventsManagePanel');
    if (panel?.classList.contains('story-viewer-panel-embedded--timeline-view')) return 'timeline';
    if (panel?.classList.contains('story-viewer-panel-embedded--list-view')) return 'list';
    try {
        if (localStorage.getItem(STORY_VIEW_MODE_KEY) === 'list') return 'list';
    } catch (_) { /* ignore */ }
    return 'timeline';
}

function isStoryArchiveEraTintContext() {
    const panel = document.getElementById('eventsManagePanel');
    if (!panel?.classList.contains('story-viewer-panel-embedded')) return false;
    const arch = window.eventManager?.dataService?.getArchiveSource?.();
    return arch === 'story';
}

function getStoryArchiveEventsForTint() {
    return window.eventManager?.getFilteredEvents?.() || [];
}

/**
 * @param {HTMLElement | null} track
 * @param {HTMLElement | null} viewport
 * @returns {number}
 */
function getTimelinePanProgress(track, viewport) {
    if (!track || !viewport) return 0;
    const trackWidth = track.offsetWidth;
    const viewWidth = viewport.clientWidth;
    if (trackWidth <= viewWidth) return 0;

    const minOffset = viewWidth - trackWidth;
    const transform = track.style.transform || '';
    const match = transform.match(/translate3d\(\s*(-?[\d.]+)px/i);
    const offsetX = match ? Number(match[1]) : 0;
    if (!Number.isFinite(offsetX) || minOffset >= 0) return 0;
    return Math.max(0, Math.min(1, offsetX / minOffset));
}

/**
 * @param {HTMLElement | null} listEl
 * @returns {number}
 */
function getListScrollProgress(listEl) {
    if (!listEl) return 0;
    const maxScroll = listEl.scrollHeight - listEl.clientHeight;
    if (maxScroll <= 0) return 0;
    return Math.max(0, Math.min(1, listEl.scrollTop / maxScroll));
}

/**
 * @param {number} progress
 */
function applyStoryArchiveEraTintProgress(progress) {
    const container = document.getElementById('storyViewerContainer');
    const panel = document.getElementById('eventsManagePanel');
    if (!container && !panel) return;

    const events = getStoryArchiveEventsForTint();
    const hex = sampleEraStripeColorAtLinearProgress(events, progress);
    const rgb = hexColorToRgbCsv(hex);

    for (const el of [container, panel]) {
        if (!el) continue;
        el.style.setProperty('--story-era-tint-rgb', rgb);
        el.classList.add('story-viewer-container--era-tint', 'story-archive-era-tint');
    }
}

export function refreshStoryArchiveEraTint() {
    if (!isStoryArchiveEraTintContext()) return;

    const mode = getCurrentStoryViewMode();
    if (mode === 'timeline') {
        const viewport = document.querySelector('.story-timeline-view__viewport');
        const track = viewport?.querySelector('.story-timeline-view__track');
        applyStoryArchiveEraTintProgress(getTimelinePanProgress(track, viewport));
        return;
    }

    const listEl = document.getElementById('eventsList');
    applyStoryArchiveEraTintProgress(getListScrollProgress(listEl));
}

export function mountStoryArchiveEraTint() {
    unmountStoryArchiveEraTint();
    if (!isStoryArchiveEraTintContext()) return;

    const ac = new AbortController();
    const { signal } = ac;

    const listEl = document.getElementById('eventsList');
    listEl?.addEventListener('scroll', () => {
        if (getCurrentStoryViewMode() === 'list') {
            refreshStoryArchiveEraTint();
        }
    }, { passive: true, signal });

    document.addEventListener('story-timeline-pan', () => {
        if (getCurrentStoryViewMode() === 'timeline') {
            refreshStoryArchiveEraTint();
        }
    }, { signal });

    window.addEventListener('resize', () => refreshStoryArchiveEraTint(), { signal });

    tintTeardown = () => {
        ac.abort();
        tintTeardown = null;
        for (const el of [
            document.getElementById('storyViewerContainer'),
            document.getElementById('eventsManagePanel'),
        ]) {
            if (!el) continue;
            el.classList.remove('story-viewer-container--era-tint', 'story-archive-era-tint');
            el.style.removeProperty('--story-era-tint-rgb');
        }
    };

    refreshStoryArchiveEraTint();
}

export function unmountStoryArchiveEraTint() {
    if (typeof tintTeardown === 'function') {
        try {
            tintTeardown();
        } catch (_) { /* ignore */ }
    }
}

export function refreshStoryArchiveEraTintIfActive() {
    if (!isStoryArchiveEraTintContext()) return;
    refreshStoryArchiveEraTint();
}
