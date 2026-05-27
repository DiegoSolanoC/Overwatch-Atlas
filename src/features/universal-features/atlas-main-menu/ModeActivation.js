/**
 * Connects main-menu tiles to orchestrator mode entry handlers.
 */

/**
 * @param {object} tiles - From `MenuButtonArrangement()`.
 * @param {object} handlers
 */
export function wireModeActivation(tiles, handlers) {
    const {
        worldviewBtn,
        codexBtn,
        storyBtn,
        biosBtn,
        theaterBtn,
        archivesBtn,
        storyTimelineBtn,
        heroBiographyBtn,
        dialogueTheaterBtn,
        archiveBtn,
        biographyBtn,
        globeBtn,
        glossaryBtn,
    } = tiles;

    const {
        setupGlobeHandler,
        setupGlossaryHandler,
        setupBiographyHandler,
        setupHeroBiographyHandler,
        setupStoryTimelineHandler,
        setupDialogueTheaterHandler,
        setupOfficialResourcesHandler,
    } = handlers;

    const pairs = [
        [worldviewBtn || globeBtn, setupGlobeHandler],
        [codexBtn || glossaryBtn, setupGlossaryHandler],
        [storyBtn || storyTimelineBtn, setupStoryTimelineHandler],
        [biosBtn || heroBiographyBtn, setupHeroBiographyHandler],
        [archivesBtn || archiveBtn || biographyBtn, setupBiographyHandler],
        [theaterBtn || dialogueTheaterBtn, setupDialogueTheaterHandler],
        [tiles.officialResourcesBtn, setupOfficialResourcesHandler],
    ];

    for (const [tile, handler] of pairs) {
        if (tile?.button && handler) {
            tile.button.addEventListener('click', handler);
        }
    }
}
