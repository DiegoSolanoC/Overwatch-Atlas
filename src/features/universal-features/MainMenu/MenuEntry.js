/**
 * MenuEntry — public entrypoint for the `MainMenu` feature.
 *
 * Loaded by `src/features/universal-features/BootUp/LoadingOrchestrator.js`. It
 * is the single live door into the menu code; the implementation lives as
 * sibling files inside `src/features/universal-features/MainMenu/`. This
 * module:
 *   • re-exports the small contained helpers from their sibling files, and
 *   • assembles them into `createMenuButtons()`, the function the loader uses
 *     to build the centered tile screen.
 *
 * (This file used to be called `MenuHelpers.js` and was the head of a 5,500-line
 *  monolith. It was renamed to `MenuEntry.js` once the body had been split out
 *  and its sibling service-loader twin `MenuServiceHelpers.js` was removed.
 *  The whole `main-menu/` folder later moved under `universal-features/MainMenu/`.)
 */

import { MenuButtonArrangement } from './MenuButtonArrangement.js';
import { wireModeActivation } from './ModeActivation.js';
import { createAutoPreloadToggle } from './createAutoPreloadToggle.js';
import { createEventSystemLoadOutButton } from './EventSystemLoadOutButton.js';

export { isGitHubPages } from './isGitHubPages.js';
export { MenuContainer } from './MenuContainer.js';

/**
 * Builds the centered main-menu DOM tree (`.main-menu-buttons`) and returns it.
 *
 * Composition (top to bottom):
 *   1. `MenuButtonArrangement()` — the three Worldview / Codex / Data Archive tiles.
 *   2. `wireModeActivation()` — attaches click handlers for all three tiles.
 *      Worldview's "3D Globe vs 2D Map" picker is part of
 *      `runGlobeComponents` (mode entry → in-content hub → exit), the same
 *      shape as Codex / Data Archive — every tile fires its mode launcher
 *      and the mode shows its sub-menu inside its own shell.
 *   3. A horizontal separator.
 *   4. An "event system" row containing the Auto preload checkbox and the
 *      LOAD/UNLOAD Event System Load Out button.
 *
 * @param {Function} [setupGlobeHandler]     - Click handler for the Worldview tile.
 * @param {Function} [setupGlossaryHandler]  - Click handler for the Codex tile.
 * @param {Function} [setupBiographyHandler] - Click handler for the Data Archive tile.
 * @returns {HTMLDivElement} The `.main-menu-buttons` container, ready to mount.
 */
export function createMenuButtons(setupGlobeHandler = null, setupGlossaryHandler = null, setupBiographyHandler = null) {
    const menuButtons = document.createElement('div');
    menuButtons.className = 'main-menu-buttons';

    const tiles = MenuButtonArrangement();
    wireModeActivation(tiles, {
        setupGlobeHandler,
        setupGlossaryHandler,
        setupBiographyHandler
    });
    menuButtons.appendChild(tiles.row);

    const separator = document.createElement('div');
    separator.style.cssText = `
        width: 60%;
        height: 1px;
        background: linear-gradient(90deg, transparent, #555, transparent);
        margin: 30px auto 10px auto;
    `;
    menuButtons.appendChild(separator);

    const eventSystemContainer = document.createElement('div');
    eventSystemContainer.style.cssText = `
        margin-top: 10px;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 15px;
        width: 100%;
    `;

    const autoPreloadToggle = createAutoPreloadToggle();
    const testBtn = createEventSystemLoadOutButton();

    eventSystemContainer.appendChild(autoPreloadToggle);
    eventSystemContainer.appendChild(testBtn);
    menuButtons.appendChild(eventSystemContainer);

    return menuButtons;
}
