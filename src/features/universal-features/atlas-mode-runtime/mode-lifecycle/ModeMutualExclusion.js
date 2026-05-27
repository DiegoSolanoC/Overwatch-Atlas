import { setRunOperation } from '../loadingOverlayState.js';
import { teardownGlobeMapChooserHub } from '../../../Interactive-Worldview/worldview-mode-entry/entry/WorldviewMapLaunchChoice.js';
import { clearCurrentMode, getCurrentMode } from './CurrentModeStatus.js';

/**
 * Mutual-exclusion guard run at the start of every `runXComponents()` in
 * `ModeOrchestrator`. Enforces the policy: at most one heavy mode
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
 * @param {string} ctx.targetMode - Mode being launched (`globe`, `glossary`, `biography`, `heroBiography`, `storyTimeline`, `dialogueTheater`, `officialResources`).
 * @param {Record<string, boolean>} ctx.loadedComponents - Orchestrator's loaded-state map.
 * @param {Record<string, (restoreMenu?: boolean) => Promise<void>>} ctx.killers - Per-mode kill functions (`orchestrator._killers`).
 */
export async function killOtherModes(ctx) {
    const { targetMode, loadedComponents, killers } = ctx;
    const currentMode = getCurrentMode();
    if (!currentMode || currentMode === targetMode) return;

    const killLinear = async (modeKey, killFn) => {
        if (currentMode !== modeKey || !loadedComponents[modeKey] || !killFn) return;
        await killFn(false);
    };

    await killLinear('biography', killers.killBiographyComponents);
    await killLinear('heroBiography', killers.killHeroBiographyComponents);
    await killLinear('storyTimeline', killers.killStoryTimelineComponents);
    await killLinear('dialogueTheater', killers.killDialogueTheaterComponents);
    await killLinear('officialResources', killers.killOfficialResourcesComponents);

    if (currentMode === 'glossary' && loadedComponents.glossary && killers.killGlossaryComponents) {
        await killers.killGlossaryComponents();
    }
    if (currentMode === 'globe' && killers.killGlobeComponents) {
        if (loadedComponents.globeBase) {
            await killers.killGlobeComponents();
        } else {
            // Worldview chooser is up but the user never picked 3D/2D — `globeBase`
            // stays false, so a full `killGlobeMode` unload never ran. Tear down
            // the hub so Codex / Data Archive do not sit behind a stale dialog.
            teardownGlobeMapChooserHub();
            const runBtn = document.getElementById('runGlobeBtn');
            if (runBtn) runBtn.disabled = false;
            clearCurrentMode();
            setRunOperation(false);
        }
    }
}
