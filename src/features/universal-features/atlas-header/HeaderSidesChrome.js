/**
 * Header side bars (left/right of center badge): dark sideways gradient +
 * solid grey outer caps + L-rim (inward slant + fading bottom), badge-style.
 *
 * Site look ships from `src/data/platform/atlas-ui-tweaks.json` (see UiTweaksStandard).
 * These DEFAULTS are the sync fallback / bake of that standard.
 */

/** Baked from atlas-ui-tweaks.json standard, Nov 2026. */
export const HEADER_SIDES_TWEAK_DEFAULTS = Object.freeze({
    /**
     * Distance from hub inner edge to badge *box*. The visible badge shape is
     * inset inside that box, so 0 still looks gappy — use negative to tuck
     * under the badge (badge paints above the hubs).
     */
    sideGapPx: -65,
    /**
     * Bottom of side stripes + black header paint, in badge viewBox Y (0–100).
     * Independent of badge Bottom Y — lower = shorter strip / paint vs badge.
     */
    sideStripBottomY: 96,
    sideInnerDarkness: 40,
    sideOuterDarkness: 98,
    sideSaturation: 56,
    sideGreyLevel: 28,
    sideGreyWidthPct: 19,

    /** Inward (toward badge) rim thickness in CSS px — 2× stroke, clipped. */
    sideRimInwardWidth: 5.75,
    /** Bottom rim thickness in CSS px — fades away from center. */
    sideRimBottomWidth: 4.5,
    /**
     * Center-facing corner round on the stripe *fill* (CSS px). The L-rim stays
     * a straight slant at the top (clipped to the round) and only fillets the
     * bottom-inner join — so the shape rounds without the border curling onto
     * the top edge.
     */
    sideRimCornerRadius: 14,
    /** How far along the bottom the fade reaches (0 = quick, 100 = full width). */
    sideRimFadeReach: 86,

    sideRimHueShift: 16,
    sideRimSaturation: 100,
    sideRimLightness: 56,
    /** 0 = neon punch, 100 = near-black / muted (crushes chroma after neon recipe). */
    sideRimDarkness: 0,
    sideRimGlow: 42,
    sideRimOpacity: 100,
});

function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
}

function cloneDefaults() {
    return { ...HEADER_SIDES_TWEAK_DEFAULTS };
}

export function cloneSidesDefaults() {
    return cloneDefaults();
}

export function sanitizeSidesState(s) {
    const next = { ...s };
    next.sideGapPx = clamp(Number(next.sideGapPx), -80, 48);
    next.sideStripBottomY = clamp(Number(next.sideStripBottomY), 48, 100);
    next.sideInnerDarkness = clamp(Number(next.sideInnerDarkness), 40, 95);
    next.sideOuterDarkness = clamp(Number(next.sideOuterDarkness), 55, 98);
    if (next.sideOuterDarkness < next.sideInnerDarkness) {
        next.sideOuterDarkness = next.sideInnerDarkness;
    }
    next.sideSaturation = clamp(Number(next.sideSaturation), 0, 80);
    next.sideGreyLevel = clamp(Number(next.sideGreyLevel), 6, 40);
    next.sideGreyWidthPct = clamp(Number(next.sideGreyWidthPct), 6, 40);

    next.sideRimInwardWidth = clamp(Number(next.sideRimInwardWidth), 0, 14);
    next.sideRimBottomWidth = clamp(Number(next.sideRimBottomWidth), 0, 16);
    next.sideRimCornerRadius = clamp(Number(next.sideRimCornerRadius), 0, 28);
    next.sideRimFadeReach = clamp(Number(next.sideRimFadeReach), 20, 100);
    next.sideRimHueShift = clamp(Number(next.sideRimHueShift), -40, 40);
    next.sideRimSaturation = clamp(Number(next.sideRimSaturation), 0, 100);
    next.sideRimLightness = clamp(Number(next.sideRimLightness), 8, 70);
    next.sideRimDarkness = clamp(Number(next.sideRimDarkness), 0, 100);
    next.sideRimGlow = clamp(Number(next.sideRimGlow), 0, 100);
    next.sideRimOpacity = clamp(Number(next.sideRimOpacity), 0, 100);
    return next;
}

