/**
 * MenuContainer — owns the singleton host element for the main menu
 * (`.test-container` / `#testContainer`).
 *
 * Two operations live here because both target the same DOM node:
 *   - `MenuContainer()`     — idempotently mounts the host under `main#content`.
 *   - `hideMenuContainer()` — hides it so a mode (Globe / Codex / Data Archive)
 *                              can take over the viewport.
 *
 * The legacy class and id names (`.test-container` / `#testContainer`) remain
 * for stylesheet and tooling compatibility.
 */

import { updateStatus } from '../atlas-mode-runtime/statusFeed.js';

/**
 * Returns the singleton host element for the main menu. Creates it once
 * under `main#content` if missing. Repeated calls return the same node.
 *
 * @returns {HTMLElement | null} The menu host, or `null` if `#content` is missing.
 */
export function MenuContainer() {
    let el = document.querySelector('.test-container');
    if (el) return el;

    const content = document.getElementById('content');
    if (!content) {
        console.warn('[MenuContainer] #content missing; menu host not created');
        return null;
    }

    el = document.createElement('div');
    el.className = 'test-container';
    el.id = 'testContainer';
    content.appendChild(el);
    return el;
}

/**
 * Hides the main menu's host so a mode can take over the viewport. The
 * orchestrator calls this from each `runXComponents()` right after killing
 * the previous mode and before the new mode's assets start loading.
 *
 * No-op if the host isn't mounted yet.
 */
export function hideMenuContainer() {
    const testContainer = document.querySelector('.test-container');
    if (!testContainer) return;
    testContainer.style.display = 'none';
    updateStatus('→ Hiding menu container...', 'info');
}

/**
 * Shows the main menu host again (hub / timeline default). Used when closing
 * the event slide after flows that hid the menu, and by `restoreMainMenu`.
 */
export function showMenuContainer() {
    const testContainer = document.querySelector('.test-container');
    if (!testContainer) return;
    testContainer.style.display = 'flex';
    testContainer.style.visibility = 'visible';
    testContainer.style.opacity = '1';
    testContainer.classList.remove('fading');
}
