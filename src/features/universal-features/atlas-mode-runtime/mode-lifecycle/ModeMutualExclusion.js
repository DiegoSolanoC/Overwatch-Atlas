import { ATLAS_MODE, normalizeAtlasMode } from '../atlasModes.js';
import { setRunOperation } from '../loadingOverlayState.js';
import { teardownGlobeMapChooserHub } from '../../../world/worldview-mode-entry/entry/WorldviewMapLaunchChoice.js';
import { clearCurrentMode, getCurrentMode } from './CurrentModeStatus.js';

/**
 * Mutual-exclusion guard run at the start of every `runXComponents()` in
 * `ModeOrchestrator`. Enforces the policy: at most one heavy mode is mounted.
 *
 * @param {Object} ctx
 * @param {string} ctx.targetMode - Canonical mode id (`world`, `codex`, …).
 * @param {Record<string, boolean>} ctx.loadedComponents
 * @param {Record<string, (restoreMenu?: boolean) => Promise<void>>} ctx.killers
 */
export async function killOtherModes(ctx) {
    const { targetMode, loadedComponents, killers } = ctx;
    const currentRaw = getCurrentMode();
    if (!currentRaw) return;

    const current = normalizeAtlasMode(currentRaw);
    const target = normalizeAtlasMode(targetMode);
    if (current === target) return;

    const killLinear = async (modeKey, killFn) => {
        if (current !== modeKey || !loadedComponents[modeKey] || !killFn) return;
        await killFn(false);
    };

    await killLinear(ATLAS_MODE.DATA_WORKSHOP, killers.killDataWorkshopComponents);
    await killLinear(ATLAS_MODE.GALLERY, killers.killGalleryComponents);
    await killLinear(ATLAS_MODE.STORY, killers.killStoryComponents);
    await killLinear(ATLAS_MODE.DIALOGUE_THEATER, killers.killDialogueTheaterComponents);
    await killLinear(ATLAS_MODE.OFFICIAL_ARCHIVE, killers.killOfficialArchiveComponents);

    if (current === ATLAS_MODE.CODEX && loadedComponents.codex && killers.killCodexComponents) {
        await killers.killCodexComponents();
    }
    if (current === ATLAS_MODE.WORLD && killers.killWorldComponents) {
        if (loadedComponents.globeBase) {
            await killers.killWorldComponents();
        } else {
            teardownGlobeMapChooserHub();
            const runBtn = document.getElementById('runGlobeBtn');
            if (runBtn) runBtn.disabled = false;
            clearCurrentMode();
            setRunOperation(false);
        }
    }
}
