import { getCurrentMode } from './CurrentModeStatus.js';

/**
 * Mutual-exclusion guard run at the start of every `runXComponents()` in
 * `ComponentOrchestrator`. Enforces the policy: at most one heavy mode
 * (Globe / Codex / Data Archive) is mounted at a time.
 *
 * Reads the persisted current mode and tears down whichever mode is currently
 * loaded if it isn't the one the caller is about to enter. Two modes share
 * `#content`, `.test-container`, audio, and event listeners; leaving the
 * previous one mounted while loading the next causes ghost markers, leaked
 * listeners, and audio overlap.
 *
 * Callers may safely pass *all three* killers in `ctx.killers` — when the
 * persisted mode equals `targetMode` this function returns immediately, so
 * the self-killer is never invoked.
 *
 * @param {Object} ctx
 * @param {string} ctx.targetMode - The mode being launched: `'globe' | 'glossary' | 'biography'`.
 * @param {{ globeBase: boolean, glossary: boolean, biography: boolean }} ctx.loadedComponents - Orchestrator's loaded-state map.
 * @param {{
 *   killGlobeComponents?:    () => Promise<void>,
 *   killGlossaryComponents?: () => Promise<void>,
 *   killBiographyComponents?: (restoreMenu?: boolean) => Promise<void>
 * }} ctx.killers - Per-mode kill functions, typically `orchestrator._killers`.
 */
export async function killOtherModes(ctx) {
    const { targetMode, loadedComponents, killers } = ctx;
    const currentMode = getCurrentMode();
    if (!currentMode || currentMode === targetMode) return;

    if (currentMode === 'biography' && loadedComponents.biography && killers.killBiographyComponents) {
        // Pass `false` so killBiography doesn't restore the menu — we're about to mount another mode.
        await killers.killBiographyComponents(false);
    }
    if (currentMode === 'glossary' && loadedComponents.glossary && killers.killGlossaryComponents) {
        await killers.killGlossaryComponents();
    }
    if (currentMode === 'globe' && loadedComponents.globeBase && killers.killGlobeComponents) {
        await killers.killGlobeComponents();
    }
}
