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
    resolveCodexNodeIdsForActiveFilters,
} from './CodexNodeFilterMatch.js';

/** @type {number} */
let filterStateApplyRaf = 0;
/** @type {number} */
let filterGraphRaf = 0;
/** @type {number} */
let filterCordDeferRaf = 0;
/** @type {number} */
let filterClearSecondaryRaf = 0;
/** @type {number} */
let filterApplyGeneration = 0;

function codexNodeMatchesFilters(nodeEl) {
    return codexNodeElMatchesActiveFilters(nodeEl);
}

function rebuildCodexFilterDerivedSets() {
    if (!codexFiltersActive()) {
        s.codexFilterReachableNodeIds = null;
        s.codexFilterConnectionEndpointNodeIds = null;
        s.codexFilterLinkedEdgePairKeys = null;
        s.codexFilterActiveEdgePairKeys = null;
        s.codexFilterSeedNodeIds = null;
        return;
    }

    const seeds = resolveCodexNodeIdsForActiveFilters(s.codexAllNodes);
    s.codexFilterSeedNodeIds = new Set(seeds);

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

    if (s.codexFilterSeedNodeIds?.has(nodeId) || codexNodeMatchesFilters(nodeEl)) {
        nodeEl.classList.add('codex-node--filter-match');
        return;
    }

    if (nodeIsFilterConnected(nodeId)) {
        nodeEl.classList.add('codex-node--filter-connected');
        return;
    }

    nodeEl.classList.add('codex-node--filtered-out');
}

/**
 * Clear filter classes without re-running match logic (fast path for Clear).
 */
function clearCodexFilterNodeClassesFast() {
    if (!s.root) return;
    s.root.classList.remove('codex--filter-linking-active', 'codex--filters-active');
    s.codexFilterReachableNodeIds = null;
    s.codexFilterConnectionEndpointNodeIds = null;
    s.codexFilterLinkedEdgePairKeys = null;
    s.codexFilterActiveEdgePairKeys = null;
    s.codexFilterSeedNodeIds = null;
    resetCodexFilterCordSyncSignature();

    const marked = s.root.querySelectorAll(
        '.codex-node--filter-match, .codex-node--filtered-out, .codex-node--filter-connected',
    );
    for (let i = 0; i < marked.length; i += 1) {
        marked[i].classList.remove(
            'codex-node--filter-match',
            'codex-node--filtered-out',
            'codex-node--filter-connected',
        );
    }
}

/**
 * Phase 1 — cheap seed match only (no graph). Instant feedback on chip click.
 */
function applyCodexFilterSeedClassesQuick() {
    if (!s.root) return;
    if (!codexFiltersActive()) {
        clearCodexFilterNodeClassesFast();
        return;
    }

    const seeds = resolveCodexNodeIdsForActiveFilters(s.codexAllNodes);
    s.codexFilterSeedNodeIds = new Set(seeds);
    s.root.classList.remove('codex--filter-linking-active');

    const nodes = s.root.querySelectorAll('.codex-node:not(.codex-node--junction)');
    const seedSet = s.codexFilterSeedNodeIds;
    for (let i = 0; i < nodes.length; i += 1) {
        const el = nodes[i];
        const id = String(el.dataset.codexNodeId || '');
        el.classList.remove(
            'codex-node--filter-match',
            'codex-node--filtered-out',
            'codex-node--filter-connected',
        );
        if (seedSet.has(id)) {
            el.classList.add('codex-node--filter-match');
        } else {
            el.classList.add('codex-node--filtered-out');
        }
    }
}

/**
 * Phase 2 — graph-derived connected endpoints + linking class.
 */
function applyCodexFilterConnectedClassesFromDerived() {
    if (!s.root || !codexFiltersActive()) return;

    const linkOn = isCodexLinkFiltersEnabled() && !!(s.codexFilterLinkedEdgePairKeys?.size);
    s.root.classList.toggle('codex--filter-linking-active', linkOn);

    const endpoints = s.codexFilterConnectionEndpointNodeIds;
    if (!endpoints?.size || linkOn) return;

    const nodes = s.root.querySelectorAll(
        '.codex-node--filtered-out:not(.codex-node--junction)',
    );
    for (let i = 0; i < nodes.length; i += 1) {
        const el = nodes[i];
        const id = String(el.dataset.codexNodeId || '');
        if (!endpoints.has(id)) continue;
        el.classList.remove('codex-node--filtered-out');
        el.classList.add('codex-node--filter-connected');
    }
}

