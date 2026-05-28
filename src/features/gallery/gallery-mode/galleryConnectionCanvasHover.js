/**
 * Codex-style cord chain hover highlighting for gallery personal connection canvas.
 */

import { CODEX_EDGE_HIT_PICK_STROKE_PX } from '../../codex/codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import { edgeDirectedKey } from '../../codex/codex-edge-cords/topology/CodexGraphPrimitives.js';

export { CODEX_EDGE_HIT_PICK_STROKE_PX };

function escapeEdgeIdForSelector(id) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(String(id));
    }
    return String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * @param {string} id
 * @param {{ nodes: object[] }} model
 */
function galleryNodeKindById(id, model) {
    const node = model.nodes.find((n) => n && n.id === id);
    if (!node) return '';
    return node.kind === 'junction' ? 'junction' : node.entityKind || node.kind || '';
}

/**
 * @param {string} fromId
 * @param {string} toId
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {(id: string) => string} kindById
 */
export function collectGalleryDirectedChainEdgeKeys(fromId, toId, edges, kindById) {
    const keys = new Set();
    if (!fromId || !toId || fromId === toId || !Array.isArray(edges)) return keys;
    const addK = (a, b) => {
        if (a && b && a !== b) keys.add(edgeDirectedKey(a, b));
    };
    addK(fromId, toId);

    let cur = fromId;
    let forbidFrom = toId;
    let steps = 0;
    const maxSteps = Math.max(8, edges.length + 2);
    while (steps < maxSteps && kindById(cur) === 'junction') {
        steps += 1;
        const inc = edges.filter((e) => e && e.toId === cur && e.fromId !== forbidFrom);
        if (inc.length !== 1) break;
        const e = inc[0];
        addK(e.fromId, e.toId);
        forbidFrom = cur;
        cur = e.fromId;
    }

    cur = toId;
    let forbidTo = fromId;
    steps = 0;
    while (steps < maxSteps && kindById(cur) === 'junction') {
        steps += 1;
        const outs = edges.filter((e) => e && e.fromId === cur && e.toId !== forbidTo);
        if (outs.length !== 1) break;
        const e = outs[0];
        addK(e.fromId, e.toId);
        forbidTo = cur;
        cur = e.toId;
    }
    return keys;
}

/**
 * @param {string} nodeId
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {(id: string) => string} kindById
 */
export function collectGalleryNodeIncidentChainKeys(nodeId, edges, kindById) {
    const keys = new Set();
    if (!nodeId || !Array.isArray(edges)) return keys;
    for (let i = 0; i < edges.length; i += 1) {
        const e = edges[i];
        if (!e) continue;
        if (e.fromId !== nodeId && e.toId !== nodeId) continue;
        const chain = collectGalleryDirectedChainEdgeKeys(e.fromId, e.toId, edges, kindById);
        chain.forEach((k) => keys.add(k));
    }
    return keys;
}

function chainKeysEqual(a, b) {
    if (!a || !b || a.size !== b.size) return false;
    for (const k of a) {
        if (!b.has(k)) return false;
    }
    return true;
}

/**
 * @param {SVGSVGElement} edgesSvg
 * @param {string} fromId
 * @param {string} toId
 * @param {boolean} active
 */
function setGalleryEdgeHoverVisual(edgesSvg, fromId, toId, active) {
    if (!edgesSvg || !fromId || !toId) return;
    const sel =
        `g.codex-edge-segment-group[data-codex-edge-from="${escapeEdgeIdForSelector(fromId)}"]`
        + `[data-codex-edge-to="${escapeEdgeIdForSelector(toId)}"]`;
    try {
        edgesSvg.querySelectorAll(sel).forEach((g) => {
            g.classList.toggle('codex-edge-segment-group--hover', active);
        });
    } catch (_) {
        /* ignore */
    }
}

/**
 * @param {SVGSVGElement} edgesSvg
 * @param {Map<string, HTMLElement>} nodeEls
 */
export function clearGalleryConnectionHoverVisual(edgesSvg, nodeEls) {
    if (edgesSvg) {
        edgesSvg.querySelectorAll('g.codex-edge-segment-group--hover').forEach((g) => {
            g.classList.remove('codex-edge-segment-group--hover');
        });
    }
    nodeEls?.forEach((el) => {
        el.classList.remove('codex-node--filter-hover');
    });
}

/**
 * @param {SVGSVGElement} edgesSvg
 * @param {Map<string, HTMLElement>} nodeEls
 * @param {Set<string>} chainKeys
 * @param {string[]} [nodeIdsToHighlight]
 */
export function applyGalleryConnectionHoverVisual(edgesSvg, nodeEls, chainKeys, nodeIdsToHighlight = []) {
    clearGalleryConnectionHoverVisual(edgesSvg, nodeEls);
    chainKeys.forEach((key) => {
        const sep = key.indexOf('\x1e');
        if (sep < 0) return;
        setGalleryEdgeHoverVisual(edgesSvg, key.slice(0, sep), key.slice(sep + 1), true);
    });
    for (let i = 0; i < nodeIdsToHighlight.length; i += 1) {
        const el = nodeEls.get(nodeIdsToHighlight[i]);
        if (el && !el.classList.contains('codex-node--junction')) {
            el.classList.add('codex-node--filter-hover');
        }
    }
}

