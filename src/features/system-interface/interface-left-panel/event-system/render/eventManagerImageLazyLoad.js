import { isLoadingAssetGifDebugForced } from '../../../../universal-features/atlas-ui/loadingGifAssets.js';

/**
 * Lazy-load preview images in the Event Manager list.
 *
 * Modern browsers: IntersectionObserver pinned to the scroll container (`eventsList`)
 * with a 200px top/bottom margin so images load just-before they scroll into view.
 * Threshold = 0.01 (effectively "any sliver visible").
 *
 * Old browsers without IntersectionObserver: immediate eager load (browser handles caching).
 *
 * Once the image's `data-src` is moved to `src`, `event-item-preview-image--loading` is
 * stripped from the wrapper so the spinner sibling fades out. Re-running the function
 * disconnects the previous observer so stale entries can't leak from a prior render.
 *
 * @param {{ _eventManagerImgObserver: IntersectionObserver|null }} renderService
 * @param {HTMLElement|null} eventsList
 */
function finishPreviewImageLoad(img, wrap) {
    if (isLoadingAssetGifDebugForced()) return;
    if (img.complete && img.naturalWidth > 0) {
        img.style.opacity = '1';
        wrap?.classList.remove('event-item-preview-image--loading');
    }
}

export function setupEventManagerImageLazyLoading(renderService, eventsList) {
    if (!eventsList) return;
    if (isLoadingAssetGifDebugForced()) return;

    const imgs = Array.from(eventsList.querySelectorAll('img[data-src]'));
    if (imgs.length === 0) return;

    if (!('IntersectionObserver' in window)) {
        imgs.forEach((img) => {
            if (img.dataset.src) {
                const wrap = img.closest('.event-item-preview-image');
                const src = img.dataset.src;
                wrap?.classList.add('event-item-preview-image--loading');
                img.style.opacity = '0';
                const done = () => finishPreviewImageLoad(img, wrap);
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
                img.src = src;
                delete img.dataset.src;
                if (img.complete) done();
            }
        });
        return;
    }

    if (renderService._eventManagerImgObserver) {
        renderService._eventManagerImgObserver.disconnect();
    }

    renderService._eventManagerImgObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const img = entry.target;
            const src = img.dataset ? img.dataset.src : null;
            if (src) {
                const wrap = img.closest('.event-item-preview-image');
                wrap?.classList.add('event-item-preview-image--loading');
                img.style.opacity = '0';
                const done = () => finishPreviewImageLoad(img, wrap);
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
                img.src = src;
                delete img.dataset.src;
                if (img.complete) done();
            }
            obs.unobserve(img);
        });
    }, {
        root: eventsList,
        rootMargin: '200px 0px',
        threshold: 0.01
    });

    imgs.forEach((img) => renderService._eventManagerImgObserver.observe(img));
}
