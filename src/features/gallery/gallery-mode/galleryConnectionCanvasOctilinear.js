/**
 * Octilinear snap + angle labels for gallery personal connection canvas.
 */

import {
    cordAngleDistToNearestOctilinearDegFromRad,
    cordSegmentDegreesLabel,
    cordSegmentWithinOctilinearToleranceDegrees,
} from '../../codex/codex-edge-cords/geometry/CodexCordOctilinearGeometry.js';
import {
    classifyCodexSegmentAxisOrDiagonal,
    codexElbowParallelogramPoints,
    codexWaypointIsSimpleCorner,
} from '../../codex/codex-node-drawing/junction-decor/CodexJunctionElbowParallelograms.js';
import {
    CODEX_EDGE_DEGREE_FONT_PX,
    CODEX_ELBOW_PARALLELOGRAM_ARM_PX,
    CODEX_OCT_SOFT_SNAP_TOL_DEG,
    CODEX_VISUAL_DEFAULTS,
} from '../../codex/codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import { appendCordFilteredPolygonGroup } from '../../codex/codex-node-drawing/svg/CodexCordSvgElements.js';

export const GALLERY_OCT_RAD = Math.PI / 4;
export const GALLERY_OCT_SOFT_SNAP_TOL_DEG = 10;
export const GALLERY_OCT_RELEASE_SNAP_EPS = 0.35;

/**
 * @param {HTMLElement} el
 */
export function galleryNodeCenterFromEl(el) {
    const x = parseFloat(el.style.left) || 0;
    const y = parseFloat(el.style.top) || 0;
    const w = el.offsetWidth || 0;
    const h = el.offsetHeight || 0;
    return { x: x + w / 2, y: y + h / 2 };
}

/**
 * @param {HTMLElement} el
 * @param {number} cx
 * @param {number} cy
 * @param {number} worldW
 * @param {number} worldH
 */
export function galleryApplyWorldCenterToNodeTopLeft(el, cx, cy, worldW, worldH) {
    const w = el.offsetWidth || 1;
    const h = el.offsetHeight || 1;
    const x = Math.max(0, Math.min(worldW - w, cx - w / 2));
    const y = Math.max(0, Math.min(worldH - h, cy - h / 2));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    return { x, y };
}

/**
 * @param {string} nodeId
 * @param {Set<string>} draggedIds
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {Map<string, HTMLElement>} nodeEls
 * @param {number} worldW
 * @param {number} worldH
 */
function snapOneNodeFromFixedNeighbors(nodeId, draggedIds, edges, nodeEls, worldW, worldH) {
    const nodeEl = nodeEls.get(nodeId);
    if (!nodeEl) return false;

    const candidates = [];
    for (let j = 0; j < edges.length; j += 1) {
        const e = edges[j];
        let fixedId = null;
        let asToEndpoint = false;
        if (e.toId === nodeId && !draggedIds.has(e.fromId)) {
            fixedId = e.fromId;
            asToEndpoint = true;
        } else if (e.fromId === nodeId && !draggedIds.has(e.toId)) {
            fixedId = e.toId;
            asToEndpoint = false;
        }
        if (!fixedId) continue;
        const fixEl = nodeEls.get(fixedId);
        if (!fixEl) continue;
        const cFix = galleryNodeCenterFromEl(fixEl);
        const cMe = galleryNodeCenterFromEl(nodeEl);
        if (asToEndpoint) {
            const dx = cMe.x - cFix.x;
            const dy = cMe.y - cFix.y;
            const len = Math.hypot(dx, dy);
            if (len < 0.5) continue;
            const ang = Math.atan2(dy, dx);
            if (cordAngleDistToNearestOctilinearDegFromRad(ang) > GALLERY_OCT_SOFT_SNAP_TOL_DEG + 1e-9) {
                continue;
            }
            const snappedAng = Math.round(ang / GALLERY_OCT_RAD) * GALLERY_OCT_RAD;
            candidates.push({
                x: cFix.x + len * Math.cos(snappedAng),
                y: cFix.y + len * Math.sin(snappedAng),
            });
        } else {
            const dx = cFix.x - cMe.x;
            const dy = cFix.y - cMe.y;
            const len = Math.hypot(dx, dy);
            if (len < 0.5) continue;
            const ang = Math.atan2(dy, dx);
            if (cordAngleDistToNearestOctilinearDegFromRad(ang) > GALLERY_OCT_SOFT_SNAP_TOL_DEG + 1e-9) {
                continue;
            }
            const snappedAng = Math.round(ang / GALLERY_OCT_RAD) * GALLERY_OCT_RAD;
            candidates.push({
                x: cFix.x - len * Math.cos(snappedAng),
                y: cFix.y - len * Math.sin(snappedAng),
            });
        }
    }
    if (!candidates.length) return false;

    let sx = 0;
    let sy = 0;
    for (let i = 0; i < candidates.length; i += 1) {
        sx += candidates[i].x;
        sy += candidates[i].y;
    }
    const nx = sx / candidates.length;
    const ny = sy / candidates.length;
    const cur = galleryNodeCenterFromEl(nodeEl);
    if ((nx - cur.x) ** 2 + (ny - cur.y) ** 2 < GALLERY_OCT_RELEASE_SNAP_EPS ** 2) {
        return false;
    }
    galleryApplyWorldCenterToNodeTopLeft(nodeEl, nx, ny, worldW, worldH);
    return true;
}

/**
 * @param {Set<string>|string[]} draggedIds
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {Map<string, HTMLElement>} nodeEls
 * @param {object[]} nodes
 * @param {number} worldW
 * @param {number} worldH
 */
