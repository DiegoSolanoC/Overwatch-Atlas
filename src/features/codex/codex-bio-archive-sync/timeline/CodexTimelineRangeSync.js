/**
 * Portrait dimming from entry lifetime ranges; cord/page gating stays separate.
 */

import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { refreshCodexTimelineGatePageActive } from './codexBioConnectionDockTimeline.js';
import { syncCodexTimelineRangeCordDom, syncCodexFilterCordDom, resetCodexFilterCordSyncSignature } from '../../codex-nodes/filters/CodexFilterCordSync.js';
import { codexFiltersActive } from '../../codex-nodes/filters/CodexNodeFilterMatch.js';
import { redrawCodexEdges } from '../../codex-node-drawing/redraw/CodexEdgeRedraw.js';
import {
    applyCodexEntryLifetimeNodeClassesNow,
    resetCodexEntryLifetimeVisualState,
} from './CodexEntryLifetimeSync.js';
import { applyCodexFactionPortraitLooksNow, resetCodexFactionPortraitLookState } from './CodexFactionPortraitLookSync.js';

/** @type {number} */
let timelineVisualRefreshRaf = 0;

function applyCodexTimelineRangeVisualRefreshNow() {
    if (!s.root) return;
    refreshCodexTimelineGatePageActive(s.codexAllNodes, s.codexEdges);
    s.codexTimelineRangeInactiveNodeIds = new Set();
    for (const nodeEl of s.codexNodeElements.values()) {
        nodeEl.classList.remove('codex-node--timeline-range-inactive');
    }
    applyCodexEntryLifetimeNodeClassesNow();
    applyCodexFactionPortraitLooksNow();
    if (codexFiltersActive()) {
        resetCodexFilterCordSyncSignature();
        if (!syncCodexFilterCordDom()) {
            redrawCodexEdges({ force: true });
        }
        return;
    }
    if (!syncCodexTimelineRangeCordDom()) {
        redrawCodexEdges({ force: true });
    }
}

export function applyCodexTimelineRangeNodeClasses() {
    if (!s.root) return;
    if (timelineVisualRefreshRaf) cancelAnimationFrame(timelineVisualRefreshRaf);
    timelineVisualRefreshRaf = requestAnimationFrame(() => {
        timelineVisualRefreshRaf = 0;
        applyCodexEntryLifetimeNodeClassesNow();
        applyCodexFactionPortraitLooksNow();
    });
}

export function applyCodexTimelineRangeVisualRefresh() {
    if (!s.root) return;
    if (timelineVisualRefreshRaf) cancelAnimationFrame(timelineVisualRefreshRaf);
    timelineVisualRefreshRaf = requestAnimationFrame(() => {
        timelineVisualRefreshRaf = 0;
        applyCodexTimelineRangeVisualRefreshNow();
    });
}

export function resetCodexTimelineRangeVisualState() {
    resetCodexEntryLifetimeVisualState();
    resetCodexFactionPortraitLookState();
}

api.applyCodexTimelineRangeVisualRefresh = applyCodexTimelineRangeVisualRefresh;
api.applyCodexTimelineRangeNodeClasses = applyCodexTimelineRangeNodeClasses;
