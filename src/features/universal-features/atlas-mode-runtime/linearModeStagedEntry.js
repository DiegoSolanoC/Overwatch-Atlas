/**
 * Shared phased load protocol for linear modes (Data Workshop, Story, Gallery,
 * Dialogue Theater, Official Archive).
 *
 * Pairs with `enterMode` in `modeLifecycleCeremony.js`: the ceremony shows the
 * overlay and resets the bar; this module advances stages via
 * `createLoadProgressTracker` before the overlay drops.
 */

import { createLoadProgressTracker } from './loadProgressTracker.js';

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
            requestAnimationFrame(resolve);
        });
    });
}

/**
 * One paint tick — no artificial 800ms “settle” tax on every mode open.
 * @param {import('./loadProgressTracker.js').LoadProgressTracker} progress
 * @param {{ beginMessage?: string }} [opts]
 */
export async function runLinearModeSettleStage(progress, opts = {}) {
    await progress.runStage(
        'settle',
        async ({ setProgress }) => {
            setProgress(0.5);
            await new Promise((r) => requestAnimationFrame(r));
            setProgress(1);
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
