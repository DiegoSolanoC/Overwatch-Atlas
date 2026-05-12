/**
 * globeModeLifecycle — `runGlobeMode` / `killGlobeMode` for Worldview.
 *
 * Worldview's mode lifecycle does NOT use the shared `enterMode` /
 * `exitMode` ceremony in `runtime/modeLifecycleCeremony.js`. Two reasons:
 *
 *   1. Manual entry paints the 3D-Globe / 2D-Map chooser hub, then EXITS
 *      early — the overlay drops, the hub stays interactive, and the
 *      actual asset load only fires when the user picks a tile (via
 *      `loadGlobeAssets`). The linear modes don't have that branch.
 *   2. Exit walks a 4-stage layered unload (Events → Controls → Transport
 *      → Globe Base) with an Event-System guard that preserves the events
 *      UI when the user has Event System Load Out enabled. The linear
 *      modes have a single teardown function instead.
 *
 * Both functions take an orchestrator context object so they can read the
 * shared `loadedComponents` flag bag and call into `loaders` / `unloaders`
 * / `killers` / `restoreMainMenu`. The `ModeOrchestrator` keeps thin
 * wrapper methods that just forward to these.
 */

import { showLoadingOverlay, hideLoadingOverlay, setRunOperation, getRunOperation } from '../../universal-features/runtime/loadingOverlayState.js';
import { updateStatus } from '../../universal-features/runtime/statusFeed.js';
import { resetLoadProgress } from '../../universal-features/runtime/loadProgressTracker.js';
import { setCurrentMode, clearCurrentMode } from '../../universal-features/ComponentSetUp/mode-lifecycle/CurrentModeStatus.js';
import { hideMenuContainer } from '../../universal-features/MainMenu/MenuContainer.js';
import { killOtherModes } from '../../universal-features/ComponentSetUp/mode-lifecycle/ModeMutualExclusion.js';
import { isEventSystemLoadOutActive } from '../../system-interface/integration/eventSystemAutoPreload.js';
import { playModeSwitchSound } from '../../universal-features/Audio/SoundEffects/playModeSwitchSound.js';
import { mountGlobeMapChooserHub } from '../entry/GlobeMapLaunchChoice.js';
import { loadGlobeAssets } from './loadGlobeAssets.js';

/**
 * @typedef {object} GlobeModeContext
 * @property {Record<string, boolean>} loadedComponents
 * @property {Record<string, (...args: any[]) => Promise<void>>} loaders
 * @property {Record<string, (...args: any[]) => Promise<void>>} unloaders
 * @property {Record<string, () => Promise<void>>} killers
 * @property {(preserveNewsTicker?: boolean) => Promise<void>} restoreMainMenu
 */

/**
 * Enter Worldview mode and present the 3D-Globe / 2D-Map chooser hub.
 *
 * `isAutoLoad === true` skips the hub and uses the persisted
 * `mapGlobePreToggle` preference (used by header switches and other
 * automated flows where the user has already chosen).
 *
 * @param {GlobeModeContext} ctx
 * @param {boolean} [isAutoLoad=false]
 */
export async function runGlobeMode(ctx, isAutoLoad = false) {
    const { loadedComponents, loaders, killers, restoreMainMenu } = ctx;

    playModeSwitchSound(isAutoLoad);

    if (window.standaloneEventSlide?.hideEventSlide) {
        window.standaloneEventSlide.hideEventSlide();
    }

    await killOtherModes({
        targetMode: 'globe',
        loadedComponents,
        killers
    });

    setCurrentMode('globe');

    const runBtn = document.getElementById('runGlobeBtn');
    if (runBtn) {
        runBtn.disabled = true;
    }

    resetLoadProgress();
    hideMenuContainer();

    const assetsCtx = { loadedComponents, loaders };

    if (isAutoLoad) {
        const startOnMap = localStorage.getItem('mapGlobePreToggle') === 'true';
        await loadGlobeAssets(startOnMap, assetsCtx, { keepRunOperation: true });
        return;
    }

    if (!getRunOperation()) {
        setRunOperation(true);
        showLoadingOverlay();
    }

    try {
        mountGlobeMapChooserHub({
            onPick: (startOnMap) => {
                void loadGlobeAssets(startOnMap, assetsCtx);
            },
            onCancel: () => {
                if (runBtn) runBtn.disabled = false;
                clearCurrentMode();
                void restoreMainMenu();
            }
        });
        updateStatus('✓ Worldview — choose a view', 'success');
    } catch (error) {
        console.error('Error mounting Worldview chooser:', error);
        updateStatus(`✗ Error in Worldview chooser: ${error.message}`, 'error');
    } finally {
        setRunOperation(false);
        hideLoadingOverlay();
    }
}

/**
 * Exit Worldview mode. Walks the 4-stage layered unload (Events →
 * Controls → Transport → Globe Base) with an Event-System guard that
 * preserves the events UI when Event System Load Out is active, then
 * restores the main menu (preserving the news ticker so a switch to
 * another mode doesn't reset it).
 *
 * @param {GlobeModeContext} ctx
 */
export async function killGlobeMode(ctx) {
    const { loadedComponents, unloaders, restoreMainMenu } = ctx;

    updateStatus('Killing all Globe Components...', 'info');

    const eventSystemActive = isEventSystemLoadOutActive();

    if (loadedComponents.events && !eventSystemActive) {
        await unloaders.events();
    } else if (eventSystemActive) {
        updateStatus('→ Event System active, preserving events UI', 'info');
    }

    if (loadedComponents.controls) {
        await unloaders.controls();
    }

    if (loadedComponents.transport) {
        await unloaders.transport();
    }

    if (loadedComponents.globeBase) {
        if (unloaders.globeBase && typeof unloaders.globeBase === 'function') {
            await unloaders.globeBase({ preserveEventsUi: eventSystemActive });
        }
    }

    // Preserve news ticker — switch to another mode shouldn't reset it.
    await restoreMainMenu(true);

    // Force markers to be recreated on next reload.
    window.globeEventMarkerManager = null;

    clearCurrentMode();

    updateStatus('✓ All Globe Components killed!', 'success');
}
