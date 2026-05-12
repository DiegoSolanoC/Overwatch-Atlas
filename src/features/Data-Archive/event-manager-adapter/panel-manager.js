/**
 * Event Manager panel DOM manipulation for Data Archive mode.
 * Handles detaching, embedding, and restoring EventManager panel in the DOM.
 */

import { updateStatus } from '../../universal-features/runtime/statusFeed.js';

// === State Management ============================================

/** @type {Node | null} Where `#eventsManagePanel` lived before being moved into Data Archive */
let originalEventsPanelParent = null;
/** @type {string | null} ClassName the panel had before Data Archive started rewriting it */
let originalEventsPanelClasses = null;

// === Panel Management Functions ==================================

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

    // Store original state
    originalEventsPanelParent = eventsManagePanel.parentNode;
    originalEventsPanelClasses = eventsManagePanel.className;

    // Detach from DOM
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

    // Add archive-specific classes
    eventsManagePanel.classList.add('story-viewer-panel-embedded');
    eventsManagePanel.classList.remove('open');

    // Embed in container
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

    // Remove from archive container
    const storyViewerContainer = document.getElementById('storyViewerContainer');
    if (storyViewerContainer && storyViewerContainer.contains(eventsManagePanel)) {
        storyViewerContainer.removeChild(eventsManagePanel);
    }

    // Restore to original location
    originalEventsPanelParent.appendChild(eventsManagePanel);

    // Restore original classes
    if (originalEventsPanelClasses) {
        eventsManagePanel.className = originalEventsPanelClasses;
    }

    // Clear stored state
    originalEventsPanelParent = null;
    originalEventsPanelClasses = null;
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

// === Legacy Compatibility ========================================

/**
 * Legacy export for backward compatibility.
 * @deprecated Use removePanelFromOriginalLocation instead.
 */
export function detachEventManagerPanel() {
    return removePanelFromOriginalLocation();
}

/**
 * Legacy export for backward compatibility.
 * @deprecated Use placePanelInArchiveContainer instead.
 */
export function embedEventManagerInArchive(eventsManagePanel, archiveSource) {
    placePanelInArchiveContainer(eventsManagePanel);
    // Note: Data source switching is now handled by data-adapter.js
}

/**
 * Legacy export for backward compatibility.
 * @deprecated Use returnPanelToOriginalLocation instead.
 */
export function restoreEventManagerPanel() {
    returnPanelToOriginalLocation();
}

/**
 * Legacy export for backward compatibility.
 * @deprecated Use isPanelEmbedded instead.
 */
export function isEventManagerEmbedded() {
    return isPanelEmbedded();
}
