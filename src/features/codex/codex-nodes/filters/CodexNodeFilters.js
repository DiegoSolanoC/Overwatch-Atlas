/** CodexNodeFilters — Codex canvas slice. */

import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import {
    exposeApplyCodexFilterState,
    getFactionMatchHelpers,
    getStoryFilterPlacesSync,
} from '../../codex-canvas/bridge/CodexAppBridge.js';
import { resetCodexFilterCordSyncSignature, syncCodexFilterCordDom } from './CodexFilterCordSync.js';
import { redrawCodexEdges } from '../../codex-node-drawing/redraw/CodexEdgeRedraw.js';
import { isCodexLinkFiltersEnabled } from '../../codex-controls-ui/stage/CodexDockToggles.js';
import {
    codexFiltersActive,
    codexNodeElMatchesActiveFilters,
    getCodexFilterDerivedState,
    invalidateCodexFilterDerivedCache,
} from './CodexNodeFilterMatch.js';

/** @type {number} */
let filterStateApplyRaf = 0;

function codexNodeMatchesFilters(nodeEl) {
    return codexNodeElMatchesActiveFilters(nodeEl);
}

function rebuildCodexFilterDerivedSets() {
    if (!codexFiltersActive()) {
        s.codexFilterReachableNodeIds = null;
        s.codexFilterConnectionEndpointNodeIds = null;
        s.codexFilterLinkedEdgePairKeys = null;
        s.codexFilterActiveEdgePairKeys = null;
        return;
    }

    const linkOn = isCodexLinkFiltersEnabled();
    const state = getCodexFilterDerivedState(s.codexAllNodes, s.codexEdges, linkOn);
    s.codexFilterReachableNodeIds = state.reachableNodeIds;
    s.codexFilterLinkedEdgePairKeys = state.linkedEdgePairKeys;
    s.codexFilterActiveEdgePairKeys = state.activeEdgePairKeys;
    s.codexFilterConnectionEndpointNodeIds = state.connectionEndpointNodeIds;
}

function nodeIsFilterConnected(nodeId) {
    if (!nodeId) return false;
    if (isCodexLinkFiltersEnabled() && s.codexFilterLinkedEdgePairKeys?.size) {
        return false;
    }
    return !!(s.codexFilterConnectionEndpointNodeIds?.has(nodeId));
}

/**
 * @param {HTMLElement} nodeEl
 */
function applyCodexNodeFilterClassesToEl(nodeEl) {
    if (!nodeEl) return;

    nodeEl.classList.remove(
        'codex-node--filter-match',
        'codex-node--filtered-out',
        'codex-node--filter-connected',
    );

    if (!codexFiltersActive()) return;

    const kind = String(nodeEl.dataset.codexKind || '');
    if (kind === 'junction') return;

    const nodeId = String(nodeEl.dataset.codexNodeId || '');

    if (codexNodeMatchesFilters(nodeEl)) {
        nodeEl.classList.add('codex-node--filter-match');
        return;
    }

    if (nodeIsFilterConnected(nodeId)) {
        nodeEl.classList.add('codex-node--filter-connected');
        return;
    }

    nodeEl.classList.add('codex-node--filtered-out');
}

function applyCodexFilterStateNow() {
    if (!s.root) return;

    if (!codexFiltersActive()) {
        resetCodexFilterCordSyncSignature();
    }

    rebuildCodexFilterDerivedSets();

    const linkOn = isCodexLinkFiltersEnabled() && !!(s.codexFilterLinkedEdgePairKeys?.size);
    s.root.classList.toggle('codex--filter-linking-active', linkOn && codexFiltersActive());

    s.root.querySelectorAll('.codex-node').forEach((nodeEl) => {
        applyCodexNodeFilterClassesToEl(nodeEl);
    });

    if (!codexFiltersActive()) {
        s.root.classList.remove('codex--filter-linking-active');
        const skipRedundantOpenRedraw = s.codexMode === 'view' && s.codexViewModeInitialRenderDone;
        if (!skipRedundantOpenRedraw) {
            redrawCodexEdges({ force: true });
        }
        return;
    }

    if (!syncCodexFilterCordDom()) {
        redrawCodexEdges({ force: true });
    }
}

