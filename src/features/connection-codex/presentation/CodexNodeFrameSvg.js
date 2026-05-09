/**
 * Codex node frame bounds in world/SVG space and SVG mask used to clip cords under portrait alpha.
 */

import { CODEX_NODE_ALPHA_PATH } from '../domain/CodexNodePortraitMetrics.js';

export function parseTranslatePxFromTransform(transformStr) {
    if (!transformStr || transformStr === 'none') return { tx: 0, ty: 0 };
    const m3d = transformStr.match(/translate3d\(([-\d.e]+)px,\s*([-\d.e]+)px/i);
    if (m3d) return { tx: parseFloat(m3d[1]), ty: parseFloat(m3d[2]) };
    const m2d = transformStr.match(/translate\(([-\d.e]+)px,\s*([-\d.e]+)px/i);
    if (m2d) return { tx: parseFloat(m2d[1]), ty: parseFloat(m2d[2]) };
    return { tx: 0, ty: 0 };
}

/** Node frame bounds in SVG / world px (includes in-drag transform), same as centers use. */
export function getNodeFrameWorldRect(el) {
    if (!el) return null;
    const baseLeft = parseFloat(el.style.left) || 0;
    const baseTop = parseFloat(el.style.top) || 0;
    const { tx, ty } = parseTranslatePxFromTransform(el.style.transform);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    return {
        left: baseLeft + tx,
        top: baseTop + ty,
        width: w,
        height: h,
        rotationDeg: parseFloat(el.dataset.codexHexRotation) || 0
    };
}

export function nodeFrameIntersectsRect(el, r) {
    const fr = getNodeFrameWorldRect(el);
    if (!fr || fr.width < 1 || fr.height < 1) return false;
    return !(fr.left + fr.width < r.minX || fr.left > r.maxX || fr.top + fr.height < r.minY || fr.top > r.maxY);
}

/**
 * Mask cords by node alpha art: PNG white keeps strokes visible, black hides them under the hex.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }|null} maskWorldRect — if set, only nodes intersecting this world AABB (faster large graphs).
 * @param {{ getRoot: () => HTMLElement|null, getDebugUiVisible: () => boolean, maskId: string }} ctx
 *        `codexNodeAlphaPath` defaults from `CODEX_NODE_ALPHA_PATH` if omitted.
 */
export function appendCodexEdgeNodeMask(defs, ns, vw, vh, maskWorldRect, ctx) {
    const {
        getRoot,
        getDebugUiVisible,
        maskId,
        codexNodeAlphaPath = CODEX_NODE_ALPHA_PATH
    } = ctx;
    const mask = document.createElementNS(ns, 'mask');
    mask.setAttribute('id', maskId);
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    mask.setAttribute('maskContentUnits', 'userSpaceOnUse');
    mask.setAttribute('x', '0');
    mask.setAttribute('y', '0');
    mask.setAttribute('width', String(vw));
    mask.setAttribute('height', String(vh));
    const base = document.createElementNS(ns, 'rect');
    base.setAttribute('width', String(vw));
    base.setAttribute('height', String(vh));
    base.setAttribute('fill', 'white');
    mask.appendChild(base);
    const root = getRoot();
    if (root) {
        const debugOn = getDebugUiVisible();
        root.querySelectorAll('.codex-node').forEach((el) => {
            if (maskWorldRect && !nodeFrameIntersectsRect(el, maskWorldRect)) return;
            const r = getNodeFrameWorldRect(el);
            if (!r || r.width < 1 || r.height < 1) return;
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            if (el.dataset.codexKind === 'junction') {
                if (!debugOn) return;
                const rad = Math.min(r.width, r.height) / 2;
                const circ = document.createElementNS(ns, 'circle');
                circ.setAttribute('cx', String(cx));
                circ.setAttribute('cy', String(cy));
                circ.setAttribute('r', String(Math.max(1, rad)));
                circ.setAttribute('fill', 'white');
                mask.appendChild(circ);
                return;
            }
            const img = document.createElementNS(ns, 'image');
            const frameVariant = el.dataset.codexFrameVariant || '1';
            const alphaUrl = `${codexNodeAlphaPath}${frameVariant}.png`;
            img.setAttribute('href', alphaUrl);
            img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', alphaUrl);
            img.setAttribute('x', String(r.left));
            img.setAttribute('y', String(r.top));
            img.setAttribute('width', String(r.width));
            img.setAttribute('height', String(r.height));
            img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            if (r.rotationDeg) {
                img.setAttribute('transform', `rotate(${r.rotationDeg} ${cx} ${cy})`);
            }
            mask.appendChild(img);
        });
    }
    defs.appendChild(mask);
}
