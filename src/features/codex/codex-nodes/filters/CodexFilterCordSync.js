/**
 * In-place cord appearance sync when filter / linking state changes.
 * Updates SVG attributes and classes instead of rebuilding the edges layer.
 */

import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { CODEX_WORLD_H, CODEX_WORLD_W } from '../../codex-data/persistence/CodexLayoutConstants.js';
import {
    ensureCodexCordAnimationLoop,
    resyncCodexTimelineRangePackets,
    syncCodexCordPacketState,
} from '../../codex-node-drawing/packets/CodexCordPacketAnimation.js';
import { appendEdgeGlowFilter } from '../../codex-node-drawing/svg/CodexCordSvgElements.js';
import {
    getCodexDockPageIndexSpan,
    getCodexTimelineRangedPathEdgeKeys,
} from '../../codex-bio-archive-sync/timeline/codexBioConnectionDockTimeline.js';
import { codexUnorderedPairKey } from '../../codex-edge-cords/topology/CodexGraphPrimitives.js';
import { codexFiltersActive } from './CodexNodeFilterMatch.js';

/** @type {number} */
let filterCordSecondarySyncRaf = 0;

/** @type {number} */
let timelineRangePacketSyncRaf = 0;

/** @type {string} */
let lastFilterCordSyncSignature = '';

export function resetCodexFilterCordSyncSignature() {
    lastFilterCordSyncSignature = '';
}

/** @type {Record<string, string>} */
const APPEARANCE_STROKE = {
    red: '#f87171',
    yellow: '#fbbf24',
    green: '#4ade80',
    grey: 'rgba(100, 108, 128, 0.55)',
};

/** @type {Record<string, string>} */
const APPEARANCE_FILTER = {
    red: 'url(#codex-edge-red-glow)',
    yellow: 'url(#codex-edge-yellow-glow)',
    green: 'url(#codex-edge-green-glow)',
    grey: 'none',
};

/**
 * @param {'red'|'yellow'|'violet'|'violet-dim'|'green'|'grey'} appearance
 * @param {{ cordColor: string, cordBlur: number, cordMorph: number, cordGlowLayers: number }} visualPrefs
 */
function resolveCordAppearanceAttrs(appearance, visualPrefs) {
    if (appearance === 'violet' || appearance === 'violet-dim') {
        return {
            stroke: visualPrefs.cordColor,
            filter: 'url(#codex-edge-violet-glow)',
        };
    }
    return {
        stroke: APPEARANCE_STROKE[appearance] || visualPrefs.cordColor,
        filter: APPEARANCE_FILTER[appearance] || 'url(#codex-edge-violet-glow)',
    };
}

/**
 * @param {SVGDefsElement} defs
 * @param {{ cordBlur: number, cordMorph: number, cordGlowLayers: number }} visualPrefs
 * @param {number} vw
 * @param {number} vh
 */
function ensureCodexCordGlowFilters(defs, visualPrefs, vw, vh) {
    const cordFilt = {
        stdDeviation: visualPrefs.cordBlur,
        morphRadius: visualPrefs.cordMorph,
        blurLayers: visualPrefs.cordGlowLayers,
        viewW: vw,
        viewH: vh,
    };
    if (!defs.querySelector('#codex-edge-violet-glow')) {
        appendEdgeGlowFilter(defs, 'codex-edge-violet-glow', 'violetBlur', cordFilt);
    }
    if (!defs.querySelector('#codex-edge-green-glow')) {
        appendEdgeGlowFilter(defs, 'codex-edge-green-glow', 'greenBlur', cordFilt);
    }
    if (!defs.querySelector('#codex-edge-yellow-glow')) {
        appendEdgeGlowFilter(defs, 'codex-edge-yellow-glow', 'yellowBlur', cordFilt);
    }
    if (!defs.querySelector('#codex-edge-red-glow')) {
        appendEdgeGlowFilter(defs, 'codex-edge-red-glow', 'redBlur', cordFilt);
    }
}

/**
 * @param {SVGLineElement} lineEl
 * @param {'red'|'yellow'|'violet'|'green'|'grey'} appearance
 * @param {boolean} filterDormant
 */
function syncCodexSegmentLineClasses(lineEl, appearance, filterDormant) {
    lineEl.classList.remove(
        'codex-edge-segment--timeline-dormant',
        'codex-edge-segment--timeline-range-inactive',
        'codex-edge-segment--filter-dormant',
        'codex-edge-segment--filter-linked',
    );
    if (appearance === 'grey') {
        lineEl.classList.add('codex-edge-segment--timeline-dormant');
        if (filterDormant) lineEl.classList.add('codex-edge-segment--filter-dormant');
    } else if (appearance === 'violet-dim') {
        lineEl.classList.add('codex-edge-segment--timeline-range-inactive');
    } else if (appearance === 'green') {
        lineEl.classList.add('codex-edge-segment--filter-linked');
    }
}

