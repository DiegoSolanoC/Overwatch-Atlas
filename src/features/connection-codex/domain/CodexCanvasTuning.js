/**
 * Codex canvas tuning: cord/edge/packet/zoom constants, virtual viewport math, and visual prefs schema.
 * Bundled as one module to avoid a sprawl of tiny single-purpose files (see refactor notes / deslop: YAGNI on micro-splits).
 */

import { CODEX_IMG_BASE_PX } from './CodexNodePortraitMetrics.js';

// --- Edge / cord / packet / cull / zoom ------------------------------------

/** Pointer move below this (screen px, squared dist) does not start a node drag. */
export const DRAG_THRESHOLD_PX = 6;

/** @deprecated Prefer canvas `codexVisualPrefs.cordThickness` where available; kept for fallbacks. */
export const CODEX_EDGE_STROKE_PX = 3.35;

/** Arm length (world px) along each cord direction for junction elbow parallelogram (axis + 45° turns). */
export const CODEX_ELBOW_PARALLELOGRAM_ARM_PX = 24;

/** Degrees slop for classifying a segment as axis-aligned vs 45° diagonal. */
export const CODEX_ELBOW_BEARING_TOL_DEG = 8;

/** World px — cord angle labels (0° / 45°). */
export const CODEX_EDGE_DEGREE_FONT_PX = 38;

export const CODEX_CORD_STROKE_OPACITY = 1;

/** Invisible cord pick targets (world px, user space); thick so “near the cord” left-clicks register reliably. */
export const CODEX_EDGE_HIT_PICK_STROKE_PX = 56;

/** Widen filter bbox for H/V lines (backup; main fix is userSpaceOnUse + feMorphology). */
export const CODEX_EDGE_FILTER_PAD_PX = 52;

/** Packet spawn pulse: meteor-style snap to peak, then exponential tail (decay = e-folding time τ). */
export const CODEX_PACKET_PULSE_RISE_MIN_SEC = 0.012;
export const CODEX_PACKET_PULSE_RISE_MAX_SEC = 0.052;
export const CODEX_PACKET_PULSE_DECAY_MIN_SEC = 0.09;
export const CODEX_PACKET_PULSE_DECAY_MAX_SEC = 0.42;

/** Opacity factor lerp at pulseStr 0 vs 1 (vs saved packet opacity); big gap so pulse reads even when opacity is 1. */
export const CODEX_PACKET_PULSE_OPACITY_LOW_MULT = 0.22;
export const CODEX_PACKET_PULSE_OPACITY_PEAK_MULT = 1.28;

/** Stroke width factor lerp (thin/dim → fat/bright). */
export const CODEX_PACKET_PULSE_WIDTH_LOW_MULT = 0.48;
export const CODEX_PACKET_PULSE_WIDTH_PEAK_MULT = 3.85;

/** Glow pad lerp (filter bbox — larger at peak). */
export const CODEX_PACKET_PULSE_PAD_LOW_MULT = 0.88;
export const CODEX_PACKET_PULSE_PAD_PEAK_MULT = 3.05;

/** Sharp white-hot core on top of filtered glow; only drawn above this pulse strength. */
export const CODEX_PACKET_METEOR_CORE_MIN_PULSE = 0.06;

/** Packets per directed edge (inclusive range). */
export const CODEX_PACKET_COUNT_MIN = 3;
export const CODEX_PACKET_COUNT_MAX = 6;

/** Arc-length speed per second (higher = more traffic). */
export const CODEX_PACKET_SPEED_MIN = 0.14;
export const CODEX_PACKET_SPEED_MAX = 0.38;

/** Below this node count, redraw all edges/masks (culling has its own overhead). */
export const CODEX_VIEWPORT_CULL_MIN_NODES = 48;

/** Below this edge count, same “redraw all” path as CODEX_VIEWPORT_CULL_MIN_NODES. */
export const CODEX_VIEWPORT_CULL_MIN_EDGES = 64;

/** Below this, skip `.codex-node--cv-offscreen` toggling (cheap for tiny boards). */
export const CODEX_NODE_DOM_CULL_MIN_NODES = 12;

/**
 * Extra screen px added on top of CODEX_EDGE_CULL_MARGIN_PX for DOM culling only —
 * keeps nodes “on” slightly before they enter view while panning.
 */
export const CODEX_NODE_DOM_CULL_MARGIN_EXTRA_PX = 160;

/** Screen px → world margin so cords don’t pop at the viewport edge. */
export const CODEX_EDGE_CULL_MARGIN_PX = 300;

/** Extra world px around drawn cord bbox for alpha-mask images (nodes the cord may pass under). */
export const CODEX_MASK_PAD_WORLD_FROM_EDGES = 200;

/** Min = zoomed out (smaller world on screen). */
export const CODEX_ZOOM_MIN = 0.18;
export const CODEX_ZOOM_MAX = 2.25;
export const CODEX_ZOOM_FACTOR = 1.12;

/** Starting / reset board zoom — more zoomed out to see more context. */
export const CODEX_ZOOM_INITIAL = 0.9;

