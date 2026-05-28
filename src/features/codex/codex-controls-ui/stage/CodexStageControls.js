/**
 * Top-right Codex toggles — view + dev (packet animation, break nodes & cord angles).
 */

import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import {
    CODEX_DEBUG_UI_PREF_KEY,
    CODEX_PACKET_ANIM_PREF_KEY,
} from '../../codex-canvas/core/canvasConstants.js';
import { redrawCodexEdges } from '../../codex-node-drawing/redraw/CodexEdgeRedraw.js';
import { applyCodexCordPacketAnimPref } from '../../codex-node-drawing/packets/CodexCordPacketAnimation.js';
import {
    mountCodexStageTargetedSelectionUi,
    resetCodexStageTargetedSelectionDraft,
    syncCodexStageTargetedSelectionDraftFromSession,
    syncCodexStageTargetedSelectionModeUi
} from './CodexStageTargetedSelectionUi.js';

function removeLegacyJunctionPrefFromToolbar() {
    s.codexToolbarEl?.querySelector('.codex-toolbar__row--junction-pref')?.remove();
}

function syncCodexStageControlInputs() {
    const host = s.codexStageControlsEl;
    if (!host) return;
    const packetCb = host.querySelector('.codex-stage-controls__packet-toggle');
    const breakCb = host.querySelector('.codex-stage-controls__break-toggle');
    if (packetCb) packetCb.checked = s.codexPacketAnimEnabled;
    if (breakCb) breakCb.checked = s.codexDebugUiVisible;
}

function ensureCodexStageControls() {
    if (!s.root) return;
    removeLegacyJunctionPrefFromToolbar();

    let host = s.codexStageControlsEl;
    if (!host || !s.root.contains(host)) {
        host = document.createElement('div');
        host.className = 'codex-stage-controls';
        host.setAttribute('aria-label', 'Codex display options');

        const packetLbl = document.createElement('label');
        packetLbl.className = 'codex-stage-controls__label';
        const packetCb = document.createElement('input');
        packetCb.type = 'checkbox';
        packetCb.className = 'codex-stage-controls__packet-toggle';
        packetCb.title = 'Animate lights along cords (turn off to improve performance while editing)';
        packetCb.addEventListener('change', () => {
            s.codexPacketAnimEnabled = !!packetCb.checked;
            api.persistCodexPacketAnimPref();
            applyCodexCordPacketAnimPref();
            redrawCodexEdges();
        });
        const packetSpan = document.createElement('span');
        packetSpan.textContent = 'Cord packets';
        packetLbl.append(packetCb, packetSpan);

        const breakLbl = document.createElement('label');
        breakLbl.className = 'codex-stage-controls__label';
        const breakCb = document.createElement('input');
        breakCb.type = 'checkbox';
        breakCb.className = 'codex-stage-controls__break-toggle';
        breakCb.title =
            'Show break (junction) nodes, Break in the add-node picker, cord angle labels, and node coordinates';
        breakCb.addEventListener('change', () => {
            s.codexDebugUiVisible = !!breakCb.checked;
            api.persistCodexDebugUiPref();
            api.syncCodexDebugUiClass();
            redrawCodexEdges();
        });
        const breakSpan = document.createElement('span');
        breakSpan.textContent = 'Break nodes & angles';
        breakLbl.append(breakCb, breakSpan);

        host.append(packetLbl, breakLbl);
        mountCodexStageTargetedSelectionUi(host);
        s.root.appendChild(host);
        s.codexStageControlsEl = host;
    } else if (!host.querySelector('.codex-stage-controls__target')) {
        mountCodexStageTargetedSelectionUi(host);
    } else {
        syncCodexStageTargetedSelectionModeUi(host);
    }

    syncCodexStageControlInputs();
    syncCodexStageTargetedSelectionDraftFromSession(host);
}

export function teardownCodexStageControls() {
    resetCodexStageTargetedSelectionDraft();
}

api.ensureCodexStageControls = ensureCodexStageControls;
api.syncCodexStageControlInputs = syncCodexStageControlInputs;
