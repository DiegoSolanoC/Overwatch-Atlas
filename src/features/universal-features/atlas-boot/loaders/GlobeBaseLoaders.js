/**
 * GlobeBaseLoaders — load/unload pair for the 3D globe foundation.
 *
 * `loadGlobeBase` sets up `#globe-container`, dynamically imports the
 * `GlobeController`, initializes it, and (when not part of a larger run
 * operation) reveals the container. `unloadGlobeBase` stops animations,
 * disposes Three.js resources, hides the container, and cascades the unload
 * down to dependent components (transport toggles, controls, events) unless
 * the caller asks for events UI to be preserved (used by mode swaps that
 * keep the standalone Event System dock alive).
 *
 * Re-entry behavior: calling `loadGlobeBase` while it's already loaded
 * disposes the existing instance via `unloadGlobeBase(...)` and **returns
 * without loading again**. The caller must invoke `loadGlobeBase` a
 * second time to get a fresh instance. The orchestrator's
 * `runGlobeComponents` handles this two-call pattern; direct callers
 * rarely hit it because the orchestrator owns most lifecycle.
 *
 * Overlay quirk: when called outside a run operation, this function
 * manages the loading overlay itself; otherwise it leaves overlay
 * management to the orchestrator that wrapped the call. The `finally`
 * block currently calls `hideLoadingOverlay()` unconditionally — this is
 * asymmetric with the gated `showLoadingOverlay()` and may be load-
 * bearing for some entry paths; do not "fix" without verifying.
 */

import {
    showLoadingOverlay,
    hideLoadingOverlay,
    getRunOperation
} from '../../atlas-mode-runtime/loadingOverlayState.js';
import { updateStatus } from '../../atlas-mode-runtime/statusFeed.js';
import { setButtonState } from '../../atlas-shared-ui/dom/setButtonState.js';
import {
    setupGlobeContainer,
    makeGlobeContainerVisible,
    hideGlobeContainer,
    stopGlobeAnimations,
    disposeThreeJSResources,
    importGlobeController,
    initializeGlobeController,
    removeEventMarkersIfNeeded
} from '../../../Interactive-Worldview/worldview-mode-entry/GlobeBaseHelpers.js';

/**
 * @param {Object} loadedComponents - shared component-state object
 * @param {Object} [unloaders] - sibling unloader functions invoked during cascade
 * @param {(loadedComponents: Object) => Promise<void>} [unloaders.unloadToggles]
 * @param {(loadedComponents: Object) => Promise<void>} [unloaders.unloadControls]
 * @param {(loadedComponents: Object) => Promise<void>} [unloaders.unloadEvents]
 * @param {Object} [options]
 * @param {boolean} [options.preserveEventsUi=false]
 */
export async function unloadGlobeBase(loadedComponents, unloaders = {}, options = {}) {
    const preserveEventsUi = options && options.preserveEventsUi === true;

    if (!loadedComponents.globeBase) {
        updateStatus('Globe base not loaded', 'info');
        return;
    }

    updateStatus('Unloading Globe Base...', 'info');

    try {
        stopGlobeAnimations();

        const container = document.getElementById('globe-container');
        if (container) {
            hideGlobeContainer(container);
        }

        disposeThreeJSResources();

        if (loadedComponents.transport && unloaders.unloadToggles) {
            await unloaders.unloadToggles(loadedComponents);
        }
        if (loadedComponents.controls) {
            if (!preserveEventsUi && unloaders.unloadControls) {
                await unloaders.unloadControls(loadedComponents);
            } else {
                loadedComponents.controls = false;
            }
        }
        if (!preserveEventsUi && loadedComponents.events && unloaders.unloadEvents) {
            await unloaders.unloadEvents(loadedComponents);
        }

        loadedComponents.globeBase = false;
        setButtonState('loadGlobeBaseBtn', 'default');
        updateStatus('✓ Globe base components unloaded!', 'success');
    } catch (error) {
        console.error('Error unloading Globe Base:', error);
        updateStatus(`✗ Error unloading Globe Base: ${error.message}`, 'error');
    }
}

/**
 * Load the 3D globe foundation. If already loaded, this disposes the
 * existing instance first (`unloadGlobeBase`) and **returns without
 * loading again** — the caller is expected to invoke `loadGlobeBase` a
 * second time to get a fresh instance. Most callers go through the
 * orchestrator's `runGlobeComponents`, which handles this re-entry
 * pattern.
 *
 * @param {Object} loadedComponents - shared component-state object
 * @param {Object} [unloaders] - sibling unloader functions used during
 *   the cascade unload that runs when this is invoked while already loaded
 * @param {(loadedComponents: Object) => Promise<void>} [unloaders.unloadToggles]
 * @param {(loadedComponents: Object) => Promise<void>} [unloaders.unloadControls]
 * @param {(loadedComponents: Object) => Promise<void>} [unloaders.unloadEvents]
 */
export async function loadGlobeBase(loadedComponents, unloaders = {}) {
    if (loadedComponents.globeBase) {
        // Dispose-then-bail: caller re-invokes to get a fresh instance.
        // See file header for the implicit-reload behavior.
        await unloadGlobeBase(loadedComponents, unloaders);
        return;
    }

    if (!getRunOperation()) {
        showLoadingOverlay();
    }
    setButtonState('loadGlobeBaseBtn', 'loading');
    updateStatus('Starting Globe Base load...', 'info');

    try {
        const container = document.getElementById('globe-container');
        if (container) {
            setupGlobeContainer(container);
        }

        const GlobeController = await importGlobeController();
        const controller = await initializeGlobeController(GlobeController);

        removeEventMarkersIfNeeded(controller, loadedComponents.events);

        if (!getRunOperation() && container) {
            makeGlobeContainerVisible(container);
        }

        loadedComponents.globeBase = true;
        setButtonState('loadGlobeBaseBtn', 'loaded');
        updateStatus('✓ Globe base components fully loaded!', 'success');
    } catch (error) {
        console.error('Error loading Globe Base:', error);
        updateStatus(`✗ Error loading Globe Base: ${error.message}`, 'error');
        setButtonState('loadGlobeBaseBtn', 'error');
    } finally {
        hideLoadingOverlay();
    }
}
