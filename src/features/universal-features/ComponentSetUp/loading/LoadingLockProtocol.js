/**
 * LoadingLockProtocol — turns a click handler into a "big operation" handler
 * that locks the loading overlay in place for the duration of the work.
 *
 * Some user clicks (the header mode buttons, the main-menu mode tiles)
 * trigger a multi-component load that takes seconds and walks through many
 * sub-loaders. While that's happening we want the loading overlay to stay
 * up the whole time — not flicker on and off as each sub-loader runs its
 * own `withLoadLifecycle` ceremony.
 *
 * The handler returned by `createLoadingLockHandler`:
 *   1. Sets the global `isRunOperation` flag to `true` (sub-loaders see
 *      this and skip their own overlay management).
 *   2. Shows the loading overlay.
 *   3. Awaits the supplied async function.
 *   4. On error: toasts the failure, flips the flag back, hides the overlay.
 *   On success it does NOT clean up here — the wrapped function (typically
 *   `runXComponents`) is responsible for clearing both, so the overlay can
 *   persist across the full multi-step sequence.
 *
 * Used by:
 *   - `BootUp/HeaderModeButtons.js` (header Worldview / Codex / Bios buttons)
 *   - `BootUp/loaders/MenuLoaders.js` (main-menu mode-tile click handlers)
 *
 * Renamed from `EventHandlerWrappers.js`: the old name was a generic plural
 * that didn't match the single-export reality. The new name describes
 * exactly what the protocol enforces — "while this runs, the loading
 * overlay is locked."
 */

import { showLoadingOverlay, hideLoadingOverlay } from '../../runtime/loadingOverlayState.js';
import { updateStatus } from '../../runtime/statusFeed.js';

/**
 * @param {() => Promise<void>} asyncFn - The big operation to run under the lock.
 * @param {(value: boolean) => void} setIsRunOperation - Setter for the global run-operation flag.
 * @returns {() => Promise<void>} A click handler that holds the loading lock for the duration.
 */
export function createLoadingLockHandler(asyncFn, setIsRunOperation) {
    return async function () {
        setIsRunOperation(true);
        showLoadingOverlay();
        try {
            await asyncFn();
        } catch (error) {
            console.error(`Error in ${asyncFn.name}:`, error);
            updateStatus(`✗ Error: ${error.message}`, 'error');
            setIsRunOperation(false);
            hideLoadingOverlay();
        }
    };
}
