/**
 * globeLoadProgress — backwards-compat shim over the unified
 * `loadProgressTracker`.
 *
 * The Worldview load originally drove a 4-stage counter directly through
 * `updateGlobeComponentsProgress(stageNumber)`. That stage counter has
 * been replaced with the mode-agnostic tracker in
 * `./loadProgressTracker.js`, which all three modes (Worldview, Codex,
 * Data Archive) now share.
 *
 * These exports stay for any caller that still imports the old names; they
 * just write to the same bar elements the tracker writes to. New code
 * should use `createLoadProgressTracker(...)` instead.
 */

import { resetLoadProgress } from './loadProgressTracker.js';

const TOTAL_STAGES = 4;

const PROGRESS_BAR_IDS = [
    'loadingProgressBar',
    'globeInlineLoadingProgressBar',
    'codexEntryInlineLoadingProgressBar'
];

function applyProgressWidth(percentage) {
    const pct = Math.max(0, Math.min(100, percentage));
    for (const id of PROGRESS_BAR_IDS) {
        const el = document.getElementById(id);
        if (el) el.style.width = `${pct}%`;
    }
}

/**
 * @deprecated Use `createLoadProgressTracker` from `./loadProgressTracker.js`.
 * @param {number} completed Stage number that just finished (1..4).
 */
export function updateGlobeComponentsProgress(completed) {
    applyProgressWidth((completed / TOTAL_STAGES) * 100);
}

/**
 * @deprecated Use `resetLoadProgress` from `./loadProgressTracker.js`.
 */
export function resetGlobeComponentsProgress() {
    resetLoadProgress();
}
