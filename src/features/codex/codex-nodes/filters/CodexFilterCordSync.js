/**
 * In-place cord appearance sync when filter / linking state changes.
 * Updates SVG attributes and classes instead of rebuilding the edges layer.
 */

import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { CODEX_WORLD_H, CODEX_WORLD_W } from '../../codex-data/persistence/CodexLayoutConstants.js';
import {
    ensureCodexCordAnimationLoop,
    syncCodexCordPacketState,
} from '../../codex-node-drawing/packets/CodexCordPacketAnimation.js';
import { appendEdgeGlowFilter } from '../../codex-node-drawing/svg/CodexCordSvgElements.js';
import { codexFiltersActive } from './CodexNodeFilterMatch.js';

/** @type {number} */
let filterCordSecondarySyncRaf = 0;

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
 * @param {'red'|'yellow'|'violet'|'green'|'grey'} appearance
 * @param {{ cordColor: string, cordBlur: number, cordMorph: number, cordGlowLayers: number }} visualPrefs
 */
function resolveCordAppearanceAttrs(appearance, visualPrefs) {
    if (appearance === 'violet') {
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
        'codex-edge-segment--filter-dormant',
        'codex-edge-segment--filter-linked',
    );
    if (appearance === 'grey') {
        lineEl.classList.add('codex-edge-segment--timeline-dormant');
        if (filterDormant) lineEl.classList.add('codex-edge-segment--filter-dormant');
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

function buildFilterCordSyncSignature() {
    const keys = s.codexFilterActiveEdgePairKeys;
    if (!keys?.size) return '0';
    return `${keys.size}:${[...keys].sort().join('|')}`;
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
        const { stroke, filter } = resolveCordAppearanceAttrs(appearance, visualPrefs);

        group.setAttribute('filter', filter);
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

    const syncSignature = buildFilterCordSyncSignature();
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
