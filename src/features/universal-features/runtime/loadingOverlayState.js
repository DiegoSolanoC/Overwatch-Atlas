/**
 * loadingOverlayState — show/hide of the full-screen `#loadingOverlay`
 * plus the run-operation flag that gates re-entrant hides.
 *
 * Why the flag exists: a long mode-entry walks through several stages,
 * each of which may call `hideLoadingOverlay()` after it finishes its own
 * little ceremony. We want the overlay to stay up for the *whole* entry,
 * not flicker between stages — so callers `setRunOperation(true)` at the
 * start, and `hideLoadingOverlay()` becomes a no-op (unless `force: true`)
 * until the outer caller flips the flag back off in its `finally`.
 */

let isRunOperation = false; // Flag to track if we're in a run operation

/**
 * Set the run operation flag
 * @param {boolean} value - True if in a run operation
 */
export function setRunOperation(value) {
    isRunOperation = value;
}

/**
 * Get the run operation flag
 * @returns {boolean} - True if in a run operation
 */
export function getRunOperation() {
    return isRunOperation;
}

/**
 * Show loading overlay
 * Works for both test.html and the timeline app (index.html)
 */
export function showLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        // Force immediate visibility (no transition delay)
        loadingOverlay.style.opacity = '1';
        loadingOverlay.style.visibility = 'visible';
        loadingOverlay.classList.add('active');
        /* Sync layout so the overlay is committed before the next long synchronous task runs. */
        void loadingOverlay.getBoundingClientRect();
        console.log('[Loading Overlay] Showing overlay');
    } else {
        console.warn('[Loading Overlay] Overlay element not found!');
    }
}

/**
 * Hide loading overlay
 * Don't hide overlay if we're in a run operation (let the run function handle it)
 * @param {{ force?: boolean }} [opts] — `force: true` always hides (e.g. Codex mode transition)
 */
export function hideLoadingOverlay(opts = {}) {
    if (!opts.force && isRunOperation) {
        console.log('[Loading Overlay] Skipping hide - run operation in progress');
        return;
    }

    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
        loadingOverlay.style.opacity = '';
        loadingOverlay.style.visibility = '';
        console.log('[Loading Overlay] Hiding overlay');
    }
}
