/**
 * LoadingLifecycle — the start/middle/end ceremony around component loads
 * and unloads. Three exports, all used by `BootUp/loaders/*.js`:
 *
 *   - `withLoadLifecycle(loadFn, name, buttonId, isRunOperation?)` — runs
 *     the loader's actual work surrounded by: button state transitions
 *     (loading → loaded / error), status-line toasts, conditional show/hide
 *     of the loading overlay (skipped when the caller already owns it),
 *     error logging, and a final re-throw so callers can short-circuit.
 *
 *   - `withUnloadLifecycle(unloadFn, name, buttonId)` — symmetric ceremony
 *     for the teardown side; resets the button to default on success.
 *
 *   - `checkAlreadyLoaded(isLoaded, name)` — early-return guard. Toasts
 *     "→ X already loaded!" and returns true when the component is mounted
 *     so loaders can stop without doing the work twice.
 *
 * Renamed from `LoaderWrappers.js`: the file is about lifecycle phases, not
 * about wrapping in the abstract sense. `withLoadWrapper` was a wrapper
 * that wrapped with a wrapper — `withLoadLifecycle` says what's actually
 * being added.
 */

import { showLoadingOverlay, hideLoadingOverlay } from '../../runtime/loadingOverlayState.js';
import { updateStatus } from '../../runtime/statusFeed.js';
import { setButtonState } from '../dom/setButtonState.js';

/**
 * Runs `loadFn` inside the standard load lifecycle (button state, toasts,
 * overlay management, error handling). Re-throws after logging so cascades
 * can short-circuit.
 *
 * @param {() => Promise<void>} loadFn
 * @param {string} componentName
 * @param {string} buttonId
 * @param {boolean} isRunOperation - When true, leaves overlay management to the caller.
 * @returns {Promise<void>}
 */
export async function withLoadLifecycle(loadFn, componentName, buttonId, isRunOperation = false) {
    if (!isRunOperation) {
        showLoadingOverlay();
    }
    setButtonState(buttonId, 'loading');
    updateStatus(`Starting ${componentName} load...`, 'info');

    try {
        await loadFn();
        setButtonState(buttonId, 'loaded');
        updateStatus(`✓ ${componentName} components fully loaded!`, 'success');
    } catch (error) {
        console.error(`Error loading ${componentName}:`, error);
        updateStatus(`✗ Error loading ${componentName}: ${error.message}`, 'error');
        setButtonState(buttonId, 'error');
        throw error;
    } finally {
        if (!isRunOperation) {
            hideLoadingOverlay();
        }
    }
}

/**
 * Runs `unloadFn` inside the standard unload lifecycle. Re-throws after
 * logging so cascade unloads in `unloadGlobeBase` can fail loudly.
 *
 * @param {() => Promise<void>} unloadFn
 * @param {string} componentName
 * @param {string} buttonId
 * @returns {Promise<void>}
 */
export async function withUnloadLifecycle(unloadFn, componentName, buttonId) {
    updateStatus(`Unloading ${componentName}...`, 'info');

    try {
        await unloadFn();
        setButtonState(buttonId, 'default');
        updateStatus(`✓ ${componentName} components unloaded!`, 'success');
    } catch (error) {
        console.error(`Error unloading ${componentName}:`, error);
        updateStatus(`✗ Error unloading ${componentName}: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Returns true (and toasts a status line) when the component is already
 * loaded, so the caller can `return` without doing the work twice.
 *
 * @param {boolean} isLoaded
 * @param {string} componentName
 * @returns {boolean}
 */
export function checkAlreadyLoaded(isLoaded, componentName) {
    if (isLoaded) {
        updateStatus(`→ ${componentName} already loaded!`, 'info');
        return true;
    }
    return false;
}
