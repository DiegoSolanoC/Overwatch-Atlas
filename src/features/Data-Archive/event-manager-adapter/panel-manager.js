/**
 * Event Manager panel DOM manipulation for Data Archive mode.
 * Handles detaching, embedding, and restoring EventManager panel in the DOM.
 *
 * Panel parent/class snapshot is owned by `adapter-state.js` so it stays in sync
 * with `archive-mode` embedding.
 */

import { updateStatus } from '../../universal-features/runtime/statusFeed.js';
import {
    storeOriginalPanelState,
    clearOriginalPanelState,
    originalEventsPanelParent,
    originalEventsPanelClasses
} from './adapter-state.js';

/**
 * Remove EventManager panel from its original location and store original state.
 * @returns {HTMLElement|null} The detached panel or null if not found
 */
export function removePanelFromOriginalLocation() {
    const eventsManagePanel = document.getElementById('eventsManagePanel');
    if (!eventsManagePanel) {
        updateStatus('Event Manager panel not found for embedding', 'error');
        return null;
    }

    storeOriginalPanelState(eventsManagePanel.parentNode, eventsManagePanel.className);

    if (originalEventsPanelParent) {
        originalEventsPanelParent.removeChild(eventsManagePanel);
    }

    return eventsManagePanel;
}

/**
 * Place EventManager panel into Data Archive container with compact layout.
 * @param {HTMLElement} eventsManagePanel - The detached panel
 */
export function placePanelInArchiveContainer(eventsManagePanel) {
    const storyViewerContainer = document.getElementById('storyViewerContainer');
    if (!storyViewerContainer) {
        updateStatus('Story viewer container not found', 'error');
        return;
    }

    eventsManagePanel.classList.add('story-viewer-panel-embedded');
    eventsManagePanel.classList.remove('open');

    storyViewerContainer.appendChild(eventsManagePanel);
}

/**
 * Return EventManager panel to its original location and state.
 */
export function returnPanelToOriginalLocation() {
    const eventsManagePanel = document.getElementById('eventsManagePanel');
    if (!eventsManagePanel || !originalEventsPanelParent) {
        return;
    }

    const storyViewerContainer = document.getElementById('storyViewerContainer');
    if (storyViewerContainer && storyViewerContainer.contains(eventsManagePanel)) {
        storyViewerContainer.removeChild(eventsManagePanel);
    }

    originalEventsPanelParent.appendChild(eventsManagePanel);

    if (originalEventsPanelClasses) {
        eventsManagePanel.className = originalEventsPanelClasses;
    }

    clearOriginalPanelState();
}

/**
 * Check if EventManager panel is currently embedded in Data Archive.
 * @returns {boolean}
 */
export function isPanelEmbedded() {
    const eventsManagePanel = document.getElementById('eventsManagePanel');
    const storyViewerContainer = document.getElementById('storyViewerContainer');
    return !!(eventsManagePanel && storyViewerContainer && storyViewerContainer.contains(eventsManagePanel));
}

/**
 * @deprecated Use removePanelFromOriginalLocation instead.
 */
export function detachEventManagerPanel() {
    return removePanelFromOriginalLocation();
}

/**
 * @deprecated Use placePanelInArchiveContainer instead.
 */
export function embedEventManagerInArchive(eventsManagePanel, archiveSource) {
    placePanelInArchiveContainer(eventsManagePanel);
}

/**
 * @deprecated Use returnPanelToOriginalLocation instead.
 */
export function restoreEventManagerPanel() {
    returnPanelToOriginalLocation();
}

/**
 * @deprecated Use isPanelEmbedded instead.
 */
export function isEventManagerEmbedded() {
    return isPanelEmbedded();
}