function applyCodexFilterNodeClassesNow() {
    if (!s.root) return;

    if (!codexFiltersActive()) {
        clearCodexFilterNodeClassesFast();
        return;
    }

    rebuildCodexFilterDerivedSets();

    const linkOn = isCodexLinkFiltersEnabled() && !!(s.codexFilterLinkedEdgePairKeys?.size);
    s.root.classList.toggle('codex--filter-linking-active', linkOn);

    const nodes = s.root.querySelectorAll('.codex-node:not(.codex-node--junction)');
    for (let i = 0; i < nodes.length; i += 1) {
        applyCodexNodeFilterClassesToEl(nodes[i]);
    }
}

function applyCodexFilterCordsNow(opts = {}) {
    if (!s.root) return;

    /*
     * Shoulders (junction elbows) tint with AND/OR — keep them on the same
     * pass as segment strokes. Only packets stay deferred.
     */
    const syncElbows = opts.syncElbows !== false;

    if (!codexFiltersActive()) {
        s.root.classList.remove('codex--filter-linking-active', 'codex--filters-active');
        const synced = syncCodexFilterCordDom({
            skipPackets: true,
            syncElbowsNow: syncElbows,
            forceSecondary: syncElbows,
        });
        if (!synced) {
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(() => redrawCodexEdges({ force: true }), { timeout: 400 });
            } else {
                setTimeout(() => redrawCodexEdges({ force: true }), 0);
            }
        }
        if (filterClearSecondaryRaf) cancelAnimationFrame(filterClearSecondaryRaf);
        filterClearSecondaryRaf = requestAnimationFrame(() => {
            filterClearSecondaryRaf = 0;
            syncCodexFilterCordDom({
                skipPackets: false,
                syncElbowsNow: false,
                forceSecondary: true,
            });
        });
        return;
    }

    const light = opts.light !== false;
    const synced = syncCodexFilterCordDom({
        skipPackets: light,
        syncElbowsNow: syncElbows,
        forceSecondary: syncElbows,
    });
    if (!synced) {
        requestAnimationFrame(() => {
            if (!syncCodexFilterCordDom({
                skipPackets: true,
                syncElbowsNow: true,
                forceSecondary: true,
            })) {
                if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(() => redrawCodexEdges({ force: true }), { timeout: 500 });
                }
            }
        });
        return;
    }

    if (light) {
        if (filterClearSecondaryRaf) cancelAnimationFrame(filterClearSecondaryRaf);
        const schedule =
            typeof requestIdleCallback === 'function'
                ? (fn) => requestIdleCallback(fn, { timeout: 220 })
                : (fn) => setTimeout(fn, 32);
        schedule(() => {
            /* Packets only — elbows already painted with the cord stroke pass. */
            syncCodexFilterCordDom({
                skipPackets: false,
                syncElbowsNow: false,
                forceSecondary: true,
            });
        });
    }
}

function cancelPendingFilterApply() {
    if (filterStateApplyRaf) {
        cancelAnimationFrame(filterStateApplyRaf);
        filterStateApplyRaf = 0;
    }
    if (filterGraphRaf) {
        cancelAnimationFrame(filterGraphRaf);
        filterGraphRaf = 0;
    }
    if (filterCordDeferRaf) {
        cancelAnimationFrame(filterCordDeferRaf);
        filterCordDeferRaf = 0;
    }
    if (filterClearSecondaryRaf) {
        cancelAnimationFrame(filterClearSecondaryRaf);
        filterClearSecondaryRaf = 0;
    }
}

/**
 * Two-phase apply: seed dimming sync, then graph + cords/shoulders next frame.
 */
function applyCodexFilterState() {
    if (!s.root) return;
    cancelPendingFilterApply();

    const gen = ++filterApplyGeneration;
    const clearing = !codexFiltersActive();

    /* Phase 1 — paint seed match/dim immediately (don't wait a frame). */
    if (clearing) {
        clearCodexFilterNodeClassesFast();
    } else {
        applyCodexFilterSeedClassesQuick();
    }

    /* Phase 2 — derived graph + cord/shoulder colors (AND green / OR violet/grey). */
    filterGraphRaf = requestAnimationFrame(() => {
        filterGraphRaf = 0;
        if (gen !== filterApplyGeneration) return;

        if (!codexFiltersActive()) {
            clearCodexFilterNodeClassesFast();
            applyCodexFilterCordsNow({ light: true, syncElbows: true });
            return;
        }

        rebuildCodexFilterDerivedSets();
        applyCodexFilterConnectedClassesFromDerived();
        /* Same frame as graph — shoulders must not trail segment tint. */
        applyCodexFilterCordsNow({ light: true, syncElbows: true });
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
