/**
 * DOM layout when `#eventsManagePanel` is embedded in the Data Archive
 * `#storyViewerContainer`: bottom bar, compact header, detached close (X),
 * and restoring the default Event Manager layout when leaving.
 */

import * as adapter from '../archive-event-panel-bridge/ArchiveEventPanelState.js';
import { isBioArchiveCategory } from '../archive-category-shared/ArchiveCategoryTypes.js';
import { archiveModeSession } from './ArchiveModeSession.js';

/** Event Manager close control removed from DOM in Data Archive embedded layout. */
export function hideStoryArchiveEventManagerClose(eventsManagePanel) {
    if (!eventsManagePanel?.classList.contains('story-viewer-panel-embedded')) return;

    const findCloseInPanel = (panel) =>
        panel.querySelector(':scope > #eventsManageClose') ||
        panel.querySelector(':scope > .events-manage-close') ||
        panel.querySelector('#eventsManageClose') ||
        panel.querySelector('.events-manage-close');

    const detach = () => {
        const closeInPanel = findCloseInPanel(eventsManagePanel);
        if (!closeInPanel) return;

        const held = archiveModeSession.storyArchiveDetachedClose;
        if (held && held !== closeInPanel) {
            archiveModeSession.storyArchiveDetachedClose = null;
        }
        archiveModeSession.storyArchiveDetachedClose = closeInPanel;
        closeInPanel.remove();
    };

    detach();
    requestAnimationFrame(detach);
}

/** Put Event Manager close control back before `.events-manage-content`. */
export function restoreStoryArchiveEventManagerClose() {
    const close = archiveModeSession.storyArchiveDetachedClose;
    if (!close) return;
    const panel = document.getElementById('eventsManagePanel');
    const content = panel?.querySelector('.events-manage-content');
    if (panel && content) {
        panel.insertBefore(close, content);
    }
    ['display', 'visibility', 'opacity', 'pointer-events'].forEach((prop) => {
        close.style.removeProperty(prop);
    });
    archiveModeSession.storyArchiveDetachedClose = null;
}

/**
 * One bottom row: Add/Save/Export (left) + pagination (center) + Show all /
 * Per page / Clear (right).
 */
export function setupStoryArchiveBottomBar(eventsManagePanel) {
    if (!eventsManagePanel?.classList.contains('story-viewer-panel-embedded')) return;

    let bottomBar = document.getElementById('storyArchiveBottomBar');
    if (!bottomBar) {
        const manageContent = eventsManagePanel.querySelector('.events-manage-content');
        const list = document.getElementById('eventsList');
        if (!manageContent || !list) return;

        bottomBar = document.createElement('div');
        bottomBar.id = 'storyArchiveBottomBar';
        bottomBar.className = 'story-archive-bottom-bar';

        const actions = eventsManagePanel.querySelector('.events-manage-actions');
        if (actions) bottomBar.appendChild(actions);

        const pag = document.getElementById('eventsPagination');
        if (pag) bottomBar.appendChild(pag);

        manageContent.insertBefore(bottomBar, list.nextSibling);
    }

    populateStoryArchiveRightToolbar(eventsManagePanel, bottomBar);
}

/** Move Show all + Per page into one right-side unit in Data Archive (not for bio buckets). */
function populateStoryArchiveRightToolbar(eventsManagePanel, bottomBar) {
    if (!bottomBar) return;

    const secondary = eventsManagePanel.querySelector('.events-manage-search-row--secondary');
    if (!secondary) return;

    const arch = window.eventManager?.dataService?.getArchiveSource?.();
    if (isBioArchiveCategory(arch)) {
        return;
    }

    const showAllLabel = document.getElementById('eventsShowAllCheckbox')?.closest('label.events-search-checkbox');
    const perPage = document.getElementById('eventsPerPageInput')?.closest('.events-per-page-group');
    let wrap = document.getElementById('storyArchiveRightToolbar');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'storyArchiveRightToolbar';
        wrap.className = 'story-archive-right-toolbar';
    }

    if (showAllLabel || perPage) {
        let unit = wrap.querySelector('.story-archive-page-unit');
        if (!unit) {
            unit = document.createElement('div');
            unit.className = 'story-archive-page-unit story-viewer-bottom-bar-control';
        }
        if (showAllLabel) unit.appendChild(showAllLabel);
        if (perPage) unit.appendChild(perPage);
        wrap.appendChild(unit);
    }

    if (wrap.childNodes.length === 0) {
        return;
    }

    bottomBar.appendChild(wrap);
}

/** Data Archive: hide header (title + count). Only "Show controls" moves above Search & filters. */
export function setupStoryArchiveCompactChrome(eventsManagePanel) {
    if (!eventsManagePanel?.classList.contains('story-viewer-panel-embedded')) return;
    const header = eventsManagePanel.querySelector('.events-manage-header');
    const controls = document.getElementById('eventsManageControls');
    const btn = document.getElementById('eventsManageToolbarToggleBtn');
    if (!header || !controls || !btn) return;

    const strayTitle = Array.from(controls.children).find((el) =>
        el.classList?.contains('events-manage-title-section')
    );
    if (strayTitle && !header.contains(strayTitle)) {
        header.insertBefore(strayTitle, header.firstChild);
    }

    if (!controls.contains(btn)) {
        controls.insertBefore(btn, controls.firstChild);
    }

    header.classList.add('events-manage-header--story-empty');
}

