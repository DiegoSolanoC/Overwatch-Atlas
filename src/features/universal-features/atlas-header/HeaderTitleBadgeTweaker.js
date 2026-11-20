/**
 * UI Tweaks — collaborator design panel (badge / sides / panels / dock).
 *
 * Same model as Codex / Story JSON:
 * - Site look = committed `src/data/platform/atlas-ui-tweaks.json`
 * - Export / Import = hand off proposals between collaborators
 * - Save = local draft only (cleared when the standard `version` bumps)
 */

import {
    HEADER_SIDES_TWEAK_DEFAULTS,
    applyHeaderSidesChrome,
    cloneSidesDefaults,
    loadSidesState,
    sanitizeSidesState,
} from './HeaderSidesChrome.js';
import {
    SIDE_PANELS_TRAP_TWEAK_DEFAULTS,
    applySidePanelsTrapChrome,
    cloneSidePanelsTrapDefaults,
    loadSidePanelsTrapState,
    sanitizeSidePanelsTrapState,
} from './SidePanelsTrapChrome.js?v=30';
import {
    clearLegacyUiTweaksStorage,
    clearUiTweaksDraft,
    getCachedUiTweaksStandard,
    loadUiTweaksStandard,
    readUiTweaksDraft,
    writeUiTweaksDraft,
} from './UiTweaksStandard.js';

const PANEL_ID = 'uiTweaksPanel';
const TOGGLE_ID = 'uiTweaksToggle';
const LEGACY_PANEL_ID = 'headerTitleBadgeTweakerPanel';
const LEGACY_TOGGLE_ID = 'headerTitleBadgeTweakerToggle';

/** @type {'sides' | 'badge' | 'panels'} */
let activeUiTweaksSection = 'sides';

/** Current committed standard version (from JSON); drafts must match. */
let uiTweaksStandardVersion = 1;

const UI_TWEAK_TABS = Object.freeze([
    { id: 'sides', label: 'Header sides' },
    { id: 'badge', label: 'Center badge' },
    { id: 'panels', label: 'Side panels' },
    { id: 'dock', label: 'Dock' },
]);

/** @typedef {object} BadgeTweakState */

/** Baked from atlas-ui-tweaks.json standard, Nov 2026. */
export const HEADER_BADGE_TWEAK_DEFAULTS = Object.freeze({
    widthPx: 406,
    heightExtraPx: 79,
    logoPercent: 83,
    logoMaxPx: 115,

    /** Uniform rim thickness in CSS px (same on sides + horizontal edge). */
    topStrokeWidth: 3.5,
    bottomStrokeWidth: 10.5,
    /** Gap length as % of each flank. */
    borderGap: 18,
    /** Gap center along flank: 0 = near top, 100 = near bottom. */
    borderGapCenter: 48,
    /** 0 = softer inside curve, 100 = sharper wedge tip. */
    tipPointiness: 78,
    /** Shared by fill + rim outer edge so border corners round with the shape. */
    cornerRadius: 1.5,

    /** Hue shift from palette accent (−40…+40). + pushes blue toward cyan. */
    borderHueShift: -23,
    borderSaturation: 100,
    borderLightness: 56,
    borderGlow: 42,
    borderOpacity: 100,

    fillDarkness: 55,
    fillBrightness: 15,

    topY: 4,
    bottomY: 96,
    topLength: 74.5,
    bottomLength: 54,
    notchDrop: 12,
    notchOut: 2,
});

function cloneDefaults() {
    return { ...HEADER_BADGE_TWEAK_DEFAULTS };
}

/** Sync fallback only — live look comes from the committed JSON standard (+ optional draft). */
function loadState() {
    return sanitizeState(cloneDefaults());
}

function buildTweaksPayload(badge, sides, panels) {
    return {
        kind: 'atlas-ui-tweaks',
        version: uiTweaksStandardVersion,
        exportedAt: new Date().toISOString(),
        badge: sanitizeState(badge),
        sides: sanitizeSidesState(sides),
        panels: sanitizeSidePanelsTrapState(panels),
    };
}

/**
 * Merge a pasted/imported payload into live bags. Accepts `{ badge, sides, panels }`
 * or a legacy flat badge-only object.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function applyTweaksPayload(raw, badge, sides, panels) {
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!parsed || typeof parsed !== 'object') {
            return { ok: false, error: 'Invalid JSON' };
        }
        const badgeSrc =
            parsed.badge && typeof parsed.badge === 'object' ? parsed.badge : parsed;
        const sidesSrc =
            parsed.sides && typeof parsed.sides === 'object' ? parsed.sides : null;
        const panelsSrc =
            parsed.panels && typeof parsed.panels === 'object' ? parsed.panels : null;

        const nextBadge = cloneDefaults();
        for (const key of Object.keys(HEADER_BADGE_TWEAK_DEFAULTS)) {
            if (badgeSrc[key] != null && Number.isFinite(Number(badgeSrc[key]))) {
                nextBadge[key] = Number(badgeSrc[key]);
            }
        }
        Object.assign(badge, sanitizeState(nextBadge));

        if (sidesSrc) {
            const nextSides = cloneSidesDefaults();
            for (const key of Object.keys(HEADER_SIDES_TWEAK_DEFAULTS)) {
                if (sidesSrc[key] != null && Number.isFinite(Number(sidesSrc[key]))) {
                    nextSides[key] = Number(sidesSrc[key]);
                }
            }
            Object.assign(sides, sanitizeSidesState(nextSides));
        }

        if (panelsSrc && panels) {
            const nextPanels = cloneSidePanelsTrapDefaults();
            for (const key of Object.keys(SIDE_PANELS_TRAP_TWEAK_DEFAULTS)) {
                if (panelsSrc[key] != null && Number.isFinite(Number(panelsSrc[key]))) {
                    nextPanels[key] = Number(panelsSrc[key]);
                }
            }
            Object.assign(panels, sanitizeSidePanelsTrapState(nextPanels));
        }
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err?.message || 'Import failed' };
    }
}

function downloadTweaksJson(payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atlas-ui-tweaks-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
}

function sanitizeState(s) {
    const next = { ...s };
    const pad = 4;

    next.widthPx = clamp(Number(next.widthPx), 200, 440);
    next.heightExtraPx = clamp(Number(next.heightExtraPx), 10, 90);
    next.logoPercent = clamp(Number(next.logoPercent), 40, 100);
    next.logoMaxPx = clamp(Number(next.logoMaxPx), 40, 140);

    next.topY = clamp(Number(next.topY), 4, 28);
    next.bottomY = clamp(Number(next.bottomY), next.topY + 36, 96);

    const maxTop = Math.max(36, (100 - pad * 2) - Number(next.notchOut) * 2);
    next.topLength = clamp(Number(next.topLength), 36, maxTop);
    next.bottomLength = clamp(Number(next.bottomLength), 24, next.topLength - 2);
    next.notchOut = clamp(Number(next.notchOut), 0, Math.max(0, (100 - next.topLength) / 2 - pad));
    next.notchDrop = clamp(Number(next.notchDrop), 2, (next.bottomY - next.topY) * 0.45);

    next.borderGap = clamp(Number(next.borderGap), 4, 40);
    next.borderGapCenter = clamp(Number(next.borderGapCenter), 18, 82);
    next.cornerRadius = clamp(Number(next.cornerRadius), 0, 12);
    next.borderHueShift = clamp(Number(next.borderHueShift), -40, 40);
    next.borderSaturation = clamp(Number(next.borderSaturation), 50, 100);
    next.borderLightness = clamp(Number(next.borderLightness), 38, 70);
    next.borderGlow = clamp(Number(next.borderGlow), 0, 100);
    next.borderOpacity = clamp(Number(next.borderOpacity), 10, 100);
    next.topStrokeWidth = clamp(Number(next.topStrokeWidth), 1, 12);
    next.bottomStrokeWidth = clamp(Number(next.bottomStrokeWidth), 1, 14);
    next.tipPointiness = clamp(Number(next.tipPointiness), 0, 100);

    return next;
}

function readPaletteAccentRgb() {
    const raw = getComputedStyle(document.body).getPropertyValue('--accent-primary-rgb').trim();
    const parts = raw.split(/[,\s]+/).map((p) => Number(p)).filter((n) => Number.isFinite(n));
    if (parts.length >= 3) {
        return [clamp(parts[0], 0, 255), clamp(parts[1], 0, 255), clamp(parts[2], 0, 255)];
    }
    return [33, 150, 243];
}

function mixRgb(a, b, t) {
    const u = clamp(t, 0, 1);
    return [
        Math.round(a[0] + (b[0] - a[0]) * u),
        Math.round(a[1] + (b[1] - a[1]) * u),
        Math.round(a[2] + (b[2] - a[2]) * u),
    ];
}

function shadeFromAccent(accent, darkness, brightness) {
    const darkened = mixRgb(accent, [0, 0, 0], clamp(Number(darkness), 0, 100) / 100);
    return mixRgb(darkened, [255, 255, 255], clamp(Number(brightness), 0, 100) / 100);
}

/**
 * Neon / sky rim: keep palette hue (plus shift), force vivid chroma — not a grey lift.
 */
