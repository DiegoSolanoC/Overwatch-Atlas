/**
 * Shared phased load protocol for linear modes (Data Workshop, Story, Gallery,
 * Dialogue Theater, Official Archive).
 *
 * Pairs with `enterMode` in `modeLifecycleCeremony.js`: the ceremony shows the
 * overlay and resets the bar; this module advances stages via
 * `createLoadProgressTracker` before the overlay drops.
 */

import { createLoadProgressTracker } from './loadProgressTracker.js';

const SETTLE_TOTAL_MS = 800;
const SETTLE_STEP_MS = 80;

const SHELL_PREP_STAGE = Object.freeze({
    id: 'shellPrep',
    label: 'Preparing mode shell',
});

const SETTLE_STAGE = Object.freeze({
    id: 'settle',
    label: 'Finalizing layout',
});

/**
 * @param {{ id: string, label: string }} mountStage
 * @returns {ReadonlyArray<{ id: string, label: string }>}
 */
export function buildLinearModeStages(mountStage) {
    return Object.freeze([SHELL_PREP_STAGE, mountStage, SETTLE_STAGE]);
}

/** Yield so the overlay can paint before long synchronous mount work. */
export function yieldForLoadingOverlayPaint() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTimeout(resolve, 48);
            });
        });
    });
}

/**
 * @param {import('./loadProgressTracker.js').LoadProgressTracker} progress
 * @param {{ beginMessage?: string }} [opts]
 */
export async function runLinearModeSettleStage(progress, opts = {}) {
    await progress.runStage(
        'settle',
        async ({ setProgress }) => {
            const steps = Math.max(1, Math.round(SETTLE_TOTAL_MS / SETTLE_STEP_MS));
            for (let i = 1; i <= steps; i += 1) {
                await new Promise((r) => setTimeout(r, SETTLE_STEP_MS));
                setProgress(i / steps);
            }
        },
        opts,
    );
}

/**
 * @param {object} cfg
 * @param {string} cfg.modeLabel
 * @param {string} cfg.mountStageId
 * @param {string} cfg.mountStageLabel   Human fragment for status lines (e.g. "building category hub").
 * @param {string} cfg.startMessage
 * @param {string} cfg.finishMessage
 * @param {() => Promise<void>} cfg.mountFn
 */
export async function runStagedLinearModeLoad(cfg) {
    const { modeLabel, mountStageId, mountStageLabel, startMessage, finishMessage, mountFn } =
        cfg;

    const stages = buildLinearModeStages({
        id: mountStageId,
        label: mountStageLabel,
    });

    const progress = createLoadProgressTracker({ modeLabel, stages });
    progress.start(startMessage);

    await yieldForLoadingOverlayPaint();

    progress.skipStage('shellPrep', `-> ${modeLabel}: preparing shell...`);

    await progress.runStage(
        mountStageId,
        async () => {
            await mountFn();
        },
        { beginMessage: `-> ${modeLabel}: ${mountStageLabel}…` },
    );

    await runLinearModeSettleStage(progress, {
        beginMessage: `-> ${modeLabel}: finalizing layout…`,
    });

    progress.finish(finishMessage);
}
