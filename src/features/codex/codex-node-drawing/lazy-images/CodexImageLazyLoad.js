/** Lazy-load Codex portrait images via IntersectionObserver (module-local singleton). */

/** @type {IntersectionObserver|null} */
let codexImageObserver = null;

function ensureCodexImageObserver() {
    if (codexImageObserver) return;
    codexImageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src && !img.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
                codexImageObserver.unobserve(img);
            }
        });
    }, {
        root: null,
        rootMargin: '100px',
        threshold: 0
    });
}

export function observeCodexImage(img) {
    ensureCodexImageObserver();
    if (codexImageObserver && img) {
        codexImageObserver.observe(img);
    }
}

export function disconnectCodexImageObserver() {
    if (codexImageObserver) {
        codexImageObserver.disconnect();
        codexImageObserver = null;
    }
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
    });
}
