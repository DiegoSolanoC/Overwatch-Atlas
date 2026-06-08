/**
 * Legacy stage panel (targeted selection, packet/info toggles) — retired in favor of
 * dock toggles + timeline filters. Keeps sync helpers for any stale DOM cleanup.
 */

import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';

function removeCodexStageControlsPanel() {
    const host = s.codexStageControlsEl || s.root?.querySelector('.codex-stage-controls');
    if (host) {
        host.remove();
    }
    s.codexStageControlsEl = null;
}

function syncCodexStageControlInputs() {
    /* Dock toggles own packet + info state; no stage panel inputs to sync. */
}

function ensureCodexStageControls() {
    removeCodexStageControlsPanel();
}

export function teardownCodexStageControls() {
    removeCodexStageControlsPanel();
}

api.ensureCodexStageControls = ensureCodexStageControls;
api.syncCodexStageControlInputs = syncCodexStageControlInputs;
api.teardownCodexStageControls = teardownCodexStageControls;