function applyCodexFilterState() {
    if (!s.root) return;
    if (filterStateApplyRaf) {
        cancelAnimationFrame(filterStateApplyRaf);
    }
    filterStateApplyRaf = requestAnimationFrame(() => {
        filterStateApplyRaf = 0;
        applyCodexFilterStateNow();
    });
}

function applyCodexEventThumbnailFilterHover(event, displayEvent) {
    const codexRoot = s.root || document.getElementById('codex-view-root');
    if (!codexRoot || !event) return;
    clearCodexEventThumbnailFilterHover();
    const disp = displayEvent && typeof displayEvent === 'object' ? displayEvent : event;
    const S = getStoryFilterPlacesSync();
    const mergeList = (a, b) => [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])];
    const heroesRaw = S?.getStoryEventHeroTokens
        ? mergeList(S.getStoryEventHeroTokens(event), S.getStoryEventHeroTokens(disp))
        : mergeList(event.filters, disp.filters);
    const factionsRaw = S?.getStoryEventFactionTokens
        ? mergeList(S.getStoryEventFactionTokens(event), S.getStoryEventFactionTokens(disp))
        : mergeList(event.factions, disp.factions);
    const npcsRaw = S?.getStoryEventNpcTokens
        ? mergeList(S.getStoryEventNpcTokens(event), S.getStoryEventNpcTokens(disp))
        : mergeList(event.npcs, disp.npcs);
    const heroesLower = new Set(
        heroesRaw.map((h) => String(h || '').trim().toLowerCase()).filter(Boolean),
    );
    const npcsLower = new Set(
        npcsRaw.map((n) => String(n || '').trim().toLowerCase()).filter(Boolean),
    );
    const factions = Array.isArray(factionsRaw) ? factionsRaw : [];
    const fh = getFactionMatchHelpers();

    codexRoot.querySelectorAll('.codex-node').forEach((el) => {
        if (!codexRoot.contains(el) || el.classList.contains('codex-node--junction')) return;
        const kind = el.dataset.codexKind;
        let match = false;
        if (kind === 'hero' && heroesLower.has(String(el.dataset.codexHero || '').trim().toLowerCase())) {
            match = true;
        }
        if (kind === 'npc' && npcsLower.has(String(el.dataset.codexNpc || '').trim().toLowerCase())) {
            match = true;
        }
        if (kind === 'faction' && factions.length) {
            const fn = el.dataset.codexFactionFile || '';
            const fd = el.dataset.codexFactionDisplay || '';
            for (let i = 0; i < factions.length; i += 1) {
                const ef = factions[i];
                if (fh && typeof fh.factionIdsMatch === 'function') {
                    if (fh.factionIdsMatch(fn, ef) || fh.factionIdsMatch(fd, ef)) {
                        match = true;
                        break;
                    }
                } else if (fn === ef || fd === ef) {
                    match = true;
                    break;
                }
            }
        }
        if (match) el.classList.add('codex-node--filter-hover');
    });
}

function clearCodexEventThumbnailFilterHover() {
    const codexRoot = s.root || document.getElementById('codex-view-root');
    if (!codexRoot) return;
    const els = codexRoot.querySelectorAll('.codex-node--filter-hover');
    if (!els.length) return;
    els.forEach((el) => el.classList.remove('codex-node--filter-hover'));
}

if (typeof window !== 'undefined') {
    exposeApplyCodexFilterState(applyCodexFilterState);
}

api.codexNodeMatchesFilters = codexNodeMatchesFilters;
api.applyCodexFilterState = applyCodexFilterState;
api.applyCodexNodeFilterClassesToEl = applyCodexNodeFilterClassesToEl;
api.applyCodexEventThumbnailFilterHover = applyCodexEventThumbnailFilterHover;
api.clearCodexEventThumbnailFilterHover = clearCodexEventThumbnailFilterHover;
api.invalidateCodexFilterDerivedCache = invalidateCodexFilterDerivedCache;