/**
 * @param {{ fromId: string, toId: string }} edge
 * @returns {{ fromId: string, toId: string }|null}
 */
function findDirectedEdge(edge) {
    if (!edge?.fromId || !edge?.toId) return null;
    return api.findEdge?.(edge.fromId, edge.toId)
        || api.findEdge?.(edge.toId, edge.fromId)
        || null;
}

function buildCordAppearanceSyncSignature() {
    const filterKeys = s.codexFilterActiveEdgePairKeys;
    const filterPart = filterKeys?.size ? `${filterKeys.size}:${[...filterKeys].sort().join('|')}` : '0';
    const page = getCodexDockPageIndexSpan()?.page ?? 1;
    const lifetimePart = s.codexEntryLifetimeNodeStatuses?.size ?? 0;
    const timelinePart = `${page}:${lifetimePart}`;
    return `${filterPart}|${timelinePart}`;
}

/** @param {string} id */
function cssAttrEscape(id) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(String(id));
    }
    return String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * @param {'red'|'yellow'|'violet'|'green'|'grey'|'violet-dim'} appearance
 * @param {string} cordColorHex
 */
function elbowFillAndFilterForAppearance(appearance, cordColorHex) {
    const isGreyAppearance = appearance === 'grey' || appearance === 'violet-dim';
    const fill = appearance === 'red'
        ? '#f87171'
        : appearance === 'yellow'
            ? '#fbbf24'
            : appearance === 'green'
                ? '#4ade80'
                : isGreyAppearance
                    ? 'rgba(120, 128, 148, 0.38)'
                    : cordColorHex;
    const filterUrl = appearance === 'red'
        ? 'url(#codex-edge-red-glow)'
        : appearance === 'yellow'
            ? 'url(#codex-edge-yellow-glow)'
            : appearance === 'green'
                ? 'url(#codex-edge-green-glow)'
                : isGreyAppearance
                    ? 'none'
                    : 'url(#codex-edge-violet-glow)';
    return { fill, filterUrl };
}

/**
 * Fast path for dock page turns — only ranged bio-path segments, elbows, and packets.
 * @returns {boolean}
 */
export function syncCodexTimelineRangeCordDom() {
    if (!s.root) return false;

    const rangedKeys = getCodexTimelineRangedPathEdgeKeys();
    if (!rangedKeys.size) return true;

    const svg = s.root.querySelector('.codex-edges-layer');
    const contentRoot = svg?.querySelector('.codex-edges-masked');
    if (!contentRoot) return false;

    const edges = s.codexEdges || [];
    const cordColorHex = s.codexVisualPrefs?.cordColor || '#c084fc';

    for (let i = 0; i < edges.length; i += 1) {
        const edge = edges[i];
        const pairKey = codexUnorderedPairKey(edge.fromId, edge.toId);
        if (!rangedKeys.has(pairKey)) continue;

        const inactive = api.edgeCordAppearance(edge) === 'violet-dim';
        const sel = `g.codex-edge-segment-group[data-codex-edge-from="${cssAttrEscape(edge.fromId)}"][data-codex-edge-to="${cssAttrEscape(edge.toId)}"]`;
        contentRoot.querySelectorAll(sel).forEach((group) => {
            group.classList.toggle('codex-edge-segment-group--timeline-range-inactive', inactive);
            const line = group.querySelector('line.codex-edge-segment');
            if (line) {
                line.classList.toggle('codex-edge-segment--timeline-range-inactive', inactive);
            }
        });
    }

    contentRoot.querySelectorAll('g[data-codex-elbow-junction]').forEach((group) => {
        const fromId = group.getAttribute('data-codex-elbow-in-from');
        const jId = group.getAttribute('data-codex-elbow-junction');
        const toId = group.getAttribute('data-codex-elbow-out-to');
        if (!fromId || !jId || !toId) return;

        const kIn = codexUnorderedPairKey(fromId, jId);
        const kOut = codexUnorderedPairKey(jId, toId);
        if (!rangedKeys.has(kIn) && !rangedKeys.has(kOut)) return;

        const eIn = findDirectedEdge({ fromId, toId: jId });
        const eOut = findDirectedEdge({ fromId: jId, toId });
        if (!eIn || !eOut) return;

        const appearance = api.edgeCordAppearanceForJunctionElbow?.(eIn, eOut)
            ?? api.edgeCordAppearance(eIn);
        const { fill, filterUrl } = elbowFillAndFilterForAppearance(appearance, cordColorHex);
        group.setAttribute('filter', filterUrl);
        const poly = group.querySelector('polygon.codex-edge-elbow-parallelogram');
        if (poly) poly.setAttribute('fill', fill);
    });

    if (timelineRangePacketSyncRaf) cancelAnimationFrame(timelineRangePacketSyncRaf);
    timelineRangePacketSyncRaf = requestAnimationFrame(() => {
        timelineRangePacketSyncRaf = 0;
        resyncCodexTimelineRangePackets(rangedKeys);
    });

    return true;
}

