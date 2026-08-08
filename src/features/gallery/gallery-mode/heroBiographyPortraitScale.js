/**
 * Gallery hero portrait scale — Dialogue Theater style.
 *
 * Theater keeps proportions consistent by using matching canvas files + one
 * uniform stage scale (no per-hero opaque-bbox "normalize to Ana"). Gallery
 * does the same: CSS stage scale only, with optional authored manifest
 * multipliers (`heroBioPortraitScales`) when a specific hero needs a nudge.
 */

import { fetchPlatformManifest } from './loadHeroBiosLooks.js';

/** @type {Record<string, number> | null} */
let manifestPortraitScales = null;

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
 * @param {HTMLImageElement} img
 * @param {number} scale
 */
function applyPortraitLayoutScale(img, scale) {
    const clamped = Number.isFinite(scale) && scale > 0 ? scale : 1;
    img.style.transform = '';
    img.style.transformOrigin = '';
    img.style.height = '';
    img.style.width = '';
    img.style.maxHeight = '';
    img.style.maxWidth = '';
    img.style.objectFit = '';
    img.style.objectPosition = '';
    img.style.setProperty('--hero-bio-portrait-scale', String(clamped));
}

/** No-op — reference preload was only needed for opaque-bbox normalization. */
export function preloadHeroBiographyPortraitReference() {}

/**
 * @param {HTMLImageElement} img
 * @param {string} heroFilterKey
 */
export async function applyHeroBiographyPortraitScale(img, heroFilterKey) {
    if (!img) return;
    const manifestMul = await getManifestPortraitScale(heroFilterKey);
    applyPortraitLayoutScale(img, manifestMul);
}

/**
 * @param {HTMLImageElement | null | undefined} img
 */
export function resetHeroBiographyPortraitScale(img) {
    if (!img) return;
    img.style.transform = '';
    img.style.transformOrigin = '';
    img.style.height = '';
    img.style.width = '';
    img.style.maxHeight = '';
    img.style.maxWidth = '';
    img.style.objectFit = '';
    img.style.objectPosition = '';
    img.style.setProperty('--hero-bio-portrait-scale', '1');
}

export function clearHeroBiographyPortraitScaleCache() {
    manifestPortraitScales = null;
}
