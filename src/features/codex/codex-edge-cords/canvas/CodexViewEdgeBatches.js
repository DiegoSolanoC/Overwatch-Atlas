/**
 * View-mode appearance-batched cord strokes — one SVG <path> per color bucket
 * instead of a filtered group per segment. Hover uses a separate overlay path.
 */

import { edgeDirectedKey } from '../topology/CodexGraphPrimitives.js';
import { getCodexViewEdgePickPolys } from './CodexViewEdgePick.js';

const BATCH_KEYS = /** @type {const} */ ([
    'violet',
    'violet-dim',
    'green',
    'yellow',
    'red',
    'grey',
]);

/**
 * @typedef {'violet'|'violet-dim'|'green'|'yellow'|'red'|'grey'} CodexViewBatchKey
 */

/** @type {SVGGElement|null} */
let batchHost = null;
/** @type {Map<CodexViewBatchKey, SVGPathElement>} */
let batchPaths = new Map();
/** @type {SVGPathElement|null} */
let hoverOverlay = null;
/** @type {{ edge: { fromId: string, toId: string }, pts: { x: number, y: number }[] }[]} */
let lastBatchEdgePolys = [];
/** @type {string} */
let lastCordColor = '';
/** @type {number} */
let lastCordThickness = 0;

/**
 * @param {{ x: number, y: number }[]} pts
 * @returns {string}
 */
export function codexPolylineToBatchPathD(pts) {
    if (!pts || pts.length < 2) return '';
    let d = '';
    for (let i = 0; i < pts.length - 1; i += 1) {
        const a = pts[i];
        const b = pts[i + 1];
        d += `M${a.x} ${a.y}L${b.x} ${b.y}`;
    }
    return d;
}

/**
 * @param {string} appearance
 * @returns {CodexViewBatchKey}
 */
function normalizeBatchKey(appearance) {
    if (appearance === 'violet-dim') return 'violet-dim';
    if (appearance === 'green') return 'green';
    if (appearance === 'yellow') return 'yellow';
    if (appearance === 'red') return 'red';
    if (appearance === 'grey') return 'grey';
    return 'violet';
}

/**
 * @param {CodexViewBatchKey} key
 * @param {string} cordColor
 */
function strokeForBatchKey(key, cordColor) {
    if (key === 'red') return '#f87171';
    if (key === 'yellow') return '#fbbf24';
    if (key === 'green') return '#4ade80';
    if (key === 'grey') return 'rgba(100, 108, 128, 0.55)';
    return cordColor || '#c084fc';
}

/**
 * @param {CodexViewBatchKey} key
 */
function filterForBatchKey(key) {
    if (key === 'red') return 'url(#codex-edge-red-glow)';
    if (key === 'yellow') return 'url(#codex-edge-yellow-glow)';
    if (key === 'green') return 'url(#codex-edge-green-glow)';
    if (key === 'grey') return 'none';
    return 'url(#codex-edge-violet-glow)';
}

export function isCodexViewEdgeBatchesActive() {
    return !!(batchHost?.isConnected && batchPaths.size);
}

/**
 * @param {SVGGElement} contentRoot
 * @param {string} ns
 * @param {{ cordColor: string, cordThickness: number }} visualPrefs
 * @param {{ edge: { fromId: string, toId: string }, pts: { x: number, y: number }[] }[]} edgePolys
 * @param {(edge: { fromId: string, toId: string }) => string} edgeCordAppearance
 */
export function paintCodexViewEdgeBatches(
    contentRoot,
    ns,
    visualPrefs,
    edgePolys,
    edgeCordAppearance,
) {
    if (!contentRoot || !ns) return;

    /** @type {Record<CodexViewBatchKey, string[]>} */
    const parts = {
        violet: [],
        'violet-dim': [],
        green: [],
        yellow: [],
        red: [],
        grey: [],
    };

    lastBatchEdgePolys = Array.isArray(edgePolys) ? edgePolys : [];
    lastCordColor = visualPrefs.cordColor || '#c084fc';
    lastCordThickness = Number(visualPrefs.cordThickness) || 3;

    for (let i = 0; i < lastBatchEdgePolys.length; i += 1) {
        const { edge, pts } = lastBatchEdgePolys[i];
        if (!edge || !pts || pts.length < 2) continue;
        const key = normalizeBatchKey(edgeCordAppearance(edge));
        const d = codexPolylineToBatchPathD(pts);
        if (d) parts[key].push(d);
    }

    let host = contentRoot.querySelector(':scope > .codex-edge-batches');
    if (!(host instanceof SVGGElement)) {
        host = document.createElementNS(ns, 'g');
        host.classList.add('codex-edge-batches');
        host.setAttribute('pointer-events', 'none');
        contentRoot.insertBefore(host, contentRoot.firstChild);
    }
    batchHost = host;
    batchPaths = new Map();

    for (let i = 0; i < BATCH_KEYS.length; i += 1) {
        const key = BATCH_KEYS[i];
        const d = parts[key].join('');
        let path = host.querySelector(`:scope > path.codex-edge-batch[data-appearance="${key}"]`);
        if (!(path instanceof SVGPathElement)) {
            path = document.createElementNS(ns, 'path');
            path.classList.add('codex-edge-batch', `codex-edge-batch--${key}`);
            path.setAttribute('data-appearance', key);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');
            path.setAttribute('pointer-events', 'none');
            host.appendChild(path);
        }
        path.setAttribute('stroke', strokeForBatchKey(key, lastCordColor));
        path.setAttribute('stroke-width', String(lastCordThickness));
        const filt = filterForBatchKey(key);
        if (filt === 'none') path.removeAttribute('filter');
        else path.setAttribute('filter', filt);
        path.setAttribute('d', d || '');
        path.style.display = d ? '' : 'none';
        batchPaths.set(key, path);
    }

    let overlay = contentRoot.querySelector(':scope > path.codex-edge-hover-overlay');
    if (!(overlay instanceof SVGPathElement)) {
        overlay = document.createElementNS(ns, 'path');
        overlay.classList.add('codex-edge-hover-overlay');
        overlay.setAttribute('fill', 'none');
        overlay.setAttribute('stroke', '#38bdf8');
        overlay.setAttribute('stroke-width', '6');
        overlay.setAttribute('stroke-linecap', 'round');
        overlay.setAttribute('stroke-linejoin', 'round');
        overlay.setAttribute('pointer-events', 'none');
        overlay.setAttribute('d', '');
        contentRoot.appendChild(overlay);
    } else {
        /* Keep overlay above batches / elbows (packets append after). */
        contentRoot.appendChild(overlay);
    }
    hoverOverlay = overlay;
    clearCodexViewEdgeHoverOverlay();
}

