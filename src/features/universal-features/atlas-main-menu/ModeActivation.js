/**
 * Connects each main-menu tile to the orchestrator entry that runs its mode.
 */

/**
 * @param {object} tiles - From `MenuButtonArrangement()`.
 * @param {object} handlers
 */
export function wireModeActivation(tiles, handlers) {
    const {
        worldviewBtn,
        codexBtn,
        archiveBtn,
        heroBiographyBtn,
        storyTimelineBtn,
        dialogueTheaterBtn,
        globeBtn,
        glossaryBtn,
        biographyBtn,
    } = tiles;

    const {
        setupGlobeHandler,
        setupGlossaryHandler,
        setupBiographyHandler,
        setupHeroBiographyHandler,
        setupStoryTimelineHandler,
        setupDialogueTheaterHandler,
    } = handlers;

    const pairs = [
        [worldviewBtn || globeBtn, setupGlobeHandler],
        [codexBtn || glossaryBtn, setupGlossaryHandler],
        [archiveBtn || biographyBtn, setupBiographyHandler],
        [heroBiographyBtn, setupHeroBiographyHandler],
        [storyTimelineBtn, setupStoryTimelineHandler],
        [dialogueTheaterBtn, setupDialogueTheaterHandler],
    ];

    for (const [tile, handler] of pairs) {
        if (tile?.button && handler) {
            tile.button.addEventListener('click', handler);
        }
    }
}
