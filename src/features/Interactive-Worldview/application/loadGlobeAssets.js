/**
 * loadGlobeAssets — the Worldview heavy-asset loader.
 *
 * Walks the staged sequence Scene → Transport → Controls → Event markers,
 * applies the 3D-vs-2D map preference to the scene model, mounts event
 * markers when the Event System is active, and dispatches the
 * `appmodechange` event so the rest of the app reacts.
 *
 * Progress is driven through the shared
 * `createLoadProgressTracker` from `universal-features/runtime/loadProgressTracker.js`
 * so the bar and the status text stay in lock-step, the same way Codex
 * and Data Archive do it.
 *
 * Called by `ModeOrchestrator.runGlobeComponents` (via `globeModeLifecycle`) in two paths:
 *   - **auto-load** (e.g. header switch into Worldview): the orchestrator
 *     has already shown the loading overlay and set the run-operation
 *     flag. Pass `{ keepRunOperation: true }` so we don't drop the overlay
 *     before the orchestrator's outer `try/finally` does.
 *   - **chooser-hub pick** (manual entry): the chooser hub buttons call us
 *     directly. The orchestrator already exited by then, so we own the
 *     overlay lifecycle ourselves.
 *
 * Lives in `Interactive-Worldview/application/` next to
 * `GlobeBaseHelpers.js` and `requireGlobeBase.js` because this is the
 * mode's own asset-loading workflow — the orchestrator just calls in.
 */

import {
    showLoadingOverlay,
    hideLoadingOverlay,
    setRunOperation
} from '../../Universal-Features/runtime/loadingOverlayState.js';
import { updateStatus } from '../../Universal-Features/runtime/statusFeed.js';
import { createLoadProgressTracker } from '../../Universal-Features/runtime/loadProgressTracker.js';
import { broadcastModeChange } from '../../Universal-Features/ComponentSetUp/mode-lifecycle/broadcastModeChange.js';
import {
    teardownGlobeMapChooserHub,
    syncGlobeMapLaunchLabels
} from '../entry/GlobeMapLaunchChoice.js';
import { isEventSystemLoadOutActive } from '../../system-interface/integration/eventSystemAutoPreload.js';

const STAGE_SETTLE_MS = 300;

/**
 * Declared up-front so the tracker knows the full denominator. The Event
 * markers stage is always declared even when there are no markers to
 * mount, so the bar reaches 100% by skipping it cleanly.
 */
const GLOBE_LOAD_STAGES = Object.freeze([
    { id: 'scene', label: 'Globe scene (WebGL + earth mesh)' },
    { id: 'transport', label: 'Camera transport (orbit + zoom)' },
    { id: 'controls', label: 'View controls + map / globe toggle' },
    { id: 'eventMarkers', label: 'Event markers' }
]);

/**
 * @param {boolean} startOnMap - `true` opens the timeline as 2D map, `false` as 3D globe.
 * @param {object} ctx
 * @param {Record<string, boolean>} ctx.loadedComponents - Orchestrator's loaded-state map.
 * @param {{ globeBase: () => Promise<void>, transport: () => Promise<void>, controls: () => Promise<void> }} ctx.loaders
 * @param {object} [opts]
 * @param {boolean} [opts.keepRunOperation=false] - When `true`, leave the run-operation flag and overlay alone (caller owns them).
 */
export async function loadGlobeAssets(startOnMap, ctx, opts = {}) {
    const keepRunOperation = !!opts.keepRunOperation;
    const runBtn = document.getElementById('runGlobeBtn');
    const { loadedComponents, loaders } = ctx;

    try { localStorage.setItem('mapGlobePreToggle', startOnMap ? 'true' : 'false'); } catch (_) {}
    syncGlobeMapLaunchLabels(startOnMap);

    teardownGlobeMapChooserHub();

    if (!keepRunOperation) {
        setRunOperation(true);
        showLoadingOverlay();
    }

    const progress = createLoadProgressTracker({
        modeLabel: 'Worldview',
        stages: GLOBE_LOAD_STAGES
    });
    progress.start('🚀 Starting Worldview load…');

    const globeContainer = document.getElementById('globe-container');
    if (globeContainer) {
        globeContainer.style.width = '100%';
        globeContainer.style.height = '100%';
        globeContainer.style.display = 'none';
        updateStatus('→ Preparing globe container…', 'info');
    }

    try {
        await runSceneStage(progress, loadedComponents, loaders, globeContainer);
        await runTransportStage(progress, loadedComponents, loaders);
        await runControlsStage(progress, loadedComponents, loaders, startOnMap);
        await runEventMarkersStage(progress);

        progress.finish('✓ Worldview ready');
        broadcastModeChange('globe');
    } catch (error) {
        console.error('Error in Globe Components auto-load:', error);
        progress.fail(error);
    } finally {
        setRunOperation(false);
        hideLoadingOverlay();
        if (runBtn) {
            runBtn.disabled = false;
        }
    }
}