/**
 * Rebuild batch `d` from last polys using a fresh appearance resolver (filter/timeline).
 * @param {(edge: { fromId: string, toId: string }) => string} edgeCordAppearance
 * @param {{ cordColor?: string, cordThickness?: number }} [visualPrefs]
 */
export function rebuildCodexViewEdgeBatchesFromCache(edgeCordAppearance, visualPrefs) {
    if (!batchHost?.isConnected || !lastBatchEdgePolys.length) return false;
    const cordColor = visualPrefs?.cordColor || lastCordColor || '#c084fc';
    const cordThickness = Number(visualPrefs?.cordThickness) || lastCordThickness || 3;
    lastCordColor = cordColor;
    lastCordThickness = cordThickness;

    /** @type {Record<CodexViewBatchKey, string[]>} */
    const parts = {
        violet: [],
        'violet-dim': [],
        green: [],
        yellow: [],
        red: [],
        grey: [],
    };
    for (let i = 0; i < lastBatchEdgePolys.length; i += 1) {
        const { edge, pts } = lastBatchEdgePolys[i];
        if (!edge || !pts || pts.length < 2) continue;
        const key = normalizeBatchKey(edgeCordAppearance(edge));
        const d = codexPolylineToBatchPathD(pts);
        if (d) parts[key].push(d);
    }
    for (let i = 0; i < BATCH_KEYS.length; i += 1) {
        const key = BATCH_KEYS[i];
        const path = batchPaths.get(key) || batchHost.querySelector(
            `:scope > path.codex-edge-batch[data-appearance="${key}"]`,
        );
        if (!(path instanceof SVGPathElement)) continue;
        const d = parts[key].join('');
        path.setAttribute('stroke', strokeForBatchKey(key, cordColor));
        path.setAttribute('stroke-width', String(cordThickness));
        const filt = filterForBatchKey(key);
        if (filt === 'none') path.removeAttribute('filter');
        else path.setAttribute('filter', filt);
        path.setAttribute('d', d || '');
        path.style.display = d ? '' : 'none';
        batchPaths.set(key, path);
    }
    return true;
}

/**
 * Keep batch cache in sync when pick polys are set (same geometry source).
 * @param {{ edge: object, pts: { x: number, y: number }[] }[]} edgePolys
 */
export function setCodexViewEdgeBatchPolysCache(edgePolys) {
    lastBatchEdgePolys = Array.isArray(edgePolys) ? edgePolys : [];
}

export function clearCodexViewEdgeBatches() {
    batchHost = null;
    batchPaths = new Map();
    hoverOverlay = null;
    lastBatchEdgePolys = [];
}

export function clearCodexViewEdgeHoverOverlay() {
    if (hoverOverlay?.isConnected) {
        hoverOverlay.setAttribute('d', '');
    }
}

/**
 * @param {Set<string>|null|undefined} chain
 */
export function setCodexViewEdgeHoverOverlayFromChain(chain) {
    if (!hoverOverlay?.isConnected) return;
    if (!chain?.size) {
        hoverOverlay.setAttribute('d', '');
        return;
    }
    const polys = getCodexViewEdgePickPolys();
    const parts = [];
    for (const key of chain) {
        const pts = polys.get(key);
        if (!pts) continue;
        const d = codexPolylineToBatchPathD(pts);
        if (d) parts.push(d);
    }
    hoverOverlay.setAttribute('d', parts.join(''));
}

/**
 * Build overlay d without pick map (fallback from batch cache).
 * @param {Set<string>} chain
 */
export function setCodexViewEdgeHoverOverlayFromBatchCache(chain) {
    if (!hoverOverlay?.isConnected) return;
    if (!chain?.size) {
        hoverOverlay.setAttribute('d', '');
        return;
    }
    const parts = [];
    for (let i = 0; i < lastBatchEdgePolys.length; i += 1) {
        const { edge, pts } = lastBatchEdgePolys[i];
        if (!edge) continue;
        const key = edgeDirectedKey(edge.fromId, edge.toId);
        if (!chain.has(key)) continue;
        const d = codexPolylineToBatchPathD(pts);
        if (d) parts.push(d);
    }
    hoverOverlay.setAttribute('d', parts.join(''));
}