export function applyGalleryOctilinearSnapOnDragRelease(
    draggedIds,
    edges,
    nodeEls,
    nodes,
    worldW,
    worldH,
) {
    const dragSet = draggedIds instanceof Set ? draggedIds : new Set(draggedIds);
    if (!dragSet.size || !edges.length) return;

    const ids = Array.from(dragSet);
    for (let pass = 0; pass < 14; pass += 1) {
        let any = false;
        for (let i = 0; i < ids.length; i += 1) {
            if (
                snapOneNodeFromFixedNeighbors(ids[i], dragSet, edges, nodeEls, worldW, worldH)
            ) {
                any = true;
            }
        }
        if (!any) break;
    }

    for (let n = 0; n < nodes.length; n += 1) {
        const rec = nodes[n];
        const el = nodeEls.get(rec.id);
        if (!el) continue;
        rec.x = parseFloat(el.style.left) || rec.x;
        rec.y = parseFloat(el.style.top) || rec.y;
    }
}

/**
 * @param {SVGGElement} parentG
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {Map<string, HTMLElement>} nodeEls
 */
export function appendGalleryEdgeAngleLabels(parentG, edges, nodeEls) {
    const ns = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < edges.length; i += 1) {
        const edge = edges[i];
        const elFrom = nodeEls.get(edge.fromId);
        const elTo = nodeEls.get(edge.toId);
        if (!elFrom || !elTo) continue;
        const p0 = galleryNodeCenterFromEl(elFrom);
        const p1 = galleryNodeCenterFromEl(elTo);
        const deg = cordSegmentDegreesLabel(p0, p1);
        if (deg == null) continue;

        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const len = Math.hypot(dx, dy);
        if (len < 0.5) continue;

        const onOctilinearLane = cordSegmentWithinOctilinearToleranceDegrees(
            p0,
            p1,
            GALLERY_OCT_SOFT_SNAP_TOL_DEG,
        );
        const mx = (p0.x + p1.x) / 2;
        const my = (p0.y + p1.y) / 2;
        const ux = dx / len;
        const uy = dy / len;
        const nx = -uy;
        const ny = ux;
        const off = 36;
        const ax = mx + nx * off;
        const ay = my + ny * off;

        const stackG = document.createElementNS(ns, 'g');
        stackG.classList.add('codex-edge-degree-stack');

        const text = document.createElementNS(ns, 'text');
        text.classList.add('codex-edge-degree');
        if (onOctilinearLane) text.classList.add('codex-edge-degree--octilinear');
        text.setAttribute('font-size', String(CODEX_EDGE_DEGREE_FONT_PX));
        text.setAttribute('x', String(ax));
        text.setAttribute('y', String(ay));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.textContent = `${deg}°`;

        const title = document.createElementNS(ns, 'title');
        title.textContent = onOctilinearLane
            ? `${deg}° — on a 45° lane (within ±${CODEX_OCT_SOFT_SNAP_TOL_DEG}°).`
            : `${deg}° — bearing from node center to node center. Green when within ±${CODEX_OCT_SOFT_SNAP_TOL_DEG}° of a 45° direction.`;

        stackG.append(title, text);
        parentG.appendChild(stackG);
    }
}

/**
 * @param {SVGGElement} parentG
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {Map<string, HTMLElement>} nodeEls
 * @param {string} [cordFilterUrl]
 */
export function appendGalleryJunctionElbows(parentG, edges, nodeEls, cordFilterUrl = '') {
    const ns = 'http://www.w3.org/2000/svg';
    const arm = CODEX_ELBOW_PARALLELOGRAM_ARM_PX;
    const seen = new Set();
    const fill = CODEX_VISUAL_DEFAULTS.cordColor;

    for (let i = 0; i < edges.length; i += 1) {
        const eIn = edges[i];
        const jId = eIn.toId;
        const elJ = nodeEls.get(jId);
        if (!elJ || !elJ.classList.contains('codex-node--junction')) continue;
        if (!codexWaypointIsSimpleCorner(jId, edges)) continue;

        const elA = nodeEls.get(eIn.fromId);
        if (!elA) continue;
        const cJ = galleryNodeCenterFromEl(elJ);
        const cA = galleryNodeCenterFromEl(elA);
        const dxIn = cJ.x - cA.x;
        const dyIn = cJ.y - cA.y;
        const clsIn = classifyCodexSegmentAxisOrDiagonal(dxIn, dyIn);
        if (clsIn !== 'axis' && clsIn !== 'diag') continue;

        for (let j = 0; j < edges.length; j += 1) {
            const eOut = edges[j];
            if (eOut.fromId !== jId) continue;
            const elB = nodeEls.get(eOut.toId);
            if (!elB) continue;
            const cB = galleryNodeCenterFromEl(elB);
            const dxOut = cB.x - cJ.x;
            const dyOut = cB.y - cJ.y;
            const clsOut = classifyCodexSegmentAxisOrDiagonal(dxOut, dyOut);
            if (clsOut !== 'axis' && clsOut !== 'diag') continue;
            if (clsIn === clsOut) continue;

            const key = `${eIn.fromId}\x1e${jId}\x1e${eOut.toId}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const pts = codexElbowParallelogramPoints(cJ.x, cJ.y, dxIn, dyIn, dxOut, dyOut, arm);
            if (!pts) continue;
            const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
            const elbowG = appendCordFilteredPolygonGroup(parentG, ns, {
                pointsStr,
                fill,
                filterUrl: cordFilterUrl,
                polyClass: 'codex-edge-elbow-parallelogram',
            });
            const title = document.createElementNS(ns, 'title');
            title.textContent = 'Axis ↔ diagonal elbow at waypoint (octilinear bend)';
            elbowG.appendChild(title);
        }
    }
}

export { codexWaypointIsSimpleCorner };
