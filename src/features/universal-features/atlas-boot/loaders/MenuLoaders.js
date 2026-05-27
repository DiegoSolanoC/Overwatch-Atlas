/**
 * MenuLoaders — load/unload pair for the main menu tile screen.
 *
 * `loadMenu` finds (or creates) the `.test-container` host, builds the row
 * of mode tiles via `createMenuButtons`, and wires each tile's run-handler
 * to the matching orchestrator entrypoint (Worldview, Codex, Data Archive).
 * `unloadMenu` removes the tile row but leaves the host container.
 */

import {
    withLoadLifecycle,
    withUnloadLifecycle,
    checkAlreadyLoaded
} from '../../atlas-shared-ui/loading/LoadingLifecycle.js';
import {
    removeElementBySelector
} from '../../atlas-shared-ui/dom/removeElement.js';
import { createLoadingLockHandler } from '../../atlas-shared-ui/loading/LoadingLockProtocol.js';
import { updateStatus } from '../../atlas-mode-runtime/statusFeed.js';
import {
    getRunOperation,
    setRunOperation
} from '../../atlas-mode-runtime/loadingOverlayState.js';
import { createMenuButtons, MenuContainer } from '../../atlas-main-menu/MenuEntry.js';

export async function loadMenu(loadedComponents) {
    if (checkAlreadyLoaded(loadedComponents.menu, 'Menu')) {
        return;
    }

    await withLoadLifecycle(async () => {
        const menuContainer = MenuContainer();
        if (!menuContainer) {
            updateStatus('✗ Menu host (#content) not found', 'error');
            return;
        }

        if (menuContainer.querySelector('.main-menu-buttons')) {
            updateStatus('Menu buttons already exist', 'info');
            loadedComponents.menu = true;
            return;
        }

        updateStatus('Creating main menu buttons...', 'info');

        // Tiles delegate to the global run-X-Components hooks the orchestrator
        // publishes on `window`. Using window references avoids a circular
        // import: this module is consumed by the orchestrator, so it can't
        // import the orchestrator directly.
        const setupGlobeHandler = createLoadingLockHandler(window.runGlobeComponents, setRunOperation);
        const setupGlossaryHandler = typeof window.runGlossaryComponents === 'function'
            ? createLoadingLockHandler(window.runGlossaryComponents, setRunOperation)
            : null;
        const setupBiographyHandler = typeof window.runBiographyComponents === 'function'
            ? createLoadingLockHandler(window.runBiographyComponents, setRunOperation)
            : null;
        const setupHeroBiographyHandler = typeof window.runHeroBiographyComponents === 'function'
            ? createLoadingLockHandler(window.runHeroBiographyComponents, setRunOperation)
            : null;
        const setupStoryTimelineHandler = typeof window.runStoryTimelineComponents === 'function'
            ? createLoadingLockHandler(window.runStoryTimelineComponents, setRunOperation)
            : null;
        const setupDialogueTheaterHandler = typeof window.runDialogueTheaterComponents === 'function'
            ? createLoadingLockHandler(window.runDialogueTheaterComponents, setRunOperation)
            : null;

        const menuButtons = createMenuButtons(
            setupGlobeHandler,
            setupGlossaryHandler,
            setupBiographyHandler,
            setupHeroBiographyHandler,
            setupStoryTimelineHandler,
            setupDialogueTheaterHandler,
        );
        menuContainer.appendChild(menuButtons);
        updateStatus('✓ Menu buttons created', 'success');

        loadedComponents.menu = true;
    }, 'Menu', 'loadMenuBtn', getRunOperation());
}

export async function unloadMenu(loadedComponents) {
    if (!loadedComponents.menu) {
        updateStatus('Menu not loaded', 'info');
        return;
    }

    await withUnloadLifecycle(async () => {
        const testContainer = document.querySelector('.test-container');
        if (testContainer) {
            removeElementBySelector('.main-menu-buttons', 'Menu buttons removed', testContainer);
        }
        loadedComponents.menu = false;
    }, 'Menu', 'loadMenuBtn');
}
