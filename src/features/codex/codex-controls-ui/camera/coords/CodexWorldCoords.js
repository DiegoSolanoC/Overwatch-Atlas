/** CodexWorldCoords — Codex canvas slice. */
import { api } from '../../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../../codex-canvas/core/canvasSession.js';
import { CODEX_OCT_RAD, CODEX_OCT_RELEASE_SNAP_EPS, CODEX_OCT_SOFT_SNAP_TOL_DEG } from '../viewport/CodexCanvasTuning.js';
import { computeCodexVisibleWorldBoundsExpanded } from '../viewport/CodexViewportWorldBounds.js';
import { CODEX_WORLD_H, CODEX_WORLD_W } from '../../../codex-data/persistence/CodexLayoutConstants.js';
import { cordAngleDistToNearestOctilinearDegFromRad } from '../../../codex-edge-cords/geometry/CodexCordOctilinearGeometry.js';
import { CODEX_IMG_BASE_PX, CODEX_JUNCTION_BASE_PX, CODEX_SCALE_MAX, CODEX_SCALE_MIN } from '../../../codex-nodes/placement/CodexNodePortraitMetrics.js';
import { parseTranslatePxFromTransform } from '../../../codex-node-drawing/svg/CodexNodeFrameSvg.js';
import { capOpts, DOUBLE_RIGHT_MS, CODEX_JUNCTION_PREVIEW_DATA_URI, MAX_SUGGEST, CODEX_DEBUG_UI_PREF_KEY_LEGACY, CODEX_MODE_PREF_KEY } from '../../../codex-canvas/core/canvasConstants.js';


