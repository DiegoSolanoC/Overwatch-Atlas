/**
 * Embed `#eventsManagePanel` in a full-stage viewer container (Story Timeline or Data Archive).
 */

import { applyStoryArchiveOverlapDevStyling } from '../archive-support/ArchiveDevStyling.js';
import { mountCategoryToolbar, updateActiveCategory } from '../archive-controls-ui/ArchiveCategoryToolbar.js';
import { applyStoryArchiveGridSquishFromDefaults } from '../archive-controls-ui/ArchiveGridSquish.js';
import { isLocalhost } from '../archive-support/ArchiveEnvironmentChecks.js';
import { hasOriginalState, storeOriginalPanelState } from '../archive-event-panel-bridge/ArchiveEventPanelState.js';
import { updateStatus } from '../../universal-features/atlas-mode-runtime/statusFeed.js';
import { isBioArchiveCategory } from '../archive-category-shared/ArchiveCategoryTypes.js';
import { archiveModeSession } from './ArchiveModeSession.js';
import {
    hideStoryArchiveEventManagerClose,
    setupStoryArchiveBottomBar,
    setupStoryArchiveCompactChrome,
} from './ArchiveEmbeddedEventPanelLayout.js';

function syncDataWorkshopBioArchivePanelClass(eventsManagePanel, archiveSource) {
    if (!eventsManagePanel) return;
    eventsManagePanel.classList.toggle('data-workshop-bio-archive', isBioArchiveCategory(archiveSource));
}

/**
 * @param {'story'|'heroes'|'factions'|'npcs'|'locations'} archiveSource
 */
function statusLabelForArchive(archiveSource) {
    if (archiveSource === 'story') return 'Story';
    return `${archiveSource.charAt(0).toUpperCase()}${archiveSource.slice(1)} archive`;
}

/**
 * @param {HTMLElement} eventsManagePanel
 * @param {{
 *   showCategoryToolbar?: boolean,
 *   onBackToHub?: () => void,
 *   onSelectArchive?: (archive: string) => void,
 *   playCategorySfx?: () => void,
 * }} [chrome]
 */
/**
 * @param {HTMLElement} eventsManagePanel
 * @param {'story'|'heroes'|'factions'|'npcs'|'locations'} archiveSource
 * @param {object} [chrome]
 */
function applyEmbeddedPanelChrome(eventsManagePanel, archiveSource, chrome = {}) {
    syncDataWorkshopBioArchivePanelClass(eventsManagePanel, archiveSource);
    setupStoryArchiveBottomBar(eventsManagePanel);
    setupStoryArchiveCompactChrome(eventsManagePanel);
    hideStoryArchiveEventManagerClose(eventsManagePanel);
    applyStoryArchiveGridSquishFromDefaults(eventsManagePanel);

    if (chrome.showCategoryToolbar && chrome.onBackToHub && chrome.onSelectArchive) {
        mountCategoryToolbar(eventsManagePanel, {
            playCategorySfx: chrome.playCategorySfx,
            onBackToHub: chrome.onBackToHub,
            onSelectArchive: chrome.onSelectArchive,
        });
    }

    if (typeof window.eventManager?.applyPerPageSettings === 'function') {
        window.eventManager.applyPerPageSettings();
    }
}

/**
 * Switch archive source when the panel is already embedded in the viewer container.
 *
 * @param {'story'|'heroes'|'factions'|'npcs'|'locations'} archiveSource
 * @param {Parameters<typeof applyEmbeddedPanelChrome>[1]} [chrome]
 */
export async function switchEmbeddedArchiveSource(archiveSource, chrome = {}) {
    const eventsManagePanel = document.getElementById('eventsManagePanel');
    try {
        if (window.eventManager?.switchStoryArchiveSource) {
            await window.eventManager.switchStoryArchiveSource(archiveSource);
        } else if (window.eventManager) {
            window.eventManager.dataService?.setArchiveSource?.(archiveSource);
            await window.eventManager.loadEvents();
            window.eventManager.renderEvents();
        }
    } catch (err) {
        console.error('[archive-mode] Archive switch failed:', err);
        updateStatus(`Could not load archive: ${err?.message || err}`, 'error');
        return;
    }

    if (eventsManagePanel) {
        syncDataWorkshopBioArchivePanelClass(eventsManagePanel, archiveSource);
        if (chrome.showCategoryToolbar) {
            applyEmbeddedPanelChrome(eventsManagePanel, archiveSource, chrome);
            updateActiveCategory(archiveSource);
        } else if (typeof window.eventManager?.applyPerPageSettings === 'function') {
            window.eventManager.applyPerPageSettings();
        }
    }

    updateStatus(`${statusLabelForArchive(archiveSource)} open`, 'success');
}

/**
 * Mount Event Manager into `#storyViewerContainer` and load an archive bucket.
 *
 * @param {'story'|'heroes'|'factions'|'npcs'|'locations'} archiveSource
 * @param {Parameters<typeof applyEmbeddedPanelChrome>[1]} [chrome]
 */
export async function embedArchiveEventsPanel(archiveSource, chrome = {}) {
    const storyContainer = document.getElementById('storyViewerContainer');
    const eventsManagePanel = document.getElementById('eventsManagePanel');
    if (!storyContainer || !eventsManagePanel) {
        updateStatus('Story viewer or Event Manager panel not found', 'error');
        return;
    }

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

    try {
        if (window.eventManager?.switchStoryArchiveSource) {
            await window.eventManager.switchStoryArchiveSource(archiveSource);
        } else if (window.eventManager) {
            window.eventManager.dataService?.setArchiveSource?.(archiveSource);
            await window.eventManager.loadEvents();
            window.eventManager.renderEvents();
        }
    } catch (err) {
        console.error('[archive-mode] Embedded archive load failed:', err);
        updateStatus(`Could not load archive: ${err?.message || err}`, 'error');
    }

    applyEmbeddedPanelChrome(eventsManagePanel, archiveSource, chrome);
    if (chrome.showCategoryToolbar) {
        updateActiveCategory(archiveSource);
    }

    if (isLocalhost()) {
        setTimeout(() => {
            applyStoryArchiveOverlapDevStyling(eventsManagePanel);

            if (!archiveModeSession.storyArchiveObserver) {
                archiveModeSession.storyArchiveObserver = new MutationObserver(() => {
                    applyStoryArchiveOverlapDevStyling(eventsManagePanel);
                });
                archiveModeSession.storyArchiveObserver.observe(eventsManagePanel, {
                    childList: true,
                    subtree: true,
                });
            }
        }, 400);
    }

    updateStatus(`${statusLabelForArchive(archiveSource)} open`, 'success');
}
