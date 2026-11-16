/**
 * Shared hex chrome (frames / masks / alphas) — only 3 variants each.
 * Warm them once so remounted nodes show a real hex shell immediately.
 */

import { CODEX_FRAME_PATH, CODEX_NODE_ALPHA_PATH } from './CodexNodePortraitMetrics.js';
import { LOADING_GIF_ASSET } from '../../../universal-features/atlas-ui/loadingGifAssets.js';

const CODEX_MASK_PATH = 'src/assets/images/Codex/Mask%20Node';

/** @type {Promise<void>|null} */
let chromeWarmPromise = null;

function warmImage(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = src;
    });
}

/**
 * Preload Node1–3 frames, masks, alpha masks, and the portrait loading GIF.
 * Safe to call repeatedly; returns the same in-flight promise.
 * @returns {Promise<void>}
 */
export function preloadCodexNodeChromeAssets() {
    if (chromeWarmPromise) return chromeWarmPromise;
    const urls = [LOADING_GIF_ASSET];
    for (let v = 1; v <= 3; v += 1) {
        urls.push(`${CODEX_FRAME_PATH}${v}.png`);
        urls.push(`${CODEX_MASK_PATH}${v}.png`);
        urls.push(`${CODEX_NODE_ALPHA_PATH}${v}.png`);
    }
    chromeWarmPromise = Promise.all(urls.map(warmImage)).then(() => undefined);
    return chromeWarmPromise;
}
