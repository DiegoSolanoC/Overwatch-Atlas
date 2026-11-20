/**
 * Side-panel + dock trapezium chrome.
 * Sides share size; each side trap has its own vertical slide; dock sizes independently.
 * Live CSS vars on :root — Save writes localStorage.
 *
 * Strokes are INLINE SVGs (not CSS background data-URLs). Background SVGs get
 * non-uniformly stretched so edges thin out and separate lip bars never join the trap.
 * viewBox matches client px so stroke-width stays even. Do NOT use non-scaling-stroke:
 * body { transform: scale(--desktop-scale) } makes Firefox keep those strokes in device
 * px while filled inward lips scale — Chrome/Firefox proportions then diverge.
 */

const STORAGE_KEY = 'atlas.sidePanelsTrap.tweak.v2';
const SVG_NS = 'http://www.w3.org/2000/svg';

export const SIDE_PANELS_TRAP_TWEAK_DEFAULTS = Object.freeze({
    /** Shared side-trap body height (excludes +8 visual pad). */
    trapHeightPx: 160,
    /** Shared outward depth (CSS px). */
    trapProtrudePx: 64,
    /** Shared short-side inset % (0 = rectangle). */
    trapTaperPct: 12,
    /** Shared white stroke weight (CSS px via non-scaling-stroke). */
    sideBorderWidth: 20,
    /** Corner rounding on side-panel trap borders (viewBox units, 0–100). */
    sideBorderRadius: 0,

    /** Independent vertical placement: 0 = top, 50 = center, 100 = bottom. */
    infoTrapPosPct: 50,
    filtersTrapPosPct: 32,
    musicTrapPosPct: 68,
    /**
     * When 1, filters/music stay mirrored about center (music = 100 − filters).
     * Individual offset is discarded; one slide drives a symmetrical spread.
     */
    filtersMusicMirror: 1,

    /** Dock trap — independent from sides (no vertical slide). */
    dockTrapHeightPx: 80,
    dockTrapWidthPx: 720,
    dockTrapTaperPct: 12,
    dockBorderWidth: 20,
    /** Corner rounding on dock trap path (viewBox units). */
    dockBorderRadius: 0,
    /**
     * Whole dock-trap button unit Y (CSS px). Positive = down into the
     * merged trap/dock band; negative = up toward the nub.
     */
    dockButtonsOffsetYPx: 0,

    /**
     * Dock inward lip (thick white bar above the page slider).
     * Thickness in CSS px; Offset Y = parallel gap past the outer stroke
     * (positive = into the dock / toward thumbs; negative = toward the border).
     * Center cut: two mirrored ribbons with a tunable open gap at dock center.
     * End shrinkage: tip only at the screen-side ends (center butts stay full).
     */
    dockInwardLineThicknessPx: 12,
    dockInwardLineOffsetYPx: 0,
    /** Open gap at center between the two mirrored lips (CSS px). Smaller = closer. */
    dockInwardCenterGapPx: 200,
    /** Extra top pad under the lip so the page slider clears the white bar. */
    dockInwardSliderClearancePx: 8,
    /** Same clearance while the dock is collapsed (often tighter). */
    dockInwardSliderClearanceCollapsedPx: 4,
    /** Thin run at each screen-side end (two clear levels: full → tip). */
    dockInwardEndThicknessPx: 4,
    dockInwardTipWidthPx: 36,
    dockInwardSlopeWidthPx: 48,
    /** Fillet radius at tip ends and vertical center-cut corners (CSS px). */
    dockInwardCornerRadiusPx: 8,

    /**
     * Side-panel inward lip (parallel to continuous edge). No end shrinkage —
     * constant thickness with tip cuts at trap buttons only.
     */
    sideInwardLineThicknessPx: 12,
    /** Parallel gap past the outer stroke before the lip (into panel fill). */
    sideInwardLineOffsetPx: 2,
    sideInwardCenterGapPx: 200,
    sideInwardCornerRadiusPx: 8,

    /**
     * White filled “nub” tabs (replace Drag/Controller Border images).
     * Side: on the inward tip of each side trap. Dock: on the top edge of the dock trap.
     */
    sideNubDepthPx: 28,
    sideNubLengthPx: 72,
    sideNubTaperPct: 14,
    sideNubRadiusPx: 0,
    sideNubArrowPx: 28,
    /** Colored label pill behind the trap logo (side panels only). */
    sideTrapBtnRadiusPx: 48,
    sideTrapBtnWidthPx: 40,
    sideTrapBtnHeightPx: 96,
    /**
     * Horizontal pill shift toward the trap tip / hub (CSS px).
     * Positive = into the tip; uses the extra bay from the inward lip.
     */
    sideTrapBtnOffsetXPx: 0,
    sideTrapIconPx: 28,
    dockNubWidthPx: 120,
    dockNubHeightPx: 40,
    dockNubTaperPct: 14,
    dockNubRadiusPx: 0,
    dockNubArrowPx: 28,
});

function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
}

function cloneDefaults() {
    return { ...SIDE_PANELS_TRAP_TWEAK_DEFAULTS };
}

export function cloneSidePanelsTrapDefaults() {
    return cloneDefaults();
}

export function sanitizeSidePanelsTrapState(s) {
    const next = { ...s };
    next.trapHeightPx = clamp(Math.round(Number(next.trapHeightPx)), 80, 560);
    next.trapProtrudePx = clamp(Math.round(Number(next.trapProtrudePx)), 36, 120);
    next.trapTaperPct = clamp(Number(next.trapTaperPct), 0, 28);
    next.sideBorderWidth = clamp(Number(next.sideBorderWidth), 8, 36);
    next.sideBorderRadius = clamp(Number(next.sideBorderRadius), 0, 24);

    next.infoTrapPosPct = clamp(Number(next.infoTrapPosPct), 0, 100);
    next.filtersTrapPosPct = clamp(Number(next.filtersTrapPosPct), 0, 100);
    next.musicTrapPosPct = clamp(Number(next.musicTrapPosPct), 0, 100);
    next.filtersMusicMirror = Number(next.filtersMusicMirror) ? 1 : 0;
    if (next.filtersMusicMirror) {
        next.musicTrapPosPct = clamp(100 - next.filtersTrapPosPct, 0, 100);
    }

    next.dockTrapHeightPx = clamp(Math.round(Number(next.dockTrapHeightPx)), 48, 160);
    next.dockTrapWidthPx = clamp(Math.round(Number(next.dockTrapWidthPx)), 280, 1100);
    next.dockTrapTaperPct = clamp(Number(next.dockTrapTaperPct), 0, 28);
    next.dockBorderWidth = clamp(Number(next.dockBorderWidth), 8, 36);
    next.dockBorderRadius = clamp(Number(next.dockBorderRadius), 0, 24);
    next.dockButtonsOffsetYPx = clamp(Math.round(Number(next.dockButtonsOffsetYPx)), -48, 96);
    next.dockInwardLineThicknessPx = clamp(Math.round(Number(next.dockInwardLineThicknessPx)), 4, 28);
    /*
     * Parallel inset must stay inside the trap height — past ~0.45×trapH the
     * slope offsets self-intersect and the SVG explodes into spikes.
     */
    {
        const maxDown = Math.max(
            8,
            Math.floor(next.dockTrapHeightPx * 0.42 - next.dockInwardLineThicknessPx * 0.35),
        );
        next.dockInwardLineOffsetYPx = clamp(
            Math.round(Number(next.dockInwardLineOffsetYPx)),
            -24,
            maxDown,
        );
    }
    /* Migrate legacy button-tied clearance → absolute center gap if needed. */
    if (
        next.dockInwardCenterGapPx == null &&
        next.dockInwardButtonClearancePx != null &&
        Number.isFinite(Number(next.dockInwardButtonClearancePx))
    ) {
        next.dockInwardCenterGapPx = 200 + Number(next.dockInwardButtonClearancePx);
    }
    next.dockInwardCenterGapPx = clamp(Math.round(Number(next.dockInwardCenterGapPx)), 24, 900);
    next.dockInwardSliderClearancePx = clamp(
        Math.round(Number(next.dockInwardSliderClearancePx)),
        0,
        80,
    );
    next.dockInwardSliderClearanceCollapsedPx = clamp(
        Math.round(
            Number(
                next.dockInwardSliderClearanceCollapsedPx ?? next.dockInwardSliderClearancePx,
            ),
        ),
        0,
        80,
    );
    delete next.dockInwardButtonClearancePx;
    next.dockInwardEndThicknessPx = clamp(
        Math.round(Number(next.dockInwardEndThicknessPx)),
        1,
        next.dockInwardLineThicknessPx,
    );
    next.dockInwardTipWidthPx = clamp(Math.round(Number(next.dockInwardTipWidthPx)), 0, 480);
    next.dockInwardSlopeWidthPx = clamp(Math.round(Number(next.dockInwardSlopeWidthPx)), 4, 200);
    next.dockInwardCornerRadiusPx = clamp(Math.round(Number(next.dockInwardCornerRadiusPx)), 0, 48);
    /* Drop legacy mid-step keys if present in saved state. */
    delete next.dockInwardMidThicknessPx;
    delete next.dockInwardMidRunWidthPx;

    /* Side inward — migrate from shared dock keys if first load after split. */
    if (next.sideInwardLineThicknessPx == null && next.dockInwardLineThicknessPx != null) {
        next.sideInwardLineThicknessPx = next.dockInwardLineThicknessPx;
    }
    if (next.sideInwardLineOffsetPx == null && next.dockInwardLineOffsetYPx != null) {
        next.sideInwardLineOffsetPx = Math.max(0, next.dockInwardLineOffsetYPx);
    }
    if (next.sideInwardCenterGapPx == null && next.dockInwardCenterGapPx != null) {
        next.sideInwardCenterGapPx = next.dockInwardCenterGapPx;
    }
    if (next.sideInwardCornerRadiusPx == null && next.dockInwardCornerRadiusPx != null) {
        next.sideInwardCornerRadiusPx = next.dockInwardCornerRadiusPx;
    }
    next.sideInwardLineThicknessPx = clamp(
        Math.round(Number(next.sideInwardLineThicknessPx)),
        4,
        28,
    );
    next.sideInwardLineOffsetPx = clamp(Math.round(Number(next.sideInwardLineOffsetPx)), -24, 56);
    next.sideInwardCenterGapPx = clamp(Math.round(Number(next.sideInwardCenterGapPx)), 24, 900);
    next.sideInwardCornerRadiusPx = clamp(
        Math.round(Number(next.sideInwardCornerRadiusPx)),
        0,
        48,
    );

    next.sideNubDepthPx = clamp(Math.round(Number(next.sideNubDepthPx)), 16, 80);
    next.sideNubLengthPx = clamp(Math.round(Number(next.sideNubLengthPx)), 36, 180);
    next.sideNubTaperPct = clamp(Number(next.sideNubTaperPct), 0, 28);
    next.sideNubRadiusPx = clamp(Number(next.sideNubRadiusPx), 0, 40);
    next.sideNubArrowPx = clamp(Math.round(Number(next.sideNubArrowPx)), 10, 96);
    next.sideTrapBtnRadiusPx = clamp(Math.round(Number(next.sideTrapBtnRadiusPx)), 0, 48);
    next.sideTrapBtnWidthPx = clamp(Math.round(Number(next.sideTrapBtnWidthPx)), 24, 96);
    next.sideTrapBtnHeightPx = clamp(Math.round(Number(next.sideTrapBtnHeightPx)), 48, 200);
    next.sideTrapBtnOffsetXPx = clamp(Math.round(Number(next.sideTrapBtnOffsetXPx)), -32, 48);
    next.sideTrapIconPx = clamp(Math.round(Number(next.sideTrapIconPx)), 12, 96);
    next.dockNubWidthPx = clamp(Math.round(Number(next.dockNubWidthPx)), 48, 280);
    next.dockNubHeightPx = clamp(Math.round(Number(next.dockNubHeightPx)), 16, 96);
    next.dockNubTaperPct = clamp(Number(next.dockNubTaperPct), 0, 28);
    next.dockNubRadiusPx = clamp(Number(next.dockNubRadiusPx), 0, 40);
    next.dockNubArrowPx = clamp(Math.round(Number(next.dockNubArrowPx)), 10, 96);
    return next;
}

