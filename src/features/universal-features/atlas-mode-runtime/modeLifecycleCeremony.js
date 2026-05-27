/**
 * modeLifecycleCeremony — the shared "enter mode" / "exit mode" ceremony
 * used by the linear modes (Codex/Glossary, Data Archive/Biography).
 *
 * Every mode entry follows the same beats: play SFX, hide event slides,
 * kill the other modes, persist the new mode, disable the menu run
 * button, raise the loading overlay, hide the menu container, run the
 * mode-specific body, dispatch the mode-change event, mark loaded, and
 * drop the overlay in `finally`. Exit mirrors that in reverse minus the
 * SFX.
 *
 * The Worldview mode does NOT use these — its `runGlobeComponents` has a
 * chooser-hub branch that exits early instead of running a body, and its
 * `killGlobeComponents` walks a 4-stage layered unload. Keeping Globe
 * bespoke and the linear modes shared turned out to be the right shape:
 * the alternative was a helper bristling with `if (mode === 'globe')`
 * branches that defeated the point.
 *
 * Lives in `runtime/` because it's orchestrator-internal — only
 * `ModeOrchestrator` calls in. Extracted out so the orchestrator
 * file can stay focused on cross-mode coordination state.
 */

import { showLoadingOverlay, hideLoadingOverlay, setRunOperation } from './loadingOverlayState.js';
import { updateStatus } from './statusFeed.js';
import { resetLoadProgress } from './loadProgressTracker.js';
import { setCurrentMode, clearCurrentMode } from './mode-lifecycle/CurrentModeStatus.js';
import { broadcastModeChange } from './mode-lifecycle/broadcastModeChange.js';
import { hideMenuContainer } from '../atlas-main-menu/MenuContainer.js';
import { killOtherModes } from './mode-lifecycle/ModeMutualExclusion.js';
import { playModeSwitchSound } from '../atlas-sound-effects/playModeSwitchSound.js';

/**
 * @typedef {object} OrchestratorContext
 * @property {Record<string, boolean>} loadedComponents - Orchestrator's loaded-state flag bag.
 * @property {Record<string, () => Promise<void>>} killers - Bound kill functions for `killOtherModes`.
 * @property {(preserveNewsTicker?: boolean) => Promise<void>} restoreMainMenu - Orchestrator's restore-menu method.
 */

/**
 * Enter ceremony for a linear mode.
 *
 * `cfg.mode` doubles as both the persisted-mode key (`localStorage.currentMode`)
 * AND the `loadedComponents` flag flipped on success — they're the same string
 * by convention for the linear modes.
 *
 * @param {OrchestratorContext} orchCtx
 * @param {object} cfg
 * @param {'glossary'|'biography'} cfg.mode      Target mode + `loadedComponents` flag.
 * @param {string} cfg.runBtnId                  DOM id of the menu's run button (disabled during load).
 * @param {string} cfg.startMessage              Status line shown when entry begins.
 * @param {string} cfg.successMessage            Status line shown after entry succeeds.
 * @param {string} cfg.errorPrefix               Prefix used in the catch-branch status / log line.
 * @param {boolean} cfg.isAutoLoad               Suppresses the mode-switch SFX (header switches use this).
 * @param {() => Promise<void>} entryFn          Mode-specific body run inside the try-block.
 */
export async function enterMode(orchCtx, cfg, entryFn) {
    const { mode, runBtnId, startMessage, successMessage, errorPrefix, isAutoLoad } = cfg;
    const { loadedComponents, killers } = orchCtx;

    playModeSwitchSound(isAutoLoad);

    if (window.standaloneEventSlide?.hideEventSlide) {
        window.standaloneEventSlide.hideEventSlide();
    }

    await killOtherModes({
        targetMode: mode,
        loadedComponents,
        killers
    });

    setCurrentMode(mode);

    const runBtn = runBtnId ? document.getElementById(runBtnId) : null;
    if (runBtn) {
        runBtn.disabled = true;
    }

    // Always start a fresh run-operation + overlay for linear mode entry.
    // A stale `isRunOperation` (e.g. abandoned loading-lock / hub teardown paths)
    // would skip `showLoadingOverlay()` and make Codex / Data Archive look instant.
    setRunOperation(false);
    setRunOperation(true);
    showLoadingOverlay();
    /* Reset the shared progress bar so each mode entry starts at 0%, regardless
     * of which mode (or stage of which mode) was active last. The body's own
     * `createLoadProgressTracker(...)` will also reset, but doing it here means
     * the bar is at 0 from the instant the overlay appears. */
    resetLoadProgress();
    updateStatus(startMessage, 'info');

    try {
        hideMenuContainer();
        await entryFn();
        broadcastModeChange(mode);
        loadedComponents[mode] = true;
        updateStatus(successMessage, 'success');
    } catch (error) {
        console.error(`${errorPrefix}:`, error);
        updateStatus(`✗ ${errorPrefix}: ${error.message}`, 'error');
    } finally {
        setRunOperation(false);
        hideLoadingOverlay();
        if (runBtn) {
            runBtn.disabled = false;
        }
    }
}

/**
 * Exit ceremony for a linear mode. Pairs with `enterMode`.
 *
 * @param {OrchestratorContext} orchCtx
 * @param {object} cfg
 * @param {'glossary'|'biography'} cfg.mode    `loadedComponents` flag to clear.
 * @param {string} cfg.startMessage            Status line shown when exit begins.
 * @param {string} cfg.successMessage          Status line shown after exit completes.
 * @param {boolean} [cfg.restoreMenu=true]     Skip when chaining straight into another mode entry.
 * @param {() => Promise<void>} teardownFn     Mode-specific teardown body.
 */
export async function exitMode(orchCtx, cfg, teardownFn) {
    const { mode, startMessage, successMessage, restoreMenu = true } = cfg;
    const { loadedComponents, restoreMainMenu } = orchCtx;

    updateStatus(startMessage, 'info');

    await teardownFn();

    if (restoreMenu) {
        await restoreMainMenu();
    }

    clearCurrentMode();
    loadedComponents[mode] = false;

    updateStatus(successMessage, 'success');
}
