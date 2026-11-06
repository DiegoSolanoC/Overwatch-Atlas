/** Lazy-load Codex portrait images via IntersectionObserver (module-local singleton). */

/** @type {IntersectionObserver|null} */
let codexImageObserver = null;

/** When true, intersecting images queue until resume (avoids decode storms mid-pan). */
let codexImagesPaused = false;

/** @type {Set<Element>} */
const pendingHydrateImgs = new Set();

function ensureCodexImageObserver() {
    if (codexImageObserver) return;
    codexImageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const img = entry.target;
            if (!(img instanceof HTMLImageElement)) return;
            if (codexImagesPaused) {
                pendingHydrateImgs.add(img);
                return;
            }
            hydrateCodexImageNow(img);
        });
    }, {
        root: null,
        rootMargin: '100px',
        threshold: 0
    });
}

/**
 * @param {HTMLImageElement} img
 */
function hydrateCodexImageNow(img) {
    if (!img) return;
    pendingHydrateImgs.delete(img);
    if (img.dataset.src && !img.src) {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
    }
    codexImageObserver?.unobserve(img);
}

export function observeCodexImage(img) {
    ensureCodexImageObserver();
    if (codexImageObserver && img) {
        codexImageObserver.observe(img);
    }
}

/** Pause assigning img.src while the board is mid-gesture (pan/zoom). */
export function pauseCodexImageHydration() {
    codexImagesPaused = true;
}

/** Flush queued intersections after the gesture settles. */
export function resumeCodexImageHydration() {
    codexImagesPaused = false;
    if (!pendingHydrateImgs.size) return;
    const queued = [...pendingHydrateImgs];
    pendingHydrateImgs.clear();
    for (const img of queued) {
        if (img instanceof HTMLImageElement) hydrateCodexImageNow(img);
    }
}

export function disconnectCodexImageObserver() {
    if (codexImageObserver) {
        codexImageObserver.disconnect();
        codexImageObserver = null;
    }
    pendingHydrateImgs.clear();
    codexImagesPaused = false;
}

/**
 * Eagerly decode portraits currently in (or near) the viewport so the first
 * paint after load is not empty hexes waiting on IntersectionObserver.
 * @param {ParentNode|null} root
 */
export function hydrateCodexPortraitImagesInViewport(root) {
    if (!root) return;
    const vv = window.visualViewport;
    const margin = 160;
    const top = (vv?.offsetTop ?? 0) - margin;
    const left = (vv?.offsetLeft ?? 0) - margin;
    const right = left + (vv?.width ?? window.innerWidth) + margin * 2;
    const bottom = top + (vv?.height ?? window.innerHeight) + margin * 2;

    root.querySelectorAll('img[data-src]').forEach((img) => {
        if (!(img instanceof HTMLImageElement) || img.src) return;
        const r = img.getBoundingClientRect();
        if (r.bottom < top || r.top > bottom || r.right < left || r.left > right) return;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        if (codexImageObserver) codexImageObserver.unobserve(img);
        pendingHydrateImgs.delete(img);
    });
}

/**
 * View-mode static board: assign every pending portrait src so pan never reveals empty hexes.
 * Chunked across frames to avoid a single long decode hitch.
 * @param {ParentNode|null} root
 * @param {{ chunkSize?: number }} [opts]
 * @returns {Promise<void>}
 */
export async function hydrateAllCodexPortraitImages(root, opts = {}) {
    if (!root) return;
    const chunkSize = Math.max(8, opts.chunkSize || 48);
    const imgs = [...root.querySelectorAll('img[data-src]')].filter(
        (img) => img instanceof HTMLImageElement && !img.src,
    );
    for (let i = 0; i < imgs.length; i += chunkSize) {
        const slice = imgs.slice(i, i + chunkSize);
        for (const img of slice) {
            if (!(img instanceof HTMLImageElement) || !img.dataset.src) continue;
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            codexImageObserver?.unobserve(img);
            pendingHydrateImgs.delete(img);
        }
        if (i + chunkSize < imgs.length) {
            await new Promise((r) => requestAnimationFrame(r));
        }
    }
}
