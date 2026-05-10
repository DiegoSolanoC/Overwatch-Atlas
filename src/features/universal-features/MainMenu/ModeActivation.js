/**
 * Connects each main-menu tile (Worldview, Codex, Data Archive) to the
 * function that activates its mode when the user clicks it.
 *
 * All three tiles fire their corresponding `runXComponents()` flow on the
 * orchestrator. Worldview's "3D Globe vs 2D Map" picker is mounted by
 * `runGlobeComponents` itself (mode entry → in-content hub → exit), the same
 * way Data Archive's category hub is mounted by `runBiographyComponents`.
 *
 * @param {{
 *   globeBtn?: { button?: HTMLElement },
 *   glossaryBtn?: { button?: HTMLElement },
 *   biographyBtn?: { button?: HTMLElement }
 * }} tiles - Tile wrappers from `MenuButtonArrangement()`. Each must expose `.button`.
 * @param {Object} handlers
 * @param {Function} [handlers.setupGlobeHandler]     - Click handler for the Worldview tile.
 * @param {Function} [handlers.setupGlossaryHandler]  - Click handler for the Codex tile.
 * @param {Function} [handlers.setupBiographyHandler] - Click handler for the Data Archive tile.
 */
export function wireModeActivation(tiles, handlers) {
    const { globeBtn, glossaryBtn, biographyBtn } = tiles;
    const { setupGlobeHandler, setupGlossaryHandler, setupBiographyHandler } = handlers;

    if (globeBtn && globeBtn.button && setupGlobeHandler) {
        globeBtn.button.addEventListener('click', setupGlobeHandler);
    }
    if (glossaryBtn && glossaryBtn.button && setupGlossaryHandler) {
        glossaryBtn.button.addEventListener('click', setupGlossaryHandler);
    }
    if (biographyBtn && biographyBtn.button && setupBiographyHandler) {
        biographyBtn.button.addEventListener('click', setupBiographyHandler);
    }
}
