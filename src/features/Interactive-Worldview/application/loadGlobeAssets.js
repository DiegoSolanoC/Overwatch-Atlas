/**
 * loadGlobeAssets — the Worldview heavy-asset loader.
 *
 * Walks the staged sequence Globe Base → Transport → Controls, applies the
 * 3D-vs-2D map preference to the scene model, mounts event markers when the
 * Event System is active, and dispatches the `appmodechange` event so the
 * rest of the app reacts.
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
} from '../../universal-features/runtime/loadingOverlayState.js';
import { updateStatus } from '../../universal-features/runtime/statusFeed.js';
import { updateGlobeComponentsProgress } from '../../universal-features/runtime/globeLoadProgress.js';
import { broadcastModeChange } from '../../universal-features/ComponentSetUp/mode-lifecycle/broadcastModeChange.js';
import {
    teardownGlobeMapChooserHub,
    syncGlobeMapLaunchLabels
} from '../entry/GlobeMapLaunchChoice.js';
import { isEventSystemLoadOutActive } from '../../system-interface/integration/eventSystemAutoPreload.js';

const STAGE_SETTLE_MS = 300;

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

    const globeContainer = document.getElementById('globe-container');
    if (globeContainer) {
        globeContainer.style.width = '100%';
        globeContainer.style.height = '100%';
        globeContainer.style.display = 'none';
        updateStatus('→ Preparing globe container...', 'info');
    }

    updateStatus('🚀 Starting Globe Components auto-load...', 'info');

    try {
        await loadGlobeBaseStage(loadedComponents, loaders, globeContainer);
        await loadTransportStage(loadedComponents, loaders);
        await loadControlsStage(loadedComponents, loaders, startOnMap);
        await mountEventMarkersIfNeeded();

        broadcastModeChange('globe');
    } catch (error) {
        console.error('Error in Globe Components auto-load:', error);
        updateStatus(`✗ Error in Globe Components auto-load: ${error.message}`, 'error');
    } finally {
        setRunOperation(false);
        hideLoadingOverlay();
        if (runBtn) {
            runBtn.disabled = false;
        }
    }
}

async function loadGlobeBaseStage(loadedComponents, loaders, globeContainer) {
    const showContainer = () => {
        if (!globeContainer) return;
        globeContainer.style.opacity = '1';
        globeContainer.style.pointerEvents = 'auto';
        globeContainer.style.display = 'block';
        globeContainer.classList.add('loaded');
    };

    if (!loadedComponents.globeBase) {
        updateStatus('→ Loading Globe Base...', 'info');
        await loaders.globeBase();
        showContainer();
        updateGlobeComponentsProgress(1);
        await new Promise(r => setTimeout(r, STAGE_SETTLE_MS));
        return;
    }
    updateStatus('→ Globe Base already loaded, skipping...', 'info');
    showContainer();
    updateGlobeComponentsProgress(1);
}

async function loadTransportStage(loadedComponents, loaders) {
    if (!loadedComponents.transport) {
        updateStatus('→ Loading Transport...', 'info');
        await loaders.transport();
        updateGlobeComponentsProgress(2);
        await new Promise(r => setTimeout(r, STAGE_SETTLE_MS));
        return;
    }
    updateStatus('→ Transport already loaded, skipping...', 'info');
    updateGlobeComponentsProgress(2);
}

async function loadControlsStage(loadedComponents, loaders, startOnMap) {
    updateStatus('→ Loading Controls...', 'info');
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
    updateGlobeComponentsProgress(3);
    await new Promise(r => setTimeout(r, STAGE_SETTLE_MS));
}

async function mountEventMarkersIfNeeded() {
    const eventSystemActive = isEventSystemLoadOutActive();
    console.log(
        `[loadGlobeAssets] Checking marker creation: eventSystemActive=${eventSystemActive}, globeController=${!!window.globeController?.sceneModel}, markerManager=${!!window.globeEventMarkerManager}`
    );
    if (!(eventSystemActive && window.globeController?.sceneModel && !window.globeEventMarkerManager)) {
        console.log('[loadGlobeAssets] Skipping marker creation');
        return;
    }

    console.log('[loadGlobeAssets] Creating EventMarkerManager for Globe...');
    updateStatus('→ Event System detected, creating event markers...', 'info');
    const { EventMarkerManager } = await import('../../system-interface/markers/EventMarkerManager.js');
    window.globeEventMarkerManager = new EventMarkerManager(
        window.globeController.sceneModel,
        window.globeController.dataModel
    );
    console.log('[loadGlobeAssets] EventMarkerManager created, adding markers...');
    await window.globeEventMarkerManager.addEventMarkers(true);
    console.log('[loadGlobeAssets] Markers added successfully');
    updateStatus('✓ Event markers added to Globe', 'success');
}
