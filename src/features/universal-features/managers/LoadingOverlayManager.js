/**
 * LoadingOverlayManager - Handles loading overlay show/hide functionality
 * Extracted from component-loader.js to improve maintainability
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
