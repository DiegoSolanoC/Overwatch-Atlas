/**
 * Black slot + `loading asset.gif` while `<img>` previews load (main menu, hubs, dock thumbs).
 */

import { resolveOptimizedAssetUrl } from '../atlas-assets/imageAssetMap.js';

const LOADING_CLASS = {
    menu: 'main-menu-image-container--loading',
    hub: 'story-archive-category-hub__figure--loading',
    dock: 'event-number-btn__img-wrap--loading',
};

/** @param {HTMLElement} el */
function slotKind(el) {
    if (el.classList.contains('event-number-btn__img-wrap')) return 'dock';
    if (el.classList.contains('main-menu-image-container')) return 'menu';
    if (el.classList.contains('story-archive-category-hub__figure')) return 'hub';
    return null;
}

/**
 * @param {HTMLImageElement} img
 * @param {HTMLElement} [wrap]
 * @returns {HTMLElement|null}
 */
export function resolveLoadingAssetSlot(img, wrap) {
    if (wrap instanceof HTMLElement && slotKind(wrap)) return wrap;
    if (!img) return null;
    return (
        img.closest('.event-number-btn__img-wrap')
        || img.closest('.main-menu-image-container')
        || img.closest('.story-archive-category-hub__figure')
    );
}

/**
 * @param {HTMLElement} slot
 * @param {HTMLImageElement} img
 */
export function beginLoadingAssetSlot(slot, img) {
    if (!(slot instanceof HTMLElement) || !(img instanceof HTMLImageElement)) return;
    const kind = slotKind(slot);
    if (!kind) return;
    if (kind === 'dock') {
        slot.classList.remove('event-number-btn__img-wrap--empty');
    }
    slot.classList.add(LOADING_CLASS[kind]);
    img.style.opacity = '0';
}

/**
 * @param {HTMLElement} slot
 * @param {HTMLImageElement} img
 */
export function endLoadingAssetSlot(slot, img) {
    if (!(slot instanceof HTMLElement) || !(img instanceof HTMLImageElement)) return;
    const kind = slotKind(slot);
    if (!kind) return;
    slot.classList.remove(LOADING_CLASS[kind]);
    img.style.opacity = '';
}

/**
 * @param {HTMLImageElement} img
 * @param {'menu'|'hub'|'dock'|null} kind
 */
function applySlotFetchPriority(img, kind) {
    if (!(img instanceof HTMLImageElement)) return;
    try {
        if (kind === 'menu') {
            img.loading = 'eager';
            img.fetchPriority = 'high';
            img.decoding = 'async';
            return;
        }
        if (kind === 'dock') {
            // Visible page thumbs — after menu tiles, still ahead of lazy filter grids.
            img.loading = 'eager';
            if (!img.fetchPriority || img.fetchPriority === 'low') {
                img.fetchPriority = 'auto';
            }
            img.decoding = 'async';
        }
    } catch (_) { /* older WebViews */ }
}

/**
 * Assign `src` and show the loading asset until the image loads (or errors).
 * Hides the previous frame immediately so dock page turns do not flash stale art.
 *
 * @param {HTMLImageElement|null} img
 * @param {string|null|undefined} src
 * @param {{ wrap?: HTMLElement }} [options]
 */
export function setLoadingAssetImageSrc(img, src, options = {}) {
    if (!(img instanceof HTMLImageElement)) return;
    const slot = resolveLoadingAssetSlot(img, options.wrap);
    const kind = slot ? slotKind(slot) : null;
    const raw = src != null ? String(src).trim() : '';
    const url = raw ? resolveOptimizedAssetUrl(raw) : '';

    if (!url) {
        if (slot && kind === 'dock') {
            slot.classList.add('event-number-btn__img-wrap--empty');
            slot.classList.remove(LOADING_CLASS.dock);
        }
        img.removeAttribute('src');
        img.style.display = 'none';
        img.style.opacity = '';
        return;
    }

    applySlotFetchPriority(img, kind);

    if (!slot) {
        img.src = url;
        img.style.display = '';
        return;
    }

    beginLoadingAssetSlot(slot, img);
    img.style.display = '';

    const finish = () => {
        if (img.naturalWidth > 0) {
            endLoadingAssetSlot(slot, img);
        }
    };

    img.addEventListener('load', finish, { once: true });
    img.addEventListener('error', finish, { once: true });

    // Skip cancel/restart when the resolved URL is already current.
    const current = img.currentSrc || img.getAttribute('src') || '';
    if (current === url && img.complete && img.naturalWidth > 0) {
        finish();
        return;
    }

    img.removeAttribute('src');
    applySlotFetchPriority(img, kind);
    img.src = url;

    if (img.complete) finish();
}

/**
 * Wire an image that already has `src` in the markup (e.g. main menu on first paint).
 *
 * @param {HTMLImageElement|null} img
 * @param {{ wrap?: HTMLElement }} [options]
 */
export function wireLoadingAssetImage(img, options = {}) {
    if (!(img instanceof HTMLImageElement)) return;
    const src = img.getAttribute('src');
    if (!src) return;
    setLoadingAssetImageSrc(img, src, options);
}
