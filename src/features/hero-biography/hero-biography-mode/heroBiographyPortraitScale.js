/**
 * Normalize on-stage hero size from portrait PNG content bounds.
 * Ana establishes the reference; heroes scale up to match her on-screen presence.
 * Sizing uses layout height (not transform) so art expands upward from the bottom.
 */

import { buildHeroBiographyLookPath, DEFAULT_HERO_BIO_LOOK } from './heroBiographyHeroicImagePaths.js';
import { fetchPlatformManifest } from './loadHeroBiosLooks.js';

const REFERENCE_HERO = 'Ana';
const FALLBACK_REFERENCE_OPAQUE_HEIGHT_RATIO = 0.807;
const FALLBACK_REFERENCE_NATURAL_HEIGHT = 924;
const ALPHA_THRESHOLD = 24;
const MAX_SAMPLE_EDGE = 512;
const MIN_SCALE = 0.88;
const MAX_SCALE = 2.05;

/** @type {{ opaqueHeightRatio: number, naturalHeight: number, opaqueHeightPx: number } | null} */
let referenceMetrics = null;

/** @type {Record<string, number> | null} */
let manifestPortraitScales = null;

/**
 * @param {HTMLImageElement} img
 * @returns {{ height: number, width: number, top: number, left: number } | null}
 */
export function measurePortraitOpaqueBounds(img) {
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) return null;

    const sampleScale = Math.min(1, MAX_SAMPLE_EDGE / Math.max(nw, nh));
    const sw = Math.max(1, Math.round(nw * sampleScale));
    const sh = Math.max(1, Math.round(nh * sampleScale));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, sw, sh);
    let imageData;
    try {
        imageData = ctx.getImageData(0, 0, sw, sh);
    } catch {
        return null;
    }

    const data = imageData.data;
    let minX = sw;
    let minY = sh;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
            const a = data[(y * sw + x) * 4 + 3];
            if (a <= ALPHA_THRESHOLD) continue;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }

    if (maxX < minX || maxY < minY) return null;

    const inv = 1 / sampleScale;
    return {
        left: minX * inv,
        top: minY * inv,
        width: (maxX - minX + 1) * inv,
        height: (maxY - minY + 1) * inv,
    };
}

function rememberReferenceMetrics(img, bounds) {
    referenceMetrics = {
        opaqueHeightRatio: bounds.height / img.naturalHeight,
        naturalHeight: img.naturalHeight,
        opaqueHeightPx: bounds.height,
    };
}

function getReferenceMetrics() {
    if (referenceMetrics) return referenceMetrics;
    return {
        opaqueHeightRatio: FALLBACK_REFERENCE_OPAQUE_HEIGHT_RATIO,
        naturalHeight: FALLBACK_REFERENCE_NATURAL_HEIGHT,
        opaqueHeightPx: FALLBACK_REFERENCE_OPAQUE_HEIGHT_RATIO * FALLBACK_REFERENCE_NATURAL_HEIGHT,
    };
}

async function getManifestPortraitScale(heroFilterKey) {
    if (!manifestPortraitScales) {
        try {
            const manifest = await fetchPlatformManifest();
            const raw = manifest?.heroBioPortraitScales;
            manifestPortraitScales =
                raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        } catch {
            manifestPortraitScales = {};
        }
    }
    const key = String(heroFilterKey || '').trim();
    const v = manifestPortraitScales[key];
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 1;
}

/**
 * Match Ana's rendered character height, including compensation for taller source canvases
 * (same fill % in a larger PNG still reads smaller with object-fit: contain).
 * @param {number} opaqueHeightPx
 * @param {number} naturalHeight
 * @param {string} heroFilterKey
 */
function computePortraitScale(opaqueHeightPx, naturalHeight, heroFilterKey) {
    const ref = getReferenceMetrics();
    const opaqueRatio = opaqueHeightPx / naturalHeight;
    const contentScale = ref.opaqueHeightRatio / opaqueRatio;
    const canvasScale = naturalHeight / ref.naturalHeight;
    let scale = contentScale * canvasScale;

    if (heroFilterKey === REFERENCE_HERO) {
        scale = 1;
    }

    return scale;
}

function applyPortraitLayoutScale(img, scale) {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    img.style.transform = '';
    img.style.transformOrigin = '';
    img.style.objectFit = 'contain';
    img.style.objectPosition = 'center bottom';
    img.style.maxHeight = 'none';
    img.style.maxWidth = 'none';

    if (Math.abs(clamped - 1) < 0.008) {
        img.style.height = '100%';
        img.style.width = '100%';
        img.style.removeProperty('--hero-bio-portrait-scale');
    } else {
        img.style.height = `${(clamped * 100).toFixed(2)}%`;
        img.style.width = 'auto';
        img.style.setProperty('--hero-bio-portrait-scale', String(clamped));
    }
}

/**
 * Preload Ana heroic so Ashe (etc.) scale against a stable reference before Ana is selected.
 */
export function preloadHeroBiographyPortraitReference() {
    if (referenceMetrics) return;

    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
        const bounds = measurePortraitOpaqueBounds(img);
        if (bounds) rememberReferenceMetrics(img, bounds);
    };
    img.src = buildHeroBiographyLookPath(REFERENCE_HERO, DEFAULT_HERO_BIO_LOOK);
}

/**
 * @param {HTMLImageElement} img
 * @param {string} heroFilterKey
 */
export async function applyHeroBiographyPortraitScale(img, heroFilterKey) {
    if (!img) return;

    const heroKey = String(heroFilterKey || '').trim();
    const bounds = measurePortraitOpaqueBounds(img);
    if (!bounds || !img.naturalHeight) {
        resetHeroBiographyPortraitScale(img);
        return;
    }

    if (heroKey === REFERENCE_HERO) {
        rememberReferenceMetrics(img, bounds);
    }

    let scale = computePortraitScale(bounds.height, img.naturalHeight, heroKey);
    const manifestMul = await getManifestPortraitScale(heroKey);
    scale *= manifestMul;

    applyPortraitLayoutScale(img, scale);
}

export function resetHeroBiographyPortraitScale(img) {
    if (!img) return;
    img.style.transform = '';
    img.style.transformOrigin = '';
    img.style.height = '';
    img.style.width = '';
    img.style.maxHeight = '';
    img.style.maxWidth = '';
    img.style.removeProperty('--hero-bio-portrait-scale');
}

export function clearHeroBiographyPortraitScaleCache() {
    referenceMetrics = null;
    manifestPortraitScales = null;
}