function getCodexBodyLayoutPerViewportPx() {
    const raw = getComputedStyle(document.body).getPropertyValue('--desktop-scale').trim();
    const fromVar = parseFloat(raw);
    if (Number.isFinite(fromVar) && fromVar > 0.05 && fromVar < 20) return fromVar;
    const tr = getComputedStyle(document.body).transform;
    if (!tr || tr === 'none') return 1;
    const m = tr.match(/matrix\(([-\d.e]+),\s*([-\d.e]+),\s*([-\d.e]+),\s*([-\d.e]+),/);
    if (m) {
        const a = Math.abs(parseFloat(m[1]));
        if (Number.isFinite(a) && a > 0.01) return a;
    }
    const sc = tr.match(/scale\(([-\d.e]+)\)/);
    if (sc) {
        const s = Math.abs(parseFloat(sc[1]));
        if (Number.isFinite(s) && s > 0.01) return s;
    }
    return 1;
}

function clientToWorldCodex(clientX, clientY) {
    if (!s.root) return { x: 0, y: 0 };
    const rr = s.root.getBoundingClientRect();
    const layoutScale = getCodexBodyLayoutPerViewportPx();
    const lx = (clientX - rr.left) / layoutScale;
    const ly = (clientY - rr.top) / layoutScale;
    if (!s.codexWorldEl) {
        return { x: lx, y: ly };
    }
    const z = Math.max(0.05, s.codexViewZoom);
    return {
        x: (lx - s.codexViewPanX) / z,
        y: (ly - s.codexViewPanY) / z
    };
}

function getCodexVisibleWorldBoundsExpanded(marginPx) {
    return computeCodexVisibleWorldBoundsExpanded({
        root: s.root,
        worldEl: s.codexWorldEl,
        panX: s.codexViewPanX,
        panY: s.codexViewPanY,
        zoom: s.codexViewZoom,
        marginPx,
        worldW: CODEX_WORLD_W,
        worldH: CODEX_WORLD_H
    });
}

function clampCodexNodeTopLeftToWorld(x, y, scale, kind = 'hero') {
    const nodeScale = Math.max(CODEX_SCALE_MIN, Math.min(CODEX_SCALE_MAX, Number(scale) || 1));
    const dim = (kind === 'junction' ? CODEX_JUNCTION_BASE_PX : CODEX_IMG_BASE_PX) * nodeScale;
    const W = s.codexWorldEl ? CODEX_WORLD_W : Math.max(1, s.root?.clientWidth || 1);
    const H = s.codexWorldEl ? CODEX_WORLD_H : Math.max(1, s.root?.clientHeight || 1);
    const maxX = Math.max(0, W - dim);
    const maxY = Math.max(0, H - dim);
    return {
        x: Math.max(0, Math.min(x, maxX)),
        y: Math.max(0, Math.min(y, maxY))
    };
}

function getNodeCenterWorldPx(el) {
    if (!el) return { x: 0, y: 0 };
    const baseLeft = parseFloat(el.style.left) || 0;
    const baseTop = parseFloat(el.style.top) || 0;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const { tx, ty } = parseTranslatePxFromTransform(el.style.transform);
    return {
        x: baseLeft + w / 2 + tx,
        y: baseTop + h / 2 + ty
    };
}

function ensureCodexNodeCoordLabel(el) {
    if (!el) return null;
    let lab = el.querySelector(':scope > .codex-node__coord-label');
    if (!lab) {
        lab = document.createElement('div');
        lab.className = 'codex-node__coord-label';
        lab.setAttribute('aria-hidden', 'true');
        lab.title =
            'Node center in world px (cord math). Saved layout uses top-left — center ≈ top-left + half size.';
        el.appendChild(lab);
    }
    return lab;
}

function syncCodexNodeCoordLabels(nodeList) {
    if (!s.root || !s.codexDebugUiVisible) return;
    // Skip in View Mode for performance
    if (s.codexMode === 'view') return;
    const list = nodeList || s.root.querySelectorAll('.codex-node');
    list.forEach((nodeEl) => {
        if (!s.root.contains(nodeEl)) return;
        const lab = ensureCodexNodeCoordLabel(nodeEl);
        const { x, y } = getNodeCenterWorldPx(nodeEl);
        lab.textContent = `${Math.round(x)}, ${Math.round(y)}`;
    });
}

function applyOctilinearSnapOnDragRelease(draggedIds, maxPasses = 14) {
    if (!s.root || !draggedIds || draggedIds.size === 0 || !s.codexEdges.length) return;

    const snapOneNodeFromFixedNeighbors = (nodeEl) => {
        const id = nodeEl.dataset.codexNodeId;
        if (!id) return false;
        const candidates = [];
        for (let j = 0; j < s.codexEdges.length; j++) {
            const e = s.codexEdges[j];
            let fixedId = null;
            let asToEndpoint = false;
            if (e.toId === id && !draggedIds.has(e.fromId)) {
                fixedId = e.fromId;
                asToEndpoint = true;
            } else if (e.fromId === id && !draggedIds.has(e.toId)) {
                fixedId = e.toId;
                asToEndpoint = false;
            }
            if (!fixedId) continue;
            const fixEl = api.codexNodeElById(fixedId);
            if (!fixEl || !s.root.contains(fixEl)) continue;
            const cFix = getNodeCenterWorldPx(fixEl);
            const cMe = getNodeCenterWorldPx(nodeEl);
            if (asToEndpoint) {
                const dx = cMe.x - cFix.x;
                const dy = cMe.y - cFix.y;
                const len = Math.hypot(dx, dy);
                if (len < 0.5) continue;
                const ang = Math.atan2(dy, dx);
                if (cordAngleDistToNearestOctilinearDegFromRad(ang) > CODEX_OCT_SOFT_SNAP_TOL_DEG + 1e-9) {
                    continue;
                }
                const snappedAng = Math.round(ang / CODEX_OCT_RAD) * CODEX_OCT_RAD;
                candidates.push({
                    x: cFix.x + len * Math.cos(snappedAng),
                    y: cFix.y + len * Math.sin(snappedAng)
                });
            } else {
                const dx = cFix.x - cMe.x;
                const dy = cFix.y - cMe.y;
                const len = Math.hypot(dx, dy);
                if (len < 0.5) continue;
                const ang = Math.atan2(dy, dx);
                if (cordAngleDistToNearestOctilinearDegFromRad(ang) > CODEX_OCT_SOFT_SNAP_TOL_DEG + 1e-9) {
                    continue;
                }
                const snappedAng = Math.round(ang / CODEX_OCT_RAD) * CODEX_OCT_RAD;
                candidates.push({
                    x: cFix.x - len * Math.cos(snappedAng),
                    y: cFix.y - len * Math.sin(snappedAng)
                });
            }
        }
        if (!candidates.length) return false;
        let sx = 0;
        let sy = 0;
        for (let i = 0; i < candidates.length; i++) {
            sx += candidates[i].x;
            sy += candidates[i].y;
        }
        const nx = sx / candidates.length;
        const ny = sy / candidates.length;
        const cur = getNodeCenterWorldPx(nodeEl);
        if ((nx - cur.x) ** 2 + (ny - cur.y) ** 2 < CODEX_OCT_RELEASE_SNAP_EPS * CODEX_OCT_RELEASE_SNAP_EPS) {
            return false;
        }
        applyWorldCenterToNodeTopLeft(nodeEl, nx, ny);
        return true;
    };

    const ids = [...draggedIds];
    for (let p = 0; p < maxPasses; p++) {
        let any = false;
        for (let i = 0; i < ids.length; i++) {
            const el = api.codexNodeElById(ids[i]);
            if (el && s.root.contains(el) && snapOneNodeFromFixedNeighbors(el)) any = true;
        }
        if (!any) break;
    }
}

function applyWorldCenterToNodeTopLeft(el, cx, cy) {
    if (!el || !s.root) return;
    const w = el.offsetWidth || 1;
    const h = el.offsetHeight || 1;
    const kind = el.dataset.codexKind || 'hero';
    const scale = parseFloat(el.dataset.codexScale) || 1;
    const left = cx - w / 2;
    const top = cy - h / 2;
    const { x, y } = clampCodexNodeTopLeftToWorld(left, top, scale, kind);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    /* Octilinear snap updates DOM after finishDrag wrote s.codexAllNodes; export uses the model. */
    const nodeId = el.dataset.codexNodeId;
    if (nodeId && Array.isArray(s.codexAllNodes)) {
        const nodeObj = s.codexAllNodes.find((n) => n && n.id === nodeId);
        if (nodeObj) {
            nodeObj.x = x;
            nodeObj.y = y;
        }
    }
}

api.getCodexBodyLayoutPerViewportPx = getCodexBodyLayoutPerViewportPx;
api.clientToWorldCodex = clientToWorldCodex;
api.getCodexVisibleWorldBoundsExpanded = getCodexVisibleWorldBoundsExpanded;
api.clampCodexNodeTopLeftToWorld = clampCodexNodeTopLeftToWorld;
api.getNodeCenterWorldPx = getNodeCenterWorldPx;
api.ensureCodexNodeCoordLabel = ensureCodexNodeCoordLabel;
api.syncCodexNodeCoordLabels = syncCodexNodeCoordLabels;
api.applyOctilinearSnapOnDragRelease = applyOctilinearSnapOnDragRelease;
api.applyWorldCenterToNodeTopLeft = applyWorldCenterToNodeTopLeft;

