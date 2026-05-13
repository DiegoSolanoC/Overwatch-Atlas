/**
 * Category Hub Manager — optional entry: mount a category hub into an existing
 * `#storyViewerContainer` without the full `mountDataArchiveMode` flow.
 *
 * Escape handling and shell prep are shared with `archive-mode/hubChrome.js`.
 * Prefer `mountDataArchiveMode` from `archive-mode/dataArchiveMode.js` for the app.
 */

import { buildDataArchiveCategoryHub } from '../category-ui/category-hub-ui.js';
import { playStoryArchiveCategorySfx } from '../archive-support/sound-effects.js';
import { updateStatus } from '../../Universal-Features/runtime/statusFeed.js';
import { eventsPanelMountedInStoryArchive } from '../archive-support/environment-checks.js';
import {
    prepareStoryArchiveShell,
    attachCategoryHubEscapeChrome,
    detachStoryArchiveHubDismissChrome
} from '../archive-mode/hubChrome.js';

/**
 * Show category hub for Data Archive selection (expects `#storyViewerContainer` to exist).
 *
 * @remarks The production path is `mountDataArchiveMode` in `archive-mode/dataArchiveMode.js`.
 *
 * @param {{
 *   onExitMode: (restoreMenu?: boolean) => void | Promise<void>,
 *   onCategorySelect: (archive: string) => void
 * }} callbacks
 */
export function showCategoryHub(callbacks) {
    prepareStoryArchiveShell();

    const storyViewerContainer = document.getElementById('storyViewerContainer');
    if (!storyViewerContainer) {
        updateStatus('Error: storyViewerContainer not found', 'error');
        return;
    }

    const categoryHub = buildDataArchiveCategoryHub({
        onSelectArchive: callbacks.onCategorySelect,
        onCancel: callbacks.onExitMode,
        playCategorySfx: playStoryArchiveCategorySfx
    });

    storyViewerContainer.appendChild(categoryHub);
    attachCategoryHubEscapeChrome(callbacks.onExitMode, () => eventsPanelMountedInStoryArchive());

    updateStatus('Data Archive loaded - select a category', 'info');
}

/**
 * Hide category hub and restore normal state.
 */
export function hideCategoryHub() {
    detachStoryArchiveHubDismissChrome();

    const storyViewerContainer = document.getElementById('storyViewerContainer');
    const categoryHub = document.getElementById('storyArchiveCategoryHub');

    if (storyViewerContainer && categoryHub) {
        storyViewerContainer.removeChild(categoryHub);
    }

    const testContainer = document.querySelector('.test-container');
    if (testContainer) {
        testContainer.style.display = '';
    }

    const eventManagerBtn = document.getElementById('eventsManageToggle');
    if (eventManagerBtn) {
        eventManagerBtn.style.removeProperty('display');
    }

    updateStatus('Exited Data Archive', 'info');
}