export function loadSidePanelsTrapState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('atlas.sidePanelsTrap.tweak.v1');
        if (!raw) return cloneDefaults();
        const parsed = JSON.parse(raw);
        const next = cloneDefaults();
        for (const key of Object.keys(SIDE_PANELS_TRAP_TWEAK_DEFAULTS)) {
            if (parsed[key] != null && Number.isFinite(Number(parsed[key]))) {
                next[key] = Number(parsed[key]);
            }
        }
        /* v1 → v2: single pos became three; dock mirrored side size. */
        if (parsed.trapPosPct != null && Number.isFinite(Number(parsed.trapPosPct))) {
            const p = Number(parsed.trapPosPct);
            if (parsed.infoTrapPosPct == null) next.infoTrapPosPct = p;
            if (parsed.filtersTrapPosPct == null) next.filtersTrapPosPct = clamp(p - 18, 0, 100);
            if (parsed.musicTrapPosPct == null) next.musicTrapPosPct = clamp(p + 18, 0, 100);
        }
        if (parsed.dockTrapHeightPx == null && parsed.trapHeightPx != null) {
            next.dockTrapHeightPx = clamp(Math.round(Number(parsed.trapHeightPx) / 2), 48, 160);
        }
        if (parsed.dockTrapTaperPct == null && parsed.trapTaperPct != null) {
            next.dockTrapTaperPct = Number(parsed.trapTaperPct);
        }
        if (parsed.dockTrapWidthPx == null && parsed.trapProtrudePx != null) {
            next.dockTrapWidthPx = clamp(Math.round(280 + Number(parsed.trapProtrudePx) * 8), 280, 1100);
        }
        /* Split side inward from dock inward — seed from dock if side keys absent. */
        if (parsed.sideInwardLineThicknessPx == null && parsed.dockInwardLineThicknessPx != null) {
            next.sideInwardLineThicknessPx = Number(parsed.dockInwardLineThicknessPx);
        }
        if (parsed.sideInwardLineOffsetPx == null && parsed.dockInwardLineOffsetYPx != null) {
            next.sideInwardLineOffsetPx = Math.max(0, Number(parsed.dockInwardLineOffsetYPx));
        }
        if (parsed.sideInwardCenterGapPx == null && parsed.dockInwardCenterGapPx != null) {
            next.sideInwardCenterGapPx = Number(parsed.dockInwardCenterGapPx);
        }
        if (parsed.sideInwardCornerRadiusPx == null && parsed.dockInwardCornerRadiusPx != null) {
            next.sideInwardCornerRadiusPx = Number(parsed.dockInwardCornerRadiusPx);
        }
        return sanitizeSidePanelsTrapState(next);
    } catch {
        return cloneDefaults();
    }
}

export function saveSidePanelsTrapState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeSidePanelsTrapState(state)));
    } catch {
        /* ignore */
    }
}

/**
 * Closed polygon with quadratic fillets (for solid white nub fills).
 * @param {{ x: number, y: number }[]} pts
 * @param {number} radius
 */
function roundedPolygonPath(pts, radius) {
    const n = pts.length;
    if (n < 3) return '';
    const rIn = Math.max(0, Number(radius) || 0);
    if (rIn < 0.05) {
        return `M ${pts.map((p) => `${p.x},${p.y}`).join(' L ')} Z`;
    }
    let d = '';
    for (let i = 0; i < n; i++) {
        const prev = pts[(i - 1 + n) % n];
        const curr = pts[i];
        const next = pts[(i + 1) % n];
        const v1x = curr.x - prev.x;
        const v1y = curr.y - prev.y;
        const v2x = next.x - curr.x;
        const v2y = next.y - curr.y;
        const len1 = Math.hypot(v1x, v1y) || 1;
        const len2 = Math.hypot(v2x, v2y) || 1;
        const r = Math.min(rIn, len1 * 0.45, len2 * 0.45);
        const p1x = curr.x - (v1x / len1) * r;
        const p1y = curr.y - (v1y / len1) * r;
        const p2x = curr.x + (v2x / len2) * r;
        const p2y = curr.y + (v2y / len2) * r;
        if (i === 0) d += `M ${p1x},${p1y}`;
        else d += ` L ${p1x},${p1y}`;
        d += ` Q ${curr.x},${curr.y} ${p2x},${p2y}`;
    }
    return `${d} Z`;
}

/**
 * Solid white nub fill as CSS background (viewBox 0–100, matches clip language).
 * @param {'right' | 'left' | 'up'} tip
 * @param {number} taperPct
 * @param {number} radius
 */
