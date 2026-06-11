/**
 * Story mode display toggle — List (card grid) vs Timeline view.
 * Mode-switch pattern matches World globe/map (orange flash, swapped label).
 */

import { createHeaderHubButton } from '../../universal-features/atlas-header/HeaderHubButton.js';
import { refreshStoryTimelineView, teardownStoryTimelineView } from './StoryTimelineView.js';

const STORY_VIEW_MODE_KEY = 'storyViewDisplayMode';

const ICON_LIST = 'src/assets/images/Icons/Mode%20Icons/Data%20Archive.png';
const ICON_TIMELINE = 'src/assets/images/Icons/Mode%20Icons/Story%20Timeline.png';

/** @typedef {'list'|'timeline'} StoryViewDisplayMode */

/** @type {(() => void) | null} */
let toggleTeardown = null;

/**
 * @returns {StoryViewDisplayMode}
 */
export function getStoryViewDisplayMode() {
    try {
        const stored = localStorage.getItem(STORY_VIEW_MODE_KEY);
        if (stored === 'timeline') return 'timeline';
    } catch (_) { /* ignore */ }
    return 'list';
}

/**
 * @param {StoryViewDisplayMode} mode
 */
function persistStoryViewDisplayMode(mode) {
    try {
        localStorage.setItem(STORY_VIEW_MODE_KEY, mode);
    } catch (_) { /* ignore */ }
}

/**
 * @param {HTMLElement} manageContent
 * @returns {HTMLElement}
 */
function ensureStoryTimelineViewLayer(manageContent) {
    let layer = document.getElementById('storyTimelineView');
    if (layer) return layer;

    layer = document.createElement('div');
    layer.id = 'storyTimelineView';
    layer.className = 'story-timeline-view';
    layer.setAttribute('aria-hidden', 'true');

    const list = document.getElementById('eventsList');
    if (list?.parentNode) {
        list.parentNode.insertBefore(layer, list);
    } else {
        manageContent.appendChild(layer);
    }
    return layer;
}

/**
 * @param {StoryViewDisplayMode} mode
 */
export function applyStoryViewDisplayMode(mode) {
    const panel = document.getElementById('eventsManagePanel');
    if (!panel?.classList.contains('story-viewer-panel-embedded')) return;

    const arch = window.eventManager?.dataService?.getArchiveSource?.();
    if (arch !== 'story') return;

    const manageContent = panel.querySelector('.events-manage-content');
    if (manageContent) ensureStoryTimelineViewLayer(manageContent);

    const isTimeline = mode === 'timeline';
    panel.classList.toggle('story-viewer-panel-embedded--timeline-view', isTimeline);
    panel.classList.toggle('story-viewer-panel-embedded--list-view', !isTimeline);

    const layer = document.getElementById('storyTimelineView');
    if (layer) layer.setAttribute('aria-hidden', isTimeline ? 'false' : 'true');

    syncStoryViewToggleUi(mode);

    if (isTimeline) {
        refreshStoryTimelineView();
    } else {
        teardownStoryTimelineView();
    }
}

/**
 * @param {StoryViewDisplayMode} mode
 */
function syncStoryViewToggleUi(mode) {
    const btn = document.getElementById('storyViewToggle');
    if (!btn) return;

    const isList = mode === 'list';
    const label = btn.querySelector('.globe-control-btn__label');
    const img = btn.querySelector('[id$="Icon"] img');

    if (label) label.textContent = isList ? 'Timeline' : 'List';
    btn.title = isList ? 'Switch to Timeline view' : 'Switch to List view';

    if (img) {
        img.src = isList ? ICON_TIMELINE : ICON_LIST;
        img.alt = isList ? 'Timeline' : 'List';
    }
}

function toggleStoryViewDisplayMode() {
    const next = getStoryViewDisplayMode() === 'list' ? 'timeline' : 'list';
    persistStoryViewDisplayMode(next);
    applyStoryViewDisplayMode(next);

    const btn = document.getElementById('storyViewToggle');
    if (btn && window.flashButton) {
        window.flashButton(btn, 'flash-orange');
    }
    if (window.SoundEffectsManager) {
        window.SoundEffectsManager.play('switchMap');
    }
}

/**
 * @param {HTMLElement} eventsManagePanel
 */
export function mountStoryViewToggle(eventsManagePanel) {
    unmountStoryViewToggle();

    if (!eventsManagePanel?.classList.contains('story-viewer-panel-embedded')) return;
    const arch = window.eventManager?.dataService?.getArchiveSource?.();
    if (arch !== 'story') return;

    const bottomBar = document.getElementById('storyArchiveBottomBar');
    if (!bottomBar) return;

    let wrap = document.getElementById('storyArchiveRightToolbar');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'storyArchiveRightToolbar';
        wrap.className = 'story-archive-right-toolbar';
        bottomBar.appendChild(wrap);
    }

    let btn = document.getElementById('storyViewToggle');
    if (!btn) {
        btn = createHeaderHubButton({
            id: 'storyViewToggle',
            className: 'dock-globe-rail__btn story-view-toggle',
            title: 'Switch to Timeline view',
            label: 'Timeline',
            iconPath: ICON_TIMELINE,
            iconAlt: 'Timeline',
            parentId: 'storyArchiveRightToolbar',
            baseClass: 'globe-control-btn',
            iconSpanId: 'storyViewToggleIcon',
        });
    }

    if (btn && wrap.firstChild !== btn) {
        wrap.insertBefore(btn, wrap.firstChild);
    }

    const ac = new AbortController();
    btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleStoryViewDisplayMode();
    }, { signal: ac.signal });

    toggleTeardown = () => {
        ac.abort();
        toggleTeardown = null;
    };

    applyStoryViewDisplayMode(getStoryViewDisplayMode());
}

export function unmountStoryViewToggle() {
    if (typeof toggleTeardown === 'function') {
        try {
            toggleTeardown();
        } catch (_) { /* ignore */ }
    }

    teardownStoryTimelineView();
    document.getElementById('storyViewToggle')?.remove();
    document.getElementById('storyTimelineView')?.remove();

    const panel = document.getElementById('eventsManagePanel');
    if (panel) {
        panel.classList.remove(
            'story-viewer-panel-embedded--timeline-view',
            'story-viewer-panel-embedded--list-view',
        );
    }
}