function syncCodexFilterCordPackets() {
    const edges = s.codexEdges || [];
    /** @type {{ edge: { fromId: string, toId: string }, pts: { x: number, y: number }[] }[]} */
    const edgePolys = [];
    for (const edge of edges) {
        if (api.edgeCordPacketsEnabled?.(edge) !== true) continue;
        const pts = api.buildPolylineForEdge?.(edge);
        if (pts && pts.length >= 2) edgePolys.push({ edge, pts });
    }
    syncCodexCordPacketState(edgePolys);
    if (edgePolys.length > 0) {
        ensureCodexCordAnimationLoop();
    }
}

function syncCodexJunctionElbowAppearance() {
    const svg = s.root?.querySelector('.codex-edges-layer');
    const contentRoot = svg?.querySelector('.codex-edges-masked');
    if (!contentRoot || !api.appendCodexJunctionElbowParallelograms) return;

    contentRoot.querySelectorAll('polygon.codex-edge-elbow-parallelogram').forEach((poly) => {
        poly.closest('g')?.remove();
    });

    const ns = 'http://www.w3.org/2000/svg';
    api.appendCodexJunctionElbowParallelograms(contentRoot, ns, null, s.codexEdges);
}

/**
 * @returns {boolean} False when the edges layer is not ready for in-place sync.
 */
export function syncCodexFilterCordDom() {
    if (!s.root) return false;

    const svg = s.root.querySelector('.codex-edges-layer');
    const contentRoot = svg?.querySelector('.codex-edges-masked');
    if (!svg || !contentRoot) return false;

    const visualPrefs = s.codexVisualPrefs;
    const worldEl = s.codexWorldEl;
    const vw = worldEl ? CODEX_WORLD_W : Math.max(1, s.root.clientWidth);
    const vh = worldEl ? CODEX_WORLD_H : Math.max(1, s.root.clientHeight);

    let defs = svg.querySelector('defs');
    if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svg.insertBefore(defs, svg.firstChild);
    }
    ensureCodexCordGlowFilters(defs, visualPrefs, vw, vh);

    svg.querySelectorAll('g.codex-edge-segment-group[data-codex-edge-from][data-codex-edge-to]').forEach((group) => {
        const fromId = group.getAttribute('data-codex-edge-from');
        const toId = group.getAttribute('data-codex-edge-to');
        if (!fromId || !toId) return;

        const edge = findDirectedEdge({ fromId, toId });
        if (!edge) return;

        const appearance = api.edgeCordAppearance(edge);
        const filterDormant = api.edgeCordIsFilterDormant?.(edge) === true;
        const timelineRangeInactive = appearance === 'violet-dim';
        const { stroke, filter } = resolveCordAppearanceAttrs(appearance, visualPrefs);

        group.setAttribute('filter', filter);
        group.classList.toggle('codex-edge-segment-group--timeline-range-inactive', timelineRangeInactive);
        const line = group.querySelector('line.codex-edge-segment');
        if (line) {
            line.setAttribute('stroke', stroke);
            syncCodexSegmentLineClasses(line, appearance, filterDormant);
        }
    });

    svg.querySelectorAll('.codex-edge-hit').forEach((hit) => {
        const fromId = hit.dataset.codexEdgeFrom;
        const toId = hit.dataset.codexEdgeTo;
        if (!fromId || !toId) return;

        const edge = findDirectedEdge({ fromId, toId });
        if (!edge) return;

        const filterDormant = api.edgeCordIsFilterDormant?.(edge) === true;
        hit.classList.toggle('codex-edge-hit--filter-dormant', filterDormant);
    });

    s.root.classList.toggle('codex--filters-active', codexFiltersActive());

    const syncSignature = buildCordAppearanceSyncSignature();
    const secondaryChanged = syncSignature !== lastFilterCordSyncSignature;
    lastFilterCordSyncSignature = syncSignature;

    if (secondaryChanged) {
        syncCodexFilterCordPackets();
        if (filterCordSecondarySyncRaf) {
            cancelAnimationFrame(filterCordSecondarySyncRaf);
        }
        filterCordSecondarySyncRaf = requestAnimationFrame(() => {
            filterCordSecondarySyncRaf = 0;
            syncCodexJunctionElbowAppearance();
        });
    }

    return true;
}

api.syncCodexFilterCordDom = syncCodexFilterCordDom;
api.syncCodexTimelineRangeCordDom = syncCodexTimelineRangeCordDom;
