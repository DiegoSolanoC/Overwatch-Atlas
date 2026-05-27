/**
 * loadProgressTracker — shared, mode-agnostic load-progress system.
 *
 * Every mode (Worldview / Codex / Data Archive) declares its own stage
 * list and drives the same tracker. The tracker keeps the loading bar
 * (`#loadingProgressBar` and any visible inline bars) in lock-step with
 * the status text from `statusFeed.updateStatus`, so the percentage the
 * user sees is always tied to a declared stage label.
 *
 * Stage list shape:
 *   [{ id, label, weight? }, ...]
 *
 * Percent = (sum(weights of completed stages) + currentStage.weight * subProgress) / sum(weights) * 100
 *
 * This replaces the Worldview-specific `globeLoadProgress.js` 4-stage
 * counter. Callers can use the high-level `runStage(id, fn)` helper or
 * drive `beginStage` / `setStageProgress` / `completeStage` by hand for
 * fine-grained control.
 */

import { updateStatus } from './statusFeed.js';

/**
 * DOM ids of every progress bar in the app. The tracker writes to every
 * one that is currently mounted, so inline overlays (`#globeInlineLoadingProgressBar`,
 * `#codexEntryInlineLoadingProgressBar`) stay in sync without their owners
 * having to wire anything extra.
 */
const PROGRESS_BAR_IDS = Object.freeze([
    'loadingProgressBar',
    'globeInlineLoadingProgressBar',
    'codexEntryInlineLoadingProgressBar'
]);

