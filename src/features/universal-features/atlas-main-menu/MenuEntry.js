/**
 * MenuEntry — public entrypoint for the main menu feature.
 */

import { MenuButtonArrangement } from './MenuButtonArrangement.js';
import { wireModeActivation } from './ModeActivation.js';
import { navigateSeeTheLatest } from './navigateSeeTheLatest.js';
import { refreshSeeTheLatestMenuPreview } from './seeTheLatestPreview.js';

export { MenuContainer } from './MenuContainer.js';

/**
 * @param {Function} [setupGlobeHandler]
 * @param {Function} [setupGlossaryHandler]
 * @param {Function} [setupBiographyHandler]
 * @param {Function} [setupHeroBiographyHandler]
 * @param {Function} [setupStoryTimelineHandler]
 * @param {Function} [setupDialogueTheaterHandler]
 * @param {Function} [setupOfficialResourcesHandler]
 * @returns {HTMLDivElement}
 */
export function createMenuButtons(
    setupGlobeHandler = null,
    setupGlossaryHandler = null,
    setupBiographyHandler = null,
    setupHeroBiographyHandler = null,
    setupStoryTimelineHandler = null,
    setupDialogueTheaterHandler = null,
    setupOfficialResourcesHandler = null,
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
        setupOfficialResourcesHandler,
    });

    const seeLatestEl = tiles.seeLatestWrapper?.button || tiles.seeLatestBtn;
    if (seeLatestEl) {
        seeLatestEl.addEventListener('click', () => {
            navigateSeeTheLatest().catch((err) => {
                console.error('[See the Latest]', err);
            });
        });
    }

    menuButtons.appendChild(tiles.stack);
    queueMicrotask(() => refreshSeeTheLatestMenuPreview());

    return menuButtons;
}
