/**
 * MenuEntry — public entrypoint for the main menu feature.
 */

import { MenuButtonArrangement } from './MenuButtonArrangement.js';
import { wireModeActivation } from './ModeActivation.js';

export { MenuContainer } from './MenuContainer.js';

/**
 * @param {Function} [setupGlobeHandler]
 * @param {Function} [setupGlossaryHandler]
 * @param {Function} [setupBiographyHandler]
 * @param {Function} [setupHeroBiographyHandler]
 * @param {Function} [setupStoryTimelineHandler]
 * @param {Function} [setupDialogueTheaterHandler]
 * @returns {HTMLDivElement}
 */
export function createMenuButtons(
    setupGlobeHandler = null,
    setupGlossaryHandler = null,
    setupBiographyHandler = null,
    setupHeroBiographyHandler = null,
    setupStoryTimelineHandler = null,
    setupDialogueTheaterHandler = null,
) {
    const menuButtons = document.createElement('div');
    menuButtons.className = 'main-menu-buttons';

    const tiles = MenuButtonArrangement();
    wireModeActivation(tiles, {
        setupGlobeHandler,
        setupGlossaryHandler,
        setupBiographyHandler,
        setupHeroBiographyHandler,
        setupStoryTimelineHandler,
        setupDialogueTheaterHandler,
    });
    menuButtons.appendChild(tiles.stack);

    return menuButtons;
}