/** Restore toolbar toggle into header and show header again. */
export function restoreStoryArchiveCompactChrome(eventsManagePanel) {
    const header = eventsManagePanel?.querySelector('.events-manage-header');
    const controls = document.getElementById('eventsManageControls');
    const btn = document.getElementById('eventsManageToolbarToggleBtn');
    if (!header || !controls || !btn) return;

    header.classList.remove('events-manage-header--story-empty');

    const titleRow = header.querySelector('.events-manage-title-row');
    if (titleRow && controls.contains(btn)) {
        titleRow.appendChild(btn);
    }
}

/** Restore Add/Save/Export to header and pagination after #eventsList (Event Manager layout). */
export function teardownStoryArchiveBottomBar(eventsManagePanel) {
    const bottomBar = document.getElementById('storyArchiveBottomBar');
    const list = document.getElementById('eventsList');
    const header = eventsManagePanel?.querySelector('.events-manage-header');
    if (!bottomBar || !eventsManagePanel?.contains(bottomBar) || !list?.parentNode || !header) return;

    const secondary = eventsManagePanel.querySelector('.events-manage-search-row--secondary');
    const rightToolbar = document.getElementById('storyArchiveRightToolbar');
    if (secondary && rightToolbar) {
        const useFilter = document.getElementById('eventsUseFilterSelectionCheckbox')?.closest('label.events-search-checkbox');
        const perPage = document.getElementById('eventsPerPageInput')?.closest('.events-per-page-group');
        const showAllLabel = document.getElementById('eventsShowAllCheckbox')?.closest('label.events-search-checkbox');
        const clearBtn = document.getElementById('eventsSearchClear');
        [showAllLabel, perPage].forEach((el) => el?.classList.remove('story-viewer-bottom-bar-control'));

        const ordered = [useFilter, perPage, showAllLabel, clearBtn].filter(Boolean);
        ordered.forEach((el) => secondary.appendChild(el));
        rightToolbar.remove();
    }

    const pag = document.getElementById('eventsPagination');
    const actions = bottomBar.querySelector('.events-manage-actions');
    if (pag && bottomBar.contains(pag)) {
        list.parentNode.insertBefore(pag, bottomBar);
    }
    if (actions) {
        header.appendChild(actions);
    }
    bottomBar.remove();
}

/**
 * Move `#eventsManagePanel` out of `#storyViewerContainer` and restore Event
 * Manager chrome. Caller should re-append hub or exit Data Archive as appropriate.
 */
export function detachEventsManagePanelFromStoryArchive(eventsManagePanel) {
    document.getElementById('storyArchiveSearchCategoryStrip')?.remove();

    if (!eventsManagePanel || !adapter.originalEventsPanelParent) {
        return;
    }

    restoreStoryArchiveEventManagerClose();
    restoreStoryArchiveCompactChrome(eventsManagePanel);
    teardownStoryArchiveBottomBar(eventsManagePanel);

    eventsManagePanel.className = adapter.originalEventsPanelClasses || 'events-manage-panel';

    eventsManagePanel.style.right = '';
    eventsManagePanel.style.position = '';
    eventsManagePanel.style.width = '';
    eventsManagePanel.style.height = '';
    eventsManagePanel.style.top = '';
    eventsManagePanel.style.bottom = '';
    eventsManagePanel.style.removeProperty('--story-archive-list-inset-inline');
    eventsManagePanel.style.removeProperty('--story-archive-list-inset-inline-end');
    eventsManagePanel.style.removeProperty('--story-archive-list-gutter');
    eventsManagePanel.style.removeProperty('--story-archive-list-max-width');

    const title = eventsManagePanel.querySelector('.story-viewer-title');
    if (title) {
        title.textContent = 'Event Management';
        title.classList.remove('story-viewer-title');
        title.classList.add('events-manage-title');
    }

    const addBtn = document.getElementById('addEventBtn');
    const saveBtn = document.getElementById('saveEventsBtn');
    const exportBtn = document.getElementById('exportEventsBtn');
    if (addBtn) addBtn.classList.remove('story-viewer-action-btn');
    if (saveBtn) saveBtn.classList.remove('story-viewer-action-btn');
    if (exportBtn) exportBtn.classList.remove('story-viewer-action-btn');
    document.getElementById('eventsSearchClear')?.classList.remove('story-viewer-action-btn');
    document.getElementById('eventsShowAllCheckbox')?.closest('label.events-search-checkbox')?.classList.remove('story-viewer-bottom-bar-control');
    document.getElementById('eventsPerPageInput')?.closest('.events-per-page-group')?.classList.remove('story-viewer-bottom-bar-control');

    const headerEl = eventsManagePanel.querySelector('.story-viewer-header');
    if (headerEl) {
        headerEl.classList.remove('story-viewer-header');
    }

    document.getElementById('storyArchiveLayoutControl')?.remove();
    document.getElementById('storyArchiveGridSquishBar')?.remove();

    eventsManagePanel.classList.remove('open');
    adapter.originalEventsPanelParent.appendChild(eventsManagePanel);
}