/**
 * @param {{
 *   edgesSvg: SVGSVGElement,
 *   edgesHitG: SVGGElement,
 *   getModel: () => { nodes: object[], edges: { fromId: string, toId: string }[] },
 *   getNodeEls: () => Map<string, HTMLElement>,
 *   getNodeCenter: (id: string) => { x: number, y: number }|null,
 *   isInteractionBlocked?: () => boolean,
 * }} ctx
 */
export function bindGalleryConnectionCanvasHover(ctx) {
    let activeChainKeys = null;

    function kindById(id) {
        return galleryNodeKindById(id, ctx.getModel());
    }

    function applyChain(chainKeys, nodeIds = []) {
        if (activeChainKeys && chainKeysEqual(activeChainKeys, chainKeys)) return;
        activeChainKeys = chainKeys;
        applyGalleryConnectionHoverVisual(ctx.edgesSvg, ctx.getNodeEls(), chainKeys, nodeIds);
    }

    function clearHover() {
        activeChainKeys = null;
        clearGalleryConnectionHoverVisual(ctx.edgesSvg, ctx.getNodeEls());
    }

    ctx.edgesHitG.addEventListener('pointerover', (ev) => {
        if (ctx.isInteractionBlocked?.()) return;
        const t = /** @type {Element} */ (ev.target);
        if (!t?.classList?.contains('gallery-conn-canvas__edge-hit')) return;
        const fromId = t.getAttribute('data-codex-edge-from') || '';
        const toId = t.getAttribute('data-codex-edge-to') || '';
        if (!fromId || !toId) return;
        const chain = collectGalleryDirectedChainEdgeKeys(
            fromId,
            toId,
            ctx.getModel().edges,
            kindById,
        );
        applyChain(chain, [fromId, toId]);
    });

    ctx.edgesHitG.addEventListener('pointerout', (ev) => {
        if (ctx.isInteractionBlocked?.()) return;
        const t = /** @type {Element} */ (ev.target);
        if (!t?.classList?.contains('gallery-conn-canvas__edge-hit')) return;
        const rel = ev.relatedTarget;
        if (rel && ctx.edgesSvg.contains(rel)) {
            const nextHit = typeof rel.closest === 'function'
                ? rel.closest('.gallery-conn-canvas__edge-hit')
                : null;
            if (nextHit) {
                const nf = nextHit.getAttribute('data-codex-edge-from') || '';
                const nt = nextHit.getAttribute('data-codex-edge-to') || '';
                const nk = nf && nt ? edgeDirectedKey(nf, nt) : '';
                if (nk && activeChainKeys?.has(nk)) return;
            }
        }
        clearHover();
    });

    return {
        onNodePointerEnter(nodeId) {
            if (ctx.isInteractionBlocked?.() || !nodeId) return;
            const chain = collectGalleryNodeIncidentChainKeys(
                nodeId,
                ctx.getModel().edges,
                kindById,
            );
            applyChain(chain, [nodeId]);
        },
        onNodePointerLeave(ev, nodeEl) {
            if (ctx.isInteractionBlocked?.()) return;
            const rel = /** @type {Node|null} */ (ev.relatedTarget);
            if (rel instanceof Element && nodeEl?.contains(rel)) return;
            if (rel instanceof Element) {
                if (rel.closest?.('.codex-node')) return;
                if (rel.closest?.('.gallery-conn-canvas__edge-hit')) return;
            }
            clearHover();
        },
        clearHover,
    };
}

/**
 * @param {SVGGElement} edgesHitG
 * @param {string} ns
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {(id: string) => { x: number, y: number }|null} getNodeCenter
 */
export function appendGalleryEdgeHitLines(edgesHitG, ns, edges, getNodeCenter) {
    while (edgesHitG.firstChild) edgesHitG.removeChild(edgesHitG.firstChild);
    for (let i = 0; i < edges.length; i += 1) {
        const edge = edges[i];
        const p0 = getNodeCenter(edge.fromId);
        const p1 = getNodeCenter(edge.toId);
        if (!p0 || !p1) continue;
        const hit = document.createElementNS(ns, 'line');
        hit.classList.add('gallery-conn-canvas__edge-hit', 'codex-edge-hit');
        hit.setAttribute('x1', String(p0.x));
        hit.setAttribute('y1', String(p0.y));
        hit.setAttribute('x2', String(p1.x));
        hit.setAttribute('y2', String(p1.y));
        hit.setAttribute('stroke', 'transparent');
        hit.setAttribute('stroke-width', String(CODEX_EDGE_HIT_PICK_STROKE_PX));
        hit.setAttribute('stroke-linecap', 'round');
        hit.setAttribute('data-codex-edge-from', edge.fromId);
        hit.setAttribute('data-codex-edge-to', edge.toId);
        edgesHitG.appendChild(hit);
    }
}
