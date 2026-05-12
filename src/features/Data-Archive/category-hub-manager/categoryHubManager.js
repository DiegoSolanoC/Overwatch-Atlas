/**
 * Category Hub Manager - handles Data Archive category selection interface.
 * 
 * Manages category hub lifecycle: showing category selection,
 * handling user interactions, and managing escape key dismissal.
 * 
 * This is a focused manager for the category hub only.
 * Full Data Archive mode logic lives in data-archive-mode/mode-orchestrator.js.
 */

import { buildStoryArchiveCategoryHub } from '../category-ui/category-hub-ui.js';
import { playStoryArchiveCategorySfx } from '../archive-support/sound-effects.js';
import { updateStatus } from '../../universal-features/runtime/statusFeed.js';

// === State Management =============================================

/** @type {((e: KeyboardEvent) => void) | null} Escape → exit Data Archive while category hub is visible */
let categoryHubKeyHandler = null;
/** Callback for exiting the mode */
let onExitMode = null;

// === Helpers =========================================================

/** True when `#eventsManagePanel` is mounted inside `#storyViewerContainer` (events list view). */
function eventsPanelMountedInStoryArchive() {
    const c = document.getElementById('storyViewerContainer');
    const p = document.getElementById('eventsManagePanel');
    return !!(c && p && c.contains(p));
}

/** Shared setup when entering Data Archive (menu hidden, Event Manager rail hidden). */
function prepareDataArchiveEnvironment() {
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

function detachCategoryHubDismissHandler() {
    if (categoryHubKeyHandler) {
        document.removeEventListener('keydown', categoryHubKeyHandler);
        categoryHubKeyHandler = null;
    }
}

/** Escape exits Data Archive when the category hub is showing (parity with globe/map chooser). */
function attachCategoryHubDismissHandler() {
    detachCategoryHubDismissHandler();
    categoryHubKeyHandler = (e) => {
        if (e.key !== 'Escape') return;
        if (eventsPanelMountedInStoryArchive()) return;
        e.preventDefault();
        if (typeof onExitMode === 'function') {
            void onExitMode(true);
        }
    };
    document.addEventListener('keydown', categoryHubKeyHandler);
}

// === Public API =======================================================

/**
 * Show category hub for Data Archive selection.
 * @param {{
 *   onExitMode: () => void,
 *   onCategorySelect: (archive: string) => void
 * }} callbacks
 */
export function showCategoryHub(callbacks) {
    onExitMode = callbacks.onExitMode;
    
    prepareDataArchiveEnvironment();
    
    const storyViewerContainer = document.getElementById('storyViewerContainer');
    if (!storyViewerContainer) {
        updateStatus('Error: storyViewerContainer not found', 'error');
        return;
    }

    const categoryHub = buildStoryArchiveCategoryHub({
        onSelectArchive: callbacks.onCategorySelect,
        onCancel: callbacks.onExitMode,
        playCategorySfx: playStoryArchiveCategorySfx
    });

    storyViewerContainer.appendChild(categoryHub);
    attachCategoryHubDismissHandler();
    
    updateStatus('Data Archive loaded - select a category', 'info');
}

/**
 * Hide category hub and restore normal state.
 */
export function hideCategoryHub() {
    detachCategoryHubDismissHandler();
    
    const storyViewerContainer = document.getElementById('storyViewerContainer');
    const categoryHub = document.getElementById('storyArchiveCategoryHub');
    
    if (storyViewerContainer && categoryHub) {
        storyViewerContainer.removeChild(categoryHub);
    }
    
    // Restore normal UI state
    const testContainer = document.querySelector('.test-container');
    if (testContainer) {
        testContainer.style.display = '';
    }
    
    const eventManagerBtn = document.getElementById('eventsManageToggle');
    if (eventManagerBtn) {
        eventManagerBtn.style.removeProperty('display');
    }
    
    onExitMode = null;
    updateStatus('Exited Data Archive', 'info');
}
