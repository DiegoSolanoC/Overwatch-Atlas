/**
 * Switching between the Data Archive category hub and the embedded Event
 * Manager list for bio archives (heroes / factions / npcs / locations).
 */

import { playStoryArchiveCategorySfx } from '../archive-support/ArchiveSoundEffects.js';
import { eventsPanelMountedInStoryArchive } from '../archive-support/ArchiveEnvironmentChecks.js';
import { updateStatus } from '../../universal-features/atlas-mode-runtime/statusFeed.js';
import { archiveModeSession, disconnectStoryArchiveOverlapObserver } from './ArchiveModeSession.js';
import {
    detachStoryArchiveHubDismissChrome,
    attachStoryArchiveHubDismissChrome,
} from './ArchiveHubChrome.js';
import {
    detachEventsManagePanelFromStoryArchive,
} from './ArchiveEmbeddedEventPanelLayout.js';
import { buildDataArchiveCategoryHub } from '../archive-controls-ui/ArchiveCategoryHubUi.js';
import { isBioArchiveCategory } from '../archive-category-shared/ArchiveCategoryTypes.js';
import {
    embedArchiveEventsPanel,
    switchEmbeddedArchiveSource,
} from './ArchiveEventPanelEmbed.js';
import { mountCategoryToolbar } from '../archive-controls-ui/ArchiveCategoryToolbar.js';

function bioArchiveToolbarCallbacks() {
    return {
        showCategoryToolbar: true,
        playCategorySfx: () => playStoryArchiveCategorySfx(),
        onBackToHub: () => {
            void returnToStoryArchiveCategoryHub();
        },
        onSelectArchive: (archive) => {
            void enterStoryArchiveEventsView(archive);
        },
    };
}

export function ensureStoryArchiveBackToCategoriesButton(eventsManagePanel) {
    mountCategoryToolbar(eventsManagePanel, {
        playCategorySfx: () => playStoryArchiveCategorySfx(),
        onBackToHub: () => {
            void returnToStoryArchiveCategoryHub();
        },
        onSelectArchive: (archive) => {
            void enterStoryArchiveEventsView(archive);
        },
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
        },
    });
}

/**
 * Redirect story timeline requests to Story Timeline mode.
 * @returns {boolean} true if redirected
 */
async function redirectStoryToTimelineMode() {
    const orch = typeof window !== 'undefined' ? window.modeOrchestrator : null;
    if (orch && typeof orch.runStoryComponents === 'function') {
        await orch.runStoryComponents();
        return true;
    }
    return false;
}

/**
 * From category hub -> mount Event Manager panel (bio archives only).
 *
 * @param {'story'|'heroes'|'factions'|'npcs'|'locations'} [archiveSource]
 */
export async function enterStoryArchiveEventsView(archiveSource = 'heroes') {
    if (archiveSource === 'story') {
        await redirectStoryToTimelineMode();
        return;
    }

    if (!isBioArchiveCategory(archiveSource)) {
        updateStatus(`Unknown archive: ${archiveSource}`, 'error');
        return;
    }

    const chrome = bioArchiveToolbarCallbacks();

    if (eventsPanelMountedInStoryArchive()) {
        await switchEmbeddedArchiveSource(archiveSource, chrome);
        return;
    }

    const storyContainer = document.getElementById('storyViewerContainer');
    const eventsManagePanel = document.getElementById('eventsManagePanel');
    if (!storyContainer || !eventsManagePanel) {
        updateStatus('Data Workshop or Event Manager panel not found', 'error');
        return;
    }

    detachStoryArchiveHubDismissChrome();
    document.getElementById('storyArchiveCategoryHub')?.remove();
    storyContainer.classList.remove('story-viewer-container--hub');

    await embedArchiveEventsPanel(archiveSource, chrome);
}

/** Hub again: detach list panel, show category tiles. */
export async function returnToStoryArchiveCategoryHub() {
    const storyContainer = document.getElementById('storyViewerContainer');
    const eventsManagePanel = document.getElementById('eventsManagePanel');
    if (!storyContainer || !eventsManagePanel || !eventsPanelMountedInStoryArchive()) {
        return;
    }

    unmountCategoryToolbar();
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
    storyContainer.classList.remove('story-viewer-container--timeline-mode');
    storyContainer.appendChild(buildArchiveCategoryHubRoot());
    attachStoryArchiveHubDismissChrome();
    updateStatus('Data Workshop — choose a category', 'success');
}
