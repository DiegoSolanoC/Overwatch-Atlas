/**
 * DataArchiveShell — Data Archive mode shell + Event Manager embedding.
 *
 * Owns the runtime DOM dance that makes Data Archive look like its own mode
 * even though it actually re-uses the existing `#eventsManagePanel`:
 *   • Mounts `#storyViewerContainer` and the category hub when the user
 *     enters the mode.
 *   • When a category tile is picked, detaches `#eventsManagePanel` from
 *     its normal home, slides it into the Data Archive shell, swaps in a
 *     compact bottom-bar layout, and switches the Event Manager data
 *     source to the picked archive (story / heroes / factions / npcs /
 *     locations).
 *   • Restores everything the way it found it on exit so the next time
 *     the user opens the Event Manager outside Data Archive nothing looks
 *     out of place.
 *
 * Extracted from `universal-features/runtime/ModeOrchestrator.js`
 * where it had grown into ~700 lines of mode-specific UI surgery sitting
 * in what was supposed to be a generic orchestrator. The orchestrator now
 * just calls `enterDataArchive()` / `exitDataArchive()` from here and lets
 * this module own its own state.
 */

import { applyStoryArchiveOverlapDevStyling } from '../presentation/applyStoryArchiveOverlapDevStyling.js';
import { buildStoryArchiveCategoryHub } from '../presentation/buildStoryArchiveCategoryHub.js';
import {
    mountStoryArchiveCategoryStrip,
    updateStoryArchiveCategoryStripActive
} from '../presentation/mountStoryArchiveCategoryStrip.js';
import { playStoryArchiveCategorySfx } from '../presentation/playStoryArchiveCategorySfx.js';
import { applyStoryArchiveGridSquishFromDefaults } from '../presentation/storyArchiveGridSquish.js';
import { updateStatus } from '../../universal-features/runtime/statusFeed.js';

// === Module-scoped state =============================================
// All Data Archive state lived on the orchestrator as `_storyArchive*`
// fields before the extraction. There's never more than one Data Archive
// session active at a time, so module-scoped variables are equivalent
// and avoid forcing callers to pass an instance around.

/** @type {HTMLElement|null} Event Manager × removed from DOM while Data Archive is open */
let storyArchiveDetachedClose = null;
/** @type {((e: KeyboardEvent) => void) | null} Escape → exit Data Archive while category hub is visible */
let storyArchiveHubKeyHandler = null;
/** @type {MutationObserver | null} Keeps overlap dev styling re-applied as the list re-renders */
let storyArchiveObserver = null;
/** @type {Node | null} Where `#eventsManagePanel` lived before being moved into Data Archive */
let originalEventsPanelParent = null;
/** @type {string | null} ClassName the panel had before Data Archive started rewriting it */
let originalEventsPanelClasses = null;

/** Callback the orchestrator passes so cancel/Escape can exit the mode */
let onExitMode = null;

// === Helpers =========================================================

