/**
 * Codex node frame bounds in world/SVG space and SVG mask used to clip cords under portrait alpha.
 */

import { CODEX_NODE_ALPHA_PATH } from '../../codex-nodes/placement/CodexNodePortraitMetrics.js';
import {
    CODEX_NODE_HOVER_TRANSITION_MS,
    CODEX_NODE_HOVER_VISUAL_SCALE,
} from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';

export function parseTranslatePxFromTransform(transformStr) {
    if (!transformStr || transformStr === 'none') return { tx: 0, ty: 0 };
    const m3d = transformStr.match(/translate3d\(([-\d.e]+)px,\s*([-\d.e]+)px/i);
    if (m3d) return { tx: parseFloat(m3d[1]), ty: parseFloat(m3d[2]) };
    const m2d = transformStr.match(/translate\(([-\d.e]+)px,\s*([-\d.e]+)px/i);
    if (m2d) return { tx: parseFloat(m2d[1]), ty: parseFloat(m2d[2]) };
    return { tx: 0, ty: 0 };
}

/**
 * Hover scale from CSS `--codex-node-hover-scale` (portrait nodes only).
 * @param {HTMLElement} el
 */
export function readCodexNodeHoverVisualScale(el) {
    const raw = getComputedStyle(el).getPropertyValue('--codex-node-hover-scale').trim();
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 1) return parsed;
    return CODEX_NODE_HOVER_VISUAL_SCALE;
}

/** @type {Map<string, number>} */
const animatedMaskScales = new Map();

/** @type {Map<string, number>} */
const maskAnimRafIds = new Map();

/**
 * @param {HTMLElement} el
 * @returns {number}
 */
export function getNodeVisualScaleMultiplier(el) {
    if (!el || el.classList.contains('codex-node--junction')) return 1;
    if (el.classList.contains('codex-node--filtered-out')) return 1;
    const id = el.dataset.codexNodeId;
    if (id && animatedMaskScales.has(id)) {
        return animatedMaskScales.get(id);
    }
    if (el.matches(':hover')) {
        return readCodexNodeHoverVisualScale(el);
    }
    return 1;
}

/** Expand layout box around its center (transform-origin: center). */
function scaleRectAboutCenter(rect, scale) {
    if (!rect || scale === 1) return rect;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const width = rect.width * scale;
    const height = rect.height * scale;
    return {
        left: cx - width / 2,
        top: cy - height / 2,
        width,
        height,
        rotationDeg: rect.rotationDeg,
    };
}

/** Node frame bounds in SVG / world px (includes in-drag translate + hover scale). */
export function getNodeFrameWorldRect(el) {
    if (!el) return null;
    const baseLeft = parseFloat(el.style.left) || 0;
    const baseTop = parseFloat(el.style.top) || 0;
    const { tx, ty } = parseTranslatePxFromTransform(el.style.transform);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const base = {
        left: baseLeft + tx,
        top: baseTop + ty,
        width: w,
        height: h,
        rotationDeg: parseFloat(el.dataset.codexHexRotation) || 0,
    };
    return scaleRectAboutCenter(base, getNodeVisualScaleMultiplier(el));
}

export function nodeFrameIntersectsRect(el, r) {
    const fr = getNodeFrameWorldRect(el);
    if (!fr || fr.width < 1 || fr.height < 1) return false;
    return !(fr.left + fr.width < r.minX || fr.left > r.maxX || fr.top + fr.height < r.minY || fr.top > r.maxY);
}

/** Matches CSS `ease-out` closely enough for cord mask sync. */
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * @param {HTMLElement} el
 */
export function cancelCodexNodeHoverMaskAnimation(el) {
    const id = el?.dataset?.codexNodeId;
    if (!id) return;
    const raf = maskAnimRafIds.get(id);
    if (raf) {
        cancelAnimationFrame(raf);
        maskAnimRafIds.delete(id);
    }
}

/**
 * Animate cord alpha mask scale in sync with node hover transform.
 * @param {HTMLElement} el
 * @param {number} targetScale
 * @param {() => void} [onFrame]
 */
export function animateCodexNodeHoverMaskScale(el, targetScale, onFrame) {
    const id = el?.dataset?.codexNodeId;
    if (!id || !el) return;

    cancelCodexNodeHoverMaskAnimation(el);

    const hoverScale = readCodexNodeHoverVisualScale(el);
    const startScale = animatedMaskScales.has(id)
        ? animatedMaskScales.get(id)
        : (targetScale > 1 ? 1 : hoverScale);

    if (Math.abs(startScale - targetScale) < 0.001) {
        animatedMaskScales.delete(id);
        onFrame?.();
        return;
    }

    const duration = CODEX_NODE_HOVER_TRANSITION_MS;
    const startTime = performance.now();

    const step = (now) => {
        if (!el.isConnected) {
            maskAnimRafIds.delete(id);
            animatedMaskScales.delete(id);
            return;
        }

        const t = duration <= 0 ? 1 : Math.min(1, (now - startTime) / duration);
        const current = startScale + (targetScale - startScale) * easeOutCubic(t);

        if (Math.abs(current - 1) < 0.001 && Math.abs(targetScale - 1) < 0.001) {
            animatedMaskScales.delete(id);
        } else {
            animatedMaskScales.set(id, current);
        }

        onFrame?.();

        if (t < 1) {
            maskAnimRafIds.set(id, requestAnimationFrame(step));
            return;
        }

        maskAnimRafIds.delete(id);
        animatedMaskScales.delete(id);
        onFrame?.();
    };

    animatedMaskScales.set(id, startScale);
    maskAnimRafIds.set(id, requestAnimationFrame(step));
}

/**
 * @param {SVGMaskElement} mask
 * @param {string} ns
 * @param {{ left: number, top: number, width: number, height: number, rotationDeg?: number }} r
 * @param {string} frameVariant
 * @param {string} codexNodeAlphaPath
 * @param {number} [scale]
 */
function appendPortraitAlphaMaskImage(mask, ns, r, frameVariant, codexNodeAlphaPath, scale = 1) {
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const w = r.width * scale;
    const h = r.height * scale;
    const x = cx - w / 2;
    const y = cy - h / 2;
    const alphaUrl = `${codexNodeAlphaPath}${frameVariant}.png`;
    const img = document.createElementNS(ns, 'image');
    img.setAttribute('href', alphaUrl);
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', alphaUrl);
    img.setAttribute('x', String(x));
    img.setAttribute('y', String(y));
    img.setAttribute('width', String(w));
    img.setAttribute('height', String(h));
    img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    if (r.rotationDeg) {
        img.setAttribute('transform', `rotate(${r.rotationDeg} ${cx} ${cy})`);
    }
    mask.appendChild(img);
}

/**
 * Mask cords by node alpha art: PNG white keeps strokes visible, black hides them under the hex.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }|null} maskWorldRect — if set, only nodes intersecting this world AABB (faster large graphs).
 * @param {{ getRoot: () => HTMLElement|null, maskId: string }} ctx
 *        `codexNodeAlphaPath` defaults from `CODEX_NODE_ALPHA_PATH` if omitted.
 */
export function appendCodexEdgeNodeMask(defs, ns, vw, vh, maskWorldRect, ctx) {
    const {
        getRoot,
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
        root.querySelectorAll('.codex-node').forEach((el) => {
            if (maskWorldRect && !nodeFrameIntersectsRect(el, maskWorldRect)) return;
            if (el.dataset.codexKind === 'junction') return;
            const r = getNodeFrameWorldRect(el);
            if (!r || r.width < 1 || r.height < 1) return;
            const frameVariant = el.dataset.codexFrameVariant || '1';
            appendPortraitAlphaMaskImage(mask, ns, r, frameVariant, codexNodeAlphaPath, 1);
        });
    }
    defs.appendChild(mask);
}