function buildNubFillUrl(tip, taperPct, radius) {
    const t = clamp(Number(taperPct) || 0, 0, 40);
    /*
     * Match parent trap tip: short vertical on the tip side (toward hub for sides,
     * toward top for dock). Previous left/right arrays were inverted.
     */
    const pts =
        tip === 'up'
            ? [
                  /* Narrow top, wide bottom — tab sitting on dock top edge. */
                  { x: t, y: 0 },
                  { x: 100 - t, y: 0 },
                  { x: 100, y: 100 },
                  { x: 0, y: 100 },
              ]
            : tip === 'left'
              ? [
                    /* Short tip on the left (right-panel inward face). */
                    { x: 0, y: t },
                    { x: 100, y: 0 },
                    { x: 100, y: 100 },
                    { x: 0, y: 100 - t },
                ]
              : [
                    /* Short tip on the right (left-panel inward face). */
                    { x: 0, y: 0 },
                    { x: 100, y: t },
                    { x: 100, y: 100 - t },
                    { x: 0, y: 100 },
                ];
    const d = roundedPolygonPath(pts, radius);
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">` +
        `<path d="${d}" fill="#ffffff"/>` +
        `</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Open polyline with quadratic fillets on intermediate corners (no close).
 * @param {{ x: number, y: number }[]} pts
 * @param {number} radius
 */
function roundedPolylinePath(pts, radius) {
    const n = pts.length;
    if (n < 2) return '';
    const rIn = Math.max(0, Number(radius) || 0);
    if (rIn < 0.05 || n === 2) {
        return `M ${pts.map((p) => `${p.x},${p.y}`).join(' L ')}`;
    }
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < n - 1; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const next = pts[i + 1];
        const v1x = curr.x - prev.x;
        const v1y = curr.y - prev.y;
        const v2x = next.x - curr.x;
        const v2y = next.y - curr.y;
        const len1 = Math.hypot(v1x, v1y) || 1;
        const len2 = Math.hypot(v2x, v2y) || 1;
        const r = Math.min(rIn, len1 * 0.45, len2 * 0.45);
        const p1x = curr.x - (v1x / len1) * r;
        const p1y = curr.y - (v1y / len1) * r;
        const p2x = curr.x + (v2x / len2) * r;
        const p2y = curr.y + (v2y / len2) * r;
        d += ` L ${p1x},${p1y} Q ${curr.x},${curr.y} ${p2x},${p2y}`;
    }
    const last = pts[n - 1];
    d += ` L ${last.x},${last.y}`;
    return d;
}

/**
 * Same corner fillets as roundedPolylinePath, but returns sampled points.
 * @param {{x:number,y:number}[]} pts
 * @param {number} radius
 * @param {number} [curveSteps]
 */
function sampleRoundedPolyline(pts, radius, curveSteps = 6) {
    const n = pts.length;
    if (n < 2) return pts.map((p) => ({ ...p }));
    const rIn = Math.max(0, Number(radius) || 0);
    if (rIn < 0.05 || n === 2) return pts.map((p) => ({ ...p }));

    const out = [{ ...pts[0] }];
    for (let i = 1; i < n - 1; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const next = pts[i + 1];
        const v1x = curr.x - prev.x;
        const v1y = curr.y - prev.y;
        const v2x = next.x - curr.x;
        const v2y = next.y - curr.y;
        const len1 = Math.hypot(v1x, v1y) || 1;
        const len2 = Math.hypot(v2x, v2y) || 1;
        const r = Math.min(rIn, len1 * 0.45, len2 * 0.45);
        const p1 = { x: curr.x - (v1x / len1) * r, y: curr.y - (v1y / len1) * r };
        const p2 = { x: curr.x + (v2x / len2) * r, y: curr.y + (v2y / len2) * r };
        out.push(p1);
        for (let k = 1; k <= curveSteps; k++) {
            const t = k / curveSteps;
            const u = 1 - t;
            out.push({
                x: u * u * p1.x + 2 * u * t * curr.x + t * t * p2.x,
                y: u * u * p1.y + 2 * u * t * curr.y + t * t * p2.y,
            });
        }
    }
    out.push({ ...pts[n - 1] });
    return out;
}

/**
 * @param {ParentNode} parent
 * @param {string} className
 * @returns {SVGSVGElement}
 */
function ensureStrokeSvg(parent, className) {
    let svg = parent.querySelector(`:scope > svg.${className}`);
    if (svg instanceof SVGSVGElement) return svg;
    svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add(className);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('preserveAspectRatio', 'none');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#ffffff');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('stroke-linecap', 'butt');
    /* Scale with body --desktop-scale (parity with filled inward lips across browsers). */
    path.removeAttribute('vector-effect');
    svg.appendChild(path);
    parent.appendChild(svg);
    return svg;
}

/**
 * @param {SVGSVGElement} svg
 * @param {string} d
 * @param {number} strokeWidth
 * @param {number} vbW
 * @param {number} vbH
 */
function writeStrokePath(svg, d, strokeWidth, vbW, vbH) {
    /* Integer viewBox avoids Firefox subpixel stretch vs CSS box. */
    const w = Math.max(1, Math.round(vbW));
    const h = Math.max(1, Math.round(vbH));
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const path = svg.querySelector('path');
    if (!(path instanceof SVGPathElement)) return;
    path.setAttribute('d', d);
    path.setAttribute('stroke-width', String(clamp(Number(strokeWidth) || 20, 4, 48)));
    path.removeAttribute('vector-effect');
}

/**
 * Dock trap geometry in the CAP-ROW's painted CSS px (clientWidth/Height).
 * Border path and fill silhouette both use this — fill is forced to follow the border.
 * @param {object} s
 * @param {Element | null} [capEl]
 */
function dockTrapGeometry(s, capEl) {
    const dock = typeof document !== 'undefined' ? document.querySelector('.pagination-dock') : null;
    const cap =
        capEl ||
        (typeof document !== 'undefined' ? document.querySelector('.pagination-dock-top-cap-row') : null);
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1400;
    /*
     * clientWidth/Height = the SVG's 100% box. getBoundingClientRect can disagree
     * under zoom/transform and stretched the stroke away from the fill.
     */
    const dockW = Math.max(1, cap?.clientWidth || dock?.clientWidth || vw);
    const trapH = Math.max(1, cap?.clientHeight || s.dockTrapHeightPx);
    const trapW = Math.min(dockW * 0.88, s.dockTrapWidthPx, Math.max(160, dockW - 48));
    const halfPx = trapW / 2;
    const insetPx = (trapW * s.dockTrapTaperPct) / 100;
    const leftPx = (dockW - trapW) / 2;
    const rightPx = leftPx + trapW;
    return {
        dockW,
        trapW,
        halfPx,
        insetPx,
        trapH,
        leftPx,
        rightPx,
        /* % of dock — same numbers the stroke path uses (fill must follow border). */
        leftPct: (leftPx / dockW) * 100,
        rightPct: (rightPx / dockW) * 100,
        topLeftPct: ((leftPx + insetPx) / dockW) * 100,
        topRightPct: ((rightPx - insetPx) / dockW) * 100,
    };
}

/**
 * One continuous dock path: left lip → trap → right lip (open along bottom seam).
 * viewBox = painted client box so path px == screen px (no stretch drift).
 * @param {object} s
 * @param {ReturnType<typeof dockTrapGeometry>} geo
 */
function syncDockEdgeStroke(s, geo) {
    const cap = document.querySelector('.pagination-dock-top-cap-row');
    if (!cap) return null;
    const svg = ensureStrokeSvg(cap, 'dock-trap-edge-stroke');
    /* Re-measure after SVG is in the tree so viewBox matches the painted box. */
    const live = dockTrapGeometry(s, cap);
    const W = Math.max(1, Math.round(live.dockW));
    const H = Math.max(1, Math.round(live.trapH));
    const sx = W / Math.max(1, live.dockW);
    const leftPx = live.leftPx * sx;
    const rightPx = live.rightPx * sx;
    const insetPx = live.insetPx * sx;
    const pts = [
        { x: 0, y: H },
        { x: leftPx, y: H },
        { x: leftPx + insetPx, y: 0 },
        { x: rightPx - insetPx, y: 0 },
        { x: rightPx, y: H },
        { x: W, y: H },
    ];
    writeStrokePath(
        svg,
        roundedPolylinePath(pts, s.dockBorderRadius),
        s.dockBorderWidth,
        W,
        H,
    );
    return { ...live, dockW: W, trapH: H, leftPx, rightPx, insetPx, halfPx: (rightPx - leftPx) / 2 };
}

/**
 * Force fill / trapezoid host to the border silhouette (border is source of truth).
 * @param {CSSStyleDeclaration} rootStyle
 * @param {object} s
 * @param {ReturnType<typeof dockTrapGeometry>} geo
 */
function applyDockFillFromBorder(rootStyle, s, geo) {
    rootStyle.setProperty('--dock-trap-height', `${Math.round(geo.trapH)}px`);
    rootStyle.setProperty('--dock-trap-taper', String(s.dockTrapTaperPct));
    rootStyle.setProperty('--dock-trapezoid-offset-y', '0px');
    rootStyle.setProperty('--dock-trapezoid-width', `${Math.round(geo.trapW)}px`);
    rootStyle.setProperty('--dock-trap-half-w', `${Math.round(geo.halfPx)}px`);
    rootStyle.setProperty('--dock-trap-inset-len', `${Math.round(geo.insetPx)}px`);
    rootStyle.setProperty('--dock-edge-border-px', `${s.dockBorderWidth}px`);
    rootStyle.setProperty('--dock-edge-radius-px', `${s.dockBorderRadius}px`);
    /*
     * Silhouette clip in the same % space as the stroke path feet/top —
     * trapezium follows the border, not a parallel formula.
     */
    rootStyle.setProperty(
        '--dock-trap-silhouette-clip',
        `polygon(` +
            `0% var(--dock-trap-height, ${Math.round(geo.trapH)}px), ` +
            `${geo.leftPct}% var(--dock-trap-height, ${Math.round(geo.trapH)}px), ` +
            `${geo.topLeftPct}% 0px, ` +
            `${geo.topRightPct}% 0px, ` +
            `${geo.rightPct}% var(--dock-trap-height, ${Math.round(geo.trapH)}px), ` +
            `100% var(--dock-trap-height, ${Math.round(geo.trapH)}px), ` +
            `100% 100%, ` +
            `0% 100%` +
            `)`,
    );
}

/**
 * Side trap open polyline in 0–100 viewBox (matches clip-path %).
 * @param {'left' | 'right'} side
 * @param {number} taperPct
 */
function sideTrapPoints(side, taperPct) {
    const t = clamp(Number(taperPct) || 0, 0, 40);
    return side === 'left'
        ? [
              { x: 100, y: 0 },
              { x: 0, y: t },
              { x: 0, y: 100 - t },
              { x: 100, y: 100 },
          ]
        : [
              { x: 0, y: 0 },
              { x: 100, y: t },
              { x: 100, y: 100 - t },
              { x: 0, y: 100 },
          ];
}

/**
 * Trap band(s) in handle-local layout px (offset*, not getBoundingClientRect —
 * body scale would desync viewBox path from clientWidth/Height).
 * Dual traps: sibling handles share the same panel top, so each label.offsetTop
 * is already in the host's Y space.
 * @param {Element} _hostHandle
 * @param {Element[]} trapHandles
 * @returns {{top:number,height:number}[]}
 */
function measureSideTrapBands(_hostHandle, trapHandles) {
    /** @type {{top:number,height:number}[]} */
    const out = [];
    for (let i = 0; i < trapHandles.length; i++) {
        const h = trapHandles[i];
        const label = h.querySelector('.panel-resize-handle__trap-label');
        if (!(label instanceof HTMLElement) || !(label.offsetHeight > 4)) continue;
        out.push({
            top: label.offsetTop,
            height: label.offsetHeight,
        });
    }
    return out.sort((a, b) => a.top - b.top);
}

/**
 * One continuous side-edge stroke (seams + every trap) — same idea as dock-trap-edge-stroke.
 * Always authored as right-protruding (info), then mirrored for filters so dual
 * traps share the proven single-trap math.
 * @param {Element} measureEl handle used for clientWidth/Height + trap labels
 * @param {'left'|'right'} protrudeDir
 * @param {{top:number,height:number}[]} traps
 * @param {object} s
 * @param {Element} [paintParent] SVG host (defaults to measureEl; filters uses panel edge host)
 */
function syncSidePanelEdgeStroke(measureEl, protrudeDir, traps, s, paintParent) {
    if (!measureEl || !traps.length) return null;
    const parent = paintParent || measureEl;
    const handleW = measureEl.clientWidth;
    const handleH = measureEl.clientHeight;
    if (!(handleW > 4) || !(handleH > 8)) return null;

    const label = measureEl.querySelector('.panel-resize-handle__trap-label');
    const labelW = label instanceof HTMLElement ? label.offsetWidth : 0;
    const protrude = Math.min(
        handleW,
        Math.max(24, labelW > 8 ? labelW : Number(s.trapProtrudePx) || 64),
    );
    /* Local authoring space: seam at x=0, tip at x=protrude (matches working info side). */
    const edgeRadius = Math.max(s.sideBorderRadius, s.dockBorderRadius);
    const localPts = sideInwardOuterPoints(
        'right',
        handleH,
        0,
        protrude,
        traps,
        s.trapTaperPct,
    );
    const outerPts =
        protrudeDir === 'left' ? mirrorPtsX(localPts, handleW) : localPts;
    const seamX = protrudeDir === 'right' ? 0 : handleW;
    const tipX = protrudeDir === 'right' ? protrude : handleW - protrude;
    /* Retire fragmented per-trap strokes — one path owns the whole edge. */
    parent.querySelectorAll(':scope > svg.panel-trap-edge-stroke').forEach((el) => {
        el.remove();
    });
    const svg = ensureStrokeSvg(parent, 'panel-side-edge-stroke');
    writeStrokePath(
        svg,
        roundedPolylinePath(outerPts, edgeRadius),
        s.sideBorderWidth,
        handleW,
        handleH,
    );
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '1';
    svg.style.overflow = 'visible';
    return {
        handleW,
        handleH,
        protrude,
        seamX,
        tipX,
        localPts,
        outerPts,
        traps,
        edgeRadius,
        protrudeDir,
    };
}

function syncAllSideTrapStrokes(s) {
    /* Continuous edge + inward line are applied together in syncAllSidePanelEdges. */
    syncAllSidePanelEdges(s);
}

/** Drop obsolete hosts from earlier border attempts. */
function cleanupLegacyEdgeHosts() {
    document
        .querySelectorAll('.panel-body-edge-stroke, .dock-top-edge-stroke, .panel-seam-edge-stroke')
        .forEach((el) => el.remove());
}

/**
 * @param {number} taperPct
 */
export function syncDockTrapSvgTaper(taperPct) {
    /* Match CSS clip / border stroke: top inset = taper% of trap width. */
    const t = clamp(Number(taperPct) || 0, 0, 40);
    const points = `${t},0 ${100 - t},0 100,100 0,100`;

    document.querySelectorAll('.pagination-dock-top-trapezoid__fill').forEach((el) => {
        if (el instanceof SVGPolygonElement) el.setAttribute('points', points);
    });
}

export function refreshDockTrapSvgFromTweaks() {
    applySidePanelsTrapChrome(loadSidePanelsTrapState());
}

let chromeResizeInstalled = false;
let chromeResizeTimer = 0;
let chromeTweenTimer = 0;
let chromeTweenRaf = 0;
let chromeTweening = false;
/** @type {ResizeObserver | null} */
let chromeLayoutRo = null;

/**
 * Debounced chrome re-paint. During dock tween, live rAF owns edge updates —
 * skip the debounced full apply so it does not fight the frame loop.
 * @param {number} [delayMs]
 */
export function scheduleSidePanelsTrapChromeReflow(delayMs = 48) {
    if (typeof window === 'undefined' || chromeTweening) return;
    window.clearTimeout(chromeResizeTimer);
    chromeResizeTimer = window.setTimeout(() => {
        if (chromeTweening) return;
        applySidePanelsTrapChrome(loadSidePanelsTrapState());
    }, Math.max(0, delayMs));
}

/**
 * In-place border + inward paths only (no CSS-var / nub rebuild). Safe every frame
 * while panel/dock height tweens — matches CSS silhouette motion.
 * @param {object} [state]
 */
function syncLiveEdgeChrome(state) {
    const s = sanitizeSidePanelsTrapState(state || loadSidePanelsTrapState());
    const fit = sideTrapViewportFit(s);
    const sidePaint = {
        ...s,
        trapHeightPx: fit.heightPx,
        trapProtrudePx: fit.protrudePx,
        sideBorderWidth: fit.borderWidth,
    };
    const dockGeo = syncDockEdgeStroke(s, dockTrapGeometry(s)) || dockTrapGeometry(s);
    syncDockInwardLineShape(s, dockGeo);
    syncAllSidePanelEdges(sidePaint);
}

/**
 * Drive edge SVG paths every animation frame through the dock height tween so
 * borders/inward lips track the CSS silhouette (trap/nub already tween via CSS).
 */
export function beginSideChromeDockTween() {
    if (typeof window === 'undefined') return;
    chromeTweening = true;
    window.clearTimeout(chromeResizeTimer);
    window.clearTimeout(chromeTweenTimer);
    window.cancelAnimationFrame(chromeTweenRaf);
    document.body?.classList.remove('side-chrome-dock-tweening');

    const tick = () => {
        if (!chromeTweening) return;
        syncLiveEdgeChrome();
        chromeTweenRaf = window.requestAnimationFrame(tick);
    };
    chromeTweenRaf = window.requestAnimationFrame(tick);

    /* Match --pagination-dock-transition-duration (~0.42s) + small settle. */
    chromeTweenTimer = window.setTimeout(() => {
        window.cancelAnimationFrame(chromeTweenRaf);
        chromeTweenRaf = 0;
        chromeTweening = false;
        applySidePanelsTrapChrome(loadSidePanelsTrapState());
    }, 480);
}

function observeSideChromeLayoutTargets() {
    if (typeof ResizeObserver === 'undefined') return;
    if (!chromeLayoutRo) {
        chromeLayoutRo = new ResizeObserver(() => {
            if (chromeTweening) return;
            scheduleSidePanelsTrapChromeReflow(64);
        });
    }
    document
        .querySelectorAll(
            '.event-slide, .filters-panel, #paginationDock, .pagination-dock, .pagination-dock-top-cap-row',
        )
        .forEach((el) => {
            try {
                chromeLayoutRo.observe(el);
            } catch (_) {
                /* ignore */
            }
        });
}

/** Re-sync inline stroke geometry on zoom / viewport / late-mounted chrome (idempotent). */
export function installSidePanelsTrapChromeLifecycle() {
    if (chromeResizeInstalled || typeof window === 'undefined') return;
    chromeResizeInstalled = true;
    const reflow = () => scheduleSidePanelsTrapChromeReflow(80);
    window.addEventListener('resize', reflow, { passive: true });
    window.visualViewport?.addEventListener('resize', reflow, { passive: true });
    window.addEventListener('orientationchange', reflow, { passive: true });
    /* One hide→settle→paint cycle per dock collapse/expand (not mid-tween rebuilds). */
    window.addEventListener('pagination-dock-collapse', () => {
        beginSideChromeDockTween();
    });
    observeSideChromeLayoutTargets();
    /* Handles / dock cap often mount after the first apply. */
    if (typeof MutationObserver !== 'undefined' && document.body) {
        const mo = new MutationObserver((mutations) => {
            let needObserve = false;
            for (let i = 0; i < mutations.length; i++) {
                const m = mutations[i];
                if (m.type === 'attributes' && m.attributeName === 'class' && m.target === document.body) {
                    /* Dock collapse class is handled by pagination-dock-collapse + tween. */
                    if (chromeTweening) continue;
                    scheduleSidePanelsTrapChromeReflow(80);
                    continue;
                }
                const nodes = m.addedNodes;
                for (let j = 0; j < nodes.length; j++) {
                    const n = nodes[j];
                    if (!(n instanceof Element)) continue;
                    /* Ignore our own stroke SVG inserts (would loop with apply). */
                    if (
                        n instanceof SVGElement ||
                        n.classList?.contains('panel-trap-edge-stroke') ||
                        n.classList?.contains('panel-side-edge-stroke') ||
                        n.classList?.contains('panel-side-edge-host') ||
                        n.classList?.contains('dock-trap-edge-stroke') ||
                        n.classList?.contains('panel-side-inward-line') ||
                        n.classList?.contains('pagination-dock-inward-line')
                    ) {
                        continue;
                    }
                    if (
                        n.matches?.(
                            '.panel-resize-handle, .pagination-dock-top-cap-row, .pagination-dock, .event-slide, .filters-panel',
                        ) ||
                        n.querySelector?.(
                            '.panel-resize-handle, .pagination-dock-top-cap-row, .pagination-dock, .event-slide, .filters-panel',
                        )
                    ) {
                        needObserve = true;
                        scheduleSidePanelsTrapChromeReflow(80);
                        break;
                    }
                }
                if (needObserve) break;
            }
            if (needObserve) observeSideChromeLayoutTargets();
        });
        mo.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class'],
        });
    }
}

/**
 * Left-hand unit normal for segment A→B — points into the dock∪trap fill when
 * walking the outer lip→trap edge left→right.
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 */
function segmentInteriorNormal(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
}

/**
 * Offset an open polyline by a constant `dist` px along left-hand normals (miter join).
 * Negative dist offsets the opposite way (needed when mirroring side geometry).
 * @param {{x:number,y:number}[]} pts
 * @param {number} dist
 */
function offsetPolyline(pts, dist) {
    if (pts.length < 2 || !(Math.abs(dist) > 0.01)) return pts.map((p) => ({ ...p }));
    const n = pts.length;
    const segN = [];
    for (let i = 0; i < n - 1; i++) segN.push(segmentInteriorNormal(pts[i], pts[i + 1]));
    const out = [];
    for (let i = 0; i < n; i++) {
        if (i === 0) {
            out.push({
                x: pts[i].x + segN[0].x * dist,
                y: pts[i].y + segN[0].y * dist,
            });
            continue;
        }
        if (i === n - 1) {
            out.push({
                x: pts[i].x + segN[n - 2].x * dist,
                y: pts[i].y + segN[n - 2].y * dist,
            });
            continue;
        }
        const n0 = segN[i - 1];
        const n1 = segN[i];
        const denom = 1 + n0.x * n1.x + n0.y * n1.y;
        if (Math.abs(denom) < 1e-6) {
            const nx = n0.x + n1.x;
            const ny = n0.y + n1.y;
            const len = Math.hypot(nx, ny) || 1;
            out.push({
                x: pts[i].x + (nx / len) * dist,
                y: pts[i].y + (ny / len) * dist,
            });
        } else {
            /* Miter: keeps offset distance constant on both adjacent segments. */
            out.push({
                x: pts[i].x + ((n0.x + n1.x) / denom) * dist,
                y: pts[i].y + ((n0.y + n1.y) / denom) * dist,
            });
        }
    }
    return out;
}

/**
 * Mirror polyline X about the handle's right edge: x' = width - x.
 * Used so left-protruding (filters) reuses the proven right-protruding math.
 * @param {{x:number,y:number}[]} pts
 * @param {number} width
 */
function mirrorPtsX(pts, width) {
    return pts.map((p) => ({ x: width - p.x, y: p.y }));
}

/**
 * Mirror M/L path coordinates (ribbon builders only emit M/L/Z).
 * @param {string} d
 * @param {number} width
 */
function mirrorPathDX(d, width) {
    if (!d) return '';
    return d.replace(/([ML])(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (_, cmd, x, y) => {
        return `${cmd}${(width - parseFloat(x)).toFixed(2)} ${y}`;
    });
}

/**
 * Densify polyline so end-shrinkage half-width can vary smoothly along arc length.
 * @param {{x:number,y:number}[]} pts
 * @param {number} step
 */
function densifyPolyline(pts, step = 8) {
    if (pts.length < 2) return pts.slice();
    const out = [{ ...pts[0] }];
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const n = Math.max(1, Math.ceil(len / step));
        for (let k = 1; k <= n; k++) {
            const t = k / n;
            out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
    }
    return out;
}

/**
 * Thickness from a tip end: thin tip → one slope → full (stays full to the far end).
 * Used for each mirrored half so the center cut is a sharp full-thickness butt.
 * @param {number} distFromTip
 * @param {number} tipW
 * @param {number} slopeW
 * @param {number} tipTh
 * @param {number} fullTh
 */
function thicknessFromTip(distFromTip, tipW, slopeW, tipTh, fullTh) {
    const tip = Math.max(0, tipW);
    const slope = Math.max(1, slopeW);
    const s = Math.max(0, distFromTip);
    if (s <= tip) return tipTh;
    if (s <= tip + slope) {
        const t = (s - tip) / slope;
        return tipTh + (fullTh - tipTh) * t;
    }
    return fullTh;
}

/**
 * Keep polyline points with x <= maxX; interpolate a butt at the cut.
 * @param {{x:number,y:number}[]} pts
 * @param {number} maxX
 */
function clipPolylineMaxX(pts, maxX) {
    if (pts.length < 2) return pts.map((p) => ({ ...p }));
    const out = [];
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.x <= maxX + 1e-6) {
            out.push({ ...p });
            continue;
        }
        if (i > 0 && pts[i - 1].x <= maxX + 1e-6) {
            const a = pts[i - 1];
            const dx = p.x - a.x;
            const t = Math.abs(dx) < 1e-6 ? 0 : (maxX - a.x) / dx;
            out.push({ x: maxX, y: a.y + (p.y - a.y) * t });
        }
        break;
    }
    return out;
}

/**
 * Keep polyline points with x >= minX; interpolate a butt at the cut.
 * @param {{x:number,y:number}[]} pts
 * @param {number} minX
 */
function clipPolylineMinX(pts, minX) {
    if (pts.length < 2) return pts.map((p) => ({ ...p }));
    const out = [];
    let started = false;
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.x >= minX - 1e-6) {
            if (!started && i > 0 && pts[i - 1].x < minX - 1e-6) {
                const a = pts[i - 1];
                const dx = p.x - a.x;
                const t = Math.abs(dx) < 1e-6 ? 0 : (minX - a.x) / dx;
                out.push({ x: minX, y: a.y + (p.y - a.y) * t });
            }
            out.push({ ...p });
            started = true;
        }
    }
    return out;
}

/**
 * Keep polyline points with y <= maxY; interpolate a butt at the cut.
 * @param {{x:number,y:number}[]} pts
 * @param {number} maxY
 */
function clipPolylineMaxY(pts, maxY) {
    if (pts.length < 2) return pts.map((p) => ({ ...p }));
    const out = [];
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.y <= maxY + 1e-6) {
            out.push({ ...p });
            continue;
        }
        if (i > 0 && pts[i - 1].y <= maxY + 1e-6) {
            const a = pts[i - 1];
            const dy = p.y - a.y;
            const t = Math.abs(dy) < 1e-6 ? 0 : (maxY - a.y) / dy;
            out.push({ x: a.x + (p.x - a.x) * t, y: maxY });
        }
        break;
    }
    return out;
}

/**
 * Keep polyline points with y >= minY; interpolate a butt at the cut.
 * @param {{x:number,y:number}[]} pts
 * @param {number} minY
 */
function clipPolylineMinY(pts, minY) {
    if (pts.length < 2) return pts.map((p) => ({ ...p }));
    const out = [];
    let started = false;
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.y >= minY - 1e-6) {
            if (!started && i > 0 && pts[i - 1].y < minY - 1e-6) {
                const a = pts[i - 1];
                const dy = p.y - a.y;
                const t = Math.abs(dy) < 1e-6 ? 0 : (minY - a.y) / dy;
                out.push({ x: a.x + (p.x - a.x) * t, y: minY });
            }
            out.push({ ...p });
            started = true;
        }
    }
    return out;
}

/**
 * Cap-row X cuts for the mirrored inward lips — driven only by center-gap tweak.
 * Smaller gap → lips reach further toward the trap middle.
 * @param {ReturnType<typeof dockTrapGeometry>} geo
 * @param {object} s
 */
function dockInwardCenterCuts(geo, s) {
    const mid = geo.dockW / 2;
    const maxGap = Math.max(24, geo.dockW * 0.85);
    const gap = clamp(Number(s.dockInwardCenterGapPx) || 200, 24, maxGap);
    const half = gap / 2;
    return {
        leftCut: mid - half,
        rightCut: mid + half,
    };
}

/**
 * Interior-offset companion edge for a densified outer polyline.
 * @param {{x:number,y:number}[]} outerEdge
 * @param {(s:number,total:number)=>number} thicknessFn
 * @returns {{outer:{x:number,y:number}[], inner:{x:number,y:number}[], total:number}}
 */
function pairedRibbonEdges(outerEdge, thicknessFn) {
    const lengths = [0];
    let total = 0;
    for (let i = 1; i < outerEdge.length; i++) {
        total += Math.hypot(
            outerEdge[i].x - outerEdge[i - 1].x,
            outerEdge[i].y - outerEdge[i - 1].y,
        );
        lengths.push(total);
    }
    const inner = [];
    if (total < 1 || outerEdge.length < 2) {
        return { outer: outerEdge.map((p) => ({ ...p })), inner, total: 0 };
    }
    for (let i = 0; i < outerEdge.length; i++) {
        const th = thicknessFn(lengths[i], total);
        if (i === 0) {
            const n = segmentInteriorNormal(outerEdge[0], outerEdge[1]);
            inner.push({ x: outerEdge[i].x + n.x * th, y: outerEdge[i].y + n.y * th });
        } else if (i === outerEdge.length - 1) {
            const n = segmentInteriorNormal(outerEdge[i - 1], outerEdge[i]);
            inner.push({ x: outerEdge[i].x + n.x * th, y: outerEdge[i].y + n.y * th });
        } else {
            const n0 = segmentInteriorNormal(outerEdge[i - 1], outerEdge[i]);
            const n1 = segmentInteriorNormal(outerEdge[i], outerEdge[i + 1]);
            const denom = 1 + n0.x * n1.x + n0.y * n1.y;
            if (Math.abs(denom) < 1e-6) {
                const nx = n0.x + n1.x;
                const ny = n0.y + n1.y;
                const len = Math.hypot(nx, ny) || 1;
                inner.push({
                    x: outerEdge[i].x + (nx / len) * th,
                    y: outerEdge[i].y + (ny / len) * th,
                });
            } else {
                inner.push({
                    x: outerEdge[i].x + ((n0.x + n1.x) / denom) * th,
                    y: outerEdge[i].y + ((n0.y + n1.y) / denom) * th,
                });
            }
        }
    }
    return { outer: outerEdge.map((p) => ({ ...p })), inner, total };
}

/**
 * Fillet selected corners of a closed ring (quadratic samples).
 * @param {{x:number,y:number}[]} pts
 * @param {number[]} cornerIdx
 * @param {number} radius
 * @param {number} [curveSteps]
 */
function filletClosedCorners(pts, cornerIdx, radius, curveSteps = 5) {
    const n = pts.length;
    if (n < 3 || !(radius > 0.05) || !cornerIdx.length) {
        return pts.map((p) => ({ ...p }));
    }
    const want = new Set(cornerIdx.map((i) => ((i % n) + n) % n));
    const out = [];
    for (let i = 0; i < n; i++) {
        const prev = pts[(i - 1 + n) % n];
        const curr = pts[i];
        const next = pts[(i + 1) % n];
        if (!want.has(i)) {
            out.push({ ...curr });
            continue;
        }
        const v1x = curr.x - prev.x;
        const v1y = curr.y - prev.y;
        const v2x = next.x - curr.x;
        const v2y = next.y - curr.y;
        const len1 = Math.hypot(v1x, v1y) || 1;
        const len2 = Math.hypot(v2x, v2y) || 1;
        const r = Math.min(radius, len1 * 0.45, len2 * 0.45);
        if (r < 0.05) {
            out.push({ ...curr });
            continue;
        }
        const p1 = { x: curr.x - (v1x / len1) * r, y: curr.y - (v1y / len1) * r };
        const p2 = { x: curr.x + (v2x / len2) * r, y: curr.y + (v2y / len2) * r };
        out.push(p1);
        for (let k = 1; k <= curveSteps; k++) {
            const t = k / curveSteps;
            const u = 1 - t;
            out.push({
                x: u * u * p1.x + 2 * u * t * curr.x + t * t * p2.x,
                y: u * u * p1.y + 2 * u * t * curr.y + t * t * p2.y,
            });
        }
    }
    return out;
}

/**
 * Mirrored half-ribbon ending in a vertical center cut (constant X), with optional
 * corner rounding on the two cut corners.
 * @param {{x:number,y:number}[]} outerFull
 * @param {(s:number,total:number)=>number} thicknessFn
 * @param {number} cutX
 * @param {'left'|'right'} side
 * @param {number} cornerRadius
 * @param {number} [maxButtSpan] reject / repair absurd vertical faces from bad offsets
 */
function verticalCutRibbonPath(outerFull, thicknessFn, cutX, side, cornerRadius, maxButtSpan = 64) {
    const paired = pairedRibbonEdges(outerFull, thicknessFn);
    if (paired.total < 1 || paired.inner.length < 2) return '';

    const outer =
        side === 'left'
            ? clipPolylineMaxX(paired.outer, cutX)
            : clipPolylineMinX(paired.outer, cutX);
    const inner =
        side === 'left'
            ? clipPolylineMaxX(paired.inner, cutX)
            : clipPolylineMinX(paired.inner, cutX);
    if (outer.length < 2 || inner.length < 2) return '';

    /* Snap cut tips onto the vertical line so the butt never follows the slope normal. */
    if (side === 'left') {
        outer[outer.length - 1] = { x: cutX, y: outer[outer.length - 1].y };
        inner[inner.length - 1] = { x: cutX, y: inner[inner.length - 1].y };
    } else {
        outer[0] = { x: cutX, y: outer[0].y };
        inner[0] = { x: cutX, y: inner[0].y };
    }

    const oCut = side === 'left' ? outer[outer.length - 1] : outer[0];
    const iCut = side === 'left' ? inner[inner.length - 1] : inner[0];
    const butt = Math.abs(oCut.y - iCut.y);
    if (!(butt > 0.5) || !Number.isFinite(butt)) return '';
    if (butt > maxButtSpan) {
        /* Offset blew up — keep a vertical face at a sane thickness. */
        const dir = iCut.y >= oCut.y ? 1 : -1;
        const repaired = { x: cutX, y: oCut.y + dir * Math.min(maxButtSpan, butt) };
        if (side === 'left') inner[inner.length - 1] = repaired;
        else inner[0] = repaired;
    }

    const ring = [...outer, ...inner.slice().reverse()];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < ring.length; i++) {
        const p = ring[i];
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return '';
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }
    /* Degenerate / spiked rings from self-intersecting parallel offsets. */
    if (maxX - minX < 8 || maxY - minY < 1 || maxY - minY > maxButtSpan * 8) return '';

    const cutCorners =
        side === 'left'
            ? [outer.length - 1, outer.length]
            : [0, ring.length - 1];
    const filleted = filletClosedCorners(ring, cutCorners, cornerRadius);
    if (filleted.length < 3) return '';

    let d = `M${filleted[0].x.toFixed(2)} ${filleted[0].y.toFixed(2)}`;
    for (let i = 1; i < filleted.length; i++) {
        d += `L${filleted[i].x.toFixed(2)} ${filleted[i].y.toFixed(2)}`;
    }
    return `${d}Z`;
}

/**
 * Half-ribbon ending in a horizontal cut (constant Y) — side-panel tip butts.
 * `side` 'top' = keep y <= cutY; 'bottom' = keep y >= cutY.
 * @param {{x:number,y:number}[]} outerFull
 * @param {(s:number,total:number)=>number} thicknessFn
 * @param {number} cutY
 * @param {'top'|'bottom'} side
 * @param {number} cornerRadius
 * @param {number} [maxButtSpan]
 */
function horizontalCutRibbonPath(outerFull, thicknessFn, cutY, side, cornerRadius, maxButtSpan = 64) {
    const paired = pairedRibbonEdges(outerFull, thicknessFn);
    if (paired.total < 1 || paired.inner.length < 2) return '';

    const outer =
        side === 'top'
            ? clipPolylineMaxY(paired.outer, cutY)
            : clipPolylineMinY(paired.outer, cutY);
    const inner =
        side === 'top'
            ? clipPolylineMaxY(paired.inner, cutY)
            : clipPolylineMinY(paired.inner, cutY);
    if (outer.length < 2 || inner.length < 2) return '';

    if (side === 'top') {
        outer[outer.length - 1] = { x: outer[outer.length - 1].x, y: cutY };
        inner[inner.length - 1] = { x: inner[inner.length - 1].x, y: cutY };
    } else {
        outer[0] = { x: outer[0].x, y: cutY };
        inner[0] = { x: inner[0].x, y: cutY };
    }

    const oCut = side === 'top' ? outer[outer.length - 1] : outer[0];
    const iCut = side === 'top' ? inner[inner.length - 1] : inner[0];
    const butt = Math.abs(oCut.x - iCut.x);
    if (!(butt > 0.5) || !Number.isFinite(butt)) return '';
    if (butt > maxButtSpan) {
        const dir = iCut.x >= oCut.x ? 1 : -1;
        const repaired = { x: oCut.x + dir * Math.min(maxButtSpan, butt), y: cutY };
        if (side === 'top') inner[inner.length - 1] = repaired;
        else inner[0] = repaired;
    }

    const ring = [...outer, ...inner.slice().reverse()];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < ring.length; i++) {
        const p = ring[i];
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return '';
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }
    if (maxY - minY < 8 || maxX - minX < 1 || maxX - minX > maxButtSpan * 8) return '';

    const cutCorners =
        side === 'top' ? [outer.length - 1, outer.length] : [0, ring.length - 1];
    const filleted = filletClosedCorners(ring, cutCorners, cornerRadius);
    if (filleted.length < 3) return '';

    let d = `M${filleted[0].x.toFixed(2)} ${filleted[0].y.toFixed(2)}`;
    for (let i = 1; i < filleted.length; i++) {
        d += `L${filleted[i].x.toFixed(2)} ${filleted[i].y.toFixed(2)}`;
    }
    return `${d}Z`;
}

/**
 * Mid ribbon with horizontal butts at both Y cuts (between dual side traps).
 * @param {{x:number,y:number}[]} outerFull
 * @param {(s:number,total:number)=>number} thicknessFn
 * @param {number} y0
 * @param {number} y1
 * @param {number} cornerRadius
 * @param {number} [maxButtSpan]
 */
function horizontalBandRibbonPath(outerFull, thicknessFn, y0, y1, cornerRadius, maxButtSpan = 64) {
    const lo = Math.min(y0, y1);
    const hi = Math.max(y0, y1);
    if (hi - lo < 8) return '';
    const paired = pairedRibbonEdges(outerFull, thicknessFn);
    if (paired.total < 1) return '';
    const outer = clipPolylineMaxY(clipPolylineMinY(paired.outer, lo), hi);
    const inner = clipPolylineMaxY(clipPolylineMinY(paired.inner, lo), hi);
    if (outer.length < 2 || inner.length < 2) return '';
    outer[0] = { x: outer[0].x, y: lo };
    outer[outer.length - 1] = { x: outer[outer.length - 1].x, y: hi };
    inner[0] = { x: inner[0].x, y: lo };
    inner[inner.length - 1] = { x: inner[inner.length - 1].x, y: hi };

    const ring = [...outer, ...inner.slice().reverse()];
    const cutCorners = [0, outer.length - 1, outer.length, ring.length - 1];
    const filleted = filletClosedCorners(ring, cutCorners, cornerRadius);
    if (filleted.length < 3) return '';
    let d = `M${filleted[0].x.toFixed(2)} ${filleted[0].y.toFixed(2)}`;
    for (let i = 1; i < filleted.length; i++) {
        d += `L${filleted[i].x.toFixed(2)} ${filleted[i].y.toFixed(2)}`;
    }
    return `${d}Z`;
}

/**
 * Parallel inward lip that follows the dock outer stroke (lips + trap bump).
 * Mounted on the cap-row beside `.dock-trap-edge-stroke`.
 * @param {object} s
 * @param {ReturnType<typeof dockTrapGeometry>} [geo]
 */
export function syncDockInwardLineShape(s, geo) {
    const cap =
        typeof document !== 'undefined'
            ? document.querySelector('.pagination-dock-top-cap-row')
            : null;
    if (!cap) return;

    /* Migrate off the old slider-row host if present. */
    document.querySelectorAll('.event-page-slider-row > .pagination-dock-inward-line').forEach((el) => {
        el.remove();
    });

    let host = cap.querySelector(':scope > .pagination-dock-inward-line');
    if (!host) {
        host = document.createElement('div');
        host.className = 'pagination-dock-inward-line';
        host.setAttribute('aria-hidden', 'true');
        /* First child → under trapezoid/buttons even if z-index is ignored. */
        cap.insertBefore(host, cap.firstChild);
    } else if (host !== cap.firstElementChild) {
        cap.insertBefore(host, cap.firstChild);
    }

    let svg = host.querySelector('svg.pagination-dock-inward-line__shape');
    if (!svg) {
        svg = document.createElementNS(SVG_NS, 'svg');
        svg.classList.add('pagination-dock-inward-line__shape');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('preserveAspectRatio', 'none');
        const path = document.createElementNS(SVG_NS, 'path');
        path.classList.add('pagination-dock-inward-line__path');
        svg.appendChild(path);
        host.replaceChildren(svg);
    }
    const path = svg.querySelector('path');
    if (!path) return;

    const raw = geo || dockTrapGeometry(s, cap);
    /* Integer box — same basis as outer stroke; avoids Firefox Y-stretch on slopes. */
    const W = Math.max(1, Math.round(raw.dockW));
    const H = Math.max(1, Math.round(raw.trapH));
    const sx = W / Math.max(1, raw.dockW);
    const leftPx = raw.leftPx * sx;
    const rightPx = raw.rightPx * sx;
    const insetPx = raw.insetPx * sx;
    const live = { ...raw, dockW: W, trapH: H, leftPx, rightPx, insetPx };
    const fullTh = Math.max(1, s.dockInwardLineThicknessPx);
    /*
     * Parallel gap past the outer stroke (signed Offset Y), hard-capped so the
     * top-flat offset cannot dive past the lip and blow up the slope miters.
     */
    const maxInset = Math.max(2, H * 0.42);
    const outerInset = clamp(
        s.dockBorderWidth * 0.5 + s.dockInwardLineOffsetYPx,
        0.5,
        maxInset,
    );
    /* Extra pad below lip so inset into the dock body still paints. */
    const pad = Math.max(
        48,
        fullTh * 2 + Math.max(0, s.dockInwardLineOffsetYPx) + s.dockBorderWidth,
    );
    const vbH = H + pad;

    const outerPts = [
        { x: 0, y: H },
        { x: leftPx, y: H },
        { x: leftPx + insetPx, y: 0 },
        { x: rightPx - insetPx, y: 0 },
        { x: rightPx, y: H },
        { x: W, y: H },
    ];
    const rounded = sampleRoundedPolyline(outerPts, s.dockBorderRadius);
    const outerEdge = densifyPolyline(offsetPolyline(rounded, outerInset), 6);
    const tipTh = Math.max(0.5, Math.min(fullTh, s.dockInwardEndThicknessPx));
    const tipW = s.dockInwardTipWidthPx;
    const slopeW = s.dockInwardSlopeWidthPx;

    /*
     * Two mirrored ribbons; center butts are vertical (constant X) even on the
     * trap slopes. Corner rounding fillets those cut corners.
     */
    const { leftCut, rightCut } = dockInwardCenterCuts(live, s);
    const cornerR = s.dockInwardCornerRadiusPx;
    const maxButt = Math.max(fullTh * 3, 36);
    const leftD = verticalCutRibbonPath(
        outerEdge,
        (arc) => thicknessFromTip(arc, tipW, slopeW, tipTh, fullTh),
        leftCut,
        'left',
        cornerR,
        maxButt,
    );
    const rightD = verticalCutRibbonPath(
        outerEdge,
        (arc, total) => thicknessFromTip(total - arc, tipW, slopeW, tipTh, fullTh),
        rightCut,
        'right',
        cornerR,
        maxButt,
    );
    const d = `${leftD}${rightD}`;

    /*
     * Height must equal viewBox H+pad in CSS px. A mismatched CSS height
     * (e.g. 100%+96) with preserveAspectRatio=none stretches Y and makes the
     * gap look wider on flats than on the trap slopes.
     */
    svg.setAttribute('viewBox', `0 0 ${W} ${vbH}`);
    svg.style.width = '100%';
    svg.style.height = `${vbH}px`;
    host.style.height = `${vbH}px`;
    path.setAttribute('d', d);

    /* Slider reserves — expanded vs collapsed, from Dock inward line sliders. */
    const root = document.documentElement;
    const clearancePx = `${Math.max(0, s.dockInwardSliderClearancePx)}px`;
    const clearanceCollapsedPx = `${Math.max(0, s.dockInwardSliderClearanceCollapsedPx)}px`;
    root.style.setProperty('--dock-inward-line-clearance', clearancePx);
    root.style.setProperty('--dock-inward-line-clearance-collapsed', clearanceCollapsedPx);
    if (document.body) {
        document.body.style.setProperty('--dock-inward-line-clearance', clearancePx);
        document.body.style.setProperty(
            '--dock-inward-line-clearance-collapsed',
            clearanceCollapsedPx,
        );
    }
}

/**
 * Build outer edge points for seams + trap bumps (handle-local px).
 * Walk top→bottom so left-hand normals point into the panel fill.
 * @param {'left'|'right'} _protrudeDir
 * @param {number} handleH
 * @param {number} seamX
 * @param {number} tipX
 * @param {{top:number,height:number}[]} traps
 * @param {number} taperPct
 */
function sideInwardOuterPoints(_protrudeDir, handleH, seamX, tipX, traps, taperPct) {
    const t = clamp(Number(taperPct) || 0, 0, 40) / 100;
    const pts = [{ x: seamX, y: 0 }];
    const sorted = traps
        .map((tr) => ({
            top: tr.top,
            bot: tr.top + tr.height,
            inset: Math.max(4, tr.height * t),
        }))
        .sort((a, b) => a.top - b.top);

    for (let i = 0; i < sorted.length; i++) {
        const tr = sorted[i];
        pts.push({ x: seamX, y: tr.top });
        pts.push({ x: tipX, y: tr.top + tr.inset });
        pts.push({ x: tipX, y: tr.bot - tr.inset });
        pts.push({ x: seamX, y: tr.bot });
    }
    pts.push({ x: seamX, y: handleH });
    return pts;
}

/**
 * Ensure full-handle inward-line SVG host.
 * @param {Element} handle
 */
function ensureSideInwardHost(handle) {
    let host = handle.querySelector(':scope > .panel-side-inward-line');
    if (!host) {
        host = document.createElement('div');
        host.className = 'panel-side-inward-line';
        host.setAttribute('aria-hidden', 'true');
        handle.insertBefore(host, handle.firstChild);
    }
    let svg = host.querySelector('svg.panel-side-inward-line__shape');
    if (!svg) {
        svg = document.createElementNS(SVG_NS, 'svg');
        svg.classList.add('panel-side-inward-line__shape');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('preserveAspectRatio', 'none');
        const path = document.createElementNS(SVG_NS, 'path');
        path.classList.add('panel-side-inward-line__path');
        svg.appendChild(path);
        host.replaceChildren(svg);
    }
    return { host, svg, path: svg.querySelector('path') };
}

/**
 * Parallel inward lip — authored in the same right-protruding local space as the
 * working info side, then X-mirrored for filters (dual traps included).
 * Constant thickness (no end shrinkage).
 * @param {Element} paintParent host for the inward SVG (handle or panel edge host)
 * @param {'left'|'right'} protrudeDir
 * @param {{handleW:number,handleH:number,protrude:number,localPts:{x:number,y:number}[],traps:{top:number,height:number}[],edgeRadius?:number}} edge
 * @param {object} s
 */
function syncSideInwardFromEdge(paintParent, protrudeDir, edge, s) {
    const { handleW, handleH, protrude, localPts, traps } = edge;
    const offsetPx = Number(s.sideInwardLineOffsetPx) || 0;
    const outerInset = Math.max(
        0.5,
        Math.min(
            protrude * 0.42,
            s.sideBorderWidth * 0.5 + Math.max(0, offsetPx),
        ),
    );
    const edgeRadius = edge.edgeRadius ?? Math.max(s.sideBorderRadius, s.dockBorderRadius);
    /* Same walk + offset as the perfect info side (local seam=0 → tip=protrude). */
    const rounded = sampleRoundedPolyline(localPts, edgeRadius);
    const localEdge = densifyPolyline(offsetPolyline(rounded, outerInset), 5);
    const fullTh = Math.max(1, s.sideInwardLineThicknessPx);
    const cornerR = Math.max(s.sideInwardCornerRadiusPx, edgeRadius);
    const maxButt = Math.max(fullTh * 3, 36);
    const gap = clamp(Number(s.sideInwardCenterGapPx) || 200, 24, 900);
    const th = () => fullTh;

    /** @type {string[]} */
    const localParts = [];
    if (traps.length === 1) {
        const mid = traps[0].top + traps[0].height / 2;
        const half = Math.min(gap / 2, traps[0].height * 0.42);
        localParts.push(
            horizontalCutRibbonPath(localEdge, th, mid - half, 'top', cornerR, maxButt),
        );
        localParts.push(
            horizontalCutRibbonPath(localEdge, th, mid + half, 'bottom', cornerR, maxButt),
        );
    } else {
        const cuts = traps.map((m) => {
            const mid = m.top + m.height / 2;
            const half = Math.min(gap / 2, m.height * 0.42);
            return { top: mid - half, bot: mid + half };
        });
        localParts.push(
            horizontalCutRibbonPath(localEdge, th, cuts[0].top, 'top', cornerR, maxButt),
        );
        for (let i = 0; i < cuts.length - 1; i++) {
            localParts.push(
                horizontalBandRibbonPath(
                    localEdge,
                    th,
                    cuts[i].bot,
                    cuts[i + 1].top,
                    cornerR,
                    maxButt,
                ),
            );
        }
        localParts.push(
            horizontalCutRibbonPath(
                localEdge,
                th,
                cuts[cuts.length - 1].bot,
                'bottom',
                cornerR,
                maxButt,
            ),
        );
    }

    const raw = localParts.filter(Boolean).join('');
    /* Mirror into handle space so the lip sits inside the filters panel fill. */
    const d = protrudeDir === 'left' ? mirrorPathDX(raw, handleW) : raw;

    const { host, svg, path } = ensureSideInwardHost(paintParent);
    if (!path) return;
    const pad = Math.max(24, fullTh * 2 + Math.abs(offsetPx) + s.sideBorderWidth);
    const vbW = handleW + pad;
    if (protrudeDir === 'right') {
        svg.setAttribute('viewBox', `${-pad} 0 ${vbW} ${handleH}`);
        host.style.left = `${-pad}px`;
        host.style.right = 'auto';
    } else {
        svg.setAttribute('viewBox', `0 0 ${vbW} ${handleH}`);
        host.style.left = '0';
        host.style.right = 'auto';
    }
    svg.style.width = `${vbW}px`;
    svg.style.height = `${handleH}px`;
    host.style.width = `${vbW}px`;
    host.style.height = `${handleH}px`;
    path.setAttribute('d', d);
}

/**
 * Persistent filters edge host — sized to the launch handle; never torn down
 * on live dock-tween updates (in-place path writes only).
 * @param {Element} panel
 * @param {Element} filtersHandle
 */
function ensureFiltersEdgeHost(panel, filtersHandle) {
    let host = panel.querySelector(':scope > .panel-side-edge-host');
    if (!host) {
        host = document.createElement('div');
        host.className = 'panel-side-edge-host';
        host.setAttribute('aria-hidden', 'true');
        panel.appendChild(host);
    }
    const w = filtersHandle.clientWidth;
    const h = filtersHandle.clientHeight;
    host.style.position = 'absolute';
    host.style.top = '0';
    host.style.left = '0';
    host.style.width = `${w}px`;
    host.style.height = `${h}px`;
    host.style.transform = 'translateX(-100%)';
    host.style.zIndex = '206';
    host.style.pointerEvents = 'none';
    host.style.overflow = 'visible';
    return host;
}

/**
 * Continuous outer edge + parallel inward lip for info + filters panels (dock language).
 * Filters dual traps: paint onto a persistent panel host (in-place updates for dock tween).
 * @param {object} s
 */
export function syncAllSidePanelEdges(s) {
    const infoHandle = document.querySelector(
        '.event-slide .panel-resize-handle--inner-right',
    );
    if (infoHandle) {
        const traps = measureSideTrapBands(infoHandle, [infoHandle]);
        const edge = syncSidePanelEdgeStroke(infoHandle, 'right', traps, s);
        if (edge) syncSideInwardFromEdge(infoHandle, 'right', edge, s);
    }

    const panel = document.querySelector('.filters-panel');
    const filtersHandle = document.querySelector(
        '.filters-panel .panel-resize-handle--inner-left.panel-resize-handle--filters-launch',
    );
    const musicHandle = document.querySelector(
        '.filters-panel .panel-resize-handle--inner-left.panel-resize-handle--music-launch',
    );
    /* Strip handle-local leftovers only — keep `.panel-side-edge-host` alive for live updates. */
    document
        .querySelectorAll(
            '.filters-panel .panel-resize-handle--inner-left > .panel-trap-edge-stroke, ' +
                '.filters-panel .panel-resize-handle--inner-left > .panel-side-edge-stroke, ' +
                '.filters-panel .panel-resize-handle--inner-left > .panel-side-inward-line',
        )
        .forEach((el) => el.remove());

    if (!filtersHandle || !panel) return;

    const trapHandles = musicHandle ? [filtersHandle, musicHandle] : [filtersHandle];
    const traps = measureSideTrapBands(filtersHandle, trapHandles);
    if (!traps.length) return;
    const host = ensureFiltersEdgeHost(panel, filtersHandle);
    const edge = syncSidePanelEdgeStroke(filtersHandle, 'left', traps, s, host);
    if (edge) syncSideInwardFromEdge(host, 'left', edge, s);
}

/** @deprecated Use syncAllSidePanelEdges */
export function syncAllSideInwardLines(s) {
    syncAllSidePanelEdges(s);
}

/**
 * Shrink side traps on short/narrow viewports so dual right traps don't overlap
 * and left+right wings don't eat the hub.
 * Tweaks stay as authored max; painted size is min(tweak, viewport budget).
 * @param {object} s
 */
function sideTrapViewportFit(s) {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1400;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    const panel =
        (typeof document !== 'undefined' &&
            (document.querySelector('.filters-panel') || document.querySelector('.event-slide'))) ||
        null;
    const panelH = Math.max(1, panel?.clientHeight || vh * 0.72);
    /*
     * Dual filters/music traps share one panel height — each must stay under ~half
     * the free column or they collide. Single info trap can be a bit taller.
     */
    const dualMaxH = Math.max(72, panelH * 0.42);
    const heightPx = Math.round(Math.min(s.trapHeightPx, dualMaxH, vh * 0.42));
    /* Left + right protrude into the hub; keep a wide center band on small widths. */
    const protrudePx = Math.round(
        Math.min(s.trapProtrudePx, Math.max(28, vw * 0.042), Math.max(28, (vw - 420) * 0.08)),
    );
    const borderWidth = Math.min(
        s.sideBorderWidth,
        Math.max(6, protrudePx * 0.28),
        Math.max(6, heightPx * 0.12),
    );
    return {
        heightPx: clamp(heightPx, 64, s.trapHeightPx),
        protrudePx: clamp(protrudePx, 28, s.trapProtrudePx),
        borderWidth: clamp(Number(borderWidth.toFixed(1)), 6, s.sideBorderWidth),
    };
}

/**
 * @param {object} state
 */
export function applySidePanelsTrapChrome(state) {
    const s = sanitizeSidePanelsTrapState(state || cloneDefaults());
    installSidePanelsTrapChromeLifecycle();
    const root = document.documentElement;
    const fit = sideTrapViewportFit(s);
    /* Painted side chrome (viewport-fitted); strokes must use the same sizes. */
    const sidePaint = {
        ...s,
        trapHeightPx: fit.heightPx,
        trapProtrudePx: fit.protrudePx,
        sideBorderWidth: fit.borderWidth,
    };
    if (!root) {
        return {
            heightPx: fit.heightPx,
            protrudePx: fit.protrudePx,
            taperPct: s.trapTaperPct,
            sideBorder: fit.borderWidth,
            sideRadius: s.sideBorderRadius,
            infoPos: s.infoTrapPosPct,
            filtersPos: s.filtersTrapPosPct,
            musicPos: s.musicTrapPosPct,
            dockH: s.dockTrapHeightPx,
            dockW: s.dockTrapWidthPx,
            dockTaper: s.dockTrapTaperPct,
            dockBorder: s.dockBorderWidth,
            dockRadius: s.dockBorderRadius,
        };
    }

    /* Shared side size — fitted to viewport so traps scale down on small windows. */
    root.style.setProperty('--event-info-side-trapezium-h', `${fit.heightPx}px`);
    root.style.setProperty('--event-info-trap-protrude', `${fit.protrudePx}px`);
    root.style.setProperty('--event-info-trap-taper', String(s.trapTaperPct));
    root.style.setProperty('--event-info-trap-border-w', String(fit.borderWidth));
    root.style.setProperty('--side-edge-border-px', `${fit.borderWidth}px`);
    root.style.setProperty('--side-edge-radius-px', `${s.sideBorderRadius}px`);
    root.style.setProperty('--side-inward-line-thickness-px', `${s.sideInwardLineThicknessPx}px`);
    root.style.setProperty('--side-inward-line-offset-px', `${s.sideInwardLineOffsetPx}px`);
    /*
     * Closed peek + open content inset share the same lip footprint:
     * half outer stroke + inward offset + inward thickness + air gap.
     * Content padding on the seam side must clear the full white lip.
     */
    {
        const lipStack =
            fit.borderWidth * 0.5 +
            Math.max(0, s.sideInwardLineOffsetPx) +
            s.sideInwardLineThicknessPx;
        /* Reel in ~5% of the closed strip so the inward lip sits tight to the outer border. */
        const closedPeek = Math.max(14, Math.round(lipStack * 0.95));
        const contentInset = Math.max(28, Math.ceil(lipStack + 14));
        root.style.setProperty('--panel-side-closed-peek-px', `${closedPeek}px`);
        root.style.setProperty('--panel-side-content-inset-px', `${contentInset}px`);
        if (document.body) {
            document.body.style.setProperty('--panel-side-closed-peek-px', `${closedPeek}px`);
            document.body.style.setProperty('--panel-side-content-inset-px', `${contentInset}px`);
        }
    }

    /* White nub tabs — size/radius from tweaks; fill SVGs include rounding. */
    const sideNubDepth = Math.min(s.sideNubDepthPx, Math.max(16, fit.protrudePx * 0.55));
    const sideNubLength = Math.min(s.sideNubLengthPx, Math.max(32, fit.heightPx * 0.55));
    root.style.setProperty('--side-nub-depth', `${Math.round(sideNubDepth)}px`);
    root.style.setProperty('--side-nub-length', `${Math.round(sideNubLength)}px`);
    root.style.setProperty('--side-nub-taper', String(s.sideNubTaperPct));
    root.style.setProperty('--side-nub-radius', `${s.sideNubRadiusPx}px`);
    root.style.setProperty('--side-nub-arrow-size', `${s.sideNubArrowPx}px`);
    root.style.setProperty('--side-trap-btn-radius', `${s.sideTrapBtnRadiusPx}px`);
    root.style.setProperty('--side-trap-btn-width', `${s.sideTrapBtnWidthPx}px`);
    root.style.setProperty('--side-trap-btn-height', `${s.sideTrapBtnHeightPx}px`);
    root.style.setProperty('--side-trap-btn-offset-x', `${s.sideTrapBtnOffsetXPx}px`);
    root.style.setProperty('--side-trap-icon-size', `${s.sideTrapIconPx}px`);
    root.style.setProperty(
        '--side-nub-fill-img',
        buildNubFillUrl('right', s.sideNubTaperPct, s.sideNubRadiusPx),
    );
    root.style.setProperty(
        '--side-nub-fill-img-mirror',
        buildNubFillUrl('left', s.sideNubTaperPct, s.sideNubRadiusPx),
    );
    root.style.setProperty('--dock-nub-width', `${s.dockNubWidthPx}px`);
    root.style.setProperty('--dock-nub-height', `${s.dockNubHeightPx}px`);
    root.style.setProperty('--dock-nub-taper', String(s.dockNubTaperPct));
    root.style.setProperty('--dock-nub-radius', `${s.dockNubRadiusPx}px`);
    root.style.setProperty('--dock-nub-arrow-size', `${s.dockNubArrowPx}px`);
    root.style.setProperty(
        '--dock-nub-fill-img',
        buildNubFillUrl('up', s.dockNubTaperPct, s.dockNubRadiusPx),
    );

    /* Independent vertical slides */
    root.style.setProperty('--event-info-trap-pos', String(s.infoTrapPosPct));
    root.style.setProperty('--filters-trap-pos', String(s.filtersTrapPosPct));
    root.style.setProperty('--music-trap-pos', String(s.musicTrapPosPct));

    /* Clear legacy CSS-background stroke URLs (inline SVGs replace them). */
    root.style.setProperty('--event-info-trap-stroke-img', 'none');
    root.style.setProperty('--event-info-trap-stroke-img-mirror', 'none');
    root.style.setProperty('--dock-trap-stroke-img', 'none');
    root.style.setProperty('--dock-top-edge-stroke-img', 'none');

    /*
     * Dock: paint border first (cap-row client box), then force fill to that silhouette.
     * Do NOT rewrite --dock-border-seam-h / img-h (those seat the cap row).
     */
    root.style.setProperty('--dock-trap-height', `${s.dockTrapHeightPx}px`);
    /* Set on :root + body — body dock rules redefine many vars and would shadow :root alone. */
    const buttonsOffsetY = `${s.dockButtonsOffsetYPx}px`;
    root.style.setProperty('--dock-buttons-offset-y', buttonsOffsetY);
    const inwardLineH = `${s.dockInwardLineThicknessPx}px`;
    const inwardLineY = `${s.dockInwardLineOffsetYPx}px`;
    const inwardClearance = `${Math.max(0, s.dockInwardSliderClearancePx)}px`;
    const inwardClearanceCollapsed = `${Math.max(0, s.dockInwardSliderClearanceCollapsedPx)}px`;
    const inwardVars = {
        '--dock-inward-line-h': inwardLineH,
        '--dock-inward-line-offset-y': inwardLineY,
        '--dock-inward-line-clearance': inwardClearance,
        '--dock-inward-line-clearance-collapsed': inwardClearanceCollapsed,
    };
    for (const [prop, value] of Object.entries(inwardVars)) {
        root.style.setProperty(prop, value);
    }
    if (document.body) {
        document.body.style.setProperty('--dock-buttons-offset-y', buttonsOffsetY);
        for (const [prop, value] of Object.entries(inwardVars)) {
            document.body.style.setProperty(prop, value);
        }
    }
    const dockGeo = syncDockEdgeStroke(s, dockTrapGeometry(s)) || dockTrapGeometry(s);
    applyDockFillFromBorder(root.style, s, dockGeo);
    syncDockInwardLineShape(s, dockGeo);

    syncAllSideTrapStrokes(sidePaint);
    syncDockTrapSvgTaper(s.dockTrapTaperPct);
    /* Keep collapse nub on the dock cap-row (same band as the trap; outside clip-path). */
    const dockCap = document.querySelector('.pagination-dock-top-cap-row');
    const dockCollapseBtn = document.getElementById('paginationDockCollapseBtn');
    if (dockCap && dockCollapseBtn && dockCollapseBtn.parentElement !== dockCap) {
        dockCap.appendChild(dockCollapseBtn);
    }
    dockCollapseBtn?.querySelector('.pagination-dock-collapse-pill')?.classList.add('pagination-dock-collapse-nub');
    cleanupLegacyEdgeHosts();

    return {
        heightPx: fit.heightPx,
        protrudePx: fit.protrudePx,
        taperPct: s.trapTaperPct,
        sideBorder: fit.borderWidth,
        sideRadius: s.sideBorderRadius,
        infoPos: s.infoTrapPosPct,
        filtersPos: s.filtersTrapPosPct,
        musicPos: s.musicTrapPosPct,
        dockH: s.dockTrapHeightPx,
        dockW: s.dockTrapWidthPx,
        dockTaper: s.dockTrapTaperPct,
        dockBorder: s.dockBorderWidth,
        dockRadius: s.dockBorderRadius,
    };
}