function isLocalhost() {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

/** True when `#eventsManagePanel` is mounted inside `#storyViewerContainer` (events list view). */
function eventsPanelMountedInStoryArchive() {
    const c = document.getElementById('storyViewerContainer');
    const p = document.getElementById('eventsManagePanel');
    return !!(c && p && c.contains(p));
}

/** Shared setup when entering Data Archive (menu hidden, Event Manager rail hidden). */
function prepareStoryArchiveShell() {
    const testContainer = document.querySelector('.test-container');
    if (testContainer) {
        testContainer.style.display = 'none';
    }
    const eventManagerBtn = document.getElementById('eventsManageToggle');
    if (eventManagerBtn) {
        eventManagerBtn.style.setProperty('display', 'none', 'important');
    }
    const eventsManagePanel = document.getElementById('eventsManagePanel');
    if (eventsManagePanel) {
        eventsManagePanel.classList.remove('open');
    }
}

function detachStoryArchiveHubDismissChrome() {
    if (storyArchiveHubKeyHandler) {
        document.removeEventListener('keydown', storyArchiveHubKeyHandler);
        storyArchiveHubKeyHandler = null;
    }
}

/** Escape exits Data Archive when the category hub is showing (parity with globe/map chooser). */
function attachStoryArchiveHubDismissChrome() {
    detachStoryArchiveHubDismissChrome();
    storyArchiveHubKeyHandler = (e) => {
        if (e.key !== 'Escape') return;
        if (eventsPanelMountedInStoryArchive()) return;
        e.preventDefault();
        if (typeof onExitMode === 'function') {
            void onExitMode(true);
        }
    };
    document.addEventListener('keydown', storyArchiveHubKeyHandler);
}

function disconnectStoryArchiveOverlapObserver() {
    if (storyArchiveObserver) {
        try {
            storyArchiveObserver.disconnect();
        } catch (_) { /* ignore */ }
        storyArchiveObserver = null;
    }
}

/**
 * Data Archive category hub: Story timeline plus Heroes / Factions / NPCs /
 * Locations (each loads its own JSON into the same Event Manager UI).
 */
function buildCategoryHub() {
    return buildStoryArchiveCategoryHub({
        playCategorySfx: () => playStoryArchiveCategorySfx(),
        onSelectArchive: (archive) => {
            void enterStoryArchiveEventsView(archive);
        },
        onCancel: () => {
            if (typeof onExitMode === 'function') {
                void onExitMode(true);
            }
        }
    });
}

/** Search row: "Categories" back + five archive icon buttons (Data Archive embedded only). */
function ensureStoryArchiveBackToCategoriesButton(eventsManagePanel) {
    mountStoryArchiveCategoryStrip(eventsManagePanel, {
        playCategorySfx: () => playStoryArchiveCategorySfx(),
        onBackToHub: () => {
            void returnToStoryArchiveCategoryHub();
        },
        onSelectArchive: (archive) => {
            void enterStoryArchiveEventsView(archive);
        }
    });
}

/**
 * Move `#eventsManagePanel` out of `#storyViewerContainer` and restore Event
 * Manager chrome. Caller should re-append hub or exit Data Archive as
 * appropriate.
 */
function detachEventsManagePanelFromStoryArchive(eventsManagePanel) {
    document.getElementById('storyArchiveSearchCategoryStrip')?.remove();

    if (!eventsManagePanel || !originalEventsPanelParent) {
        return;
    }

    restoreStoryArchiveEventManagerClose();
    restoreStoryArchiveCompactChrome(eventsManagePanel);
    teardownStoryArchiveBottomBar(eventsManagePanel);

    eventsManagePanel.className = originalEventsPanelClasses || 'events-manage-panel';

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

    const header = eventsManagePanel.querySelector('.story-viewer-header');
    if (header) {
        header.classList.remove('story-viewer-header');
    }

    document.getElementById('storyArchiveLayoutControl')?.remove();
    document.getElementById('storyArchiveGridSquishBar')?.remove();

    eventsManagePanel.classList.remove('open');
    originalEventsPanelParent.appendChild(eventsManagePanel);
}

/**
 * From category hub → mount Event Manager panel (same UI; data from
 * `archiveSource` JSON).
 *
 * @param {'story'|'heroes'|'factions'|'npcs'|'locations'} archiveSource
 */
async function enterStoryArchiveEventsView(archiveSource = 'story') {
    if (eventsPanelMountedInStoryArchive()) {
        const eventsManagePanelMounted = document.getElementById('eventsManagePanel');
        try {
            if (window.eventManager?.switchStoryArchiveSource) {
                await window.eventManager.switchStoryArchiveSource(archiveSource);
            } else if (window.eventManager) {
                window.eventManager.dataService?.setArchiveSource?.(archiveSource);
                await window.eventManager.loadEvents();
                window.eventManager.renderEvents();
            }
        } catch (err) {
            console.error('[DataArchiveShell] Data Archive category switch failed:', err);
            updateStatus(`⚠ Could not load archive: ${err?.message || err}`, 'error');
            return;
        }
        if (eventsManagePanelMounted) {
            ensureStoryArchiveBackToCategoriesButton(eventsManagePanelMounted);
            updateStoryArchiveCategoryStripActive(archiveSource);
        }
        const labelMounted =
            archiveSource === 'story'
                ? 'Story timeline'
                : `${archiveSource.charAt(0).toUpperCase()}${archiveSource.slice(1)} archive`;
        updateStatus(`✓ ${labelMounted} open`, 'success');
        return;
    }

    const storyContainer = document.getElementById('storyViewerContainer');
    const eventsManagePanel = document.getElementById('eventsManagePanel');
    if (!storyContainer || !eventsManagePanel) {
        updateStatus('⚠ Data Archive or Event Manager panel not found', 'error');
        return;
    }

    detachStoryArchiveHubDismissChrome();
    document.getElementById('storyArchiveCategoryHub')?.remove();
    storyContainer.classList.remove('story-viewer-container--hub');

    if (!originalEventsPanelParent) {
        originalEventsPanelParent = eventsManagePanel.parentNode;
        originalEventsPanelClasses = eventsManagePanel.className;
    }

    eventsManagePanel.classList.remove('events-manage-panel');
    eventsManagePanel.classList.add('story-viewer-panel-embedded');
    eventsManagePanel.style.right = 'auto';
    eventsManagePanel.style.position = 'relative';
    eventsManagePanel.style.width = '100%';
    eventsManagePanel.style.height = '100%';
    eventsManagePanel.style.top = 'auto';
    eventsManagePanel.style.bottom = 'auto';

    storyContainer.appendChild(eventsManagePanel);

    const header = eventsManagePanel.querySelector('.events-manage-header');
    if (header) {
        header.classList.add('story-viewer-header');
    }

    const addBtn = document.getElementById('addEventBtn');
    const saveBtn = document.getElementById('saveEventsBtn');
    const exportBtn = document.getElementById('exportEventsBtn');
    if (addBtn) addBtn.classList.add('story-viewer-action-btn');
    if (saveBtn) saveBtn.classList.add('story-viewer-action-btn');
    if (exportBtn) exportBtn.classList.add('story-viewer-action-btn');

    eventsManagePanel.classList.add('open');

    setupStoryArchiveBottomBar(eventsManagePanel);
    setupStoryArchiveCompactChrome(eventsManagePanel);

    try {
        if (window.eventManager?.switchStoryArchiveSource) {
            await window.eventManager.switchStoryArchiveSource(archiveSource);
        } else if (window.eventManager) {
            window.eventManager.dataService?.setArchiveSource?.(archiveSource);
            await window.eventManager.loadEvents();
            window.eventManager.renderEvents();
        }
    } catch (err) {
        console.error('[DataArchiveShell] Data Archive load failed:', err);
        updateStatus(`⚠ Could not load archive: ${err?.message || err}`, 'error');
    }

    hideStoryArchiveEventManagerClose(eventsManagePanel);
    applyStoryArchiveGridSquishFromDefaults(eventsManagePanel);
    ensureStoryArchiveBackToCategoriesButton(eventsManagePanel);
    updateStoryArchiveCategoryStripActive(archiveSource);

    if (isLocalhost()) {
        setTimeout(() => {
            console.log('[DataArchiveShell] Data Archive (events view) DOM inspection:');
            console.log('[DataArchiveShell] eventsManagePanel:', eventsManagePanel);
            const eventItems = eventsManagePanel.querySelectorAll('.event-item');
            console.log('[DataArchiveShell] Event items found:', eventItems.length);
        }, 300);

        setTimeout(() => {
            applyStoryArchiveOverlapDevStyling(eventsManagePanel);

            if (!storyArchiveObserver) {
                storyArchiveObserver = new MutationObserver(() => {
                    applyStoryArchiveOverlapDevStyling(eventsManagePanel);
                });
                storyArchiveObserver.observe(eventsManagePanel, {
                    childList: true,
                    subtree: true,
                });
            }
        }, 400);
    }

    const label =
        archiveSource === 'story'
            ? 'Story timeline'
            : `${archiveSource.charAt(0).toUpperCase()}${archiveSource.slice(1)} archive`;
    updateStatus(`✓ ${label} open`, 'success');
}

/** Hub again: detach list panel, restore main timeline in memory, show category tiles. */
async function returnToStoryArchiveCategoryHub() {
    const storyContainer = document.getElementById('storyViewerContainer');
    const eventsManagePanel = document.getElementById('eventsManagePanel');
    if (!storyContainer || !eventsManagePanel || !eventsPanelMountedInStoryArchive()) {
        return;
    }

    document.getElementById('storyArchiveCategoryHub')?.remove();
    disconnectStoryArchiveOverlapObserver();

    detachEventsManagePanelFromStoryArchive(eventsManagePanel);

    if (window.eventManager?.dataService?.setArchiveSource) {
        window.eventManager.dataService.setArchiveSource('story');
    }
    try {
        if (window.eventManager?.loadEvents) {
            await window.eventManager.loadEvents();
        }
    } catch (e) {
        console.warn('[DataArchiveShell] Restoring main timeline for category hub:', e);
    }
    if (window.eventManager?.renderEvents) {
        window.eventManager.renderEvents();
    }

    storyContainer.classList.add('story-viewer-container--hub');
    storyContainer.appendChild(buildCategoryHub());
    attachStoryArchiveHubDismissChrome();
    updateStatus('✓ Data Archive — choose a category', 'success');
}

/** Event Manager × — removed from DOM in Data Archive. */
function hideStoryArchiveEventManagerClose(eventsManagePanel) {
    if (!eventsManagePanel?.classList.contains('story-viewer-panel-embedded')) return;

    const findCloseInPanel = (panel) =>
        panel.querySelector(':scope > #eventsManageClose') ||
        panel.querySelector(':scope > .events-manage-close') ||
        panel.querySelector('#eventsManageClose') ||
        panel.querySelector('.events-manage-close');

    const detach = () => {
        const closeInPanel = findCloseInPanel(eventsManagePanel);
        if (!closeInPanel) return;

        const held = storyArchiveDetachedClose;
        if (held && held !== closeInPanel) {
            storyArchiveDetachedClose = null;
        }
        storyArchiveDetachedClose = closeInPanel;
        closeInPanel.remove();
    };

    detach();
    requestAnimationFrame(detach);
}

/** Put Event Manager × back before `.events-manage-content`. */
function restoreStoryArchiveEventManagerClose() {
    const close = storyArchiveDetachedClose;
    if (!close) return;
    const panel = document.getElementById('eventsManagePanel');
    const content = panel?.querySelector('.events-manage-content');
    if (panel && content) {
        panel.insertBefore(close, content);
    }
    ['display', 'visibility', 'opacity', 'pointer-events'].forEach((prop) => {
        close.style.removeProperty(prop);
    });
    storyArchiveDetachedClose = null;
}

/**
 * One bottom row: Add/Save/Export (left) + pagination (center) + Show all /
 * Per page / Clear (right).
 */
function setupStoryArchiveBottomBar(eventsManagePanel) {
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

/** Move Show all + Per page into one right-side unit in Data Archive. */
function populateStoryArchiveRightToolbar(eventsManagePanel, bottomBar) {
    if (!bottomBar) return;

    const secondary = eventsManagePanel.querySelector('.events-manage-search-row--secondary');
    if (!secondary) return;

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
function setupStoryArchiveCompactChrome(eventsManagePanel) {
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
function restoreStoryArchiveCompactChrome(eventsManagePanel) {
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
function teardownStoryArchiveBottomBar(eventsManagePanel) {
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

// === Public API ======================================================

/**
 * Mount the Data Archive shell: category hub first; events list mounts
 * after user taps a category tile. Idempotent — repeat calls just refresh
 * an existing shell.
 *
 * @param {object} options
 * @param {(restoreMenu?: boolean) => void | Promise<void>} options.onCancel
 *        Called when the user cancels (Escape on the hub, or "Back" tile).
 */
export async function createDataArchivePanel({ onCancel } = {}) {
    onExitMode = onCancel || null;

    let storyContainer = document.getElementById('storyViewerContainer');
    const eventsManagePanel = document.getElementById('eventsManagePanel');

    if (eventsPanelMountedInStoryArchive()) {
        storyContainer.style.display = 'flex';
        if (eventsManagePanel) {
            setupStoryArchiveBottomBar(eventsManagePanel);
            setupStoryArchiveCompactChrome(eventsManagePanel);
            hideStoryArchiveEventManagerClose(eventsManagePanel);
            applyStoryArchiveGridSquishFromDefaults(eventsManagePanel);
            ensureStoryArchiveBackToCategoriesButton(eventsManagePanel);
            const curArchive =
                window.eventManager?.dataService?.getArchiveSource?.() || 'story';
            updateStoryArchiveCategoryStripActive(curArchive);
        }
        requestAnimationFrame(() => {
            storyContainer.classList.add('active');
        });
        return;
    }

    if (storyContainer?.querySelector('#storyArchiveCategoryHub')) {
        storyContainer.style.display = 'flex';
        attachStoryArchiveHubDismissChrome();
        requestAnimationFrame(() => {
            storyContainer.classList.add('active');
        });
        return;
    }

    prepareStoryArchiveShell();

    if (!eventsManagePanel) {
        updateStatus('⚠ Event Manager panel not found', 'error');
        return;
    }

    if (!storyContainer) {
        storyContainer = document.createElement('div');
        storyContainer.id = 'storyViewerContainer';
        storyContainer.className = 'story-viewer-container story-viewer-container--hub';
        storyContainer.appendChild(buildCategoryHub());

        const content = document.getElementById('content');
        if (content) {
            content.appendChild(storyContainer);
        } else {
            document.body.appendChild(storyContainer);
        }

        requestAnimationFrame(() => {
            storyContainer.classList.add('active');
        });

        attachStoryArchiveHubDismissChrome();
        updateStatus('✓ Data Archive — choose a category', 'success');
    }
}

/**
 * External fast-path: open Data Archive directly on the given source,
 * skipping the category-pick step. Used by the Event Manager × → "open
 * Data Archive" affordance and by keyboard shortcuts.
 *
 * @param {'story'|'heroes'|'factions'|'npcs'|'locations'} [archiveSource]
 * @param {object} [options]
 * @param {(restoreMenu?: boolean) => void | Promise<void>} [options.onCancel]
 */
export async function openDataArchiveEventsView(archiveSource = 'story', options = {}) {
    await createDataArchivePanel(options);
    await enterStoryArchiveEventsView(archiveSource);
}

/**
 * Tear down the Data Archive shell: detach the embedded panel, restore
 * the Event Manager rail, and animate the container out. Called by the
 * orchestrator's `killBiographyComponents`.
 */
export async function exitDataArchive() {
    detachStoryArchiveHubDismissChrome();

    const eventsManagePanel = document.getElementById('eventsManagePanel');
    if (eventsManagePanel && originalEventsPanelParent) {
        detachEventsManagePanelFromStoryArchive(eventsManagePanel);
    }

    if (window.eventManager?.dataService?.setArchiveSource) {
        window.eventManager.dataService.setArchiveSource('story');
    }
    try {
        if (window.eventManager?.loadEvents) {
            await window.eventManager.loadEvents();
        }
    } catch (e) {
        console.warn('[DataArchiveShell] Restoring main timeline after Data Archive failed:', e);
    }
    if (window.eventManager?.renderEvents) {
        window.eventManager.renderEvents();
    }

    const eventManagerBtnRestore = document.getElementById('eventsManageToggle');
    if (eventManagerBtnRestore) {
        eventManagerBtnRestore.style.removeProperty('display');
    }

    disconnectStoryArchiveOverlapObserver();

    const storyContainer = document.getElementById('storyViewerContainer');
    if (storyContainer) {
        storyContainer.classList.remove('active');
        setTimeout(() => {
            storyContainer.remove();
        }, 300);
    }

    onExitMode = null;
}