function rimFromAccent(accent, sat, light, hueShift, glow) {
    const [h0] = rgbToHsl(accent[0], accent[1], accent[2]);
    const h = ((h0 + Number(hueShift)) % 360 + 360) % 360;
    const s = clamp(Number(sat), 0, 100);
    const l = clamp(Number(light), 0, 100);
    // Pure vivid at target HSL, then punch with a neon mid-tone of same hue.
    const vivid = hslToRgb(h, s, l);
    const neon = hslToRgb(h, 100, 52);
    const electric = hslToRgb(h, 100, 62);
    const punched = mixRgb(mixRgb(vivid, neon, 0.45), electric, 0.25);
    // Glow: blend toward near-white of same hue (keeps saturation feel without going grey).
    const hot = hslToRgb(h, 100, 72);
    return mixRgb(punched, hot, clamp(Number(glow), 0, 100) / 100 * 0.55);
}

function rgbToHsl(r, g, b) {
    const rr = r / 255;
    const gg = g / 255;
    const bb = b / 255;
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l * 100];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
    else if (max === gg) h = ((bb - rr) / d + 2) / 6;
    else h = ((rr - gg) / d + 4) / 6;
    return [h * 360, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
    const hh = (((h % 360) + 360) % 360) / 360;
    const ss = clamp(s, 0, 100) / 100;
    const ll = clamp(l, 0, 100) / 100;
    if (ss === 0) {
        const v = Math.round(ll * 255);
        return [v, v, v];
    }
    const hue2rgb = (p, q, t) => {
        let tt = t;
        if (tt < 0) tt += 1;
        if (tt > 1) tt -= 1;
        if (tt < 1 / 6) return p + (q - p) * 6 * tt;
        if (tt < 1 / 2) return q;
        if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
        return p;
    };
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
    const p = 2 * ll - q;
    return [
        Math.round(hue2rgb(p, q, hh + 1 / 3) * 255),
        Math.round(hue2rgb(p, q, hh) * 255),
        Math.round(hue2rgb(p, q, hh - 1 / 3) * 255),
    ];
}

