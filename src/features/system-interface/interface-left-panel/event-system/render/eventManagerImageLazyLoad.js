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
    if (img.complete && img.naturalWidth > 0) {
        img.style.opacity = '1';
        wrap?.classList.remove('event-item-preview-image--loading');
    }
}

/**
 * @param {HTMLImageElement} img
 */
function loadPreviewImageFromDataset(img) {
    const src = img.dataset?.src;
    if (!src) return;

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

/**
 * Eager-load lazy preview images currently visible in `root`.
 * Needed when the scroll root was `display:none`, or when cards move via CSS
 * transform (timeline pan) — IntersectionObserver does not re-fire for transforms.
 *
 * @param {HTMLElement | null} root
 * @param {number} [marginPx]
 */
export function flushVisibleLazyPreviewImages(root, marginPx = 200) {
    if (!root) return;
    root.querySelectorAll('img[data-src]').forEach((img) => {
        const rect = img.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        const rootRect = root.getBoundingClientRect();
        const visible = rect.bottom >= rootRect.top - marginPx
            && rect.top <= rootRect.bottom + marginPx
            && rect.right >= rootRect.left
            && rect.left <= rootRect.right;
        if (visible) {
            loadPreviewImageFromDataset(img);
        }
    });
}

/**
 * Re-bind lazy loading for story archive list or timeline after a view switch.
 */
export function resyncStoryArchivePreviewImages() {
    const renderService = typeof window !== 'undefined' ? window.EventRenderService : null;
    const panel = document.getElementById('eventsManagePanel');
    if (!renderService || !panel?.classList.contains('story-viewer-panel-embedded')) return;

    const isTimeline = panel.classList.contains('story-viewer-panel-embedded--timeline-view');
    const root = isTimeline
        ? document.querySelector('.story-timeline-view__viewport')
        : document.getElementById('eventsList');
    if (!root) return;

    setupEventManagerImageLazyLoading(renderService, root);
}

export function setupEventManagerImageLazyLoading(renderService, eventsList) {
    if (!eventsList) return;

    const imgs = Array.from(eventsList.querySelectorAll('img[data-src]'));
    if (imgs.length === 0) return;

    if (!('IntersectionObserver' in window)) {
        imgs.forEach((img) => {
            if (img.dataset.src) {
                loadPreviewImageFromDataset(img);
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
            if (img.dataset?.src) {
                loadPreviewImageFromDataset(img);
            }
            obs.unobserve(img);
        });
    }, {
        root: eventsList,
        rootMargin: '200px 0px',
        threshold: 0.01
    });

    imgs.forEach((img) => renderService._eventManagerImgObserver.observe(img));

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            flushVisibleLazyPreviewImages(eventsList, 200);
        });
    });
}