/** Sync fallback only — live look comes from the committed JSON standard (+ optional draft). */
export function loadSidesState() {
    return sanitizeSidesState(cloneDefaults());
}

/** @deprecated Draft persistence is unified in UiTweaksStandard / HeaderTitleBadgeTweaker. */
export function saveSidesState(_state) {
    /* no-op: per-slice localStorage removed (not a per-visitor preference) */
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

function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            default:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }
    return [h * 360, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = clamp(s, 0, 100) / 100;
    l = clamp(l, 0, 100) / 100;
    if (s === 0) {
        const v = Math.round(l * 255);
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
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hh = h / 360;
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

function sideToneFromAccent(accent, darkness, saturation) {
    const [h] = rgbToHsl(accent[0], accent[1], accent[2]);
    const l = 22 - (clamp(darkness, 0, 100) / 100) * 18;
    const s = clamp(saturation, 0, 80);
    return hslToRgb(h, s, Math.max(3, l));
}

/** Same neon rim recipe as the center badge. */
function rimFromAccent(accent, sat, light, hueShift, glow) {
    const [h0] = rgbToHsl(accent[0], accent[1], accent[2]);
    const h = ((h0 + Number(hueShift)) % 360 + 360) % 360;
    const s = clamp(Number(sat), 0, 100);
    const l = clamp(Number(light), 0, 100);
    const vivid = hslToRgb(h, s, l);
    const neon = hslToRgb(h, 100, 52);
    const electric = hslToRgb(h, 100, 62);
    const punched = mixRgb(mixRgb(vivid, neon, 0.45), electric, 0.25);
    const hot = hslToRgb(h, 100, 72);
    return mixRgb(punched, hot, (clamp(Number(glow), 0, 100) / 100) * 0.55);
}

function measureSlantPx(hub) {
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText =
        'position:absolute;left:0;top:0;height:1px;width:var(--header-hub-btn-slant);pointer-events:none;visibility:hidden';
    hub.appendChild(probe);
    const w = probe.offsetWidth || 40;
    probe.remove();
    return w;
}

function dist(a, b) {
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * Closed polygon path in px. Only indices in `roundIdx` get a Q fillet —
 * inward slant corners stay sharp so the diagonal runs straight to the top.
 * @param {number[][]} pts
 * @param {number} radius
 * @param {Set<number> | number[]} roundIdx
 */
function roundedPolyPath(pts, radius, roundIdx) {
    const f = (n) => Math.round(n * 100) / 100;
    const rMax = Math.max(0, Number(radius) || 0);
    const n = pts.length;
    if (n < 3) return '';
    const roundSet =
        roundIdx instanceof Set
            ? roundIdx
            : new Set(Array.isArray(roundIdx) ? roundIdx : []);
    if (rMax < 0.05 || roundSet.size === 0) {
        let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
        for (let i = 1; i < n; i += 1) d += `L${f(pts[i][0])} ${f(pts[i][1])}`;
        return `${d}Z`;
    }
    const parts = [];
    for (let i = 0; i < n; i += 1) {
        const prev = pts[(i - 1 + n) % n];
        const cur = pts[i];
        const next = pts[(i + 1) % n];
        const d1 = dist(prev, cur);
        const d2 = dist(cur, next);
        if (d1 < 1e-6 || d2 < 1e-6) continue;
        const want = roundSet.has(i) ? rMax : 0;
        const r = Math.min(want, d1 * 0.45, d2 * 0.45);
        if (r < 0.05) {
            if (parts.length === 0) parts.push(`M${f(cur[0])} ${f(cur[1])}`);
            else parts.push(`L${f(cur[0])} ${f(cur[1])}`);
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
        if (parts.length === 0) parts.push(`M${f(p1[0])} ${f(p1[1])}`);
        else parts.push(`L${f(p1[0])} ${f(p1[1])}`);
        parts.push(`Q${f(cur[0])} ${f(cur[1])} ${f(p2[0])} ${f(p2[1])}`);
    }
    parts.push('Z');
    return parts.join('');
}

/**
 * Parallelogram vertices in CSS px (TL→… clockwise from outer-top for left).
 * @param {'left' | 'right'} side
 */
function stripePoints(side, w, h, slantPx) {
    const s = clamp(slantPx, 1, w * 0.45);
    return side === 'left'
        ? [
              [0, 0],
              [w - s, 0],
              [w, h],
              [0, h],
          ]
        : [
              [s, 0],
              [w, 0],
              [w, h],
              [0, h],
          ];
}

/**
 * Rounded parallelogram clip — both center-facing corners (fill silhouette).
 * Outer ends stay sharp.
 */
function stripeClipPath(side, w, h, slantPx, radiusPx) {
    const pts = stripePoints(side, w, h, slantPx);
    // Left: top-inner=1, bot-inner=2. Right: top-inner=0, bot-inner=3.
    const centerIdx = side === 'left' ? [1, 2] : [0, 3];
    const d = roundedPolyPath(pts, radiusPx, centerIdx);
    return d ? `path('${d}')` : '';
}

/**
 * Q-fillet endpoints around `cur` between `prev`→`cur`→`next`.
 * @param {number[]} prev
 * @param {number[]} cur
 * @param {number[]} next
 * @param {number} rWant
 */
function filletAt(prev, cur, next, rWant) {
    const d1 = dist(prev, cur);
    const d2 = dist(cur, next);
    const r = Math.min(Math.max(0, rWant), d1 * 0.45, d2 * 0.45);
    if (r < 0.05) return { p1: [...cur], p2: [...cur], r: 0 };
    return {
        p1: [
            cur[0] + (prev[0] - cur[0]) * (r / d1),
            cur[1] + (prev[1] - cur[1]) * (r / d1),
        ],
        p2: [
            cur[0] + (next[0] - cur[0]) * (r / d2),
            cur[1] + (next[1] - cur[1]) * (r / d2),
        ],
        r,
    };
}

/**
 * Point past `through` continuing from `from`→`through` by `extra` px.
 * @param {number[]} from
 * @param {number[]} through
 * @param {number} extra
 */
function extendPast(from, through, extra) {
    const dx = through[0] - from[0];
    const dy = through[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.max(0, extra) / len;
    return [through[0] + dx * t, through[1] + dy * t];
}

/**
 * L-rim as two strokes (independent thickness):
 * - inward: full straight slant, extended past both ends (fill round clips tips)
 * - bottom: bottom-inner fillet + bottom edge (fade gradient)
 * Inward must run the whole slant — ending at the fillet start shortened it
 * whenever corner round > 0.
 *
 * @param {'left' | 'right'} side
 * @param {number} inwardStrokePx visible inward thickness (pre-2×)
 * @param {number} bottomStrokePx visible bottom thickness (pre-2×)
 */
function rimPathsForSide(side, w, h, slantPx, radiusPx, inwardStrokePx, bottomStrokePx) {
    const f = (n) => Math.round(n * 100) / 100;
    const s = clamp(slantPx, 1, w * 0.45);
    const rMax = Math.max(0, radiusPx);
    const extTop = Math.max(Math.max(0, inwardStrokePx) * 2.5, 6);
    const extBot = Math.max(Math.max(0, inwardStrokePx) * 2.5, 6);

    /** @type {number[]} */
    let topInner;
    /** @type {number[]} */
    let botInner;
    /** @type {number[]} */
    let botOuter;

    if (side === 'left') {
        topInner = [w - s, 0];
        botInner = [w, h];
        botOuter = [0, h];
    } else {
        topInner = [s, 0];
        botInner = [0, h];
        botOuter = [w, h];
    }

    const botF = filletAt(topInner, botInner, botOuter, rMax);
    const pastTop = extendPast(botInner, topInner, extTop);
    const pastBot = extendPast(topInner, botInner, extBot);

    // Full slant length (same idea as the top seat) — not truncated at the fillet.
    const inward = `M${f(pastTop[0])} ${f(pastTop[1])} L${f(pastBot[0])} ${f(pastBot[1])}`;

    // Bottom edge owns the L fillet + fade; slight overlap at the join is fine.
    let bottom = `M${f(botF.r > 0 ? botF.p1[0] : botInner[0])} ${f(
        botF.r > 0 ? botF.p1[1] : botInner[1],
    )}`;
    if (botF.r > 0) {
        bottom += `Q${f(botInner[0])} ${f(botInner[1])} ${f(botF.p2[0])} ${f(botF.p2[1])}`;
    }
    // Extend a hair past the outer end so butt + clip stay flush when thick.
    const botExt = Math.max(Math.max(0, bottomStrokePx) * 1.5, 2);
    const pastOuter =
        side === 'left'
            ? [botOuter[0] - botExt, botOuter[1]]
            : [botOuter[0] + botExt, botOuter[1]];
    bottom += `L${f(pastOuter[0])} ${f(pastOuter[1])}`;

    return { inward, bottom };
}

function ensureRimSvg(chrome, side) {
    chrome.querySelectorAll(':scope > .header-hub-chrome__rim').forEach((el) => el.remove());

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'header-hub-chrome__rim');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');

    const defs = document.createElementNS(ns, 'defs');
    const grad = document.createElementNS(ns, 'linearGradient');
    grad.setAttribute('id', side === 'left' ? 'headerHubRimFadeLeft' : 'headerHubRimFadeRight');
    grad.setAttribute('gradientUnits', 'userSpaceOnUse');
    grad.setAttribute('x1', side === 'left' ? '100' : '0');
    grad.setAttribute('y1', '100');
    grad.setAttribute('x2', side === 'left' ? '0' : '100');
    grad.setAttribute('y2', '100');
    const s0 = document.createElementNS(ns, 'stop');
    s0.setAttribute('class', 'header-hub-chrome__rim-fade-start');
    s0.setAttribute('offset', '0%');
    const s1 = document.createElementNS(ns, 'stop');
    s1.setAttribute('class', 'header-hub-chrome__rim-fade-end');
    s1.setAttribute('offset', '100%');
    s1.setAttribute('stop-opacity', '0');
    grad.appendChild(s0);
    grad.appendChild(s1);
    defs.appendChild(grad);
    svg.appendChild(defs);

    const mk = (cls, stroke) => {
        const el = document.createElementNS(ns, 'path');
        el.setAttribute('class', cls);
        el.setAttribute('fill', 'none');
        el.setAttribute('stroke', stroke);
        el.setAttribute('stroke-linecap', 'butt');
        el.setAttribute('stroke-linejoin', 'round');
        el.setAttribute('vector-effect', 'non-scaling-stroke');
        return el;
    };

    const fadeId = side === 'left' ? 'url(#headerHubRimFadeLeft)' : 'url(#headerHubRimFadeRight)';
    svg.appendChild(mk('header-hub-chrome__rim-inward', 'currentColor'));
    svg.appendChild(mk('header-hub-chrome__rim-bottom', fadeId));
    chrome.appendChild(svg);
    return svg;
}

function ensureHubChrome(hub, side) {
    if (!hub) return null;
    hub.querySelector(':scope > .header-hub-chrome-clip')?.remove();
    // Old builds put the rim on the hub; keep a single rim inside chrome.
    hub.querySelectorAll(':scope > .header-hub-chrome__rim').forEach((el) => el.remove());

    let chrome = hub.querySelector(':scope > .header-hub-chrome');
    if (!chrome) {
        chrome = document.createElement('div');
        chrome.className = 'header-hub-chrome';
        chrome.setAttribute('aria-hidden', 'true');
        const grey = document.createElement('div');
        grey.className = 'header-hub-chrome__grey';
        const bar = document.createElement('div');
        bar.className = 'header-hub-chrome__bar';
        chrome.appendChild(grey);
        chrome.appendChild(bar);
        hub.insertBefore(chrome, hub.firstChild);
    }
    ensureRimSvg(chrome, side);
    hub.classList.add('header-hub--chrome');
    return chrome;
}

export function ensureHeaderSidesChrome() {
    ensureHubChrome(document.getElementById('headerHub'), 'left');
    ensureHubChrome(document.getElementById('headerHubRight'), 'right');
}

/**
 * @param {ReturnType<typeof sanitizeSidesState>} state
 */
export function applyHeaderSidesChrome(state) {
    const clean = sanitizeSidesState(state);
    ensureHeaderSidesChrome();

    const root = document.body;
    const accent = readPaletteAccentRgb();
    const inner = sideToneFromAccent(accent, clean.sideInnerDarkness, clean.sideSaturation);
    const outer = sideToneFromAccent(accent, clean.sideOuterDarkness, clean.sideSaturation * 0.65);
    const grey = [
        clamp(clean.sideGreyLevel + 4, 0, 255),
        clamp(clean.sideGreyLevel + 6, 0, 255),
        clamp(clean.sideGreyLevel + 10, 0, 255),
    ];
    const rimVivid = rimFromAccent(
        accent,
        clean.sideRimSaturation,
        clean.sideRimLightness,
        clean.sideRimHueShift,
        clean.sideRimGlow * (1 - clamp(clean.sideRimDarkness, 0, 100) / 100),
    );
    // Darkness crushes neon toward black and strips remaining chroma.
    const darkT = clamp(clean.sideRimDarkness, 0, 100) / 100;
    const rimMuted = (() => {
        const [h, s, l] = rgbToHsl(rimVivid[0], rimVivid[1], rimVivid[2]);
        return hslToRgb(h, s * (1 - darkT * 0.92), Math.max(2, l * (1 - darkT * 0.82)));
    })();
    const rimRgb = mixRgb(rimMuted, [0, 0, 0], darkT * 0.55);
    const rimAlpha = clamp(clean.sideRimOpacity, 0, 100) / 100;
    const rimSolid = rgbCss(rimRgb, rimAlpha);
    const rimOpaque = rgbCss(rimRgb, 1);

    const targets = [root, document.querySelector('header')].filter(Boolean);
    const vw = typeof window !== 'undefined' ? window.innerWidth || 1400 : 1400;
    const vh = typeof window !== 'undefined' ? window.innerHeight || 900 : 900;
    const compact = vw <= 768;
    const portrait = compact && vh >= vw;
    /*
     * Soften large negative hub↔badge tuck when the CSS viewport is zoomed narrow.
     * Compact / portrait must keep a *positive* gap (mobile CSS) — desktop −65px tuck
     * eats hub columns and clips Theater/Archive/Gallery on real phones.
     */
    const gapPx = compact
        ? /* Mild tuck so the wider phone badge meets the hubs (not a black void). */
          Math.max(
              portrait ? -18 : 8,
              Math.min(portrait ? -6 : 14, -Math.round(vw * (portrait ? 0.028 : -0.022))),
          )
        : clean.sideGapPx < 0
          ? Math.max(clean.sideGapPx, -Math.round(vw * 0.045))
          : clean.sideGapPx;
    const props = {
        '--header-badge-gap': `${gapPx}px`,
        '--header-hub-hex-y-bottom': String(clean.sideStripBottomY),
        '--header-side-grad-inner': rgbCss(inner),
        '--header-side-grad-outer': rgbCss(outer),
        '--header-side-grey': rgbCss(grey),
        '--header-side-grey-pct': `${clean.sideGreyWidthPct}%`,
        '--header-side-rim': rimSolid,
    };
    for (const el of targets) {
        el.style.removeProperty('--header-side-edge');
        el.style.removeProperty('--header-side-edge-w');
        for (const [key, value] of Object.entries(props)) {
            el.style.setProperty(key, value);
        }
    }

    const fadeEnd = `${clamp(clean.sideRimFadeReach, 20, 100)}%`;

    /** @param {'left' | 'right'} side */
    const paintRim = (hubId, side) => {
        const hub = document.getElementById(hubId);
        if (!hub) return;
        const chrome = hub.querySelector(':scope > .header-hub-chrome');
        if (!chrome) return;
        const svg = ensureRimSvg(chrome, side);

        const w = Math.max(hub.clientWidth, 1);
        const h = Math.max(hub.clientHeight, 1);
        const slantPx = measureSlantPx(hub);
        const cornerR = Math.max(0, clean.sideRimCornerRadius);
        const inwardW = Math.max(clean.sideRimInwardWidth, 0);
        const bottomW = Math.max(clean.sideRimBottomWidth, 0);

        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

        const clip = stripeClipPath(side, w, h, slantPx, cornerR);
        if (clip) chrome.style.clipPath = clip;
        else chrome.style.removeProperty('clip-path');

        const { inward, bottom } = rimPathsForSide(
            side,
            w,
            h,
            slantPx,
            cornerR,
            inwardW,
            bottomW,
        );
        const inwardEl = svg.querySelector('.header-hub-chrome__rim-inward');
        const bottomEl = svg.querySelector('.header-hub-chrome__rim-bottom');
        const fadeStart = svg.querySelector('.header-hub-chrome__rim-fade-start');
        const fadeEndStop = svg.querySelector('.header-hub-chrome__rim-fade-end');
        const grad = svg.querySelector('linearGradient');

        if (inwardEl) {
            inwardEl.setAttribute('d', inward);
            inwardEl.setAttribute('stroke', rimSolid);
            inwardEl.setAttribute('stroke-width', String(inwardW * 2));
            inwardEl.setAttribute('stroke-linecap', 'butt');
            inwardEl.setAttribute('stroke-linejoin', 'round');
            inwardEl.style.opacity = inwardW <= 0 ? '0' : '1';
        }
        if (bottomEl) {
            bottomEl.setAttribute('d', bottom);
            bottomEl.setAttribute(
                'stroke',
                side === 'left' ? 'url(#headerHubRimFadeLeft)' : 'url(#headerHubRimFadeRight)',
            );
            bottomEl.setAttribute('stroke-width', String(bottomW * 2));
            bottomEl.setAttribute('stroke-linecap', 'butt');
            bottomEl.setAttribute('stroke-linejoin', 'round');
            bottomEl.style.opacity = bottomW <= 0 ? '0' : '1';
        }
        if (fadeStart) {
            fadeStart.setAttribute('stop-color', rimOpaque);
            fadeStart.setAttribute('stop-opacity', String(rimAlpha));
        }
        if (fadeEndStop) {
            fadeEndStop.setAttribute('stop-color', rimOpaque);
            fadeEndStop.setAttribute('stop-opacity', '0');
            fadeEndStop.setAttribute('offset', fadeEnd);
        }
        if (grad && side === 'left') {
            const reach = clamp(clean.sideRimFadeReach, 20, 100) / 100;
            grad.setAttribute('x1', String(w));
            grad.setAttribute('y1', String(h));
            grad.setAttribute('x2', String(w * (1 - reach)));
            grad.setAttribute('y2', String(h));
        } else if (grad) {
            const reach = clamp(clean.sideRimFadeReach, 20, 100) / 100;
            grad.setAttribute('x1', '0');
            grad.setAttribute('y1', String(h));
            grad.setAttribute('x2', String(w * reach));
            grad.setAttribute('y2', String(h));
        }
    };

    paintRim('headerHub', 'left');
    paintRim('headerHubRight', 'right');

    return { accent, inner, outer, grey, rimRgb };
}
