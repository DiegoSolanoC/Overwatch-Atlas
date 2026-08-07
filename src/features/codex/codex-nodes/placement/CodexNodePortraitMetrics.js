/**
 * Portrait dimensions, asset paths, country whitelist, and default scales for Codex nodes.
 */

import { codexHexRotationDegreesForId } from './CodexNodeVisualHash.js';

export const CODEX_IMG_BASE_PX = 144;
export const CODEX_FRAME_PATH = 'src/assets/images/Codex/Node';
/** Luminance mask base path for variant-specific alpha images (Alpha Node1/2/3.png) */
export const CODEX_NODE_ALPHA_PATH = 'src/assets/images/Codex/Alpha%20Node';

/** Junction waypoint: layout box (circle fits inside). */
export const CODEX_JUNCTION_BASE_PX = 32;

/** Enable simplified DOM structure (4 elements vs 8). Set to false to use legacy nested DOM. */
export const CODEX_USE_SIMPLIFIED_DOM = true;

/** Node portrait/junction scale clamp + defaults for newly placed nodes. */
export const CODEX_SCALE_MIN = 0.25;
export const CODEX_SCALE_MAX = 5;
export const CODEX_DEFAULT_SCALE_HERO = 1.5;
export const CODEX_DEFAULT_SCALE_FACTION = 2;
export const CODEX_DEFAULT_SCALE_COUNTRY = 1.5;
export const CODEX_DEFAULT_SCALE_JUNCTION = 3;

/** Extend when adding countries; image path per key (misc art vs flags). */
export const CODEX_ALLOWED_COUNTRY_KEYS = Object.freeze([]);

export const CODEX_COUNTRY_IMAGE_SRC_BY_KEY = Object.freeze({});

export function normalizeCodexCountryKey(raw) {
    const t = String(raw || '').trim().toLowerCase();
    for (let i = 0; i < CODEX_ALLOWED_COUNTRY_KEYS.length; i += 1) {
        const k = CODEX_ALLOWED_COUNTRY_KEYS[i];
        if (t === k.toLowerCase()) return k;
    }
    return null;
}

export function codexCountryFlagSrc(canonicalKey) {
    const mapped = CODEX_COUNTRY_IMAGE_SRC_BY_KEY[canonicalKey];
    if (mapped) return mapped;
    return `src/assets/images/Filters/Flags/${encodeURIComponent(canonicalKey)}.png`;
}

/**
 * @param {'hero'|'faction'|'country'|'junction'|'npc'} kind
 * @param {unknown} optsScale
 */
export function codexNodeLayoutSizePx(kind, scale) {
    const resolved = resolveCodexNodeScale(kind || 'hero', scale);
    const base = kind === 'junction' ? CODEX_JUNCTION_BASE_PX : CODEX_IMG_BASE_PX;
    const dim = base * resolved;
    return { width: dim, height: dim };
}

/**
 * @param {{ id?: string, kind?: string, x?: number, y?: number, scale?: number }} node
 */
export function codexNodeCenterFromLayoutRecord(node) {
    if (!node || typeof node.x !== 'number' || typeof node.y !== 'number') return null;
    const kind = node.kind || 'hero';
    const { width, height } = codexNodeLayoutSizePx(kind, node.scale);
    return { x: node.x + width / 2, y: node.y + height / 2 };
}

/**
 * @param {{ id?: string, kind?: string, x?: number, y?: number, scale?: number }} node
 */
export function codexNodeFrameFromLayoutRecord(node) {
    if (!node || typeof node.x !== 'number' || typeof node.y !== 'number') return null;
    const kind = node.kind || 'hero';
    const { width, height } = codexNodeLayoutSizePx(kind, node.scale);
    return {
        left: node.x,
        top: node.y,
        width,
        height,
        rotationDeg: node.id ? codexHexRotationDegreesForId(node.id) : 0,
    };
}

export function resolveCodexNodeScale(kind, optsScale) {
    if (typeof optsScale === 'number' && Number.isFinite(optsScale)) {
        return Math.max(CODEX_SCALE_MIN, Math.min(CODEX_SCALE_MAX, optsScale));
    }
    const p = parseFloat(String(optsScale));
    if (Number.isFinite(p)) {
        return Math.max(CODEX_SCALE_MIN, Math.min(CODEX_SCALE_MAX, p));
    }
    if (kind === 'junction') return CODEX_DEFAULT_SCALE_JUNCTION;
    if (kind === 'faction') return CODEX_DEFAULT_SCALE_FACTION;
    if (kind === 'country') return CODEX_DEFAULT_SCALE_COUNTRY;
    return CODEX_DEFAULT_SCALE_HERO;
}
