/**
 * Equirectangular land mask (white = continent, black = ocean) aligned with MAP textures.
 * CPU sampling uses a downscaled single-channel buffer; GPU consumers share one capped texture.
 * @see src/assets/images/Maps/Utility/Alpha.png
 */

export const EARTH_LAND_MASK_URL = 'src/assets/images/Maps/Utility/Alpha.png';

/** Cap longest edge for CPU sampling + GPU upload (Alpha.png is ~8k×4k). */
export const EARTH_LAND_MASK_MAX_EDGE = 2048;

/** Smaller cap for CSS data-URL masks (keeps style sheets / element styles lean). */
export const EARTH_OCEAN_CSS_MASK_MAX_EDGE = 1024;

/** Red channel >= threshold counts as land (0–255). */
const DEFAULT_LAND_THRESHOLD = 96;

let _maskCache = null;
let _loadPromise = null;
/** @type {THREE.Texture|null} */
let _gpuTex = null;
/** @type {Promise<THREE.Texture>|null} */
let _gpuTexPromise = null;

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
                const srcW = img.naturalWidth || img.width;
                const srcH = img.naturalHeight || img.height;
                const longest = Math.max(srcW, srcH);
                const scale = longest > EARTH_LAND_MASK_MAX_EDGE
                    ? EARTH_LAND_MASK_MAX_EDGE / longest
                    : 1;
                const w = Math.max(1, Math.round(srcW * scale));
                const h = Math.max(1, Math.round(srcH * scale));
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) {
                    reject(new Error('EarthLandMask: no 2d context'));
                    return;
                }
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, w, h);
                const im = ctx.getImageData(0, 0, w, h);
                /* Keep RGBA layout for isLatLonOnLand (reads .r); data is already downscaled. */
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
 * Shared GPU land/ocean texture (downscaled, mipmapped). Safe to reuse across pattern / lights.
 * @param {THREE.TextureLoader} textureLoader
 * @param {THREE.WebGLRenderer} [renderer]
 * @returns {Promise<THREE.Texture>}
 */
export function loadEarthLandMaskTexture(textureLoader, renderer) {
    if (_gpuTex) return Promise.resolve(_gpuTex);
    if (_gpuTexPromise) return _gpuTexPromise;
    if (!textureLoader) {
        return Promise.reject(new Error('EarthLandMask: TextureLoader required'));
    }

    _gpuTexPromise = new Promise((resolve, reject) => {
        textureLoader.load(
            EARTH_LAND_MASK_URL,
            (tex) => {
                try {
                    const img = tex.image;
                    const srcW = (img && (img.width || img.naturalWidth)) || 0;
                    const srcH = (img && (img.height || img.naturalHeight)) || 0;
                    const longest = Math.max(srcW, srcH);
                    if (longest > EARTH_LAND_MASK_MAX_EDGE && srcW > 0 && srcH > 0) {
                        const scale = EARTH_LAND_MASK_MAX_EDGE / longest;
                        const nw = Math.max(1, Math.round(srcW * scale));
                        const nh = Math.max(1, Math.round(srcH * scale));
                        const canvas = document.createElement('canvas');
                        canvas.width = nw;
                        canvas.height = nh;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.imageSmoothingEnabled = true;
                            ctx.imageSmoothingQuality = 'high';
                            ctx.drawImage(img, 0, 0, nw, nh);
                            tex.image = canvas;
                        }
                    }
                    tex.wrapS = THREE.ClampToEdgeWrapping;
                    tex.wrapT = THREE.ClampToEdgeWrapping;
                    tex.generateMipmaps = true;
                    tex.minFilter = THREE.LinearMipmapLinearFilter;
                    tex.magFilter = THREE.LinearFilter;
                    tex.needsUpdate = true;
                    if (renderer && typeof renderer.initTexture === 'function') {
                        try { renderer.initTexture(tex); } catch (_) { /* ignore */ }
                    }
                    _gpuTex = tex;
                    resolve(tex);
                } catch (e) {
                    reject(e);
                }
            },
            undefined,
            (err) => reject(err || new Error(`EarthLandMask GPU: failed ${EARTH_LAND_MASK_URL}`))
        );
    });

    return _gpuTexPromise;
}

/** @type {string|null} data-URL of inverted Alpha (white = ocean) for CSS masks */
let _oceanMaskCssUrl = null;
/** @type {Promise<string>|null} */
let _oceanMaskCssPromise = null;

/**
 * Inverted land Alpha as a CSS mask URL (white = ocean, black = land).
 * Used by map-2d-lite pattern layers so undulation is clipped off continents.
 * @returns {Promise<string>}
 */
export function getOceanMaskCssUrl() {
    if (_oceanMaskCssUrl) return Promise.resolve(_oceanMaskCssUrl);
    if (_oceanMaskCssPromise) return _oceanMaskCssPromise;

    _oceanMaskCssPromise = loadEarthLandMask().then((mask) => {
        const longest = Math.max(mask.width, mask.height);
        const scale = longest > EARTH_OCEAN_CSS_MASK_MAX_EDGE
            ? EARTH_OCEAN_CSS_MASK_MAX_EDGE / longest
            : 1;
        const w = Math.max(1, Math.round(mask.width * scale));
        const h = Math.max(1, Math.round(mask.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('EarthLandMask: no 2d context for ocean CSS mask');

        /* Draw source then invert in place (white = ocean for CSS luminance masks). */
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = mask.width;
        srcCanvas.height = mask.height;
        const srcCtx = srcCanvas.getContext('2d');
        if (!srcCtx) throw new Error('EarthLandMask: no 2d context for ocean CSS source');
        const srcIm = srcCtx.createImageData(mask.width, mask.height);
        srcIm.data.set(mask.data);
        srcCtx.putImageData(srcIm, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(srcCanvas, 0, 0, w, h);
        const im = ctx.getImageData(0, 0, w, h);
        const thr = DEFAULT_LAND_THRESHOLD;
        for (let i = 0; i < im.data.length; i += 4) {
            const ocean = im.data[i] < thr ? 255 : 0;
            im.data[i] = ocean;
            im.data[i + 1] = ocean;
            im.data[i + 2] = ocean;
            im.data[i + 3] = 255;
        }
        ctx.putImageData(im, 0, 0);
        _oceanMaskCssUrl = canvas.toDataURL('image/png');
        return _oceanMaskCssUrl;
    });

    return _oceanMaskCssPromise;
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
