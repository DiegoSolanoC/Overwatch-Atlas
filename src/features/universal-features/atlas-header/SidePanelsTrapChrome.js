/**
 * Side-panel + dock trapezium chrome.
 * Sides share size; each side trap has its own vertical slide; dock sizes independently.
 * Live CSS vars on :root — Save writes localStorage.
 *
 * Strokes are INLINE SVGs (not CSS background data-URLs). Background SVGs get
 * non-uniformly stretched so edges thin out and separate lip bars never join the trap.
 * Inline + vector-effect=non-scaling-stroke keeps thickness even; one dock path = no gaps.
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
     * White filled “nub” tabs (replace Drag/Controller Border images).
     * Side: on the inward tip of each side trap. Dock: on the top edge of the dock trap.
     */
    sideNubDepthPx: 28,
    sideNubLengthPx: 72,
    sideNubTaperPct: 14,
    sideNubRadiusPx: 0,
    sideNubArrowPx: 28,
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
    next.trapHeightPx = clamp(Math.round(Number(next.trapHeightPx)), 80, 320);
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

    next.sideNubDepthPx = clamp(Math.round(Number(next.sideNubDepthPx)), 16, 80);
    next.sideNubLengthPx = clamp(Math.round(Number(next.sideNubLengthPx)), 36, 180);
    next.sideNubTaperPct = clamp(Number(next.sideNubTaperPct), 0, 28);
    next.sideNubRadiusPx = clamp(Number(next.sideNubRadiusPx), 0, 20);
    next.sideNubArrowPx = clamp(Math.round(Number(next.sideNubArrowPx)), 10, 96);
    next.dockNubWidthPx = clamp(Math.round(Number(next.dockNubWidthPx)), 48, 280);
    next.dockNubHeightPx = clamp(Math.round(Number(next.dockNubHeightPx)), 16, 96);
    next.dockNubTaperPct = clamp(Number(next.dockNubTaperPct), 0, 28);
    next.dockNubRadiusPx = clamp(Number(next.dockNubRadiusPx), 0, 20);
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
    path.setAttribute('vector-effect', 'non-scaling-stroke');
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
    svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
    const path = svg.querySelector('path');
    if (!(path instanceof SVGPathElement)) return;
    path.setAttribute('d', d);
    path.setAttribute('stroke-width', String(clamp(Number(strokeWidth) || 20, 4, 48)));
    path.setAttribute('vector-effect', 'non-scaling-stroke');
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
    const W = live.dockW;
    const H = live.trapH;
    const pts = [
        { x: 0, y: H },
        { x: live.leftPx, y: H },
        { x: live.leftPx + live.insetPx, y: 0 },
        { x: live.rightPx - live.insetPx, y: 0 },
        { x: live.rightPx, y: H },
        { x: W, y: H },
    ];
    writeStrokePath(
        svg,
        roundedPolylinePath(pts, s.dockBorderRadius),
        s.dockBorderWidth,
        W,
        H,
    );
    return live;
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
 * Inline trap stroke on a resize handle — same box as clip/label, even thickness.
 * @param {Element | null} handle
 * @param {'left' | 'right'} side
 * @param {object} s
 */
function syncSideTrapStroke(handle, side, s) {
    if (!handle) return;
    const svg = ensureStrokeSvg(handle, 'panel-trap-edge-stroke');
    writeStrokePath(
        svg,
        roundedPolylinePath(sideTrapPoints(side, s.trapTaperPct), s.sideBorderRadius),
        s.sideBorderWidth,
        100,
        100,
    );
}

function syncAllSideTrapStrokes(s) {
    document
        .querySelectorAll('.event-slide .panel-resize-handle--inner-right')
        .forEach((el) => syncSideTrapStroke(el, 'right', s));
    document
        .querySelectorAll('.filters-panel .panel-resize-handle--inner-left')
        .forEach((el) => syncSideTrapStroke(el, 'left', s));
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

/** Re-sync inline stroke geometry on zoom / viewport / late-mounted chrome (idempotent). */
export function installSidePanelsTrapChromeLifecycle() {
    if (chromeResizeInstalled || typeof window === 'undefined') return;
    chromeResizeInstalled = true;
    const reflow = () => {
        window.clearTimeout(chromeResizeTimer);
        chromeResizeTimer = window.setTimeout(() => {
            applySidePanelsTrapChrome(loadSidePanelsTrapState());
        }, 80);
    };
    window.addEventListener('resize', reflow, { passive: true });
    window.visualViewport?.addEventListener('resize', reflow, { passive: true });
    window.addEventListener('orientationchange', reflow, { passive: true });
    /* Handles / dock cap often mount after the first apply. */
    if (typeof MutationObserver !== 'undefined' && document.body) {
        const mo = new MutationObserver((mutations) => {
            for (let i = 0; i < mutations.length; i++) {
                const nodes = mutations[i].addedNodes;
                for (let j = 0; j < nodes.length; j++) {
                    const n = nodes[j];
                    if (!(n instanceof Element)) continue;
                    /* Ignore our own stroke SVG inserts (would loop with apply). */
                    if (
                        n instanceof SVGElement ||
                        n.classList?.contains('panel-trap-edge-stroke') ||
                        n.classList?.contains('dock-trap-edge-stroke')
                    ) {
                        continue;
                    }
                    if (
                        n.matches?.(
                            '.panel-resize-handle, .pagination-dock-top-cap-row, .pagination-dock',
                        ) ||
                        n.querySelector?.(
                            '.panel-resize-handle, .pagination-dock-top-cap-row',
                        )
                    ) {
                        reflow();
                        return;
                    }
                }
            }
        });
        mo.observe(document.body, { childList: true, subtree: true });
    }
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
    const dualMaxH = Math.max(72, panelH * 0.34);
    const heightPx = Math.round(Math.min(s.trapHeightPx, dualMaxH, vh * 0.26));
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

    /* White nub tabs — size/radius from tweaks; fill SVGs include rounding. */
    const sideNubDepth = Math.min(s.sideNubDepthPx, Math.max(16, fit.protrudePx * 0.55));
    const sideNubLength = Math.min(s.sideNubLengthPx, Math.max(32, fit.heightPx * 0.55));
    root.style.setProperty('--side-nub-depth', `${Math.round(sideNubDepth)}px`);
    root.style.setProperty('--side-nub-length', `${Math.round(sideNubLength)}px`);
    root.style.setProperty('--side-nub-taper', String(s.sideNubTaperPct));
    root.style.setProperty('--side-nub-radius', `${s.sideNubRadiusPx}px`);
    root.style.setProperty('--side-nub-arrow-size', `${s.sideNubArrowPx}px`);
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
    const dockGeo = syncDockEdgeStroke(s, dockTrapGeometry(s)) || dockTrapGeometry(s);
    applyDockFillFromBorder(root.style, s, dockGeo);

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