function rgbCss(rgb, alpha) {
    if (alpha == null || alpha >= 1) return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clamp(alpha, 0, 1)})`;
}

export function badgeVerticesFromState(s) {
    const state = sanitizeState(s);
    const cx = 50;
    const topHalf = Math.max(8, Number(state.topLength) / 2);
    const botHalf = Math.max(6, Math.min(topHalf - 1, Number(state.bottomLength) / 2));
    const topY = Number(state.topY);
    const bottomY = Number(state.bottomY);
    const notchY = clamp(topY + Number(state.notchDrop), topY + 1, bottomY - 8);
    const notchOut = Math.max(0, Number(state.notchOut));
    const pad = 2;

    const tlX = cx - topHalf;
    const trX = cx + topHalf;
    const blX = cx - botHalf;
    const brX = cx + botHalf;

    return [
        [clamp(tlX, pad, 50 - 4), topY],
        [clamp(trX, 50 + 4, 100 - pad), topY],
        [clamp(trX + notchOut, 50 + 4, 100 - pad), notchY],
        [clamp(brX, 50 + 4, 100 - pad), bottomY],
        [clamp(blX, pad, 50 - 4), bottomY],
        [clamp(tlX - notchOut, pad, 50 - 4), notchY],
    ];
}

function dist(a, b) {
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function sideMetrics(chain) {
    const segs = [];
    let total = 0;
    for (let i = 0; i < chain.length - 1; i += 1) {
        const len = dist(chain[i], chain[i + 1]);
        segs.push({ a: chain[i], b: chain[i + 1], len });
        total += len;
    }
    return { total: total || 1, segs };
}

function pointAtFraction(chain, t) {
    const { total, segs } = sideMetrics(chain);
    let remain = clamp(t, 0, 1) * total;
    for (const seg of segs) {
        if (remain <= seg.len || seg === segs[segs.length - 1]) {
            const u = seg.len > 0 ? clamp(remain / seg.len, 0, 1) : 0;
            return [
                seg.a[0] + (seg.b[0] - seg.a[0]) * u,
                seg.a[1] + (seg.b[1] - seg.a[1]) * u,
            ];
        }
        remain -= seg.len;
    }
    return chain[chain.length - 1];
}

function sliceChain(chain, t0, t1) {
    const lo = Math.min(t0, t1);
    const hi = Math.max(t0, t1);
    const { total, segs } = sideMetrics(chain);
    const out = [pointAtFraction(chain, lo)];
    let acc = 0;
    for (const seg of segs) {
        acc += seg.len;
        const end = acc / total;
        if (end > lo + 1e-6 && end < hi - 1e-6) out.push([...seg.b]);
    }
    out.push(pointAtFraction(chain, hi));
    return t0 <= t1 ? out : out.reverse();
}

/** Trim both ends of an open polyline by a fraction of its length (tip seat). */
function trimPolylineEnds(pts, frac) {
    const t = clamp(Number(frac), 0, 0.2);
    if (!pts || pts.length < 2 || t < 1e-4) return pts;
    return sliceChain(pts, t, 1 - t);
}

/**
 * Rounded closed fill path.
 */
export function roundedPathFromPoints(pts, radius, closed) {
    if (!pts || pts.length < 2) return '';
    const f = (n) => Math.round(n * 100) / 100;
    const rMax = Math.max(0, Number(radius) || 0);
    const n = pts.length;

    if (!closed) {
        if (rMax < 0.05) {
            let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
            for (let i = 1; i < n; i += 1) d += ` L${f(pts[i][0])} ${f(pts[i][1])}`;
            return d;
        }
        const open = [`M${f(pts[0][0])} ${f(pts[0][1])}`];
        for (let i = 1; i < n - 1; i += 1) {
            const prev = pts[i - 1];
            const cur = pts[i];
            const next = pts[i + 1];
            const d1 = dist(prev, cur);
            const d2 = dist(cur, next);
            const r = Math.min(rMax, d1 * 0.45, d2 * 0.45);
            if (d1 < 1e-6 || d2 < 1e-6 || r < 0.05) {
                open.push(`L${f(cur[0])} ${f(cur[1])}`);
                continue;
            }
            const p1 = [
                cur[0] + (prev[0] - cur[0]) * (r / d1),
                cur[1] + (prev[1] - cur[1]) * (r / d1),
            ];
            const p2 = [
                cur[0] + (next[0] - cur[0]) * (r / d2),
                cur[1] + (next[1] - cur[1]) * (r / d2),
            ];
            open.push(`L${f(p1[0])} ${f(p1[1])}`);
            open.push(`Q${f(cur[0])} ${f(cur[1])} ${f(p2[0])} ${f(p2[1])}`);
        }
        open.push(`L${f(pts[n - 1][0])} ${f(pts[n - 1][1])}`);
        return open.join(' ');
    }

    if (rMax < 0.05) {
        let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
        for (let i = 1; i < n; i += 1) d += ` L${f(pts[i][0])} ${f(pts[i][1])}`;
        return `${d} Z`;
    }

    const parts = [];
    for (let i = 0; i < n; i += 1) {
        const prev = pts[(i - 1 + n) % n];
        const cur = pts[i];
        const next = pts[(i + 1) % n];
        const d1 = dist(prev, cur);
        const d2 = dist(cur, next);
        if (d1 < 1e-6 || d2 < 1e-6) continue;
        const r = Math.min(rMax, d1 * 0.45, d2 * 0.45);
        const p1 = [
            cur[0] + (prev[0] - cur[0]) * (r / d1),
            cur[1] + (prev[1] - cur[1]) * (r / d1),
        ];
        const p2 = [
            cur[0] + (next[0] - cur[0]) * (r / d2),
            cur[1] + (next[1] - cur[1]) * (r / d2),
        ];
        if (parts.length === 0) parts.push(`M${f(p1[0])} ${f(p1[1])}`);
        else parts.push(`L${f(p1[0])} ${f(p1[1])}`);
        parts.push(`Q${f(cur[0])} ${f(cur[1])} ${f(p2[0])} ${f(p2[1])}`);
    }
    parts.push('Z');
    return parts.join(' ');
}

/**
 * @param {number[][]} pts
 * @param {number} gapPct
 * @param {number} gapCenterPct 0–100 along flank
 */
export function splitBorderPolylines(pts, gapPct, gapCenterPct = 50) {
    const left = [pts[0], pts[5], pts[4]];
    const right = [pts[1], pts[2], pts[3]];
    const gap = clamp(Number(gapPct), 4, 40) / 100;
    const center = clamp(Number(gapCenterPct), 18, 82) / 100;
    const half = gap / 2;
    const tTop = clamp(center - half, 0.06, 0.9);
    const tBot = clamp(center + half, tTop + 0.04, 0.94);

    const leftTop = sliceChain(left, tTop, 0);
    const rightTop = sliceChain(right, 0, tTop);
    const top = [...leftTop, ...rightTop];

    const leftBot = sliceChain(left, tBot, 1);
    const rightBot = sliceChain(right, 1, tBot);
    const bottom = [...leftBot, ...rightBot];

    return { top, bottom };
}

export function badgePathFromVertices(pts) {
    return roundedPathFromPoints(pts, 0, true);
}

function sideLengths(pts) {
    const out = [];
    for (let i = 0; i < pts.length; i += 1) {
        out.push(dist(pts[i], pts[(i + 1) % pts.length]));
    }
    return out;
}

function ensureBadgeSvgParts(badge) {
    const svg = badge.querySelector('.header-title-badge-shape');
    if (!svg) return;

    let defs = svg.querySelector('defs');
    if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svg.insertBefore(defs, svg.firstChild);
    }
    let grad = defs.querySelector('#headerTitleBadgeFill');
    if (!grad) {
        grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        grad.setAttribute('id', 'headerTitleBadgeFill');
        grad.setAttribute('x1', '0');
        grad.setAttribute('y1', '0');
        grad.setAttribute('x2', '0');
        grad.setAttribute('y2', '1');
        const s0 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        s0.setAttribute('id', 'headerTitleBadgeGradTop');
        s0.setAttribute('offset', '0%');
        const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        s1.setAttribute('id', 'headerTitleBadgeGradBot');
        s1.setAttribute('offset', '100%');
        grad.appendChild(s0);
        grad.appendChild(s1);
        defs.appendChild(grad);
    }

    let clip = defs.querySelector('#headerTitleBadgeClip');
    if (!clip) {
        clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clip.setAttribute('id', 'headerTitleBadgeClip');
        clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
        const clipPathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        clipPathEl.setAttribute('class', 'header-title-badge-clip');
        clip.appendChild(clipPathEl);
        defs.appendChild(clip);
    }

    let fill = svg.querySelector('.header-title-badge-path');
    if (!fill) {
        fill = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        fill.setAttribute('class', 'header-title-badge-path');
        svg.appendChild(fill);
    }
    fill.setAttribute('fill', 'url(#headerTitleBadgeFill)');
    fill.style.stroke = 'none';
    fill.removeAttribute('stroke');

    // One rim layer only: strip legacy tips / duplicate strokes / old per-path clips.
    svg.querySelectorAll('.header-title-badge-tips').forEach((el) => el.remove());
    svg.querySelectorAll('.header-title-badge-stroke').forEach((el) => el.remove());
    svg.querySelectorAll('.header-title-badge-rim').forEach((el) => el.remove());

    svg.appendChild(fill);

    // Clip the group (not each path) so non-scaling 2× strokes don't ghost outside.
    const rimGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    rimGroup.setAttribute('class', 'header-title-badge-rim');
    rimGroup.setAttribute('clip-path', 'url(#headerTitleBadgeClip)');

    const mkStroke = (cls) => {
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        el.setAttribute('class', `header-title-badge-stroke ${cls}`);
        el.setAttribute('fill', 'none');
        el.style.fill = 'none';
        el.setAttribute('vector-effect', 'non-scaling-stroke');
        el.setAttribute('stroke-linecap', 'round');
        el.setAttribute('stroke-linejoin', 'round');
        rimGroup.appendChild(el);
        return el;
    };
    mkStroke('header-title-badge-stroke--top');
    mkStroke('header-title-badge-stroke--bottom');
    svg.appendChild(rimGroup);
}

export function applyHeaderTitleBadgeTweaks(state) {
    const badge = document.getElementById('headerTitleBadge');
    if (!badge) return;

    ensureBadgeSvgParts(badge);
    const clean = sanitizeState(state);
    Object.assign(state, clean);

    const svg = badge.querySelector('.header-title-badge-shape');
    // Keep 0–100 viewBox so hub/header black height stays locked to badge bottom.
    if (svg) svg.setAttribute('viewBox', '0 0 100 100');

    const pts = badgeVerticesFromState(clean);
    const fillD = roundedPathFromPoints(pts, clean.cornerRadius, true);
    const { top, bottom } = splitBorderPolylines(pts, clean.borderGap, clean.borderGapCenter);
    // tipPointiness shortens the stroke into the gap; round cap + clip still forms the tip.
    const tipTrim = (clamp(Number(clean.tipPointiness), 0, 100) / 100) * 0.04;
    const topPts = trimPolylineEnds(top, tipTrim);
    const botPts = trimPolylineEnds(bottom, tipTrim);
    // Same rounded open outline as the fill — stroke follows corners without offset math.
    const topD = roundedPathFromPoints(topPts, clean.cornerRadius, false);
    const bottomD = roundedPathFromPoints(botPts, clean.cornerRadius, false);

    const fill = badge.querySelector('.header-title-badge-path');
    const clipPathEl = badge.querySelector('.header-title-badge-clip');
    const topStroke = badge.querySelector('.header-title-badge-stroke--top');
    const botStroke = badge.querySelector('.header-title-badge-stroke--bottom');
    if (fill && fillD) fill.setAttribute('d', fillD);
    if (clipPathEl && fillD) clipPathEl.setAttribute('d', fillD);
    if (topStroke && topD) topStroke.setAttribute('d', topD);
    if (botStroke && bottomD) botStroke.setAttribute('d', bottomD);

    const accent = readPaletteAccentRgb();
    const fillTop = shadeFromAccent(accent, clean.fillDarkness, 0);
    const fillBottom = shadeFromAccent(accent, 0, clean.fillBrightness);
    const fillBottomFinal =
        Number(clean.fillBrightness) < 1 ? mixRgb(accent, fillTop, 0.35) : fillBottom;

    const borderRgb = rimFromAccent(
        accent,
        clean.borderSaturation,
        clean.borderLightness,
        clean.borderHueShift,
        clean.borderGlow,
    );
    const borderAlpha = clamp(Number(clean.borderOpacity), 0, 100) / 100;
    const rimCss = rgbCss(borderRgb, borderAlpha);

    const gradTop = document.getElementById('headerTitleBadgeGradTop');
    const gradBot = document.getElementById('headerTitleBadgeGradBot');
    if (gradTop) gradTop.setAttribute('stop-color', rgbCss(fillTop));
    if (gradBot) gradBot.setAttribute('stop-color', rgbCss(fillBottomFinal));

    if (fill) {
        fill.setAttribute('fill', 'url(#headerTitleBadgeFill)');
        fill.style.stroke = 'none';
    }
    // Round caps + group clip → one-sided tip (no second unclipped ghost stroke).
    if (topStroke) {
        topStroke.setAttribute('fill', 'none');
        topStroke.style.fill = 'none';
        topStroke.setAttribute('stroke', rimCss);
        topStroke.style.stroke = rimCss;
        topStroke.setAttribute('stroke-width', String(Math.max(1, clean.topStrokeWidth) * 2));
        topStroke.setAttribute('stroke-linecap', 'round');
        topStroke.setAttribute('stroke-linejoin', 'round');
        topStroke.setAttribute('vector-effect', 'non-scaling-stroke');
        topStroke.removeAttribute('clip-path');
    }
    if (botStroke) {
        botStroke.setAttribute('fill', 'none');
        botStroke.style.fill = 'none';
        botStroke.setAttribute('stroke', rimCss);
        botStroke.style.stroke = rimCss;
        botStroke.setAttribute('stroke-width', String(Math.max(1, clean.bottomStrokeWidth) * 2));
        botStroke.setAttribute('stroke-linecap', 'round');
        botStroke.setAttribute('stroke-linejoin', 'round');
        botStroke.setAttribute('vector-effect', 'non-scaling-stroke');
        botStroke.removeAttribute('clip-path');
    }
    const rimGroup = badge.querySelector('.header-title-badge-rim');
    if (rimGroup) rimGroup.setAttribute('clip-path', 'url(#headerTitleBadgeClip)');

    const root = document.body;
    root.style.setProperty('--header-badge-outer-w', `${clean.widthPx}px`);
    root.style.setProperty('--header-chrome-align-extra', `${clean.heightExtraPx}px`);
    root.style.setProperty('--header-badge-logo-percent', `${clean.logoPercent}%`);
    root.style.setProperty('--header-badge-logo-max', `${clean.logoMaxPx}px`);

    const notchY = pts[2][1];
    const bottomY = pts[3][1];
    const dx = Math.abs(pts[2][0] - pts[3][0]);
    const dy = Math.abs(bottomY - notchY) || 1;
    // Strip top + slant follow badge notch; strip/paint bottom is owned by Header sides.
    root.style.setProperty('--header-hub-hex-y-top', String(notchY));
    root.style.setProperty('--header-hub-hex-edge-dx', String(dx));
    root.style.setProperty('--header-hub-hex-edge-dy', String(dy));
    root.style.setProperty(
        '--header-hub-btn-slant',
        `calc(var(--header-badge-outer-w) * ${dx} / 100)`,
    );

    return {
        pts,
        sideLengths: sideLengths(pts),
        accent,
        fillTop,
        fillBottom: fillBottomFinal,
        borderRgb,
    };
}

/**
 * @param {HTMLElement} panel
 * @param {{ badge: object, sides: object, panels: object }} bags
 * @param {{ onPreview: () => void, onSave: () => void, isDirty: () => boolean }} hooks
 */
function mountControls(panel, bags, hooks) {
    panel.replaceChildren();
    const { badge, sides, panels } = bags;

    const resolveBag = (name) => {
        if (name === 'sides') return sides;
        /* Dock chrome shares the side-panels trap bag (same persisted state). */
        if (name === 'panels' || name === 'dock') return panels;
        return badge;
    };
    const resolveDefaults = (name) => {
        if (name === 'sides') return HEADER_SIDES_TWEAK_DEFAULTS;
        if (name === 'panels' || name === 'dock') return SIDE_PANELS_TRAP_TWEAK_DEFAULTS;
        return HEADER_BADGE_TWEAK_DEFAULTS;
    };
    const resolveSanitize = (name) => {
        if (name === 'sides') return sanitizeSidesState;
        if (name === 'panels' || name === 'dock') return sanitizeSidePanelsTrapState;
        return sanitizeState;
    };

    const head = document.createElement('div');
    head.className = 'header-badge-tweaker__head';
    panel.appendChild(head);

    const title = document.createElement('div');
    title.className = 'header-badge-tweaker__title';
    title.textContent = 'UI Tweaks';
    head.appendChild(title);

    const status = document.createElement('div');
    status.className = 'header-badge-tweaker__status';
    head.appendChild(status);

    const hint = document.createElement('p');
    hint.className = 'header-badge-tweaker__hint';
    hint.textContent =
        activeUiTweaksSection === 'panels'
            ? 'Side panels · Shared size · Inward line · Per-trap slide · Export JSON to propose standard'
            : activeUiTweaksSection === 'dock'
                ? 'Dock · Trapezium · Inward line · End shrinkage · Nub · Export JSON to propose standard'
                : 'Collab chrome · Live preview · Save = local draft · Export JSON → incorporate into atlas-ui-tweaks.json';
    panel.appendChild(hint);

    document.body.classList.toggle('ui-tweaks-side-panels', activeUiTweaksSection === 'panels');
    document.body.classList.toggle('ui-tweaks-dock', activeUiTweaksSection === 'dock');
    document.body.classList.toggle('ui-tweaks-open', true);
    document.body.classList.toggle(
        'ui-tweaks-filters-music-independent',
        activeUiTweaksSection === 'panels' && !bags.panels.filtersMusicMirror,
    );

    const tabs = document.createElement('div');
    tabs.className = 'header-badge-tweaker__tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'UI Tweaks sections');
    panel.appendChild(tabs);

    for (const tab of UI_TWEAK_TABS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'header-badge-tweaker__tab';
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', tab.id === activeUiTweaksSection ? 'true' : 'false');
        btn.dataset.section = tab.id;
        btn.textContent = tab.label;
        if (tab.id === activeUiTweaksSection) btn.classList.add('is-active');
        btn.addEventListener('click', () => {
            if (activeUiTweaksSection === tab.id) return;
            activeUiTweaksSection = tab.id;
            mountControls(panel, bags, hooks);
        });
        tabs.appendChild(btn);
    }

    const meta = document.createElement('div');
    meta.className = 'header-badge-tweaker__meta';
    panel.appendChild(meta);

    const paletteNote = document.createElement('div');
    paletteNote.className = 'header-badge-tweaker__palette';
    meta.appendChild(paletteNote);

    const swatches = document.createElement('div');
    swatches.className = 'header-badge-tweaker__swatches';
    meta.appendChild(swatches);

    /** @type {{ group: string, title: string, bag: 'badge' | 'sides' | 'panels' | 'dock', defaults: object, sanitize: Function, items: { key: string, label: string, min: number, max: number, step: number, bag?: string }[] }[]} */
    const allSections = [
        {
            group: 'Side panels',
            title: 'Shared size',
            bag: 'panels',
            defaults: SIDE_PANELS_TRAP_TWEAK_DEFAULTS,
            sanitize: sanitizeSidePanelsTrapState,
            items: [
                { key: 'trapHeightPx', label: 'Trapezium height', min: 80, max: 560, step: 2 },
                { key: 'trapProtrudePx', label: 'Side depth (outward)', min: 36, max: 120, step: 1 },
                { key: 'trapTaperPct', label: 'Side taper (0=rect)', min: 0, max: 28, step: 0.5 },
                { key: 'sideBorderWidth', label: 'White border thickness', min: 8, max: 36, step: 0.5 },
                { key: 'sideBorderRadius', label: 'Corner rounding', min: 0, max: 24, step: 1 },
            ],
        },
        {
            group: 'Side panels',
            title: 'Slide (per trap)',
            bag: 'panels',
            defaults: SIDE_PANELS_TRAP_TWEAK_DEFAULTS,
            sanitize: sanitizeSidePanelsTrapState,
            items: [
                { key: 'infoTrapPosPct', label: 'Info (right) · 0=top', min: 0, max: 100, step: 1 },
                {
                    key: 'filtersMusicMirror',
                    label: 'Mirror filters ↔ music',
                    min: 0,
                    max: 1,
                    step: 1,
                },
                {
                    key: 'filtersTrapPosPct',
                    label: 'Filters (upper) · 0=top',
                    min: 0,
                    max: 100,
                    step: 1,
                },
                {
                    key: 'musicTrapPosPct',
                    label: 'Music (lower) · 0=top',
                    min: 0,
                    max: 100,
                    step: 1,
                },
            ],
        },
        {
            group: 'Side panels',
            title: 'Inward line',
            bag: 'panels',
            defaults: SIDE_PANELS_TRAP_TWEAK_DEFAULTS,
            sanitize: sanitizeSidePanelsTrapState,
            items: [
                {
                    key: 'sideInwardLineThicknessPx',
                    label: 'Inward line thickness',
                    min: 4,
                    max: 28,
                    step: 1,
                },
                {
                    key: 'sideInwardLineOffsetPx',
                    label: 'Inward offset (into fill)',
                    min: -24,
                    max: 56,
                    step: 1,
                },
                {
                    key: 'sideInwardCenterGapPx',
                    label: 'Cut gap at trap buttons (↓ = closer)',
                    min: 24,
                    max: 900,
                    step: 2,
                },
                {
                    key: 'inwardCutFocusBonusPct',
                    label: 'Hover peek bonus % (undo bridge; open = 1×)',
                    min: 0,
                    max: 150,
                    step: 1,
                },
                {
                    key: 'sideInwardCornerRadiusPx',
                    label: 'Cut corner rounding',
                    min: 0,
                    max: 48,
                    step: 1,
                },
            ],
        },
        {
            group: 'Side panels',
            title: 'Side nub (inward tip)',
            bag: 'panels',
            defaults: SIDE_PANELS_TRAP_TWEAK_DEFAULTS,
            sanitize: sanitizeSidePanelsTrapState,
            items: [
                { key: 'sideNubDepthPx', label: 'Nub depth', min: 16, max: 80, step: 1 },
                { key: 'sideNubLengthPx', label: 'Nub length', min: 36, max: 180, step: 2 },
                { key: 'sideNubTaperPct', label: 'Nub taper (0=rect)', min: 0, max: 28, step: 0.5 },
                { key: 'sideNubRadiusPx', label: 'Nub corner rounding', min: 0, max: 40, step: 1 },
                { key: 'sideNubArrowPx', label: 'Arrow icon size', min: 10, max: 96, step: 1 },
            ],
        },
        {
            group: 'Side panels',
            title: 'Side trap label (pill)',
            bag: 'panels',
            defaults: SIDE_PANELS_TRAP_TWEAK_DEFAULTS,
            sanitize: sanitizeSidePanelsTrapState,
            items: [
                { key: 'sideTrapBtnRadiusPx', label: 'Label corner rounding', min: 0, max: 48, step: 1 },
                { key: 'sideTrapBtnWidthPx', label: 'Label horizontal size', min: 24, max: 96, step: 1 },
                { key: 'sideTrapBtnHeightPx', label: 'Label vertical size', min: 48, max: 200, step: 2 },
                {
                    key: 'sideTrapBtnOffsetXPx',
                    label: 'Pill X (→ tip / hub)',
                    min: -32,
                    max: 48,
                    step: 1,
                },
                { key: 'sideTrapIconPx', label: 'Logo icon size', min: 12, max: 96, step: 1 },
            ],
        },
        {
            group: 'Dock',
            title: 'Dock trapezium',
            bag: 'dock',
            defaults: SIDE_PANELS_TRAP_TWEAK_DEFAULTS,
            sanitize: sanitizeSidePanelsTrapState,
            items: [
                { key: 'dockTrapHeightPx', label: 'Dock trap height', min: 48, max: 160, step: 2 },
                { key: 'dockTrapWidthPx', label: 'Dock trap width', min: 280, max: 1100, step: 10 },
                { key: 'dockTrapTaperPct', label: 'Dock taper (0=rect)', min: 0, max: 28, step: 0.5 },
                { key: 'dockBorderWidth', label: 'Dock border thickness', min: 8, max: 36, step: 0.5 },
                { key: 'dockBorderRadius', label: 'Dock corner rounding', min: 0, max: 24, step: 1 },
            ],
        },
        {
            group: 'Dock',
            title: 'Atlas News red trapezium',
            bag: 'dock',
            defaults: SIDE_PANELS_TRAP_TWEAK_DEFAULTS,
            sanitize: sanitizeSidePanelsTrapState,
            items: [
                {
                    key: 'atlasNewsWidthPx',
                    label: 'Red shape width',
                    min: 48,
                    max: 180,
                    step: 2,
                },
                {
                    key: 'atlasNewsHeightPx',
                    label: 'Red shape height',
                    min: 36,
                    max: 140,
                    step: 2,
                },
                {
                    key: 'atlasNewsIconPct',
                    label: 'Logo icon size (%)',
                    min: 40,
                    max: 100,
                    step: 1,
                },
            ],
        },
        {
            group: 'Dock',
            title: 'Dock trap buttons',
            bag: 'dock',
            defaults: SIDE_PANELS_TRAP_TWEAK_DEFAULTS,
            sanitize: sanitizeSidePanelsTrapState,
            items: [
                {
                    key: 'dockButtonsOffsetYPx',
                    label: 'Buttons Y (↓ into dock)',
                    min: -48,
                    max: 96,
                    step: 1,
                },
            ],
        },
        {
            group: 'Dock',
            title: 'Inward line',
            bag: 'dock',
            defaults: SIDE_PANELS_TRAP_TWEAK_DEFAULTS,
            sanitize: sanitizeSidePanelsTrapState,
            items: [
                {
                    key: 'dockInwardLineThicknessPx',
                    label: 'Inward line thickness',
                    min: 4,
                    max: 28,
                    step: 1,
                },
                {
                    key: 'dockInwardLineOffsetYPx',
                    label: 'Inward offset (into fill)',
                    min: -24,
                    max: 56,
                    step: 1,
                },
                {
                    key: 'dockInwardCenterGapPx',
                    label: 'Cut gap at trap buttons (↓ = closer)',
                    min: 24,
                    max: 900,
                    step: 2,
                },
                {
                    key: 'dockInwardSliderClearancePx',
                    label: 'Slider clearance (expanded)',
                    min: 0,
                    max: 80,
                    step: 1,
                },
                {
                    key: 'dockInwardSliderClearanceCollapsedPx',
                    label: 'Slider clearance (collapsed)',
                    min: 0,
                    max: 80,
                    step: 1,
                },
            ],
        },
        {
            group: 'Dock',
            title: 'End shrinkage',
            bag: 'dock',
            defaults: SIDE_PANELS_TRAP_TWEAK_DEFAULTS,
            sanitize: sanitizeSidePanelsTrapState,
            items: [
                {
                    key: 'dockInwardEndThicknessPx',
                    label: 'End tip thickness',
                    min: 1,
                    max: 28,
                    step: 1,
                },
                {
                    key: 'dockInwardTipWidthPx',
                    label: 'Tip width (each end)',
                    min: 0,
                    max: 480,
                    step: 2,
                },
                {
                    key: 'dockInwardSlopeWidthPx',
                    label: 'Slope width',
                    min: 4,
                    max: 200,
                    step: 1,
                },
                {
                    key: 'dockInwardCornerRadiusPx',
                    label: 'Corner rounding (ends + center cuts)',
                    min: 0,
                    max: 48,
                    step: 1,
                },
            ],
        },
        {
            group: 'Dock',
            title: 'Dock nub (top tab)',
            bag: 'dock',
            defaults: SIDE_PANELS_TRAP_TWEAK_DEFAULTS,
            sanitize: sanitizeSidePanelsTrapState,
            items: [
                { key: 'dockNubWidthPx', label: 'Nub width', min: 48, max: 280, step: 2 },
                { key: 'dockNubHeightPx', label: 'Nub height', min: 16, max: 96, step: 1 },
                { key: 'dockNubTaperPct', label: 'Nub taper (0=rect)', min: 0, max: 28, step: 0.5 },
                { key: 'dockNubRadiusPx', label: 'Nub corner rounding', min: 0, max: 40, step: 1 },
                { key: 'dockNubArrowPx', label: 'Arrow icon size', min: 10, max: 96, step: 1 },
            ],
        },
        {
            group: 'Header sides',
            title: 'Gap & layout',
            bag: 'sides',
            defaults: HEADER_SIDES_TWEAK_DEFAULTS,
            sanitize: sanitizeSidesState,
            items: [
                {
                    key: 'heightExtraPx',
                    label: 'Overall height (badge + sides)',
                    min: 10,
                    max: 90,
                    step: 1,
                    bag: 'badge',
                },
                { key: 'sideGapPx', label: 'Gap to badge (neg = under)', min: -80, max: 48, step: 1 },
                {
                    key: 'sideStripBottomY',
                    label: 'Strip + paint bottom Y',
                    min: 48,
                    max: 100,
                    step: 0.5,
                },
                { key: 'sideGreyWidthPct', label: 'Grey outer width %', min: 6, max: 40, step: 1 },
                { key: 'sideRimCornerRadius', label: 'Corner round', min: 0, max: 28, step: 0.5 },
            ],
        },
        {
            group: 'Header sides',
            title: 'Side coloration',
            bag: 'sides',
            defaults: HEADER_SIDES_TWEAK_DEFAULTS,
            sanitize: sanitizeSidesState,
            items: [
                { key: 'sideInnerDarkness', label: 'Inner (brighter) darkness', min: 40, max: 95, step: 1 },
                { key: 'sideOuterDarkness', label: 'Outer (darker) darkness', min: 55, max: 98, step: 1 },
                { key: 'sideSaturation', label: 'Gradient saturation', min: 0, max: 80, step: 1 },
                { key: 'sideGreyLevel', label: 'Grey outer level', min: 6, max: 40, step: 1 },
            ],
        },
        {
            group: 'Header sides',
            title: 'Side border (inward + bottom)',
            bag: 'sides',
            defaults: HEADER_SIDES_TWEAK_DEFAULTS,
            sanitize: sanitizeSidesState,
            items: [
                { key: 'sideRimInwardWidth', label: 'Inward thickness', min: 0, max: 14, step: 0.25 },
                { key: 'sideRimBottomWidth', label: 'Bottom thickness', min: 0, max: 16, step: 0.25 },
                { key: 'sideRimFadeReach', label: 'Bottom fade reach', min: 20, max: 100, step: 1 },
                { key: 'sideRimHueShift', label: 'Rim hue shift', min: -40, max: 40, step: 1 },
                { key: 'sideRimSaturation', label: 'Rim saturation', min: 0, max: 100, step: 1 },
                { key: 'sideRimLightness', label: 'Rim lightness', min: 8, max: 70, step: 1 },
                { key: 'sideRimDarkness', label: 'Rim darkness', min: 0, max: 100, step: 1 },
                { key: 'sideRimGlow', label: 'Rim neon glow', min: 0, max: 100, step: 1 },
                { key: 'sideRimOpacity', label: 'Rim opacity', min: 0, max: 100, step: 1 },
            ],
        },
        {
            group: 'Center badge',
            title: 'Size & logo',
            bag: 'badge',
            defaults: HEADER_BADGE_TWEAK_DEFAULTS,
            sanitize: sanitizeState,
            items: [
                { key: 'widthPx', label: 'Width', min: 200, max: 440, step: 2 },
                { key: 'heightExtraPx', label: 'Overall height (badge + sides)', min: 10, max: 90, step: 1 },
                { key: 'logoPercent', label: 'Logo %', min: 50, max: 95, step: 1 },
                { key: 'logoMaxPx', label: 'Logo max px', min: 40, max: 120, step: 1 },
            ],
        },
        {
            group: 'Center badge',
            title: 'Border shape',
            bag: 'badge',
            defaults: HEADER_BADGE_TWEAK_DEFAULTS,
            sanitize: sanitizeState,
            items: [
                { key: 'topStrokeWidth', label: 'Top border thickness', min: 1, max: 12, step: 0.25 },
                { key: 'bottomStrokeWidth', label: 'Bottom border thickness', min: 1, max: 14, step: 0.25 },
                { key: 'borderGap', label: 'Rim gap size', min: 4, max: 40, step: 1 },
                { key: 'borderGapCenter', label: 'Rim gap position (↑↓)', min: 18, max: 82, step: 1 },
                { key: 'tipPointiness', label: 'Tip pointiness', min: 0, max: 100, step: 1 },
                { key: 'cornerRadius', label: 'Shape / border corner round', min: 0, max: 12, step: 0.25 },
            ],
        },
        {
            group: 'Center badge',
            title: 'Border color',
            bag: 'badge',
            defaults: HEADER_BADGE_TWEAK_DEFAULTS,
            sanitize: sanitizeState,
            items: [
                { key: 'borderHueShift', label: 'Hue shift', min: -40, max: 40, step: 1 },
                { key: 'borderSaturation', label: 'Saturation', min: 50, max: 100, step: 1 },
                { key: 'borderLightness', label: 'Lightness', min: 38, max: 70, step: 1 },
                { key: 'borderGlow', label: 'Neon glow', min: 0, max: 100, step: 1 },
                { key: 'borderOpacity', label: 'Opacity', min: 10, max: 100, step: 1 },
            ],
        },
        {
            group: 'Center badge',
            title: 'Fill',
            bag: 'badge',
            defaults: HEADER_BADGE_TWEAK_DEFAULTS,
            sanitize: sanitizeState,
            items: [
                { key: 'fillDarkness', label: 'Top darkness', min: 0, max: 100, step: 1 },
                { key: 'fillBrightness', label: 'Bottom lift', min: 0, max: 100, step: 1 },
            ],
        },
        {
            group: 'Center badge',
            title: 'Geometry',
            bag: 'badge',
            defaults: HEADER_BADGE_TWEAK_DEFAULTS,
            sanitize: sanitizeState,
            items: [
                { key: 'topY', label: 'Top Y', min: 2, max: 24, step: 0.5 },
                { key: 'bottomY', label: 'Bottom Y', min: 70, max: 98, step: 0.5 },
                { key: 'topLength', label: 'Top length', min: 40, max: 86, step: 0.5 },
                { key: 'bottomLength', label: 'Bottom length', min: 24, max: 80, step: 0.5 },
                { key: 'notchOut', label: 'Notch out', min: 0, max: 10, step: 0.25 },
                { key: 'notchDrop', label: 'Notch drop', min: 4, max: 24, step: 0.5 },
            ],
        },
    ];

    const sections = allSections.filter((s) => s.bag === activeUiTweaksSection);

    const grid = document.createElement('div');
    grid.className = 'header-badge-tweaker__grid';
    panel.appendChild(grid);

    const refreshStatus = () => {
        status.textContent = hooks.isDirty() ? 'Unsaved draft changes' : 'Matches draft / standard';
        status.classList.toggle('is-dirty', hooks.isDirty());
    };

    const refreshReadouts = () => {
        const badgeResult = applyHeaderTitleBadgeTweaks(badge);
        const sideResult = applyHeaderSidesChrome(sides);
        const panelsResult = applySidePanelsTrapChrome(panels);
        if (!badgeResult || !sideResult) return;
        const { accent, fillTop, fillBottom, borderRgb } = badgeResult;

        const swatchRows =
            activeUiTweaksSection === 'sides'
                ? [
                    ['Accent', accent],
                    ['Side inner', sideResult.inner],
                    ['Side outer', sideResult.outer],
                    ['Side grey', sideResult.grey],
                    ['Side rim', sideResult.rimRgb || accent],
                ]
                : activeUiTweaksSection === 'panels' || activeUiTweaksSection === 'dock'
                    ? [['Accent', accent]]
                    : [
                        ['Accent', accent],
                        ['Badge fill', fillTop],
                        ['Fill bottom', fillBottom],
                        ['Badge rim', borderRgb],
                    ];

        paletteNote.textContent =
            activeUiTweaksSection === 'sides'
                ? `Header sides  ·  ${sideResult.inner.join(', ')} → ${sideResult.outer.join(', ')}`
                : activeUiTweaksSection === 'dock'
                    ? `Dock ${panelsResult.dockH}×${panelsResult.dockW} · taper ${panelsResult.dockTaper} · border ${panelsResult.dockBorder} · r ${panelsResult.dockRadius}`
                    : activeUiTweaksSection === 'panels'
                        ? `Sides h ${panelsResult.heightPx} · depth ${panelsResult.protrudePx} · taper ${panelsResult.taperPct} · border ${panelsResult.sideBorder} · r ${panelsResult.sideRadius}`
                        : `Center badge  ·  accent ${accent.join(', ')}  →  rim ${borderRgb.join(', ')}`;

        swatches.replaceChildren();
        for (const [label, rgb] of swatchRows) {
            const cell = document.createElement('div');
            cell.className = 'header-badge-tweaker__swatch';
            const chip = document.createElement('span');
            chip.className = 'header-badge-tweaker__swatch-chip';
            chip.style.background = rgbCss(rgb);
            const lab = document.createElement('span');
            lab.textContent = label;
            cell.appendChild(chip);
            cell.appendChild(lab);
            swatches.appendChild(cell);
        }
        refreshStatus();
    };

    const syncRowValues = () => {
        panel.querySelectorAll('[data-tweak-key]').forEach((el) => {
            const key = el.getAttribute('data-tweak-key');
            const bagName = el.getAttribute('data-tweak-bag');
            const bag = resolveBag(bagName);
            if (!key || !(key in bag)) return;
            const range = el.querySelector('input[type="range"]');
            const v = el.querySelector('.header-badge-tweaker__val');
            if (range) range.value = String(bag[key]);
            if (v) {
                v.textContent =
                    key === 'filtersMusicMirror'
                        ? bag[key] ? 'On' : 'Off'
                        : String(bag[key]);
            }
        });
    };

    for (const section of sections) {
        const card = document.createElement('section');
        card.className = 'header-badge-tweaker__section';

        const h = document.createElement('h3');
        h.className = 'header-badge-tweaker__section-title';
        h.textContent = section.title;
        card.appendChild(h);

        for (const spec of section.items) {
            const itemBagName = spec.bag || section.bag;
            const bag = resolveBag(itemBagName);
            const itemDefaults = resolveDefaults(itemBagName);
            const itemSanitize = resolveSanitize(itemBagName);

            const row = document.createElement('div');
            row.className = 'header-badge-tweaker__row';
            row.dataset.tweakKey = spec.key;
            row.dataset.tweakBag = itemBagName;

            const lab = document.createElement('span');
            lab.className = 'header-badge-tweaker__label';
            lab.textContent = spec.label;

            const input = document.createElement('input');
            input.type = 'range';
            input.min = String(spec.min);
            input.max = String(spec.max);
            input.step = String(spec.step);
            input.value = String(bag[spec.key]);
            input.setAttribute('aria-label', spec.label);

            const val = document.createElement('span');
            val.className = 'header-badge-tweaker__val';
            val.textContent = String(bag[spec.key]);

            const resetOne = document.createElement('button');
            resetOne.type = 'button';
            resetOne.className = 'header-badge-tweaker__reset-one';
            resetOne.title = `Reset ${spec.label}`;
            resetOne.textContent = 'Reset';
            resetOne.addEventListener('click', () => {
                bag[spec.key] = itemDefaults[spec.key];
                Object.assign(bag, itemSanitize(bag));
                syncRowValues();
                hooks.onPreview();
                refreshReadouts();
            });

            input.addEventListener('input', () => {
                bag[spec.key] = Number(input.value);
                if (itemBagName === 'panels') {
                    if (spec.key === 'filtersMusicMirror' && bag.filtersMusicMirror) {
                        bag.musicTrapPosPct = 100 - Number(bag.filtersTrapPosPct);
                    }
                    if (
                        spec.key === 'filtersTrapPosPct'
                        && bag.filtersMusicMirror
                    ) {
                        bag.musicTrapPosPct = 100 - Number(bag.filtersTrapPosPct);
                    }
                    if (
                        spec.key === 'musicTrapPosPct'
                        && bag.filtersMusicMirror
                    ) {
                        bag.filtersTrapPosPct = 100 - Number(bag.musicTrapPosPct);
                    }
                }
                Object.assign(bag, itemSanitize(bag));
                if (itemBagName === 'panels') {
                    document.body.classList.toggle(
                        'ui-tweaks-filters-music-independent',
                        !bag.filtersMusicMirror,
                    );
                    const filtersLab = panel.querySelector(
                        '[data-tweak-key="filtersTrapPosPct"] .header-badge-tweaker__label',
                    );
                    if (filtersLab) {
                        filtersLab.textContent = bag.filtersMusicMirror
                            ? 'Filters ↔ Music · upper (0=top)'
                            : 'Filters (upper) · 0=top';
                    }
                }
                syncRowValues();
                hooks.onPreview();
                refreshReadouts();
            });

            if (spec.key === 'filtersTrapPosPct' && bags.panels.filtersMusicMirror) {
                lab.textContent = 'Filters ↔ Music · upper (0=top)';
            }
            if (spec.key === 'filtersMusicMirror') {
                val.textContent = Number(bag[spec.key]) ? 'On' : 'Off';
            }

            row.appendChild(lab);
            row.appendChild(input);
            row.appendChild(val);
            row.appendChild(resetOne);
            card.appendChild(row);
        }

        grid.appendChild(card);
    }

    const actions = document.createElement('div');
    actions.className = 'header-badge-tweaker__actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'header-badge-tweaker__save';
    saveBtn.textContent = 'Save draft';
    saveBtn.title = 'Keep a local editing draft. Does not change the site standard — Export JSON for that.';
    saveBtn.addEventListener('click', () => {
        hooks.onSave();
        saveBtn.textContent = 'Draft saved';
        refreshStatus();
        setTimeout(() => {
            saveBtn.textContent = 'Save draft';
        }, 1000);
    });

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.textContent = 'Reset all';
    resetBtn.title = 'Clear local draft and restore the committed site standard';
    resetBtn.addEventListener('click', () => {
        if (typeof hooks.onReset === 'function') {
            hooks.onReset();
        } else {
            Object.assign(badge, cloneDefaults());
            Object.assign(sides, cloneSidesDefaults());
            Object.assign(panels, cloneSidePanelsTrapDefaults());
            hooks.onPreview();
        }
        mountControls(panel, bags, hooks);
    });

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.textContent = 'Export';
    exportBtn.title = 'Download JSON for collaborators — replace src/data/platform/atlas-ui-tweaks.json to ship';
    exportBtn.addEventListener('click', () => {
        try {
            downloadTweaksJson(buildTweaksPayload(badge, sides, panels));
            exportBtn.textContent = 'Exported';
            setTimeout(() => {
                exportBtn.textContent = 'Export';
            }, 1200);
        } catch {
            exportBtn.textContent = 'Export failed';
            setTimeout(() => {
                exportBtn.textContent = 'Export';
            }, 1600);
        }
    });

    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.textContent = 'Import';
    importBtn.title = 'Load a collaborator JSON to preview (Save draft to keep while editing)';

    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = 'application/json,.json';
    importInput.hidden = true;
    importInput.addEventListener('change', async () => {
        const file = importInput.files?.[0];
        importInput.value = '';
        if (!file) return;
        try {
            const text = await file.text();
            const result = applyTweaksPayload(text, badge, sides, panels);
            if (!result.ok) {
                importBtn.textContent = 'Bad file';
                setTimeout(() => {
                    importBtn.textContent = 'Import';
                }, 1600);
                return;
            }
            hooks.onPreview();
            mountControls(panel, bags, hooks);
            importBtn.textContent = 'Imported';
            setTimeout(() => {
                importBtn.textContent = 'Import';
            }, 1200);
        } catch {
            importBtn.textContent = 'Import failed';
            setTimeout(() => {
                importBtn.textContent = 'Import';
            }, 1600);
        }
    });
    importBtn.addEventListener('click', () => importInput.click());

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy JSON';
    copyBtn.title = 'Copy UI Tweaks JSON to clipboard';
    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(
                JSON.stringify(buildTweaksPayload(badge, sides, panels), null, 2),
            );
            copyBtn.textContent = 'Copied';
            setTimeout(() => {
                copyBtn.textContent = 'Copy JSON';
            }, 1200);
        } catch {
            copyBtn.textContent = 'Copy failed';
            setTimeout(() => {
                copyBtn.textContent = 'Copy JSON';
            }, 1600);
        }
    });

    actions.appendChild(saveBtn);
    actions.appendChild(resetBtn);
    actions.appendChild(exportBtn);
    actions.appendChild(importBtn);
    actions.appendChild(copyBtn);
    panel.appendChild(importInput);
    panel.appendChild(actions);

    refreshReadouts();
}

export function setupHeaderTitleBadgeTweaker() {
    try {
        const badgeEl = document.getElementById('headerTitleBadge');
        if (!badgeEl) return;

        document.getElementById(LEGACY_TOGGLE_ID)?.remove();
        document.getElementById(LEGACY_PANEL_ID)?.remove();

        ensureBadgeSvgParts(badgeEl);
        const badge = loadState();
        const sides = loadSidesState();
        const panels = loadSidePanelsTrapState();
        let savedBadge = sanitizeState({ ...badge });
        let savedSides = sanitizeSidesState({ ...sides });
        let savedPanels = sanitizeSidePanelsTrapState({ ...panels });
        let dirty = false;
        const bags = { badge, sides, panels };

        const markClean = () => {
            savedBadge = sanitizeState({ ...badge });
            savedSides = sanitizeSidesState({ ...sides });
            savedPanels = sanitizeSidePanelsTrapState({ ...panels });
            dirty = false;
        };

        const preview = () => {
            try {
                applyHeaderTitleBadgeTweaks(badge);
                applyHeaderSidesChrome(sides);
                applySidePanelsTrapChrome(panels);
                dirty =
                    JSON.stringify(sanitizeState(badge)) !== JSON.stringify(savedBadge)
                    || JSON.stringify(sanitizeSidesState(sides)) !== JSON.stringify(savedSides)
                    || JSON.stringify(sanitizeSidePanelsTrapState(panels)) !== JSON.stringify(savedPanels);
            } catch (err) {
                console.error('[UI Tweaks] preview failed:', err);
            }
        };

        const applyStandardBags = (payload) => {
            if (!payload) return;
            applyTweaksPayload(payload, badge, sides, panels);
        };

        const persist = () => {
            try {
                Object.assign(badge, sanitizeState(badge));
                Object.assign(sides, sanitizeSidesState(sides));
                Object.assign(panels, sanitizeSidePanelsTrapState(panels));
                writeUiTweaksDraft(buildTweaksPayload(badge, sides, panels));
                markClean();
                preview();
            } catch (err) {
                console.error('[UI Tweaks] save draft failed:', err);
            }
        };

        const resetToStandard = () => {
            try {
                clearUiTweaksDraft();
                Object.assign(badge, cloneDefaults());
                Object.assign(sides, cloneSidesDefaults());
                Object.assign(panels, cloneSidePanelsTrapDefaults());
                const std = getCachedUiTweaksStandard();
                if (std) applyStandardBags(std);
                markClean();
                preview();
            } catch (err) {
                console.error('[UI Tweaks] reset failed:', err);
            }
        };

        const hooks = {
            onPreview: preview,
            onSave: persist,
            onReset: resetToStandard,
            isDirty: () => dirty,
        };

        preview();

        loadUiTweaksStandard()
            .then((std) => {
                clearLegacyUiTweaksStorage();
                uiTweaksStandardVersion = Number(std.version) || 1;
                applyStandardBags(std);
                const draft = readUiTweaksDraft(uiTweaksStandardVersion);
                if (draft) applyStandardBags(draft);
                markClean();
                preview();
                const openPanel = document.getElementById(PANEL_ID);
                if (openPanel && !openPanel.hidden) {
                    mountControls(openPanel, bags, hooks);
                }
            })
            .catch((err) => {
                console.warn('[UI Tweaks] standard JSON unavailable; using baked defaults', err);
                clearLegacyUiTweaksStorage();
                const draft = readUiTweaksDraft(uiTweaksStandardVersion);
                if (draft) applyStandardBags(draft);
                markClean();
                preview();
            });

        const existingToggle = document.getElementById(TOGGLE_ID);
        if (existingToggle?.classList.contains('header-hub-btn--ui-tweaks')) return;
        existingToggle?.remove();
        document.querySelector('.header-badge-tweaker-toggle')?.remove();

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.id = TOGGLE_ID;
        toggle.className = 'header-hub-btn header-hub-btn--icon header-hub-btn--ui-tweaks';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', PANEL_ID);
        toggle.setAttribute('aria-label', 'UI Tweaks');
        toggle.title = 'UI Tweaks — collaborator chrome (Export JSON to ship a new standard)';

        const iconWrap = document.createElement('span');
        iconWrap.id = 'uiTweaksIcon';
        iconWrap.className = 'header-hub-icon-wrap';
        const icon = document.createElement('img');
        icon.className = 'header-hub-icon';
        icon.src = 'src/assets/images/Icons/Utility%20Icons/Config%20Icon.png';
        icon.alt = '';
        icon.decoding = 'async';
        iconWrap.appendChild(icon);
        toggle.appendChild(iconWrap);

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.className = 'header-badge-tweaker-panel';
        panel.hidden = true;
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'UI Tweaks');

        mountControls(panel, bags, hooks);

        // Palette class changes only — recolor; do not remount (avoids loops).
        const mo = new MutationObserver(() => {
            try {
                applyHeaderTitleBadgeTweaks(badge);
                applyHeaderSidesChrome(sides);
                applySidePanelsTrapChrome(panels);
            } catch (err) {
                console.error('[UI Tweaks] palette recolor failed:', err);
            }
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        toggle.addEventListener('click', () => {
            const open = panel.hidden;
            panel.hidden = !open;
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            toggle.classList.toggle('is-active', open);
            toggle.classList.toggle('header-hub-btn--active', open);
            if (open) {
                document.body.classList.add('ui-tweaks-open');
                mountControls(panel, bags, hooks);
            } else {
                document.body.classList.remove(
                    'ui-tweaks-side-panels',
                    'ui-tweaks-open',
                    'ui-tweaks-filters-music-independent',
                );
            }
        });

        const greySlot = document.getElementById('headerHubRightGreySlot');
        if (greySlot) {
            greySlot.appendChild(toggle);
            // Palette may mount later; keep Config to its right when both exist.
            const paletteBtn = document.getElementById('colorPaletteToggle');
            if (paletteBtn?.parentElement === greySlot) {
                greySlot.appendChild(toggle);
            }
        } else {
            document.body.appendChild(toggle);
        }
        /* Same host as Codex/Story main band — fills layout-container exactly. */
        const mainHost = document.querySelector('.layout-container') || document.body;
        mainHost.appendChild(panel);
    } catch (err) {
        console.error('[UI Tweaks] setup failed:', err);
    }
}

if (typeof window !== 'undefined') {
    window.HeaderTitleBadgeTweaker = {
        setupHeaderTitleBadgeTweaker,
        applyHeaderTitleBadgeTweaks,
        HEADER_BADGE_TWEAK_DEFAULTS,
        HEADER_SIDES_TWEAK_DEFAULTS,
    };
}