/** π/4 — octilinear cord directions. */
export const CODEX_OCT_RAD = Math.PI / 4;

/** Degrees from a 45° lane: within this, cord snaps on pointer-up; degree labels turn green while near a lane. */
export const CODEX_OCT_SOFT_SNAP_TOL_DEG = 10;

/** Min center movement (px) when applying release snap (avoid jitter). */
export const CODEX_OCT_RELEASE_SNAP_EPS = 0.35;

/** SVG `<mask id="…">` for cutting cords behind node portraits. */
export const CODEX_EDGES_NODE_ALPHA_MASK_ID = 'codex-edges-node-alpha-mask';

// --- Virtual scroll viewport (world space) ---------------------------------

/** World px padding beyond the visible rect before nodes mount/unmount (larger = fewer churn). */
export const CODEX_VIRTUAL_BUFFER_PX = 1200;

/**
 * @typedef {{ left: number, top: number, right: number, bottom: number }} CodexVirtualViewportBounds
 * @param {{ clientWidth: number, clientHeight: number }} rootSize Codex root scroll surface.
 * @param {{ panX: number, panY: number, zoom: number }} view Screen pan (px) and zoom (world px per screen px).
 * @param {number} [bufferPx]
 * @returns {CodexVirtualViewportBounds}
 */
export function computeCodexVirtualViewportBounds(rootSize, view, bufferPx = CODEX_VIRTUAL_BUFFER_PX) {
    const rw = rootSize.clientWidth || 1;
    const rh = rootSize.clientHeight || 1;
    const z = Math.max(0.05, view.zoom);
    const viewLeft = -view.panX / z;
    const viewTop = -view.panY / z;
    const viewRight = viewLeft + rw / z;
    const viewBottom = viewTop + rh / z;
    return {
        left: viewLeft - bufferPx,
        top: viewTop - bufferPx,
        right: viewRight + bufferPx,
        bottom: viewBottom + bufferPx
    };
}

/**
 * @param {{ x: number, y: number, scale?: number }} node
 * @param {CodexVirtualViewportBounds} viewport
 * @param {number} [imgBasePx] Portrait base size for cull box (matches node DOM scale source).
 */
export function isCodexNodeInVirtualViewport(node, viewport, imgBasePx = CODEX_IMG_BASE_PX) {
    const nodeSize = imgBasePx * (node.scale || 1);
    return (
        node.x + nodeSize >= viewport.left &&
        node.x <= viewport.right &&
        node.y + nodeSize >= viewport.top &&
        node.y <= viewport.bottom
    );
}

// --- Visual prefs (defaults + safe merge from localStorage JSON) ----------

export const CODEX_VISUAL_PREFS_KEY = 'timelineCodexVisualPrefs';

/** Default cord/packet SVG look (matches original hard-coded constants). */
export const CODEX_VISUAL_DEFAULTS = Object.freeze({
    cordColor: '#e9d5ff',
    cordThickness: 3.35,
    cordBlur: 4,
    cordMorph: 1.25,
    cordGlowLayers: 2,
    packetColorIdle: '#9333ea',
    packetColorActive: '#c026d3',
    packetThicknessMult: 1.35,
    packetBlurMult: 1.35,
    packetMorphMult: 1.35,
    packetGlowLayers: 2,
    packetOpacity: 1
});

function clampPref(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
}

/**
 * @param {unknown} raw
 * @returns {typeof CODEX_VISUAL_DEFAULTS}
 */
export function normalizeCodexVisualPrefs(raw) {
    const o = { ...CODEX_VISUAL_DEFAULTS };
    if (!raw || typeof raw !== 'object') return o;
    const hex6 = (v, key) => {
        if (typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v)) o[key] = v;
    };
    hex6(raw.cordColor, 'cordColor');
    hex6(raw.packetColorIdle, 'packetColorIdle');
    hex6(raw.packetColorActive, 'packetColorActive');
    const nn = (v, def) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
    o.cordThickness = clampPref(nn(raw.cordThickness, o.cordThickness), 0.5, 14);
    o.cordBlur = clampPref(nn(raw.cordBlur, o.cordBlur), 0, 18);
    o.cordMorph = clampPref(nn(raw.cordMorph, o.cordMorph), 0, 5);
    o.cordGlowLayers = Math.round(clampPref(nn(raw.cordGlowLayers, o.cordGlowLayers), 1, 6));
    o.packetThicknessMult = clampPref(nn(raw.packetThicknessMult, o.packetThicknessMult), 0.3, 3.5);
    o.packetBlurMult = clampPref(nn(raw.packetBlurMult, o.packetBlurMult), 0.2, 3.5);
    o.packetMorphMult = clampPref(nn(raw.packetMorphMult, o.packetMorphMult), 0.3, 3.5);
    o.packetGlowLayers = Math.round(clampPref(nn(raw.packetGlowLayers, o.packetGlowLayers), 1, 6));
    o.packetOpacity = clampPref(nn(raw.packetOpacity, o.packetOpacity), 0.1, 1);
    return o;
}