function clamp01(n) {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

function writeProgressBarWidth(percent) {
    const pct = Math.max(0, Math.min(100, percent));
    for (const id of PROGRESS_BAR_IDS) {
        const el = document.getElementById(id);
        if (el) el.style.width = `${pct}%`;
    }
}

/** Force every progress bar to 0%. Call when a new mode entry begins. */
export function resetLoadProgress() {
    writeProgressBarWidth(0);
}

/**
 * @typedef {object} LoadProgressStageSpec
 * @property {string} id      Unique id used by `beginStage` / `completeStage` / `runStage`.
 * @property {string} label   Human-readable line shown via `updateStatus` when the stage begins.
 * @property {number} [weight=1]  Relative weight of this stage in the overall bar. Default 1.
 */

/**
 * @typedef {object} LoadProgressTracker
 * @property {() => number} percent                                Current bar percentage (0..100).
 * @property {() => LoadProgressStageSpec[]} stages                Snapshot of declared stages.
 * @property {(message?: string) => void} start                    Reset bar to 0 + optional intro status line.
 * @property {(idOrIdx: string|number, message?: string) => void} beginStage
 *   Mark a stage as in-progress; bar reflects prior completed weight.
 * @property {(fraction: number) => void} setStageProgress
 *   Set sub-progress (0..1) of the current stage; updates the bar.
 * @property {(idOrIdx?: string|number, message?: string) => void} completeStage
 *   Mark a stage as done; bar reflects its full weight.
 * @property {(idOrIdx: string|number, message?: string) => void} skipStage
 *   Mark a stage as done without doing work (e.g. already loaded).
 * @property {(idOrIdx: string|number, fn: (api: { setProgress: (n:number)=>void }) => Promise<any>, opts?: { beginMessage?: string, completeMessage?: string }) => Promise<any>} runStage
 *   Convenience: begin → await fn → complete (or fail).
 * @property {(error: Error|string|null|undefined) => void} fail   Emit an error status line.
 * @property {(message?: string) => void} finish                   Fill bar to 100% + optional success line.
 * @property {() => void} reset                                    Same as `start` but without a status line.
 */

/**
 * Create a tracker bound to a fixed list of stages.
 *
 * @param {object} opts
 * @param {string} [opts.modeLabel]      Prefix used when the tracker auto-renders the default per-stage status line. e.g. "Worldview".
 * @param {LoadProgressStageSpec[]} opts.stages
 * @returns {LoadProgressTracker}
 */
export function createLoadProgressTracker({ modeLabel, stages } = {}) {
    const stageList = (Array.isArray(stages) ? stages : []).map((s, i) => ({
        id: s && typeof s.id === 'string' ? s.id : `stage_${i}`,
        label: s && typeof s.label === 'string' ? s.label : `Stage ${i + 1}`,
        weight: s && Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 1
    }));
    const totalWeight = stageList.reduce((acc, s) => acc + s.weight, 0) || 1;

    /** @type {Set<string>} ids of stages that have been marked complete (or skipped). */
    const completed = new Set();
    /** Index into `stageList` of the stage currently in progress, or `-1` when none. */
    let currentIdx = -1;
    /** Sub-progress (0..1) within the stage at `currentIdx`. */
    let subProgress = 0;

    function resolveStageIdx(idOrIdx) {
        if (typeof idOrIdx === 'number') {
            return idOrIdx >= 0 && idOrIdx < stageList.length ? idOrIdx : -1;
        }
        if (typeof idOrIdx === 'string') {
            return stageList.findIndex((s) => s.id === idOrIdx);
        }
        return -1;
    }

    function computePercent() {
        let acc = 0;
        for (const s of stageList) {
            if (completed.has(s.id)) acc += s.weight;
        }
        if (currentIdx >= 0) {
            const cur = stageList[currentIdx];
            if (cur && !completed.has(cur.id)) {
                acc += cur.weight * clamp01(subProgress);
            }
        }
        return (acc / totalWeight) * 100;
    }

    function commitBar() {
        writeProgressBarWidth(computePercent());
    }

    function defaultStageLine(stage) {
        const body = `Loading ${stage.label.replace(/^Loading\s+/i, '')}…`;
        return modeLabel ? `→ ${modeLabel} — ${body}` : `→ ${body}`;
    }

    function clearState() {
        completed.clear();
        currentIdx = -1;
        subProgress = 0;
    }

    return {
        percent() { return computePercent(); },
        stages() { return stageList.map((s) => ({ ...s })); },

        start(message) {
            clearState();
            writeProgressBarWidth(0);
            if (typeof message === 'string' && message.length > 0) {
                updateStatus(message, 'info');
            }
        },

        beginStage(idOrIdx, message) {
            const idx = resolveStageIdx(idOrIdx);
            if (idx < 0) return;
            const stage = stageList[idx];
            currentIdx = idx;
            subProgress = 0;
            updateStatus(
                typeof message === 'string' && message.length > 0 ? message : defaultStageLine(stage),
                'info'
            );
            commitBar();
        },

        setStageProgress(fraction) {
            if (currentIdx < 0) return;
            subProgress = clamp01(fraction);
            commitBar();
        },

        completeStage(idOrIdx, message) {
            const target = (typeof idOrIdx === 'undefined' || idOrIdx === null)
                ? currentIdx
                : resolveStageIdx(idOrIdx);
            if (target < 0) return;
            const stage = stageList[target];
            completed.add(stage.id);
            if (currentIdx === target) {
                currentIdx = -1;
                subProgress = 0;
            }
            if (typeof message === 'string' && message.length > 0) {
                updateStatus(message, 'info');
            }
            commitBar();
        },

        skipStage(idOrIdx, message) {
            const idx = resolveStageIdx(idOrIdx);
            if (idx < 0) return;
            const stage = stageList[idx];
            completed.add(stage.id);
            if (currentIdx === idx) {
                currentIdx = -1;
                subProgress = 0;
            }
            if (typeof message === 'string' && message.length > 0) {
                updateStatus(message, 'info');
            }
            commitBar();
        },

        async runStage(idOrIdx, fn, opts = {}) {
            const idx = resolveStageIdx(idOrIdx);
            if (idx < 0) {
                return typeof fn === 'function' ? fn({ setProgress: () => {} }) : undefined;
            }
            this.beginStage(idx, opts && opts.beginMessage);
            try {
                const result = typeof fn === 'function'
                    ? await fn({ setProgress: (n) => this.setStageProgress(n) })
                    : undefined;
                this.completeStage(idx, opts && opts.completeMessage);
                return result;
            } catch (err) {
                this.fail(err);
                throw err;
            }
        },

        fail(error) {
            const msg = error && typeof error === 'object' && 'message' in error
                ? `✗ ${error.message}`
                : (typeof error === 'string' && error.length > 0 ? `✗ ${error}` : '✗ Load failed');
            updateStatus(msg, 'error');
        },

        finish(message) {
            for (const s of stageList) completed.add(s.id);
            currentIdx = -1;
            subProgress = 0;
            writeProgressBarWidth(100);
            if (typeof message === 'string' && message.length > 0) {
                updateStatus(message, 'success');
            }
        },

        reset() {
            clearState();
            writeProgressBarWidth(0);
        }
    };
}
