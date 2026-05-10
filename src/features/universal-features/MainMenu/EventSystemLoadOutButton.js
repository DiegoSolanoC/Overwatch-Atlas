/**
 * Event System Load Out button — the LOAD/UNLOAD test button on the main menu.
 *
 * Owns just the button DOM and its click routing. The actual heavy work
 * (mounting/unmounting the dock, filters, news ticker, markers, etc.) lives
 * in `system-interface/services/EventSystemLoadOut.js` as `loadEventSystem` /
 * `unloadEventSystem`. This mirrors the mode-tile pattern: thin button in
 * `main-menu/`, heavy work in its home feature.
 *
 * The button is hidden on GitHub Pages (auto-preload is forced on for public
 * viewers via {@link createAutoPreloadToggle} instead).
 */

import { isGitHubPages as detectGitHubPages } from './isGitHubPages.js';
import {
    loadEventSystem,
    unloadEventSystem
} from '../../system-interface/services/EventSystemLoadOut.js';

/**
 * Builds the LOAD/UNLOAD Event System Load Out button used by the main menu.
 *
 * @returns {HTMLButtonElement} The fully-wired testBtn, ready to be appended.
 */
export function createEventSystemLoadOutButton() {
    const testBtn = document.createElement('button');
    testBtn.id = 'testBtn';
    testBtn.className = 'test-btn';
    testBtn.textContent = 'LOAD Event System Load Out';
    testBtn.style.cssText = `
        padding: 8px 16px;
        font-size: 12px;
        background: #333;
        color: #fff;
        border: 1px solid #555;
        border-radius: 4px;
        cursor: pointer;
    `;

    if (detectGitHubPages()) {
        testBtn.style.display = 'none';
    }

    testBtn.addEventListener('click', async () => {
        if (testBtn.dataset.loaded === 'true') {
            await unloadEventSystem(testBtn);
        } else {
            await loadEventSystem(testBtn);
        }
    });

    return testBtn;
}