async function runSceneStage(progress, loadedComponents, loaders, globeContainer) {
    const showContainer = () => {
        if (!globeContainer) return;
        globeContainer.style.opacity = '1';
        globeContainer.style.pointerEvents = 'auto';
        globeContainer.style.display = 'block';
        globeContainer.classList.add('loaded');
    };

    if (loadedComponents.globeBase) {
        progress.skipStage('scene', '→ Worldview — globe scene already loaded, skipping…');
        showContainer();
        await sleep(STAGE_SETTLE_MS);
        return;
    }

    await progress.runStage(
        'scene',
        async () => {
            await loaders.globeBase();
            showContainer();
        },
        { beginMessage: '→ Worldview — loading globe scene (WebGL + earth mesh)…' }
    );
    await sleep(STAGE_SETTLE_MS);
}

async function runTransportStage(progress, loadedComponents, loaders) {
    if (loadedComponents.transport) {
        progress.skipStage('transport', '→ Worldview — camera transport already loaded, skipping…');
        await sleep(STAGE_SETTLE_MS);
        return;
    }
    await progress.runStage(
        'transport',
        async () => {
            await loaders.transport();
        },
        { beginMessage: '→ Worldview — loading camera transport (orbit + zoom)…' }
    );
    await sleep(STAGE_SETTLE_MS);
}

async function runControlsStage(progress, loadedComponents, loaders, startOnMap) {
    await progress.runStage(
        'controls',
        async () => {
            if (window.globeController?.sceneModel) {
                if (window.globeController.sceneModel.setMapViewEnabled) {
                    window.globeController.sceneModel.setMapViewEnabled(startOnMap);
                } else {
                    window.globeController.sceneModel.isMapView = startOnMap;
                }
            }
            if (window.globeController && typeof window.globeController.setMapViewEnabled === 'function') {
                window.globeController.setMapViewEnabled(startOnMap);
            }
            await loaders.controls();
            if (window.globeController?.uiView?.setupMapViewToggle) {
                window.globeController.uiView.setupMapViewToggle();
            }
            document.body.classList.add('rotate-subbar-open');
            const rotateSubBar = document.getElementById('headerRotateSubBar');
            if (rotateSubBar) {
                rotateSubBar.style.display = 'block';
                rotateSubBar.style.top = '0';
                rotateSubBar.style.left = '0';
            }
        },
        { beginMessage: '→ Worldview — loading view controls + map / globe toggle…' }
    );
    await sleep(STAGE_SETTLE_MS);
}

async function runEventMarkersStage(progress) {
    const eventSystemActive = isEventSystemLoadOutActive();
    const needsMarkers =
        eventSystemActive
        && !!window.globeController?.sceneModel
        && !window.globeEventMarkerManager;

    console.log(
        `[loadGlobeAssets] Checking marker creation: eventSystemActive=${eventSystemActive}, globeController=${!!window.globeController?.sceneModel}, markerManager=${!!window.globeEventMarkerManager}`
    );

    if (!needsMarkers) {
        progress.skipStage(
            'eventMarkers',
            eventSystemActive
                ? '→ Worldview — event markers already mounted, skipping…'
                : '→ Worldview — Event System inactive, skipping marker stage'
        );
        return;
    }

    console.log('[loadGlobeAssets] Creating EventMarkerManager for Globe...');
    await progress.runStage(
        'eventMarkers',
        async () => {
            const { EventMarkerManager } = await import('../../system-interface/markers/EventMarkerManager.js');
            window.globeEventMarkerManager = new EventMarkerManager(
                window.globeController.sceneModel,
                window.globeController.dataModel
            );
            console.log('[loadGlobeAssets] EventMarkerManager created, adding markers...');
            await window.globeEventMarkerManager.addEventMarkers(true);
            console.log('[loadGlobeAssets] Markers added successfully');
        },
        {
            beginMessage: '→ Worldview — mounting event markers…',
            completeMessage: '✓ Event markers mounted'
        }
    );
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
