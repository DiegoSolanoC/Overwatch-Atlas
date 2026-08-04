/**
 * Story mode — main timeline Event Manager.
 */

import {
    detachEventsManagePanelFromStoryArchive,
    setupStoryArchiveBottomBar,
} from '../../data-workshop/archive-mode/ArchiveEmbeddedEventPanelLayout.js?v=2';
import {
    archiveModeSession,
    clearArchiveModeCallbacks,
    disconnectStoryArchiveOverlapObserver,
} from '../../data-workshop/archive-mode/ArchiveModeSession.js';
import { embedArchiveEventsPanel } from '../../data-workshop/archive-mode/ArchiveEventPanelEmbed.js';
import {
    attachCategoryHubEscapeChrome,
    detachStoryArchiveHubDismissChrome,
    prepareStoryArchiveShell,
} from '../../data-workshop/archive-mode/ArchiveHubChrome.js';
import { eventsPanelMountedInStoryArchive } from '../../data-workshop/archive-support/ArchiveEnvironmentChecks.js';
import { clearOriginalPanelState } from '../../data-workshop/archive-event-panel-bridge/ArchiveEventPanelState.js';
import { updateStatus } from '../../universal-features/atlas-mode-runtime/statusFeed.js';
import {
    ensureStoryTimelineViewerContainer,
    getStoryViewerContainer,
    removeStoryViewerContainer,
} from '../../data-workshop/archive-mode/ArchiveViewerShell.js';
import {
    clearStoryModeCallbacks,
    storyModeSession,
    storyTimelineModeSession,
} from './StoryModeSession.js';
import { mountStoryViewToggle } from './StoryViewToggle.js';
import { syncArchiveManagePanelActionVisibility } from '../../system-interface/interface-left-panel/event-system/listeners/wireManagePanelButtons.js';

/**
 * @param {object} [options]
 * @param {(restoreMenu?: boolean) => void | Promise<void>} [options.onCancel]
 */
export async function mountStoryMode({ onCancel } = {}) {
    storyModeSession.onExitMode = onCancel || null;
    archiveModeSession.onExitMode = onCancel || null;

    prepareStoryArchiveShell();

    if (eventsPanelMountedInStoryArchive()) {
        const eventsManagePanel = document.getElementById('eventsManagePanel');
        try {
            if (window.eventManager?.switchStoryArchiveSource) {
                await window.eventManager.switchStoryArchiveSource('story');
            } else if (window.eventManager) {
                window.eventManager.dataService?.setArchiveSource?.('story');
                await window.eventManager.loadEvents();
                window.eventManager.renderEvents();
            }
        } catch (err) {
            console.warn('[story] Reload story timeline failed:', err);
        }
        ensureStoryTimelineViewerContainer();
        requestAnimationFrame(() => {
            getStoryViewerContainer()?.classList.add('active');
        });
        mountStoryViewToggle(eventsManagePanel);
        syncArchiveManagePanelActionVisibility();
        setupStoryArchiveBottomBar(eventsManagePanel);
        updateStatus('Story open', 'success');
        return;
    }

    const storyContainer = ensureStoryTimelineViewerContainer();
    requestAnimationFrame(() => {
        storyContainer.classList.add('active');
    });

    await embedArchiveEventsPanel('story', { showCategoryToolbar: false });

    attachCategoryHubEscapeChrome(
        () => archiveModeSession.onExitMode || storyTimelineModeSession.onExitMode,
        () => false,
    );

    syncArchiveManagePanelActionVisibility();

    updateStatus('Story open', 'success');
}

/**
 * @param {object} [options]
 * @param {boolean} [options.restoreMenu=true] When false (mode chain), remove shell immediately.
 */
export async function unmountStoryMode({ restoreMenu = true } = {}) {
    detachStoryArchiveHubDismissChrome();
    clearStoryModeCallbacks();
    clearArchiveModeCallbacks();

    const eventsManagePanel = document.getElementById('eventsManagePanel');
    if (eventsManagePanel) {
        detachEventsManagePanelFromStoryArchive(eventsManagePanel);
    }

    disconnectStoryArchiveOverlapObserver();

    if (window.eventManager?.dataService?.setArchiveSource) {
        window.eventManager.dataService.setArchiveSource('story');
    }
    try {
        if (window.eventManager?.loadEvents) {
            await window.eventManager.loadEvents();
        }
    } catch (e) {
        console.warn('[story] Restoring timeline after exit failed:', e);
    }
    if (window.eventManager?.renderEvents) {
        window.eventManager.renderEvents();
    }

    const eventManagerBtn = document.getElementById('eventsManageToggle');
    if (eventManagerBtn) {
        eventManagerBtn.style.removeProperty('display');
    }

    removeStoryViewerContainer({ immediate: !restoreMenu });

    clearOriginalPanelState();

    syncArchiveManagePanelActionVisibility();
}

/** @deprecated Use {@link mountStoryMode} */
export const mountStoryTimelineMode = mountStoryMode;
/** @deprecated Use {@link unmountStoryMode} */
export const unmountStoryTimelineMode = unmountStoryMode;
