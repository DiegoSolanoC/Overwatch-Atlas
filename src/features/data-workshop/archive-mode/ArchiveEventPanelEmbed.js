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
} from './ArchiveEmbeddedEventPanelLayout.js?v=2';
import {
    mountStoryViewToggle,
    unmountStoryViewToggle,
} from '../../story/story-mode/StoryViewToggle.js';

/**
 * @param {HTMLElement|null|undefined} storyContainer
 */
function hideStoryViewerContainer(storyContainer) {
    storyContainer?.classList.remove('active');
}

/**
 * @param {HTMLElement|null|undefined} storyContainer
 */
function revealStoryViewerContainer(storyContainer) {
    if (!storyContainer) return;
    storyContainer.style.display = 'flex';
    requestAnimationFrame(() => {
        storyContainer.classList.add('active');
    });
}

/**
 * @param {'story'|'heroes'|'factions'|'npcs'|'locations'} archiveSource
 * @returns {Promise<void>}
 */
async function loadEmbeddedArchiveSource(archiveSource) {
    if (window.eventManager?.switchStoryArchiveSource) {
        await window.eventManager.switchStoryArchiveSource(archiveSource);
        return;
    }
    if (window.eventManager) {
        window.eventManager.dataService?.setArchiveSource?.(archiveSource);
        await window.eventManager.loadEvents();
        window.eventManager.renderEvents();
    }
}

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

    if (archiveSource === 'story') {
        mountStoryViewToggle(eventsManagePanel);
    } else {
        unmountStoryViewToggle();
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
    const storyContainer = document.getElementById('storyViewerContainer');
    hideStoryViewerContainer(storyContainer);

    try {
        await loadEmbeddedArchiveSource(archiveSource);
    } catch (err) {
        console.error('[archive-mode] Archive switch failed:', err);
        updateStatus(`Could not load archive: ${err?.message || err}`, 'error');
        revealStoryViewerContainer(storyContainer);
        return;
    }

    if (eventsManagePanel) {
        syncDataWorkshopBioArchivePanelClass(eventsManagePanel, archiveSource);
        if (chrome.showCategoryToolbar) {
            applyEmbeddedPanelChrome(eventsManagePanel, archiveSource, chrome);
            updateActiveCategory(archiveSource);
        } else {
            applyEmbeddedPanelChrome(eventsManagePanel, archiveSource, chrome);
        }
    }

    revealStoryViewerContainer(storyContainer);
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

    hideStoryViewerContainer(storyContainer);
    eventsManagePanel.classList.remove('open');

    if (!hasOriginalState()) {
        storeOriginalPanelState(eventsManagePanel.parentNode, eventsManagePanel.className);
    }

    try {
        await loadEmbeddedArchiveSource(archiveSource);
    } catch (err) {
        console.error('[archive-mode] Embedded archive load failed:', err);
        updateStatus(`Could not load archive: ${err?.message || err}`, 'error');
        revealStoryViewerContainer(storyContainer);
        return;
    }

    syncDataWorkshopBioArchivePanelClass(eventsManagePanel, archiveSource);

    eventsManagePanel.classList.remove('events-manage-panel');
    eventsManagePanel.classList.add('story-viewer-panel-embedded');
    eventsManagePanel.style.right = 'auto';
    eventsManagePanel.style.position = 'relative';
    eventsManagePanel.style.width = '100%';
    eventsManagePanel.style.height = '100%';
    eventsManagePanel.style.top = 'auto';
    eventsManagePanel.style.bottom = 'auto';

    storyContainer.classList.remove('story-viewer-container--hub');
    storyContainer.classList.add('story-viewer-container--timeline-mode');
    storyContainer.appendChild(eventsManagePanel);

    const header = eventsManagePanel.querySelector('.events-manage-header');
    if (header) {
        header.classList.add('story-viewer-header');
    }

    const addBtn = document.getElementById('addEventBtn');
    const saveBtn = document.getElementById('saveEventsBtn');
    const importBtn = document.getElementById('importEventsBtn');
    const exportBtn = document.getElementById('exportEventsBtn');
    const mergeBtn = document.getElementById('mergeEventsBtn');
    if (addBtn) addBtn.classList.add('story-viewer-action-btn');
    if (saveBtn) saveBtn.classList.add('story-viewer-action-btn');
    if (exportBtn) exportBtn.classList.add('story-viewer-action-btn');
    if (importBtn) importBtn.classList.add('story-viewer-action-btn');
    if (mergeBtn) mergeBtn.classList.add('story-viewer-action-btn');

    applyEmbeddedPanelChrome(eventsManagePanel, archiveSource, chrome);
    if (chrome.showCategoryToolbar) {
        updateActiveCategory(archiveSource);
    }

    eventsManagePanel.classList.add('open');
    revealStoryViewerContainer(storyContainer);

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
