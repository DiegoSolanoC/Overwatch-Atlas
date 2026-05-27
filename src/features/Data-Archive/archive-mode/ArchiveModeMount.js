/**
 * Data Archive as an app mode: mount the category hub, embed the Event Manager
 * panel when a category is chosen, and tear it all down on exit.
 *
 * Prefer the named exports `mountDataArchiveMode`, `unmountDataArchiveMode`, and
 * `openDataArchiveAtSource`. Legacy names (`createDataArchivePanel`, `exitDataArchive`,
 * `openDataArchiveEventsView`) remain for existing orchestrator imports.
 */

import { eventsPanelMountedInStoryArchive } from '../archive-support/ArchiveEnvironmentChecks.js';
import { clearOriginalPanelState } from '../archive-event-panel-bridge/ArchiveEventPanelState.js';
import { updateActiveCategory } from '../archive-controls-ui/ArchiveCategoryToolbar.js';
import { updateStatus } from '../../universal-features/atlas-mode-runtime/statusFeed.js';
import { archiveModeSession, clearArchiveModeCallbacks, disconnectStoryArchiveOverlapObserver } from './ArchiveModeSession.js';
import {
    prepareStoryArchiveShell,
    attachStoryArchiveHubDismissChrome,
    detachStoryArchiveHubDismissChrome
} from './ArchiveHubChrome.js';
import {
    buildArchiveCategoryHubRoot,
    enterStoryArchiveEventsView,
    ensureStoryArchiveBackToCategoriesButton
} from './ArchiveCategoryNavigation.js';
import {
    setupStoryArchiveBottomBar,
    setupStoryArchiveCompactChrome,
    hideStoryArchiveEventManagerClose,
    detachEventsManagePanelFromStoryArchive
} from './ArchiveEmbeddedEventPanelLayout.js';
import { applyStoryArchiveGridSquishFromDefaults } from '../archive-controls-ui/ArchiveGridSquish.js';

/**
 * Mount the Data Archive shell: category hub first; events list mounts after
 * the user taps a category tile. Idempotent — repeat calls refresh an existing shell.
 *
 * @param {object} [options]
 * @param {(restoreMenu?: boolean) => void | Promise<void>} [options.onCancel]
 */
export async function mountDataArchiveMode({ onCancel } = {}) {
    archiveModeSession.onExitMode = onCancel || null;

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
            updateActiveCategory(curArchive);
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
        updateStatus('Event Manager panel not found', 'error');
        return;
    }

    if (!storyContainer) {
        storyContainer = document.createElement('div');
        storyContainer.id = 'storyViewerContainer';
        storyContainer.className = 'story-viewer-container story-viewer-container--hub';
        storyContainer.appendChild(buildArchiveCategoryHubRoot());

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
        updateStatus('Data Archive — choose a category', 'success');
    }
}

/**
 * Open Data Archive on a given archive, skipping the category hub step.
 * Used by Event Manager shortcuts and keyboard flows.
 *
 * @param {'story'|'heroes'|'factions'|'npcs'|'locations'} [archiveSource]
 * @param {object} [options]
 * @param {(restoreMenu?: boolean) => void | Promise<void>} [options.onCancel]
 */
export async function openDataArchiveAtSource(archiveSource = 'story', options = {}) {
    await mountDataArchiveMode(options);
    await enterStoryArchiveEventsView(archiveSource);
}

/**
 * Tear down Data Archive: restore the Event Manager panel and remove the shell.
 */
export async function unmountDataArchiveMode() {
    detachStoryArchiveHubDismissChrome();

    const eventsManagePanel = document.getElementById('eventsManagePanel');
    if (eventsManagePanel) {
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
        console.warn('[archive-mode] Restoring main timeline after Data Archive failed:', e);
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

    clearOriginalPanelState();
    clearArchiveModeCallbacks();
}

/** @deprecated Use {@link mountDataArchiveMode} */
export const createDataArchivePanel = mountDataArchiveMode;

/** @deprecated Use {@link unmountDataArchiveMode} */
export const exitDataArchive = unmountDataArchiveMode;

/** @deprecated Use {@link openDataArchiveAtSource} */
export const openDataArchiveEventsView = openDataArchiveAtSource;
