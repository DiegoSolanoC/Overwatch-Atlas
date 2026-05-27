/**
 * Black slot + `loading asset.gif` while `<img>` previews load (main menu, hubs, dock thumbs).
 */

import { isLoadingAssetGifDebugForced } from './loadingGifAssets.js';

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
    if (isLoadingAssetGifDebugForced()) return;
    const kind = slotKind(slot);
    if (!kind) return;
    slot.classList.remove(LOADING_CLASS[kind]);
    img.style.opacity = '';
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
    const url = src != null ? String(src).trim() : '';

    if (!url) {
        if (slot && slotKind(slot) === 'dock') {
            slot.classList.add('event-number-btn__img-wrap--empty');
            slot.classList.remove(LOADING_CLASS.dock);
        }
        img.removeAttribute('src');
        img.style.display = 'none';
        img.style.opacity = '';
        return;
    }

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

    img.removeAttribute('src');
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
