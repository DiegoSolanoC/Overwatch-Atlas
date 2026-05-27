/**
 * Equirectangular land mask (white = continent, black = ocean) aligned with MAP textures.
 * @see src/assets/images/Maps/Utility/Alpha.png
 */

export const EARTH_LAND_MASK_URL = 'src/assets/images/Maps/Utility/Alpha.png';

/** Red channel >= threshold counts as land (0–255). */
const DEFAULT_LAND_THRESHOLD = 96;

let _maskCache = null;
let _loadPromise = null;

/**
 * @returns {Promise<{ width: number, height: number, data: Uint8ClampedArray }>}
 */
export function loadEarthLandMask() {
    if (_maskCache) return Promise.resolve(_maskCache);
    if (_loadPromise) return _loadPromise;

    _loadPromise = new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
            try {
                const w = img.naturalWidth || img.width;
                const h = img.naturalHeight || img.height;
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) {
                    reject(new Error('EarthLandMask: no 2d context'));
                    return;
                }
                ctx.drawImage(img, 0, 0);
                const im = ctx.getImageData(0, 0, w, h);
                _maskCache = { width: im.width, height: im.height, data: im.data };
                resolve(_maskCache);
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = () => reject(new Error(`EarthLandMask: failed to load ${EARTH_LAND_MASK_URL}`));
        img.src = EARTH_LAND_MASK_URL;
    });

    return _loadPromise;
}

/**
 * @param {{ width: number, height: number, data: Uint8ClampedArray }} mask
 * @param {number} lat
 * @param {number} lon
 * @param {number} [threshold]
 */
export function isLatLonOnLand(mask, lat, lon, threshold = DEFAULT_LAND_THRESHOLD) {
    if (!mask || !mask.data) return true;

    let u = (lon + 180) / 360;
    u = ((u % 1) + 1) % 1;
    let v = (90 - lat) / 180;
    v = Math.max(0, Math.min(1, v));

    const x = Math.min(mask.width - 1, Math.max(0, Math.floor(u * mask.width)));
    const y = Math.min(mask.height - 1, Math.max(0, Math.floor(v * mask.height)));
    const i = (y * mask.width + x) * 4;
    const r = mask.data[i];
    return r >= threshold;
}
