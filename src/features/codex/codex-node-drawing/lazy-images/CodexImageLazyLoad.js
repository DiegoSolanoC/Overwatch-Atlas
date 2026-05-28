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
