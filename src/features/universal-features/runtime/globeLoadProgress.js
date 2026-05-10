/**
 * globeLoadProgress — drives the loading-bar fill that sits on top of the
 * loading overlay during a Worldview boot.
 *
 * The Globe load is a 4-stage walk: Globe Base → Transport → Controls →
 * Events. After each stage finishes, `loadGlobeAssets` (or whoever is
 * driving the load) calls `updateGlobeComponentsProgress(stageNumber)`
 * and the bar grows another 25%. `resetGlobeComponentsProgress()` zeroes
 * it before a new run begins.
 *
 * Why a separate file: this used to live in `statusFeed.js`, but the
 * progress bar is its own concern (stage counter + DOM bar fill) that has
 * nothing to do with the status-text feed. Splitting follows the
 * "one focused job per file" pattern of the rest of `runtime/`.
 */

const TOTAL_STAGES = 4; // Globe Base, Transport, Controls, Events

function applyGlobeProgressWidth(percentage) {
    const mainBar = document.getElementById('loadingProgressBar');
    if (mainBar) mainBar.style.width = `${percentage}%`;
    const inlineBar = document.getElementById('globeInlineLoadingProgressBar');
    if (inlineBar) inlineBar.style.width = `${percentage}%`;
}

/**
 * @param {number} completed - Stage number that just finished (1..TOTAL_STAGES).
 */
export function updateGlobeComponentsProgress(completed) {
    applyGlobeProgressWidth((completed / TOTAL_STAGES) * 100);
}

export function resetGlobeComponentsProgress() {
    applyGlobeProgressWidth(0);
}
