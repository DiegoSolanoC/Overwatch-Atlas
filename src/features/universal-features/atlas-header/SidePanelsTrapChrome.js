/**
 * Side-panel + dock trapezium chrome.
 * Sides share size; each side trap has its own vertical slide; dock sizes independently.
 * Live CSS vars on :root.
 *
 * Site look ships from `src/data/platform/atlas-ui-tweaks.json` (collaborator Export →
 * replace that file to ship). Save in the tweaker only writes a local *draft*.
 *
 * Strokes are INLINE SVGs (not CSS background data-URLs). Background SVGs get
 * non-uniformly stretched so edges thin out and separate lip bars never join the trap.
 * viewBox matches client px so stroke-width stays even. Do NOT use non-scaling-stroke:
 * body { transform: scale(--desktop-scale) } makes Firefox keep those strokes in device
 * px while filled inward lips scale — Chrome/Firefox proportions then diverge.
 */

import { resolveUiTweaksSyncPayload } from './UiTweaksStandard.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Baked from atlas-ui-tweaks.json standard, Nov 2026. */
export const SIDE_PANELS_TRAP_TWEAK_DEFAULTS = Object.freeze({
    /** Shared side-trap body height (excludes +8 visual pad). */
    trapHeightPx: 306,
    /** Shared outward depth (CSS px). */
    trapProtrudePx: 69,
    /** Shared short-side inset % (0 = rectangle). */
    trapTaperPct: 22.5,
    /** Shared white stroke weight (CSS px via non-scaling-stroke). */
    sideBorderWidth: 8,
    /** Corner rounding on side-panel trap borders (viewBox units, 0–100). */
    sideBorderRadius: 6,

    /** Independent vertical placement: 0 = top, 50 = center, 100 = bottom. */
    infoTrapPosPct: 87,
    filtersTrapPosPct: 13,
    musicTrapPosPct: 87,
    /**
     * When 1, filters/music stay mirrored about center (music = 100 − filters).
     * Individual offset is discarded; one slide drives a symmetrical spread.
     */
    filtersMusicMirror: 1,
    /**
     * Extra % added to each side-trap pos while the dock is collapsed
     * (`--side-trap-collapse-shift` eases 0 → this amount).
     */
    sideTrapCollapseShiftPct: 10,

    /** Dock trap — independent from sides (no vertical slide). */
    dockTrapHeightPx: 120,
    /** Desktop / wide authored trap width (CSS px). */
    dockTrapWidthPx: 760,
    /** Compact (≤768px) authored trap width — narrower so side chips clear the crop. */
    dockTrapWidthMobilePx: 630,
    dockTrapTaperPct: 19,
    dockBorderWidth: 8,
    /** Corner rounding on dock trap path (viewBox units). */
    dockBorderRadius: 9,
    /**
     * Whole dock-trap button unit Y (CSS px). Positive = down into the
     * merged trap/dock band; negative = up toward the nub.
     */
    dockButtonsOffsetYPx: 13,

    /**
     * Dock inward lip (thick white bar above the page slider).
     * Thickness in CSS px; Offset Y = parallel gap past the outer stroke
     * (positive = into the dock / toward thumbs; negative = toward the border).
     * Center cut: two mirrored ribbons with a tunable open gap at dock center.
     * End shrinkage: tip only at the screen-side ends (center butts stay full).
     */
    dockInwardLineThicknessPx: 22,
    dockInwardLineOffsetYPx: 10,
    /** Open gap at center between the two mirrored lips (CSS px). Smaller = closer. */
    dockInwardCenterGapPx: 528,
    /** Extra top pad under the lip so the page slider clears the white bar. */
    dockInwardSliderClearancePx: 20,
    /** Same clearance while the dock is collapsed (often tighter). */
    dockInwardSliderClearanceCollapsedPx: 49,
    /** Thin run at each screen-side end (two clear levels: full → tip). */
    dockInwardEndThicknessPx: 4,
    dockInwardTipWidthPx: 388,
    dockInwardSlopeWidthPx: 27,
    /** Fillet radius at tip ends and vertical center-cut corners (CSS px). */
    dockInwardCornerRadiusPx: 10,

    /**
     * Side-panel inward lip (parallel to continuous edge). No end shrinkage —
     * constant thickness with tip cuts at trap buttons only.
     */
    sideInwardLineThicknessPx: 18,
    /** Parallel gap past the outer stroke before the lip (into panel fill). */
    sideInwardLineOffsetPx: 10,
    sideInwardCenterGapPx: 200,
    sideInwardCornerRadiusPx: 8,
    /**
     * Extra cut-gap % while hovering a *closed* side trap (peek). Closed /
     * unfocused traps stay drawbridged; hover undoes the bridge up to this
     * bonus; fully open settles to parallel at 1× (no bonus). Dock: always 1×.
     */
    inwardCutFocusBonusPct: 38,

    /**
     * White filled “nub” tabs (replace Drag/Controller Border images).
     * Side: on the inward tip of each side trap. Dock: on the top edge of the dock trap.
     */
    sideNubDepthPx: 35,
    sideNubLengthPx: 78,
    sideNubTaperPct: 28,
    sideNubRadiusPx: 13,
    sideNubArrowPx: 43,
    /** Colored label pill behind the trap logo (side panels only). */
    sideTrapBtnRadiusPx: 12,
    sideTrapBtnWidthPx: 52,
    sideTrapBtnHeightPx: 168,
    /**
     * Horizontal pill shift toward the trap tip / hub (CSS px).
     * Positive = into the tip; uses the extra bay from the inward lip.
     */
    sideTrapBtnOffsetXPx: -2,
    sideTrapIconPx: 47,
    dockNubWidthPx: 192,
    dockNubHeightPx: 40,
    dockNubTaperPct: 24.5,
    dockNubRadiusPx: 8,
    dockNubArrowPx: 52,

    /**
     * Atlas News red footer trapezium (floating badge).
     * Authoring size from UI Tweaks; keep under dock thumbs when possible.
     */
    atlasNewsWidthPx: 146,
    atlasNewsHeightPx: 88,
    /** Logo image size as % of the red badge box. */
    atlasNewsIconPct: 100,

    /**
     * World mode chrome — flank mode buttons + zoom/sun stack above the dock trap.
     */
    worldFlankGapBorderPx: 18,
    worldFlankPairGapPx: 8,
    /** Flank plate Y (CSS px). Positive = down toward dock lip. */
    worldFlankOffsetYPx: 0,
    worldFlankIconPx: 52,
    worldFlankFontPx: 18,
    worldZoomStackGapPx: 28,
    worldZoomLiftPx: 10,
    worldResetMinHeightPx: 48,
    worldResetFontPx: 16,
    worldResetPadXPx: 28,
    worldZoomThumbPx: 52,
    worldZoomTrackHPx: 14,
    /** White track outline thickness (CSS px). */
    worldZoomTrackBorderPx: 2,
    /** Individual slider lengths as % of the zoom stack width. */
    worldZoomSliderWidthPct: 100,
    worldSunSliderWidthPct: 100,
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
    next.sideTrapCollapseShiftPct = clamp(Number(next.sideTrapCollapseShiftPct ?? 10), 0, 40);

    next.dockTrapHeightPx = clamp(Math.round(Number(next.dockTrapHeightPx)), 48, 160);
    next.dockTrapWidthPx = clamp(Math.round(Number(next.dockTrapWidthPx)), 280, 1100);
    {
        const mobileRaw = next.dockTrapWidthMobilePx;
        const mobileFallback =
            mobileRaw == null || mobileRaw === '' || Number.isNaN(Number(mobileRaw))
                ? 630
                : Number(mobileRaw);
        next.dockTrapWidthMobilePx = clamp(Math.round(mobileFallback), 240, 900);
    }
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
    /* Migrate old idle de-emphasize key → focus bonus (behavior flipped). */
    if (next.inwardCutFocusBonusPct == null && next.inwardCutDeemphasizePct != null) {
        next.inwardCutFocusBonusPct = next.inwardCutDeemphasizePct;
    }
    next.inwardCutFocusBonusPct = clamp(
        Math.round(Number(next.inwardCutFocusBonusPct ?? 40)),
        0,
        150,
    );
    delete next.inwardCutDeemphasizePct;

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
    next.atlasNewsWidthPx = clamp(Math.round(Number(next.atlasNewsWidthPx ?? 146)), 48, 180);
    next.atlasNewsHeightPx = clamp(Math.round(Number(next.atlasNewsHeightPx ?? 88)), 36, 140);
    next.atlasNewsIconPct = clamp(Math.round(Number(next.atlasNewsIconPct ?? 100)), 40, 100);
    next.worldFlankGapBorderPx = clamp(Math.round(Number(next.worldFlankGapBorderPx ?? 18)), 0, 64);
    next.worldFlankPairGapPx = clamp(Math.round(Number(next.worldFlankPairGapPx ?? 8)), 0, 48);
    next.worldFlankOffsetYPx = clamp(Math.round(Number(next.worldFlankOffsetYPx ?? 0)), -48, 64);
    next.worldFlankIconPx = clamp(Math.round(Number(next.worldFlankIconPx ?? 52)), 24, 72);
    next.worldFlankFontPx = clamp(Math.round(Number(next.worldFlankFontPx ?? 18)), 12, 28);
    next.worldZoomStackGapPx = clamp(Math.round(Number(next.worldZoomStackGapPx ?? 28)), 8, 72);
    next.worldZoomLiftPx = clamp(Math.round(Number(next.worldZoomLiftPx ?? 10)), 0, 64);
    next.worldResetMinHeightPx = clamp(Math.round(Number(next.worldResetMinHeightPx ?? 48)), 28, 72);
    next.worldResetFontPx = clamp(Math.round(Number(next.worldResetFontPx ?? 16)), 11, 28);
    next.worldResetPadXPx = clamp(Math.round(Number(next.worldResetPadXPx ?? 28)), 12, 56);
    next.worldZoomThumbPx = clamp(Math.round(Number(next.worldZoomThumbPx ?? 52)), 28, 80);
    next.worldZoomTrackHPx = clamp(Math.round(Number(next.worldZoomTrackHPx ?? 14)), 4, 40);
    next.worldZoomTrackBorderPx = clamp(Math.round(Number(next.worldZoomTrackBorderPx ?? 2)), 0, 8);
    next.worldZoomSliderWidthPct = clamp(Math.round(Number(next.worldZoomSliderWidthPct ?? 100)), 30, 100);
    next.worldSunSliderWidthPct = clamp(Math.round(Number(next.worldSunSliderWidthPct ?? 100)), 30, 100);
    delete next.stageMenuOffsetYPx;
    delete next.globeOffsetYPx;
    return next;
}

/** Sync look: local draft → cached standard → baked defaults. */
export function loadSidePanelsTrapState() {
    try {
        const payload = resolveUiTweaksSyncPayload();
        if (payload?.panels && typeof payload.panels === 'object') {
            return sanitizeSidePanelsTrapState({
                ...SIDE_PANELS_TRAP_TWEAK_DEFAULTS,
                ...payload.panels,
            });
        }
    } catch {
        /* fall through to defaults */
    }
    return sanitizeSidePanelsTrapState(cloneDefaults());
}

/** @deprecated Draft persistence is unified in UiTweaksStandard / HeaderTitleBadgeTweaker. */
export function saveSidePanelsTrapState(_state) {
    /* no-op: per-slice localStorage removed (not a per-visitor preference) */
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
    const vh = typeof window !== 'undefined' ? window.innerHeight || 900 : 900;
    const compact = vw <= 768;
    const portrait = compact && vh >= vw;
    /*
     * clientWidth/Height = the SVG's 100% box. getBoundingClientRect can disagree
     * under zoom/transform and stretched the stroke away from the fill.
     */
    const dockW = Math.max(1, cap?.clientWidth || dock?.clientWidth || vw);
    const fluidTrapH = compact
        ? Math.max(56, Math.min(portrait ? 84 : 96, Math.round(vh * (portrait ? 0.095 : 0.11))))
        : Math.max(56, Math.min(s.dockTrapHeightPx, Math.round(vh * 0.12)));
    const trapH = Math.max(1, cap?.clientHeight || fluidTrapH);
    const authoredTrapW = compact ? s.dockTrapWidthMobilePx : s.dockTrapWidthPx;
    const trapW = Math.min(
        dockW * (portrait ? 0.96 : 0.88),
        compact ? Math.min(authoredTrapW, Math.round(dockW * 0.98)) : authoredTrapW,
        Math.max(160, dockW - (portrait ? 16 : 48)),
    );
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
    /* True trap-wall angle — mode flank plates use this so they sit // the silhouette. */
    const wallSkewDeg = (Math.atan2(geo.insetPx, Math.max(1, geo.trapH)) * 180) / Math.PI;
    rootStyle.setProperty('--dock-trap-wall-skew', `${Math.round(wallSkewDeg * 10) / 10}deg`);
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
 * Extra paint below the handle into the dock. Panels now track live dock height
 * (`bottom` eases with collapse), so strokes match the box — only a light tuck
 * under the dock top border remains (avoids the old “line floats past the fill”).
 * @returns {number}
 */
function sidePanelDockOverhangPx() {
    if (chromeTweenOverhangPx != null) return chromeTweenOverhangPx;
    if (typeof document === 'undefined' || !document.getElementById('paginationDock')) {
        return 0;
    }
    const cs = getComputedStyle(document.body);
    const seam = parseFloat(cs.getPropertyValue('--dock-border-seam-h').trim());
    if (Number.isFinite(seam) && seam > 0) return Math.round(Math.min(20, seam * 0.2));
    return 8;
}

/** Expanded / collapsed dock height in CSS px (matches pagination-dock.css seating). */
function readDockSeatHeightsPx() {
    const cs =
        typeof document !== 'undefined' ? getComputedStyle(document.body) : null;
    const expanded = parseFloat(cs?.getPropertyValue('--pagination-dock-height-expanded') || '') || 400;
    const collapsedBase =
        parseFloat(cs?.getPropertyValue('--pagination-dock-height-collapsed') || '') || 200;
    const clearance =
        parseFloat(cs?.getPropertyValue('--dock-inward-line-clearance-collapsed') || '') || 4;
    const collapsed = collapsedBase + Math.max(0, clearance - 14);
    return { expanded, collapsed };
}

/**
 * Trap band top/height matching panel-resize.css percentage formulas (no layout read).
 * @param {number} panelH
 * @param {number} trapHeightPx
 * @param {number} posPct
 * @param {number} shift
 * @param {number} capFrac 0.62 info / 0.42 filters
 */
function formulaTrapBand(panelH, trapHeightPx, posPct, shift, capFrac) {
    const h = Math.max(1, panelH);
    const capped = Math.min(trapHeightPx, h * capFrac);
    const pos = Math.min(100, Math.max(0, posPct + shift));
    const top = ((h - capped) * pos) / 100 - 2;
    return { top, height: capped + 8 };
}

/** Live collapse amount 0..1 from transitioning --side-trap-collapse-shift. */
function readTrapCollapseT() {
    if (typeof document === 'undefined') return 0;
    const cs = getComputedStyle(document.body);
    const shift = parseFloat(cs.getPropertyValue('--side-trap-collapse-shift'));
    const amount = parseFloat(cs.getPropertyValue('--side-trap-collapse-shift-amount'));
    const denom = Number.isFinite(amount) && amount > 0 ? amount : 10;
    if (!Number.isFinite(shift)) {
        return document.body.classList.contains('pagination-dock-collapsed') ? 1 : 0;
    }
    return Math.min(1, Math.max(0, shift / denom));
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
 * @param {number} [paintHeight] path height (may exceed handle to overhang under dock)
 */
/**
 * @param {Element} measureEl
 * @param {'left'|'right'} protrudeDir
 * @param {{top:number,height:number}[]} traps
 * @param {object} s
 * @param {Element} [paintParent]
 * @param {number} [paintHeight]
 * @param {{ handleW?: number, handleH?: number, protrude?: number }} [layout]
 */
function syncSidePanelEdgeStroke(
    measureEl,
    protrudeDir,
    traps,
    s,
    paintParent,
    paintHeight,
    layout = {},
) {
    if (!measureEl || !traps.length) return null;
    const parent = paintParent || measureEl;
    const handleW = Math.max(
        1,
        Math.round(Number(layout.handleW) || measureEl.clientWidth || 0),
    );
    const boxH = Math.round(Number(layout.handleH) || measureEl.clientHeight || 0);
    const handleH = Math.max(boxH, Math.round(Number(paintHeight) || boxH));
    if (!(handleW > 4) || !(handleH > 8)) return null;

    let protrude;
    if (Number.isFinite(Number(layout.protrude)) && Number(layout.protrude) > 0) {
        protrude = Math.min(handleW, Math.max(24, Number(layout.protrude)));
    } else {
        const label = measureEl.querySelector('.panel-resize-handle__trap-label');
        const labelW = label instanceof HTMLElement ? label.offsetWidth : 0;
        protrude = Math.min(
            handleW,
            Math.max(24, labelW > 8 ? labelW : Number(s.trapProtrudePx) || 64),
        );
    }
    /* Local authoring space: seam at x=0, tip at x=protrude (matches working info side). */
    const edgeRadius = Math.max(s.sideBorderRadius, s.dockBorderRadius);
    const seamX = protrudeDir === 'right' ? 0 : handleW;
    const tipX = protrudeDir === 'right' ? protrude : handleW - protrude;
    /*
     * Outer white stroke ignores drawbridge flatten — skip path rewrite when the
     * handle box / trap bands are unchanged (typical during confirm close).
     */
    const outerKey =
        `${handleW}|${handleH}|${protrude}|${edgeRadius}|${s.sideBorderWidth}|${s.trapTaperPct}|${protrudeDir}|` +
        traps.map((t) => `${Math.round(t.top)},${Math.round(t.height)}`).join(';');
    /* Retire fragmented per-trap strokes once — one path owns the whole edge. */
    if (!parent.dataset.sideEdgeLegacyCleared) {
        parent.querySelectorAll(':scope > svg.panel-trap-edge-stroke').forEach((el) => {
            el.remove();
        });
        parent.dataset.sideEdgeLegacyCleared = '1';
    }
    const svg = ensureStrokeSvg(parent, 'panel-side-edge-stroke');
    if (parent.dataset.sideOuterKey !== outerKey) {
        const localPts = sideInwardOuterPoints(
            'right',
            handleH,
            0,
            protrude,
            traps,
            s.trapTaperPct,
        );
        const outerPts = dedupePolyPoints(
            protrudeDir === 'left' ? mirrorPtsX(localPts, handleW) : localPts,
            0.75,
        );
        writeStrokePath(
            svg,
            roundedPolylinePath(outerPts, edgeRadius),
            s.sideBorderWidth,
            handleW,
            handleH,
        );
        parent.dataset.sideOuterKey = outerKey;
        svg.style.position = 'absolute';
        svg.style.left = '0';
        svg.style.top = '0';
        svg.style.right = 'auto';
        svg.style.bottom = 'auto';
        svg.style.width = '100%';
        svg.style.height = `${handleH}px`;
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '1';
        svg.style.overflow = 'visible';
    }
    return {
        handleW,
        handleH,
        protrude,
        seamX,
        tipX,
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

let chromeResizeInstalled = false;
let chromeResizeTimer = 0;
let chromeTweenTimer = 0;
let chromeTweenRaf = 0;
/** Dock height CSS tween owns a live rAF paint loop for side edge SVGs. */
let chromeTweening = false;
/**
 * Cached overhang while dock-tweening — avoid getComputedStyle(body) every frame.
 * @type {number | null}
 */
let chromeTweenOverhangPx = null;
/**
 * Mid dock-tween layout snapshot — formula paint (no clientHeight/offsetTop per frame).
 * @type {null | {
 *   collapsing: boolean,
 *   expandedDock: number,
 *   collapsedDock: number,
 *   dockH0: number,
 *   infoH0: number,
 *   filtersH0: number,
 *   infoW: number,
 *   filtersW: number,
 *   protrude: number,
 *   trapH: number,
 *   infoPos: number,
 *   filtersPos: number,
 *   musicPos: number,
 * }}
 */
let chromeTweenLayout = null;
/** Suppress RO full-applies while a side panel width CSS-tweens (open/close). */
let panelWidthTweenGuardUntil = 0;
/**
 * After dock collapse settle, RO fires on panel height change. A full
 * applySidePanelsTrapChrome (nubs + every CSS var) was ~50–120ms forced reflow
 * on Codex. Prefer light edge sync until this timestamp.
 */
let chromePreferLightReflowUntil = 0;
/** One-shot: strip legacy handle-local side strokes (avoid per-frame DOM deletes). */
let sideHandleLegacyStrokesCleaned = false;
/** One-shot: strip legacy dock inward host under the slider row. */
let dockInwardLegacyCleaned = false;
/** @type {ResizeObserver | null} */
let chromeLayoutRo = null;

/** @param {InwardCutKey} key */
function sideChromeKeyBusy(key) {
    const st = drawbridge[key];
    if (st && st.phase !== 'idle') return true;
    const e = cutEmphasis[key];
    if (e && Math.abs(e.current - e.target) > 0.0005) return true;
    return !!(e && e.hovering);
}

function anySideChromeBusy() {
    return (
        sideChromeKeyBusy('info') ||
        sideChromeKeyBusy('filters') ||
        sideChromeKeyBusy('music')
    );
}

/**
 * True while we must not run a full chrome rebuild (dock live rAF, or panel
 * width CSS open/close guard / panel--closing).
 */
function chromeLivePaintActive() {
    if (chromeTweening) return true;
    if (performance.now() < panelWidthTweenGuardUntil) return true;
    if (typeof document === 'undefined') return false;
    return !!document.querySelector(
        '.filters-panel.panel--closing, .event-slide.panel--closing',
    );
}

/*
 * Side inward lips (inverted drawbridge):
 * - Closed / unfocused: bridged (flatten + closed cut)
 * - Hover (closed): undo bridge → parallel cut widened by inwardCutFocusBonusPct
 * - Fully open: parallel cut at 1× (no bonus)
 * Dock cuts stay 1× always. Scales tween — SVG `d` cannot CSS-transition.
 *
 * Phase names are historical: “opening-*” = animate toward bridge,
 * “closing-*” = animate toward parallel.
 */
const INWARD_CUT_IDLE_SCALE = 1;
/** Exponential time-constant for hover cut eases. */
const INWARD_CUT_TWEEN_TAU_MS = 160;
/** Drawbridge flatten phase duration (kept short so open/close feels snappy). */
const DRAWBRIDGE_FLATTEN_MS = 170;
/** Drawbridge gap open/close phase duration. */
const DRAWBRIDGE_GAP_MS = 130;

/** @typedef {'info'|'filters'|'music'} InwardCutKey */

/** @type {Record<InwardCutKey, { current: number, target: number, hovering: boolean }>} */
const cutEmphasis = {
    info: { current: INWARD_CUT_IDLE_SCALE, target: INWARD_CUT_IDLE_SCALE, hovering: false },
    filters: { current: INWARD_CUT_IDLE_SCALE, target: INWARD_CUT_IDLE_SCALE, hovering: false },
    music: { current: INWARD_CUT_IDLE_SCALE, target: INWARD_CUT_IDLE_SCALE, hovering: false },
};
let cutEmphasisRaf = 0;
let cutEmphasisLastTs = 0;
let cutEmphasisHoverBound = false;

/**
 * @typedef {{
 *   wantParallel: boolean,
 *   flatten: number,
 *   gapOpen: number,
 *   phase: 'idle'|'opening-flatten'|'opening-closeGap'|'closing-openGap'|'closing-unflatten',
 *   phaseStartedAt: number,
 *   fromFlatten: number,
 *   fromGapOpen: number,
 * }} DrawbridgeState
 */

/** Closed traps start bridged; open / hover drive toward parallel. */
/** @type {Record<InwardCutKey, DrawbridgeState>} */
const drawbridge = {
    info: {
        wantParallel: false,
        flatten: 1,
        gapOpen: 0,
        phase: 'idle',
        phaseStartedAt: 0,
        fromFlatten: 1,
        fromGapOpen: 0,
    },
    filters: {
        wantParallel: false,
        flatten: 1,
        gapOpen: 0,
        phase: 'idle',
        phaseStartedAt: 0,
        fromFlatten: 1,
        fromGapOpen: 0,
    },
    music: {
        wantParallel: false,
        flatten: 1,
        gapOpen: 0,
        phase: 'idle',
        phaseStartedAt: 0,
        fromFlatten: 1,
        fromGapOpen: 0,
    },
};
let drawbridgeRaf = 0;
/**
 * Last sanitized trap state from `applySidePanelsTrapChrome` — includes unsaved
 * tweaker preview. Hover/collapse/resize must use this so live sliders
 * (e.g. focus cut bonus %) do not snap back to the committed standard.
 * @type {object | null}
 */
let liveTrapChromeState = null;

/** Prefer live tweaker preview over the committed standard so unsaved sliders are not clobbered. */
function paintTrapChromeState(explicit) {
    if (explicit) return sanitizeSidePanelsTrapState(explicit);
    return liveTrapChromeState || loadSidePanelsTrapState();
}

export function refreshDockTrapSvgFromTweaks() {
    applySidePanelsTrapChrome(paintTrapChromeState());
}

/** @param {object} [s] */
function inwardCutFocusScaleFromState(s) {
    const pct = clamp(
        Math.round(
            Number(
                s?.inwardCutFocusBonusPct ??
                    SIDE_PANELS_TRAP_TWEAK_DEFAULTS.inwardCutFocusBonusPct,
            ),
        ),
        0,
        150,
    );
    return 1 + pct / 100;
}

/** @param {boolean} focused @param {number} focusScale */
function desiredInwardCutScale(focused, focusScale) {
    return focused ? focusScale : INWARD_CUT_IDLE_SCALE;
}

function resolveInwardCutTargetsFromDom() {
    const hoverScale = inwardCutFocusScaleFromState(
        liveTrapChromeState || loadSidePanelsTrapState(),
    );
    /*
     * Bonus only while peeking a closed trap. Fully open = 1×.
     * While animating toward bridge, force 1× — hover width is baked into
     * gapOpen at the flatten→closeGap handoff.
     */
    for (const key of /** @type {InwardCutKey[]} */ (['info', 'filters', 'music'])) {
        const st = drawbridge[key];
        const panelOpen = drawbridgePanelOpenForKey(key);
        const bridgingShut =
            st.phase === 'opening-flatten' ||
            st.phase === 'opening-closeGap' ||
            (!st.wantParallel && st.gapOpen < 0.98);
        const hoverPeek = cutEmphasis[key].hovering && !panelOpen && !bridgingShut;
        cutEmphasis[key].target = desiredInwardCutScale(hoverPeek, hoverScale);
    }
}

/** @param {InwardCutKey} key */
function drawbridgePanelOpenForKey(key) {
    if (key === 'info') {
        return !!document.querySelector('.event-slide.open');
    }
    const rightPanel = document.querySelector('.filters-panel');
    if (!rightPanel?.classList.contains('open')) return false;
    const mode =
        rightPanel.dataset?.panelMode === 'music' ||
        rightPanel.classList.contains('filters-panel--music-mode')
            ? 'music'
            : 'filters';
    return key === mode;
}

/**
 * Parallel lip when the panel is open *or* the closed trap is hovered (peek).
 * @param {InwardCutKey} key
 */
function drawbridgeWantParallelForKey(key) {
    return drawbridgePanelOpenForKey(key) || cutEmphasis[key].hovering;
}

/**
 * Retarget drawbridge phases from DOM (open / hover). Does not paint.
 * Closed/unfocused → bridge; open or hover → parallel.
 * @param {number} [now]
 * @returns {boolean} true if any trap is mid-phase
 */
function resolveDrawbridgeFromDom(now = performance.now()) {
    let busy = false;
    for (const key of /** @type {InwardCutKey[]} */ (['info', 'filters', 'music'])) {
        const st = drawbridge[key];
        const wantParallel = drawbridgeWantParallelForKey(key);
        if (wantParallel !== st.wantParallel) {
            st.wantParallel = wantParallel;
            st.phaseStartedAt = now;
            st.fromFlatten = st.flatten;
            st.fromGapOpen = st.gapOpen;
            /* Parallel: open gap then unflatten. Bridge: flatten then close gap. */
            st.phase = wantParallel ? 'closing-openGap' : 'opening-flatten';
        }
        if (st.phase !== 'idle') busy = true;
    }
    return busy;
}

/** @param {number} u 0..1 */
function smoothstep01(u) {
    const t = clamp(u, 0, 1);
    return t * t * (3 - 2 * t);
}

/** Ease-out for flatten (settles into straight). */
function easeOutCubic01(u) {
    const t = 1 - clamp(u, 0, 1);
    return 1 - t * t * t;
}

/**
 * Begin gap-close toward bridge from the *visual* gap (hover peek included)
 * so the lip does not snap inward after flatten.
 * @param {InwardCutKey} key
 * @param {DrawbridgeState} st
 * @param {number} now
 */
function beginOpeningCloseGap(key, st, now) {
    st.flatten = 1;
    st.phase = 'opening-closeGap';
    st.phaseStartedAt = now;
    st.fromFlatten = 1;
    const hoverMul = Math.max(1, cutEmphasis[key].current);
    st.fromGapOpen = Math.max(st.gapOpen, 0.001) * hoverMul;
    st.gapOpen = st.fromGapOpen;
    cutEmphasis[key].current = 1;
    cutEmphasis[key].target = 1;
}

/**
 * Advance drawbridge flatten / gapOpen through sequenced phases.
 * @param {number} [now]
 * @returns {boolean}
 */
function advanceDrawbridge(now = performance.now()) {
    resolveDrawbridgeFromDom(now);
    let busy = false;
    for (const key of /** @type {InwardCutKey[]} */ (['info', 'filters', 'music'])) {
        const st = drawbridge[key];
        if (st.phase === 'idle') continue;
        if (st.phase === 'opening-flatten') {
            const u = easeOutCubic01((now - st.phaseStartedAt) / DRAWBRIDGE_FLATTEN_MS);
            st.flatten = st.fromFlatten + (1 - st.fromFlatten) * u;
            st.gapOpen = st.fromGapOpen;
            /* Overlap: start closing the cut once mostly straight. */
            if (u >= 0.88) {
                beginOpeningCloseGap(key, st, now);
            }
        } else if (st.phase === 'opening-closeGap') {
            const u = smoothstep01((now - st.phaseStartedAt) / DRAWBRIDGE_GAP_MS);
            st.flatten = 1;
            st.gapOpen = st.fromGapOpen + (0 - st.fromGapOpen) * u;
            if (u >= 1) {
                st.gapOpen = 0;
                st.phase = 'idle';
            }
        } else if (st.phase === 'closing-openGap') {
            const u = smoothstep01((now - st.phaseStartedAt) / DRAWBRIDGE_GAP_MS);
            st.flatten = st.fromFlatten;
            st.gapOpen = st.fromGapOpen + (1 - st.fromGapOpen) * u;
            if (u >= 1) {
                st.gapOpen = 1;
                st.phase = 'closing-unflatten';
                st.phaseStartedAt = now;
                st.fromFlatten = st.flatten;
                st.fromGapOpen = 1;
            }
        } else if (st.phase === 'closing-unflatten') {
            const u = easeOutCubic01((now - st.phaseStartedAt) / DRAWBRIDGE_FLATTEN_MS);
            st.gapOpen = 1;
            st.flatten = st.fromFlatten + (0 - st.fromFlatten) * u;
            if (u >= 1) {
                st.flatten = 0;
                st.phase = 'idle';
            }
        }
        if (st.phase !== 'idle') busy = true;
    }
    return busy;
}

function ensureDrawbridgeTween() {
    if (typeof window === 'undefined' || drawbridgeRaf || chromeTweening) return;
    resolveDrawbridgeFromDom();
    if (!Object.values(drawbridge).some((st) => st.phase !== 'idle')) return;
    const tick = (/** @type {number} */ now) => {
        if (chromeTweening) {
            drawbridgeRaf = 0;
            return;
        }
        const busy = advanceDrawbridge(now);
        resolveInwardCutTargetsFromDom();
        advanceInwardCutCurrents(now);
        /* Drawbridge only reshapes side inward lips — skip dock rebuilds. */
        if (!busy) settleDrawbridgeIfIdle();
        syncLiveEdgeChrome(undefined, { dock: false, sides: true });
        if (busy || inwardCutEmphasisBusy()) {
            drawbridgeRaf = window.requestAnimationFrame(tick);
        } else {
            drawbridgeRaf = 0;
        }
    };
    drawbridgeRaf = window.requestAnimationFrame(tick);
}

/** Snap drawbridge to DOM open state (cold apply / boot). Closed = bridged. */
function snapDrawbridgeToDom() {
    for (const key of /** @type {InwardCutKey[]} */ (['info', 'filters', 'music'])) {
        const wantParallel = drawbridgeWantParallelForKey(key);
        const st = drawbridge[key];
        st.wantParallel = wantParallel;
        st.flatten = wantParallel ? 0 : 1;
        st.gapOpen = wantParallel ? 1 : 0;
        st.phase = 'idle';
        st.fromFlatten = st.flatten;
        st.fromGapOpen = st.gapOpen;
    }
}

/**
 * If phases already finished, clamp residual flatten/gap so a closed trap cannot
 * leave a hairline punch (gapOpen stuck at ~0.01 still opens a visible break).
 */
function settleDrawbridgeIfIdle() {
    resolveDrawbridgeFromDom();
    for (const key of /** @type {InwardCutKey[]} */ (['info', 'filters', 'music'])) {
        const st = drawbridge[key];
        if (st.phase !== 'idle') continue;
        if (st.wantParallel) {
            st.flatten = 0;
            st.gapOpen = 1;
        } else {
            st.flatten = 1;
            st.gapOpen = 0;
        }
        st.fromFlatten = st.flatten;
        st.fromGapOpen = st.gapOpen;
    }
}

/** @param {{ snap?: boolean }} [opts] */
function refreshInwardCutEmphasis(opts = {}) {
    /* Never snap drawbridge on ordinary applies — resize/RO would kill the open/close ease. */
    resolveDrawbridgeFromDom();
    ensureDrawbridgeTween();
    resolveInwardCutTargetsFromDom();
    if (opts.snap) {
        for (const key of Object.keys(cutEmphasis)) {
            const e = cutEmphasis[/** @type {InwardCutKey} */ (key)];
            e.current = e.target;
        }
        return;
    }
    ensureInwardCutEmphasisTween();
}

/** @returns {boolean} true if any scale is still easing */
function inwardCutEmphasisBusy() {
    for (const key of Object.keys(cutEmphasis)) {
        const e = cutEmphasis[/** @type {InwardCutKey} */ (key)];
        if (Math.abs(e.current - e.target) > 0.0005) return true;
    }
    return false;
}

/** @param {number} [now] */
function advanceInwardCutCurrents(now = performance.now()) {
    const dt = Math.min(48, Math.max(0, now - (cutEmphasisLastTs || now)));
    cutEmphasisLastTs = now;
    const t = 1 - Math.exp(-dt / INWARD_CUT_TWEEN_TAU_MS);
    for (const key of Object.keys(cutEmphasis)) {
        const e = cutEmphasis[/** @type {InwardCutKey} */ (key)];
        const diff = e.target - e.current;
        if (Math.abs(diff) < 0.0005) e.current = e.target;
        else e.current += diff * t;
    }
    return inwardCutEmphasisBusy();
}

function ensureInwardCutEmphasisTween() {
    if (typeof window === 'undefined' || cutEmphasisRaf || chromeTweening) return;
    if (!inwardCutEmphasisBusy()) return;
    cutEmphasisLastTs = performance.now();
    cutEmphasisRaf = window.requestAnimationFrame(tickInwardCutEmphasis);
}

/** @param {number} now */
function tickInwardCutEmphasis(now) {
    /* Dock/panel layout tween owns the paint loop; it advances cut scales itself. */
    if (chromeTweening) {
        cutEmphasisRaf = 0;
        return;
    }
    const busy = advanceInwardCutCurrents(now);
    syncLiveEdgeChrome(undefined, { dock: false, sides: true });
    if (busy) {
        cutEmphasisRaf = window.requestAnimationFrame(tickInwardCutEmphasis);
    } else {
        cutEmphasisRaf = 0;
    }
}

/**
 * Right-rail launch classes are historically swapped vs `data-panel-mode`
 * (filters-launch opens music, music-launch opens filters). Always key cuts
 * off `data-panel-mode` so emphasis follows the real mode/icon.
 * @param {Element | null | undefined} handle
 * @returns {'filters'|'music'}
 */
function rightRailCutKeyFromHandle(handle) {
    return handle?.dataset?.panelMode === 'music' ? 'music' : 'filters';
}

/**
 * @param {EventTarget | null} el
 * @returns {InwardCutKey | null}
 */
function inwardCutKeyFromHoverTarget(el) {
    if (!(el instanceof Element)) return null;
    if (el.closest?.('.event-slide .panel-resize-handle--inner-right')) {
        return 'info';
    }
    const rightHandle = el.closest?.('.filters-panel .panel-resize-handle--inner-left');
    if (rightHandle) {
        return rightRailCutKeyFromHandle(rightHandle);
    }
    return null;
}

function bindInwardCutEmphasisHover() {
    if (cutEmphasisHoverBound || typeof document === 'undefined') return;
    cutEmphasisHoverBound = true;
    document.addEventListener(
        'pointerenter',
        (ev) => {
            const key = inwardCutKeyFromHoverTarget(ev.target);
            if (!key || cutEmphasis[key].hovering) return;
            cutEmphasis[key].hovering = true;
            refreshInwardCutEmphasis();
        },
        true,
    );
    document.addEventListener(
        'pointerleave',
        (ev) => {
            const key = inwardCutKeyFromHoverTarget(ev.target);
            if (!key || !cutEmphasis[key].hovering) return;
            /* Ignore leave→enter within the same trap / collapse control. */
            const still = inwardCutKeyFromHoverTarget(
                /** @type {PointerEvent} */ (ev).relatedTarget,
            );
            if (still === key) return;
            cutEmphasis[key].hovering = false;
            refreshInwardCutEmphasis();
        },
        true,
    );
}

/**
 * Debounced chrome re-paint. During dock live tween / panel width close, skip
 * full applies so they do not fight the frame loop.
 * @param {number} [delayMs]
 * @param {{ light?: boolean }} [opts] — light = edges only (no nub / CSS-var storm)
 */
export function scheduleSidePanelsTrapChromeReflow(delayMs = 48, opts = {}) {
    if (typeof window === 'undefined' || chromeLivePaintActive() || anySideChromeBusy()) {
        return;
    }
    const preferLight =
        opts.light === true || performance.now() < chromePreferLightReflowUntil;
    window.clearTimeout(chromeResizeTimer);
    chromeResizeTimer = window.setTimeout(() => {
        if (chromeLivePaintActive() || anySideChromeBusy()) return;
        if (preferLight || performance.now() < chromePreferLightReflowUntil) {
            syncLiveEdgeChrome(undefined, { dock: true, sides: true });
            return;
        }
        applySidePanelsTrapChrome(paintTrapChromeState());
    }, Math.max(0, delayMs));
}

/**
 * In-place border + inward paths only (no nub data-URL rebuild).
 * @param {object} [state]
 * @param {{ dock?: boolean, sides?: boolean }} [parts]
 */
function syncLiveEdgeChrome(state, parts = {}) {
    const wantDock = parts.dock !== false;
    const wantSides = parts.sides !== false;
    const s = paintTrapChromeState(state);
    if (wantDock) {
        const dockGeo = syncDockEdgeStroke(s, dockTrapGeometry(s)) || dockTrapGeometry(s);
        syncDockInwardLineShape(s, dockGeo);
    }
    if (wantSides) {
        /*
         * Mid dock-tween: keep trap *size* CSS vars settled (no sideTrapViewportFit —
         * that rewrites :root sizes and reflows). Still rebuild side SVG paths from
         * live label bands so borders track the CSS silhouette + panel `bottom` ease.
         */
        if (chromeTweening) {
            syncAllSidePanelEdges(s, { selective: false });
        } else {
            const fit = sideTrapViewportFit(s);
            const root = document.documentElement;
            if (root) {
                root.style.setProperty('--event-info-side-trapezium-h', `${fit.heightPx}px`);
                root.style.setProperty('--event-info-trap-protrude', `${fit.protrudePx}px`);
                root.style.setProperty('--event-info-trap-border-w', String(fit.borderWidth));
                root.style.setProperty('--side-edge-border-px', `${fit.borderWidth}px`);
            }
            syncAllSidePanelEdges(
                {
                    ...s,
                    trapHeightPx: fit.heightPx,
                    trapProtrudePx: fit.protrudePx,
                    sideBorderWidth: fit.borderWidth,
                },
                {
                    /* Drawbridge-only paints skip idle sides. */
                    selective: !wantDock,
                },
            );
        }
    }
}

/**
 * Dock height collapse/expand (~0.42s CSS) — overlay chrome is one timed unit:
 * dock height + panel `bottom` + --side-trap-collapse-shift are CSS; side edge
 * SVGs must be rewritten each frame from live trap bands (stretching a stale
 * path desyncs borders from the silhouette). Dock cap stroke is parented to the
 * dock and moves with it — only settle-paint the dock path.
 *
 * Codex: body --pagination-dock-height is frozen on the board (pagination-dock /
 * codex-canvas) so this layout read stays on the overlay panels, not the node tree.
 * Probe: localStorage.dockPerf=1.
 * @param {number} [durationMs]
 */
export function beginSideChromeDockTween(durationMs = 420) {
    if (typeof window === 'undefined') return;
    const ms = Math.max(120, Number(durationMs) || 420);
    chromeTweening = true;
    chromeTweenOverhangPx = sidePanelDockOverhangPx();
    window.clearTimeout(chromeResizeTimer);
    window.clearTimeout(chromeTweenTimer);
    window.cancelAnimationFrame(chromeTweenRaf);
    window.cancelAnimationFrame(cutEmphasisRaf);
    window.cancelAnimationFrame(drawbridgeRaf);
    chromeTweenRaf = 0;
    cutEmphasisRaf = 0;
    drawbridgeRaf = 0;

    const s = paintTrapChromeState();
    const seats = readDockSeatHeightsPx();
    const collapsing = !!document.body?.classList.contains('pagination-dock-collapsed');
    const infoHandle = document.querySelector(
        '.event-slide .panel-resize-handle--inner-right',
    );
    const filtersHandle =
        document.querySelector(
            '.filters-panel .panel-resize-handle--inner-left.panel-resize-handle--filters-launch',
        ) || document.querySelector('.filters-panel .panel-resize-handle--inner-left');
    const dockEl =
        document.getElementById('paginationDock') ||
        document.querySelector('.pagination-dock');
    /* One layout sample at tween start — mid frames use formulas only. */
    const infoH0 = infoHandle instanceof HTMLElement ? infoHandle.clientHeight : 0;
    const filtersH0 =
        filtersHandle instanceof HTMLElement ? filtersHandle.clientHeight : infoH0;
    const infoW = infoHandle instanceof HTMLElement ? infoHandle.clientWidth : 80;
    const filtersW =
        filtersHandle instanceof HTMLElement ? filtersHandle.clientWidth : infoW;
    const dockH0 =
        dockEl instanceof HTMLElement && dockEl.clientHeight > 0
            ? dockEl.clientHeight
            : collapsing
              ? seats.expanded
              : seats.collapsed;
    chromeTweenLayout = {
        collapsing,
        expandedDock: seats.expanded,
        collapsedDock: seats.collapsed,
        dockH0,
        infoH0: Math.max(8, infoH0),
        filtersH0: Math.max(8, filtersH0),
        infoW: Math.max(24, infoW),
        filtersW: Math.max(24, filtersW),
        protrude: Math.max(24, Number(s.trapProtrudePx) || 64),
        trapH: Math.max(64, Number(s.trapHeightPx) || 306),
        infoPos: Number(s.infoTrapPosPct) || 50,
        filtersPos: Number(s.filtersTrapPosPct) || 32,
        musicPos: Number(s.musicTrapPosPct) || 68,
    };

    document.body?.classList.add('side-chrome-dock-tweening');
    try {
        window.__codexSetCordAnimDockSuspended?.(true);
    } catch (_) {
        /* Codex not mounted */
    }
    try {
        window.DockCollapsePerf?.mark?.('side-chrome-dock-tween:start');
    } catch (_) {
        /* probe optional */
    }

    /* First paint immediately so frame 0 is not a stretched stale path. */
    syncLiveEdgeChrome(undefined, { dock: false, sides: true });

    const tick = () => {
        if (!chromeTweening) return;
        /* Sides only — dock stroke rides the cap row; rewriting it each frame is waste. */
        syncLiveEdgeChrome(undefined, { dock: false, sides: true });
        chromeTweenRaf = window.requestAnimationFrame(tick);
    };
    chromeTweenRaf = window.requestAnimationFrame(tick);

    chromeTweenTimer = window.setTimeout(() => {
        window.cancelAnimationFrame(chromeTweenRaf);
        chromeTweenRaf = 0;
        /* Leave tween mode before settle so sideTrapViewportFit runs for final sizes. */
        chromeTweening = false;
        chromeTweenOverhangPx = null;
        chromeTweenLayout = null;
        document.body?.classList.remove('side-chrome-dock-tweening');
        /*
         * Cancel RO-scheduled full applies from panel height change; settle paint
         * already fits + syncs edges. Keep RO on a light path briefly after.
         */
        window.clearTimeout(chromeResizeTimer);
        chromePreferLightReflowUntil = performance.now() + 700;
        settleDrawbridgeIfIdle();
        syncLiveEdgeChrome(undefined, { dock: true, sides: true });
        try {
            window.DockCollapsePerf?.mark?.('side-chrome-dock-tween:settle');
        } catch (_) {
            /* probe optional */
        }
        ensureInwardCutEmphasisTween();
        ensureDrawbridgeTween();
        try {
            window.__codexSetCordAnimDockSuspended?.(false);
        } catch (_) {
            /* Codex not mounted */
        }
    }, ms);
}

/**
 * Panel open/close — do NOT run a heavy layout rAF loop (that lagged Confirm close).
 * Guard RO full-applies for the width CSS duration and let drawbridge own inward paint.
 */
export function beginSideChromePanelTween() {
    if (typeof window === 'undefined') return;
    panelWidthTweenGuardUntil = performance.now() + 380;
    window.clearTimeout(chromeResizeTimer);
    refreshInwardCutEmphasis();
    /* One immediate side paint so the first close frame is not a stale bridged lip. */
    syncLiveEdgeChrome(undefined, { dock: false, sides: true });
}

/** True while a dock chrome layout tween owns the paint loop. */
export function isSideChromeLayoutTweening() {
    return chromeTweening;
}

function observeSideChromeLayoutTargets() {
    if (typeof ResizeObserver === 'undefined') return;
    if (!chromeLayoutRo) {
        chromeLayoutRo = new ResizeObserver(() => {
            if (chromeLivePaintActive() || anySideChromeBusy()) return;
            /*
             * Panel/dock box changes (collapse, open) only need path sync.
             * Full apply is reserved for window resize / tweaks (viewport fit + nubs).
             */
            scheduleSidePanelsTrapChromeReflow(64, { light: true });
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
    bindInwardCutEmphasisHover();
    snapDrawbridgeToDom();
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
                if (
                    m.type === 'attributes' &&
                    (m.attributeName === 'class' || m.attributeName === 'data-panel-mode')
                ) {
                    const t = m.target;
                    if (!(t instanceof Element)) continue;
                    const isBody = t === document.body;
                    const isPanel =
                        t.classList.contains('event-slide') || t.classList.contains('filters-panel');
                    if (isPanel) {
                        /* Open/close / filters↔music mode retargets cut emphasis per trap. */
                        refreshInwardCutEmphasis();
                        /*
                         * FiltersPanel already starts the panel tween on open/close.
                         * Only kick one for event-slide (or other class toggles) when
                         * a layout tween is not already owning the paint loop —
                         * restarting mid-bridge dropped frames.
                         */
                        if (
                            m.attributeName === 'class' &&
                            !chromeTweening &&
                            t.classList.contains('event-slide')
                        ) {
                            const cl = t.classList;
                            const nowTween = cl.contains('open');
                            const wasTween =
                                typeof m.oldValue === 'string' && /\bopen\b/.test(m.oldValue);
                            if (nowTween || wasTween) {
                                beginSideChromePanelTween();
                            }
                        }
                    }
                    if (isBody && m.attributeName === 'class') {
                        /*
                         * Dock collapse is owned by pagination-dock-collapse + tween.
                         * Ignore dock / tween body classes — full apply here forced
                         * 80–300ms reflows on keydown + settle (Codex longtasks).
                         * Also ignore UI Tweaks open/tab classes — those must not
                         * re-fit trap/dock geometry or editing preview drifts vs closed.
                         */
                        if (chromeTweening) continue;
                        if (document.body.classList.contains('side-chrome-dock-tweening')) {
                            continue;
                        }
                        const was = typeof m.oldValue === 'string' ? m.oldValue : '';
                        if (/\bside-chrome-dock-tweening\b/.test(was)) continue;
                        const stripChromeNoise = (cls) =>
                            cls
                                .replace(/\bpagination-dock-collapsed\b/g, '')
                                .replace(/\bui-tweaks-[\w-]+\b/g, '')
                                .replace(/\s+/g, ' ')
                                .trim();
                        const now = document.body.className || '';
                        if (stripChromeNoise(was) === stripChromeNoise(now)) {
                            continue;
                        }
                        scheduleSidePanelsTrapChromeReflow(80);
                    }
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
            attributeOldValue: true,
            attributeFilter: ['class', 'data-panel-mode'],
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
 * Drop near-duplicate vertices so zero-length segments cannot poison normals.
 * @param {{x:number,y:number}[]} pts
 * @param {number} [eps]
 */
function dedupePolyPoints(pts, eps = 0.6) {
    if (pts.length < 2) return pts.map((p) => ({ ...p }));
    /** @type {{x:number,y:number}[]} */
    const out = [{ x: pts[0].x, y: pts[0].y }];
    for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        const q = out[out.length - 1];
        if (Math.hypot(p.x - q.x, p.y - q.y) >= eps) out.push({ x: p.x, y: p.y });
    }
    if (out.length === 1 && pts.length > 1) {
        out.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
    }
    return out;
}

/**
 * Offset an open polyline by a constant `dist` px along left-hand normals (miter join).
 * Negative dist offsets the opposite way (needed when mirroring side geometry).
 * Miter length is capped — drawbridge flatten makes acute corners whose uncapped
 * miters spike into long white shards.
 * @param {{x:number,y:number}[]} pts
 * @param {number} dist
 */
function offsetPolyline(pts, dist) {
    const clean = dedupePolyPoints(pts);
    if (clean.length < 2 || !(Math.abs(dist) > 0.01)) return clean.map((p) => ({ ...p }));
    const n = clean.length;
    const segN = [];
    for (let i = 0; i < n - 1; i++) segN.push(segmentInteriorNormal(clean[i], clean[i + 1]));
        const maxMiter = Math.abs(dist) * 2.4;
        const out = [];
        for (let i = 0; i < n; i++) {
        if (i === 0) {
            out.push({
                x: clean[i].x + segN[0].x * dist,
                y: clean[i].y + segN[0].y * dist,
            });
            continue;
        }
        if (i === n - 1) {
            out.push({
                x: clean[i].x + segN[n - 2].x * dist,
                y: clean[i].y + segN[n - 2].y * dist,
            });
            continue;
        }
        const n0 = segN[i - 1];
        const n1 = segN[i];
        const denom = 1 + n0.x * n1.x + n0.y * n1.y;
        let ox;
        let oy;
        if (Math.abs(denom) < 0.14) {
            /* Near-parallel / razor corner — bevel (average normals) instead of miter. */
            const nx = n0.x + n1.x;
            const ny = n0.y + n1.y;
            const len = Math.hypot(nx, ny) || 1;
            ox = (nx / len) * dist;
            oy = (ny / len) * dist;
        } else {
            ox = ((n0.x + n1.x) / denom) * dist;
            oy = ((n0.y + n1.y) / denom) * dist;
            const mLen = Math.hypot(ox, oy);
            if (mLen > maxMiter) {
                ox = (ox / mLen) * maxMiter;
                oy = (oy / mLen) * maxMiter;
            }
        }
        out.push({
            x: clean[i].x + ox,
            y: clean[i].y + oy,
        });
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
 * Cap-row X cuts for the mirrored inward lips — driven by center-gap tweak × emphasis.
 * Smaller gap → lips reach further toward the trap middle.
 * @param {ReturnType<typeof dockTrapGeometry>} geo
 * @param {object} s
 * @param {number} [cutScale]
 */
function dockInwardCenterCuts(geo, s, cutScale = INWARD_CUT_IDLE_SCALE) {
    const mid = geo.dockW / 2;
    /* Allow focus bonus up to nearly full dock width — old 0.85× still fine for ≤150%. */
    const maxGap = Math.max(24, geo.dockW * 0.95);
    const base = clamp(Number(s.dockInwardCenterGapPx) || 200, 24, maxGap);
    const gap = clamp(base * cutScale, 24, maxGap);
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
    /* Allow short dual-trap connectors; dropping sub-8px bands left visible breaks. */
    if (hi - lo < 3) return '';
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

    /* Migrate off the old slider-row host once (not every live paint frame). */
    if (!dockInwardLegacyCleaned) {
        document
            .querySelectorAll('.event-page-slider-row > .pagination-dock-inward-line')
            .forEach((el) => el.remove());
        dockInwardLegacyCleaned = true;
    }

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
    const curveSteps = chromeTweening ? 3 : 6;
    const densifyStep = chromeTweening ? 12 : 6;
    const rounded = sampleRoundedPolyline(outerPts, s.dockBorderRadius, curveSteps);
    const outerEdge = densifyPolyline(offsetPolyline(rounded, outerInset), densifyStep);
    const tipTh = Math.max(0.5, Math.min(fullTh, s.dockInwardEndThicknessPx));
    /* Tip/slope authored for wide traps — clamp so zoom-narrow docks don't tear the lip. */
    const tipW = Math.min(s.dockInwardTipWidthPx, Math.max(24, live.trapW * 0.42));
    const slopeW = Math.min(s.dockInwardSlopeWidthPx, Math.max(4, live.trapW * 0.12));

    /*
     * Two mirrored ribbons; center butts are vertical (constant X) even on the
     * trap slopes. Corner rounding fillets those cut corners.
     */
    /* Dock cut is always authored gap — no hover/collapse bonus. */
    const { leftCut, rightCut } = dockInwardCenterCuts(live, s, INWARD_CUT_IDLE_SCALE);
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
 * @param {{top:number,height:number,flatten?:number}[]} traps
 * @param {number} taperPct
 */
function sideInwardOuterPoints(_protrudeDir, handleH, seamX, tipX, traps, taperPct) {
    const t = clamp(Number(taperPct) || 0, 0, 40) / 100;
    const tipSign = tipX >= seamX ? 1 : -1;
    const fullDepth = Math.abs(tipX - seamX);
    /** @type {{x:number,y:number}[]} */
    const pts = [{ x: seamX, y: 0 }];
    const sorted = [...traps].sort((a, b) => a.top - b.top);

    for (let i = 0; i < sorted.length; i++) {
        const tr = sorted[i];
        const flat = clamp(Number(tr.flatten) || 0, 0, 1);
        const top = tr.top;
        const bot = tr.top + tr.height;
        pts.push({ x: seamX, y: top });

        /*
         * Drawbridge flatten: keep a usable tip depth until nearly straight, then
         * drop tip vertices entirely. Morphing tip→seam with tiny leftovers made
         * razor corners whose offset miters spiked into shards mid-animation.
         */
        if (flat >= 0.84 || fullDepth < 1) {
            pts.push({ x: seamX, y: bot });
            continue;
        }
        const depth = Math.max(fullDepth * (1 - flat), 12 * (1 - flat));
        const xTip = seamX + tipSign * depth;
        let inset = Math.max(4, tr.height * t) * (1 - flat);
        inset = Math.max(inset, 10 * (1 - flat));
        const tipSpan = bot - top - 2 * inset;
        if (tipSpan < 8) {
            const midY = (top + bot) / 2;
            pts.push({ x: xTip, y: midY });
        } else {
            pts.push({ x: xTip, y: top + inset });
            pts.push({ x: xTip, y: bot - inset });
        }
        pts.push({ x: seamX, y: bot });
    }
    pts.push({ x: seamX, y: handleH });
    return dedupePolyPoints(pts, 0.75);
}

/**
 * Punch [holeLo, holeHi] out of solid Y spans.
 * @param {[number, number][]} spans
 * @param {number} holeLo
 * @param {number} holeHi
 */
function punchYSpans(spans, holeLo, holeHi) {
    /** @type {[number, number][]} */
    const out = [];
    for (let i = 0; i < spans.length; i++) {
        const a = spans[i][0];
        const b = spans[i][1];
        if (holeHi <= a || holeLo >= b) {
            out.push([a, b]);
            continue;
        }
        if (holeLo > a) out.push([a, holeLo]);
        if (holeHi < b) out.push([holeHi, b]);
    }
    return out;
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
 * Constant thickness (no end shrinkage). Drawbridge flatten/gap are inward-only
 * (outer white stroke keeps the full trap silhouette).
 * @param {Element} paintParent host for the inward SVG (handle or panel edge host)
 * @param {'left'|'right'} protrudeDir
 * @param {{handleW:number,handleH:number,protrude:number,traps:{top:number,height:number,key?:InwardCutKey,scale?:number}[],edgeRadius?:number}} edge
 * @param {object} s
 * @param {number[]} [cutScales] per-trap hover scale (default 1)
 */
function syncSideInwardFromEdge(paintParent, protrudeDir, edge, s, cutScales) {
    const { handleW, handleH, protrude, traps } = edge;
    const offsetPx = Number(s.sideInwardLineOffsetPx) || 0;
    const outerInset = Math.max(
        0.5,
        Math.min(
            protrude * 0.42,
            s.sideBorderWidth * 0.5 + Math.max(0, offsetPx),
        ),
    );
    const edgeRadius = edge.edgeRadius ?? Math.max(s.sideBorderRadius, s.dockBorderRadius);
    const trapsForInward = traps.map((tr, i) => {
        const key = tr.key;
        const st = key ? drawbridge[key] : null;
        return {
            top: tr.top,
            height: tr.height,
            flatten: st ? st.flatten : 1,
            gapOpen: st ? st.gapOpen : 0,
            scale:
                typeof cutScales?.[i] === 'number' && Number.isFinite(cutScales[i])
                    ? cutScales[i]
                    : typeof tr.scale === 'number'
                      ? tr.scale
                      : INWARD_CUT_IDLE_SCALE,
        };
    });
    /*
     * Densify is the expensive bit. Shape depends on flatten (not gapOpen) —
     * cache across closeGap/openGap frames once flatten has settled.
     */
    /* Inward lip gets its own polyline so drawbridge flatten does not move the outer stroke. */
    const liveBusy = chromeTweening || anySideChromeBusy();
    const localPts = sideInwardOuterPoints(
        'right',
        handleH,
        0,
        protrude,
        trapsForInward,
        s.trapTaperPct,
    );
    /* Dock tween: coarsest densify — still tracks Y, without starving the CSS ease. */
    const curveSteps = chromeTweening ? 2 : liveBusy ? 3 : 6;
    const densifyStep = chromeTweening ? 20 : liveBusy ? 12 : 5;
    const rounded = dedupePolyPoints(
        sampleRoundedPolyline(localPts, edgeRadius, curveSteps),
        0.5,
    );
    const localEdge = densifyPolyline(offsetPolyline(rounded, outerInset), densifyStep);
    const fullTh = Math.max(1, s.sideInwardLineThicknessPx);
    const cornerR = Math.max(s.sideInwardCornerRadiusPx, edgeRadius);
    const maxButt = Math.max(fullTh * 3, 36);
    const baseGap = clamp(Number(s.sideInwardCenterGapPx) || 200, 24, 900);
    const th = () => fullTh;
    const maxHalfFor = (/** @type {number} */ trapH, /** @type {number} */ scale) =>
        trapH * Math.min(0.88, 0.42 * Math.max(1, scale));

    /* Solid spans along Y; each open cut punches a hole. gapOpen→0 removes the hole. */
    /** @type {[number, number][]} */
    let spans = [[0, handleH]];
    for (let i = 0; i < trapsForInward.length; i++) {
        const tr = trapsForInward[i];
        /* Treat near-closed as closed — residual 0.01–0.05 left hairline breaks. */
        const gapOpen = tr.gapOpen < 0.04 ? 0 : tr.gapOpen;
        const gap = clamp(baseGap * tr.scale * gapOpen, 0, 900);
        if (gap < 4) continue;
        const mid = tr.top + tr.height / 2;
        const half = Math.min(gap / 2, maxHalfFor(tr.height, Math.max(1, tr.scale)));
        if (half < 2) continue;
        spans = punchYSpans(spans, mid - half, mid + half);
    }

    /** @type {string[]} */
    const localParts = [];
    for (let i = 0; i < spans.length; i++) {
        const a = spans[i][0];
        const b = spans[i][1];
        /* Keep short connectors between dual-trap cuts — dropping them left visible gaps. */
        if (b - a < 3) continue;
        if (a <= 0.5 && b >= handleH - 0.5) {
            localParts.push(
                horizontalBandRibbonPath(localEdge, th, 0, handleH, cornerR, maxButt),
            );
        } else if (a <= 0.5) {
            localParts.push(
                horizontalCutRibbonPath(localEdge, th, b, 'top', cornerR, maxButt),
            );
        } else if (b >= handleH - 0.5) {
            localParts.push(
                horizontalCutRibbonPath(localEdge, th, a, 'bottom', cornerR, maxButt),
            );
        } else {
            localParts.push(
                horizontalBandRibbonPath(localEdge, th, a, b, cornerR, maxButt),
            );
        }
    }

    const raw = localParts.filter(Boolean).join('');
    /* Mirror into handle space so the lip sits inside the filters panel fill. */
    const d = protrudeDir === 'left' ? mirrorPathDX(raw, handleW) : raw;

    const { host, svg, path } = ensureSideInwardHost(paintParent);
    if (!path) return;
    const pad = Math.max(24, fullTh * 2 + Math.abs(offsetPx) + s.sideBorderWidth);
    const vbW = handleW + pad;
    const inwardKey =
        `${handleW}|${handleH}|${protrude}|${outerInset}|${fullTh}|${cornerR}|${protrudeDir}|` +
        trapsForInward
            .map(
                (t) =>
                    `${Math.round(t.top)},${Math.round(t.height)},${t.flatten.toFixed(3)},${t.gapOpen.toFixed(3)},${Number(t.scale).toFixed(3)}`,
            )
            .join(';');
    if (host.dataset.sideInwardKey === inwardKey && path.getAttribute('d')) return;
    host.dataset.sideInwardKey = inwardKey;
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
/**
 * @param {Element} panel
 * @param {Element} filtersHandle
 * @param {number} [paintHeight] may exceed handle to overhang under the dock
 * @param {{ handleW?: number, handleH?: number }} [layout]
 */
function ensureFiltersEdgeHost(panel, filtersHandle, paintHeight, layout = {}) {
    let host = panel.querySelector(':scope > .panel-side-edge-host');
    if (!host) {
        host = document.createElement('div');
        host.className = 'panel-side-edge-host';
        host.setAttribute('aria-hidden', 'true');
        panel.appendChild(host);
        host.style.position = 'absolute';
        host.style.top = '0';
        host.style.left = '0';
        host.style.transform = 'translateX(-100%)';
        host.style.zIndex = '206';
        host.style.pointerEvents = 'none';
        host.style.overflow = 'visible';
    }
    const w = Math.max(1, Math.round(Number(layout.handleW) || filtersHandle.clientWidth || 0));
    const h = Math.max(
        Math.round(Number(layout.handleH) || filtersHandle.clientHeight || 0),
        Math.round(Number(paintHeight) || filtersHandle.clientHeight),
    );
    const boxKey = `${w}x${h}`;
    if (host.dataset.boxKey !== boxKey) {
        host.style.width = `${w}px`;
        host.style.height = `${h}px`;
        host.dataset.boxKey = boxKey;
    }
    return host;
}

/**
 * Continuous outer edge + parallel inward lip for info + filters panels (dock language).
 * Filters dual traps: paint onto a persistent panel host (in-place updates for dock tween).
 * @param {object} s
 * @param {{ selective?: boolean }} [opts] — when selective, skip idle sides (drawbridge path)
 */
export function syncAllSidePanelEdges(s, opts = {}) {
    const selective = !!opts.selective;
    const overhang = sidePanelDockOverhangPx();
    const tween = chromeTweening ? chromeTweenLayout : null;
    let tweenInfoH = 0;
    let tweenFiltersH = 0;
    let tweenShift = 0;
    if (tween) {
        const collapseT = readTrapCollapseT();
        const dockH =
            tween.expandedDock + (tween.collapsedDock - tween.expandedDock) * collapseT;
        tweenInfoH = Math.max(8, Math.round(tween.infoH0 + (tween.dockH0 - dockH)));
        tweenFiltersH = Math.max(8, Math.round(tween.filtersH0 + (tween.dockH0 - dockH)));
        /* Must match CSS --side-trap-collapse-shift-amount (not a hardcoded 10). */
        const shiftAmount = Number(s?.sideTrapCollapseShiftPct);
        const amount = Number.isFinite(shiftAmount) ? shiftAmount : 10;
        tweenShift = collapseT * amount;
    }

    const infoHandle = document.querySelector(
        '.event-slide .panel-resize-handle--inner-right',
    );
    const paintInfo =
        !!infoHandle &&
        (!selective ||
            sideChromeKeyBusy('info') ||
            !!document.querySelector('.event-slide.open'));
    if (paintInfo && infoHandle) {
        if (infoHandle instanceof HTMLElement) {
            infoHandle.style.overflow = 'visible';
        }
        /** @type {{top:number,height:number,key:InwardCutKey,scale:number}[]} */
        let traps;
        /** @type {{ handleW?: number, handleH?: number, protrude?: number }} */
        let layout = {};
        if (tween) {
            const band = formulaTrapBand(
                tweenInfoH,
                tween.trapH,
                tween.infoPos,
                tweenShift,
                0.62,
            );
            traps = [
                {
                    ...band,
                    key: /** @type {InwardCutKey} */ ('info'),
                    scale: cutEmphasis.info.current,
                },
            ];
            layout = {
                handleW: tween.infoW,
                handleH: tweenInfoH,
                protrude: tween.protrude,
            };
        } else {
            traps = measureSideTrapBands(infoHandle, [infoHandle]).map((tr) => ({
                ...tr,
                key: /** @type {InwardCutKey} */ ('info'),
                scale: cutEmphasis.info.current,
            }));
        }
        const paintH = (tween ? tweenInfoH : infoHandle.clientHeight) + overhang;
        const edge = syncSidePanelEdgeStroke(
            infoHandle,
            'right',
            traps,
            s,
            undefined,
            paintH,
            layout,
        );
        if (edge) {
            edge.traps = traps;
            syncSideInwardFromEdge(infoHandle, 'right', edge, s, [cutEmphasis.info.current]);
        }
    }

    const panel = document.querySelector('.filters-panel');
    const rightHandles = panel
        ? Array.from(
              panel.querySelectorAll('.panel-resize-handle--inner-left'),
          )
        : [];
    /* Prefer filters-launch as measure host (full-height rail); fall back to first handle. */
    const measureHandle =
        rightHandles.find((h) =>
            h.classList.contains('panel-resize-handle--filters-launch'),
        ) || rightHandles[0];
    /* Strip handle-local leftovers once — keep `.panel-side-edge-host` for live updates. */
    if (!sideHandleLegacyStrokesCleaned) {
        const leftovers = document.querySelectorAll(
            '.filters-panel .panel-resize-handle--inner-left > .panel-trap-edge-stroke, ' +
                '.filters-panel .panel-resize-handle--inner-left > .panel-side-edge-stroke, ' +
                '.filters-panel .panel-resize-handle--inner-left > .panel-side-inward-line',
        );
        leftovers.forEach((el) => el.remove());
        sideHandleLegacyStrokesCleaned = true;
    }

    if (!measureHandle || !panel) return;

    const paintFilters =
        !selective ||
        sideChromeKeyBusy('filters') ||
        sideChromeKeyBusy('music') ||
        panel.classList.contains('open') ||
        panel.classList.contains('panel--closing');
    if (!paintFilters) return;

    /*
     * Scale + drawbridge key from data-panel-mode (launch class names are swapped).
     * Bands sort by Y with key/scale glued to each handle.
     */
    /** @type {{top:number,height:number,scale:number,key:InwardCutKey}[]} */
    const traps = [];
    /** @type {{ handleW?: number, handleH?: number, protrude?: number }} */
    let filtersLayout = {};
    if (tween) {
        const keys = rightHandles.length
            ? rightHandles.map((handle) => rightRailCutKeyFromHandle(handle))
            : /** @type {InwardCutKey[]} */ (['filters', 'music']);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const pos = key === 'music' ? tween.musicPos : tween.filtersPos;
            const band = formulaTrapBand(
                tweenFiltersH,
                tween.trapH,
                pos,
                tweenShift,
                0.42,
            );
            traps.push({
                ...band,
                scale: cutEmphasis[key].current,
                key,
            });
        }
        traps.sort((a, b) => a.top - b.top);
        filtersLayout = {
            handleW: tween.filtersW,
            handleH: tweenFiltersH,
            protrude: tween.protrude,
        };
    } else {
        for (let i = 0; i < rightHandles.length; i++) {
            const handle = rightHandles[i];
            const label = handle.querySelector('.panel-resize-handle__trap-label');
            if (!(label instanceof HTMLElement) || !(label.offsetHeight > 4)) continue;
            const key = rightRailCutKeyFromHandle(handle);
            traps.push({
                top: label.offsetTop,
                height: label.offsetHeight,
                scale: cutEmphasis[key].current,
                key,
            });
        }
        traps.sort((a, b) => a.top - b.top);
    }
    if (!traps.length) return;
    const paintH = (tween ? tweenFiltersH : measureHandle.clientHeight) + overhang;
    const host = ensureFiltersEdgeHost(panel, measureHandle, paintH, filtersLayout);
    const edge = syncSidePanelEdgeStroke(
        measureHandle,
        'left',
        traps,
        s,
        host,
        paintH,
        filtersLayout,
    );
    if (edge) {
        edge.traps = traps;
        syncSideInwardFromEdge(
            host,
            'left',
            edge,
            s,
            traps.map((t) => t.scale),
        );
    }
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
 * Keep the floating Atlas News badge in sync with tweak vars.
 * mountAtlasNewsChrome also writes inline !important sizes — override those live.
 * @param {object} s sanitized trap state
 */
function syncFloatingAtlasNewsBadge(s) {
    const badge =
        document.querySelector('.footer-atlas-news.footer-atlas-news--floating') ||
        document.querySelector('footer.timeline-loaded .footer-atlas-news');
    if (!badge) return;
    badge.style.setProperty('width', `${s.atlasNewsWidthPx}px`, 'important');
    badge.style.setProperty('height', `${s.atlasNewsHeightPx}px`, 'important');
    const img = badge.querySelector('img');
    if (img) {
        img.style.setProperty('width', `${s.atlasNewsIconPct}%`, 'important');
        img.style.setProperty('height', `${s.atlasNewsIconPct}%`, 'important');
        img.style.setProperty('max-width', '100%', 'important');
        img.style.setProperty('max-height', '100%', 'important');
        img.style.setProperty('object-fit', 'contain', 'important');
        img.style.setProperty('display', 'block', 'important');
    }
}

/** Rounded trapezium path (viewBox 0 0 1000 100) — wider at bottom, soft corners. */
const STAGE_SLIDER_TRAP_PATH =
    'M82,10 H918 Q942,10 954,28 L978,72 Q990,90 966,90 H34 Q10,90 22,72 L46,28 Q58,10 82,10 Z';

/**
 * @param {'mask' | 'stroke'} kind
 * @param {number} strokeWidth
 * @returns {string} CSS url("data:image/svg+xml,...")
 */
function stageSliderTrapSvgUrl(kind, strokeWidth = 2) {
    const sw = Math.max(0.5, Number(strokeWidth) || 2);
    const svg =
        kind === 'mask'
            ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100" preserveAspectRatio="none"><path d="${STAGE_SLIDER_TRAP_PATH}" fill="#fff"/></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100" preserveAspectRatio="none"><path d="${STAGE_SLIDER_TRAP_PATH}" fill="none" stroke="#fff" stroke-width="${sw * 5}" stroke-linejoin="round"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * World-mode CSS vars only — no dock SVG / side-stroke rebuild.
 * Use while dragging World mode tweaks so preview stays cheap.
 * @param {object} state
 * @param {CSSStyleDeclaration} [rootStyle]
 */
export function applyWorldModeChromeVars(state, rootStyle) {
    const s = sanitizeSidePanelsTrapState({ ...SIDE_PANELS_TRAP_TWEAK_DEFAULTS, ...state });
    /* Keep live trap bag in sync so dock refresh / reload paths see World edits. */
    liveTrapChromeState = liveTrapChromeState
        ? sanitizeSidePanelsTrapState({ ...liveTrapChromeState, ...s })
        : s;
    const root = rootStyle || document.documentElement?.style;
    if (!root) return s;
    const worldVars = {
        '--world-flank-gap-border': `${s.worldFlankGapBorderPx}px`,
        '--world-flank-pair-gap': `${s.worldFlankPairGapPx}px`,
        '--world-flank-offset-y': `${s.worldFlankOffsetYPx}px`,
        '--world-flank-icon': `${s.worldFlankIconPx}px`,
        '--world-flank-font': `${s.worldFlankFontPx}px`,
        '--world-zoom-stack-gap': `${s.worldZoomStackGapPx}px`,
        '--world-zoom-lift': `${s.worldZoomLiftPx}px`,
        '--world-reset-min-h': `${s.worldResetMinHeightPx}px`,
        '--world-reset-font': `${s.worldResetFontPx}px`,
        '--world-reset-pad-x': `${s.worldResetPadXPx}px`,
        '--world-zoom-thumb': `${s.worldZoomThumbPx}px`,
        '--world-zoom-track-h': `${s.worldZoomTrackHPx}px`,
        '--world-zoom-track-border': `${s.worldZoomTrackBorderPx}px`,
        '--world-zoom-slider-width': `${s.worldZoomSliderWidthPct}%`,
        '--world-sun-slider-width': `${s.worldSunSliderWidthPct}%`,
        '--dock-flank-pair-gap': `${s.worldFlankPairGapPx}px`,
        '--zoom-slider-trap-mask': stageSliderTrapSvgUrl('mask'),
        '--zoom-slider-trap-stroke': stageSliderTrapSvgUrl('stroke', s.worldZoomTrackBorderPx),
    };
    for (const [prop, value] of Object.entries(worldVars)) {
        root.setProperty(prop, value);
        document.body?.style.setProperty(prop, value);
    }
    return s;
}

/**
 * @param {object} state
 * @param {{ snapCuts?: boolean }} [opts] — default snap; dock-tween settle passes false
 */
export function applySidePanelsTrapChrome(state, opts = {}) {
    const s = sanitizeSidePanelsTrapState(state || cloneDefaults());
    liveTrapChromeState = s;
    installSidePanelsTrapChromeLifecycle();
    /* Cold applies snap cut scales; live dock settle must not or the ease pops. */
    refreshInwardCutEmphasis({ snap: opts.snapCuts !== false });
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
            dockWMobile: s.dockTrapWidthMobilePx,
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

    /* Atlas News red trapezium — CSS vars + live inline sync (beats float mount). */
    const atlasNewsVars = {
        '--atlas-news-width': `${s.atlasNewsWidthPx}px`,
        '--atlas-news-height': `${s.atlasNewsHeightPx}px`,
        '--atlas-news-icon-pct': `${s.atlasNewsIconPct}%`,
    };
    for (const [prop, value] of Object.entries(atlasNewsVars)) {
        root.style.setProperty(prop, value);
        document.body?.style.setProperty(prop, value);
    }
    syncFloatingAtlasNewsBadge(s);

    /* Independent vertical slides */
    root.style.setProperty('--event-info-trap-pos', String(s.infoTrapPosPct));
    root.style.setProperty('--filters-trap-pos', String(s.filtersTrapPosPct));
    root.style.setProperty('--music-trap-pos', String(s.musicTrapPosPct));
    const collapseShiftAmount = String(s.sideTrapCollapseShiftPct);
    root.style.setProperty('--side-trap-collapse-shift-amount', collapseShiftAmount);
    document.body?.style.setProperty('--side-trap-collapse-shift-amount', collapseShiftAmount);

    /* Clear legacy CSS-background stroke URLs (inline SVGs replace them). */
    root.style.setProperty('--event-info-trap-stroke-img', 'none');
    root.style.setProperty('--event-info-trap-stroke-img-mirror', 'none');
    root.style.setProperty('--dock-trap-stroke-img', 'none');
    root.style.setProperty('--dock-top-edge-stroke-img', 'none');

    /*
     * Dock: paint border first (cap-row client box), then force fill to that silhouette.
     * Do NOT rewrite --dock-border-seam-h / img-h (those seat the cap row).
     */
    /*
     * Cap trap height against live viewport so zoom-in does not leave 120px controls
     * inside a band that is visually shorter than the fixed authoring size.
     * Compact portrait must track pagination-dock.css seam clamp (68–84) — desktop
     * 120px trap + 22px inward lip + 13px button Y blow out the phone dock chrome.
     */
    const vw = typeof window !== 'undefined' ? window.innerWidth || 1400 : 1400;
    const vh = typeof window !== 'undefined' ? window.innerHeight || 900 : 900;
    const compact = vw <= 768;
    const portrait = compact && vh >= vw;
    const fluidDockTrapH = compact
        ? Math.max(56, Math.min(portrait ? 84 : 96, Math.round(vh * (portrait ? 0.095 : 0.11))))
        : Math.max(56, Math.min(s.dockTrapHeightPx, Math.round(vh * 0.12)));
    root.style.setProperty('--dock-trap-height', `${fluidDockTrapH}px`);
    /* Set on :root + body — body dock rules redefine many vars and would shadow :root alone. */
    const buttonsOffsetYPx = compact
        ? Math.min(s.dockButtonsOffsetYPx, portrait ? 36 : 6)
        : s.dockButtonsOffsetYPx;
    const buttonsOffsetY = `${buttonsOffsetYPx}px`;
    root.style.setProperty('--dock-buttons-offset-y', buttonsOffsetY);
    root.style.removeProperty('--stage-menu-offset-y');
    root.style.removeProperty('--globe-offset-y');
    const inwardLineH = `${
        compact ? Math.min(s.dockInwardLineThicknessPx, portrait ? 12 : 16) : s.dockInwardLineThicknessPx
    }px`;
    const inwardLineY = `${
        compact ? Math.min(s.dockInwardLineOffsetYPx, portrait ? 4 : 8) : s.dockInwardLineOffsetYPx
    }px`;
    const inwardClearance = `${Math.max(0, compact ? Math.min(s.dockInwardSliderClearancePx, 10) : s.dockInwardSliderClearancePx)}px`;
    const inwardClearanceCollapsed = `${Math.max(0, compact ? Math.min(s.dockInwardSliderClearanceCollapsedPx, 16) : s.dockInwardSliderClearanceCollapsedPx)}px`;
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
        document.body.style.removeProperty('--stage-menu-offset-y');
        document.body.style.removeProperty('--globe-offset-y');
        for (const [prop, value] of Object.entries(inwardVars)) {
            document.body.style.setProperty(prop, value);
        }
    }
    const dockGeo = syncDockEdgeStroke(s, dockTrapGeometry(s)) || dockTrapGeometry(s);
    applyDockFillFromBorder(root.style, s, dockGeo);
    syncDockInwardLineShape(s, dockGeo);

    applyWorldModeChromeVars(s, root.style);

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
        dockWMobile: s.dockTrapWidthMobilePx,
        dockTaper: s.dockTrapTaperPct,
        dockBorder: s.dockBorderWidth,
        dockRadius: s.dockBorderRadius,
    };
}
