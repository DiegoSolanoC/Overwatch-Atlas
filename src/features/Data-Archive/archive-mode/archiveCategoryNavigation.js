/**
 * Switching between the Data Archive category hub and the embedded Event
 * Manager list for a chosen archive (story / heroes / factions / npcs / locations).
 */

import { applyStoryArchiveOverlapDevStyling } from '../archive-support/dev-styling.js';
import { buildDataArchiveCategoryHub } from '../category-ui/category-hub-ui.js';
import { mountCategoryToolbar, updateActiveCategory } from '../category-toolbar/categoryToolbar.js';
import { playStoryArchiveCategorySfx } from '../archive-support/sound-effects.js';
import { applyStoryArchiveGridSquishFromDefaults } from '../layout-adaptations/gridSquish.js';
import { isLocalhost, eventsPanelMountedInStoryArchive } from '../archive-support/environment-checks.js';
import { hasOriginalState, storeOriginalPanelState } from '../event-manager-adapter/adapter-state.js';
import { updateStatus } from '../../universal-features/runtime/statusFeed.js';
import { archiveModeSession, disconnectStoryArchiveOverlapObserver } from './sessionState.js';
import {
    detachStoryArchiveHubDismissChrome,
    attachStoryArchiveHubDismissChrome
} from './hubChrome.js';
import {
    detachEventsManagePanelFromStoryArchive,
    hideStoryArchiveEventManagerClose,
    setupStoryArchiveBottomBar,
    setupStoryArchiveCompactChrome
} from './embeddedEventPanelLayout.js';

export function ensureStoryArchiveBackToCategoriesButton(eventsManagePanel) {
    mountCategoryToolbar(eventsManagePanel, {
        playCategorySfx: () => playStoryArchiveCategorySfx(),
        onBackToHub: () => {
            void returnToStoryArchiveCategoryHub();
        },
        onSelectArchive: (archive) => {
            void enterStoryArchiveEventsView(archive);
        }
    });
}

export function buildArchiveCategoryHubRoot() {
    return buildDataArchiveCategoryHub({
        playCategorySfx: () => playStoryArchiveCategorySfx(),
        onSelectArchive: (archive) => {
            void enterStoryArchiveEventsView(archive);
        },
        onCancel: () => {
            if (typeof archiveModeSession.onExitMode === 'function') {
                void archiveModeSession.onExitMode(true);
            }
        }
    });
}

/**
 * From category hub -> mount Event Manager panel (same UI; data from archive JSON).
 *
 * @param {'story'|'heroes'|'factions'|'npcs'|'locations'} [archiveSource]
 */
export async function enterStoryArchiveEventsView(archiveSource = 'story') {
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
            console.error('[archive-mode] Data Archive category switch failed:', err);
            updateStatus(`Could not load archive: ${err?.message || err}`, 'error');
            return;
        }
        if (eventsManagePanelMounted) {
            ensureStoryArchiveBackToCategoriesButton(eventsManagePanelMounted);
            updateActiveCategory(archiveSource);
        }
        const labelMounted =
            archiveSource === 'story'
                ? 'Story timeline'
                : `${archiveSource.charAt(0).toUpperCase()}${archiveSource.slice(1)} archive`;
        updateStatus(`${labelMounted} open`, 'success');
        return;
    }

    const storyContainer = document.getElementById('storyViewerContainer');
    const eventsManagePanel = document.getElementById('eventsManagePanel');
    if (!storyContainer || !eventsManagePanel) {
        updateStatus('Data Archive or Event Manager panel not found', 'error');
        return;
    }

    detachStoryArchiveHubDismissChrome();
    document.getElementById('storyArchiveCategoryHub')?.remove();
    storyContainer.classList.remove('story-viewer-container--hub');

    if (!hasOriginalState()) {
        storeOriginalPanelState(eventsManagePanel.parentNode, eventsManagePanel.className);
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
        console.error('[archive-mode] Data Archive load failed:', err);
        updateStatus(`Could not load archive: ${err?.message || err}`, 'error');
    }

    hideStoryArchiveEventManagerClose(eventsManagePanel);
    applyStoryArchiveGridSquishFromDefaults(eventsManagePanel);
    ensureStoryArchiveBackToCategoriesButton(eventsManagePanel);
    updateActiveCategory(archiveSource);

    if (isLocalhost()) {
        setTimeout(() => {
            console.log('[archive-mode] Data Archive (events view) DOM inspection:');
            console.log('[archive-mode] eventsManagePanel:', eventsManagePanel);
            const eventItems = eventsManagePanel.querySelectorAll('.event-item');
            console.log('[archive-mode] Event items found:', eventItems.length);
        }, 300);

        setTimeout(() => {
            applyStoryArchiveOverlapDevStyling(eventsManagePanel);

            if (!archiveModeSession.storyArchiveObserver) {
                archiveModeSession.storyArchiveObserver = new MutationObserver(() => {
                    applyStoryArchiveOverlapDevStyling(eventsManagePanel);
                });
                archiveModeSession.storyArchiveObserver.observe(eventsManagePanel, {
                    childList: true,
                    subtree: true
                });
            }
        }, 400);
    }

    const label =
        archiveSource === 'story'
            ? 'Story timeline'
            : `${archiveSource.charAt(0).toUpperCase()}${archiveSource.slice(1)} archive`;
    updateStatus(`${label} open`, 'success');
}

/** Hub again: detach list panel, restore main timeline in memory, show category tiles. */
export async function returnToStoryArchiveCategoryHub() {
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
        console.warn('[archive-mode] Restoring main timeline for category hub:', e);
    }
    if (window.eventManager?.renderEvents) {
        window.eventManager.renderEvents();
    }

    storyContainer.classList.add('story-viewer-container--hub');
    storyContainer.appendChild(buildArchiveCategoryHubRoot());
    attachStoryArchiveHubDismissChrome();
    updateStatus('Data Archive — choose a category', 'success');
}
