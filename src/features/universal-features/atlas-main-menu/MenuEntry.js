/**
 * MenuEntry — public entrypoint for the `MainMenu` feature.
 *
 * Loaded by `src/features/universal-features/atlas-boot/LoadingOrchestrator.js`. It
 * is the single live door into the menu code; the implementation lives as
 * sibling files inside `src/features/universal-features/atlas-main-menu/`. This
 * module:
 *   • re-exports the small contained helpers from their sibling files, and
 *   • assembles them into `createMenuButtons()`, the function the loader uses
 *     to build the centered tile screen.
 *
 * (This file used to be called `MenuHelpers.js` and was the head of a 5,500-line
 *  monolith. It was renamed to `MenuEntry.js` once the body had been split out
 *  and its sibling service-loader twin `MenuServiceHelpers.js` was removed.
 *  The whole `main-menu/` folder later moved under `universal-features/atlas-main-menu/`.)
 */

import { MenuButtonArrangement } from './MenuButtonArrangement.js';
import { wireModeActivation } from './ModeActivation.js';

export { MenuContainer } from './MenuContainer.js';

/**
 * Builds the centered main-menu DOM tree (`.main-menu-buttons`) and returns it.
 *
 * Composition:
 *   1. `MenuButtonArrangement()` — the three Worldview / Codex / Data Archive tiles.
 *   2. `wireModeActivation()` — attaches click handlers for all three tiles.
 *      Worldview's "3D Globe vs 2D Map" picker is part of
 *      `runGlobeComponents` (mode entry → in-content hub → exit), the same
 *      shape as Codex / Data Archive — every tile fires its mode launcher
 *      and the mode shows its sub-menu inside its own shell.
 *
 * (Historically the menu also rendered an Auto-preload checkbox + a
 * LOAD/UNLOAD Event System Load Out button. Both were removed once the
 * Event System became part of the boot sequence — see `AppInitializer.js`.)
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

    return menuButtons;
}
