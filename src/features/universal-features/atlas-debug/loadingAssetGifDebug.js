/**
 * Dev toggle: use `loading asset.gif` everywhere and keep loading spinners visible
 * so you can tune the asset and spot slots that could adopt it.
 *
 * Localhost only. Persists in localStorage (`atlasDebugLoadingAssetGif`).
 */

import {
    LOADING_GIF_ASSET,
    LOADING_GIF_STANDARD,
    getOverlayLoadingGifSrc,
} from '../atlas-ui/loadingGifAssets.js';
import { setupEventManagerImageLazyLoading } from '../../system-interface/interface-left-panel/event-system/render/eventManagerImageLazyLoad.js';

const STORAGE_KEY = 'atlasDebugLoadingAssetGif';
const BODY_CLASS = 'debug-loading-asset-gif';
const FORCED_CLASS = 'debug-loading-gif-forced';
const BTN_ID = 'loadingAssetGifDebugToggle';
const LEGEND_ID = 'loadingAssetGifDebugLegend';
const LAZY_IMG_PLACEHOLDER =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

let domObserver = null;

function isLocalDevHost() {
    if (typeof window === 'undefined') return false;
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '';
}

export function isLoadingAssetGifDebugEnabled() {
    return typeof document !== 'undefined' && document.body.classList.contains(BODY_CLASS);
}

function readStoredEnabled() {
    try {
        return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (_) {
        return false;
    }
}

function persistEnabled(on) {
    try {
        localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    } catch (_) {}
}

/** @param {HTMLImageElement} img */
function isStandardLoadingGifImg(img) {
    const src = String(img.getAttribute('src') || img.src || '');
    return src.includes('loading.gif') && !src.includes('loading%20asset') && !src.includes('loading asset');
}

/** @param {HTMLImageElement} img */
function setImgSrc(img, src) {
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
}

function syncOverlayLoadingImages() {
    const src = getOverlayLoadingGifSrc();
    document.querySelectorAll('img.loading-gif, #loadingGif').forEach((img) => {
        if (!(img instanceof HTMLImageElement)) return;
        if (isLoadingAssetGifDebugEnabled()) {
            setImgSrc(img, LOADING_GIF_ASSET);
        } else if (isStandardLoadingGifImg(img) || img.id === 'loadingGif') {
            setImgSrc(img, LOADING_GIF_STANDARD);
        }
    });
}

function syncEventListSpinners() {
    document.querySelectorAll('img.event-item-preview-image__spinner').forEach((img) => {
        setImgSrc(img, LOADING_GIF_ASSET);
    });
}

/** Re-arm list previews (including already-loaded thumbs) for debug visibility. */
function prepareEventListForDebugPreview() {
    document.querySelectorAll('#eventsList .event-item-preview-image__photo').forEach((photo) => {
        if (!(photo instanceof HTMLImageElement)) return;
        const wrap = photo.closest('.event-item-preview-image');
        if (!wrap) return;
        wrap.classList.add('event-item-preview-image--loading', FORCED_CLASS);
        photo.style.opacity = '0';
        if (!photo.dataset.src && photo.src && !photo.src.startsWith('data:')) {
            photo.dataset.src = photo.src;
            photo.src = LAZY_IMG_PLACEHOLDER;
        }
    });
    syncEventListSpinners();
}

function releaseEventListFromDebugPreview() {
    document.querySelectorAll('#eventsList .event-item-preview-image').forEach((wrap) => {
        if (!(wrap instanceof HTMLElement) || !wrap.classList.contains(FORCED_CLASS)) return;
        wrap.classList.remove(FORCED_CLASS);
        const photo = wrap.querySelector('.event-item-preview-image__photo');
        if (!(photo instanceof HTMLImageElement)) {
            wrap.classList.remove('event-item-preview-image--loading');
            return;
        }
        const pending = photo.dataset?.src;
        if (pending) {
            photo.src = pending;
            delete photo.dataset.src;
            photo.style.opacity = '0';
            wrap.classList.add('event-item-preview-image--loading');
            if (photo.complete && photo.naturalWidth > 0) {
                photo.style.opacity = '1';
                wrap.classList.remove('event-item-preview-image--loading');
            }
            return;
        }
        if (photo.src && !photo.src.startsWith('data:')) {
            photo.style.opacity = '1';
            wrap.classList.remove('event-item-preview-image--loading');
        }
    });
}

function forceEventListLoadingStates(on) {
    if (on) {
        prepareEventListForDebugPreview();
        return;
    }
    releaseEventListFromDebugPreview();
}

function markHubTileFiguresForDebug(on) {
    const figures = document.querySelectorAll(
        '.story-archive-category-hub__figure, .main-menu-image-container',
    );
    figures.forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        el.classList.toggle('atlas-loading-asset-gif-slot', on);
        el.classList.toggle(FORCED_CLASS, on);
    });
}

function forcePaginationThumbLoadingStates(on) {
    const wraps = document.querySelectorAll(
        '.event-number-buttons .event-number-btn__img-wrap:not(.event-number-btn__img-wrap--empty)',
    );
    wraps.forEach((wrap) => {
        if (!(wrap instanceof HTMLElement)) return;
        if (on) {
            wrap.classList.add('event-number-btn__img-wrap--loading', FORCED_CLASS);
        } else if (wrap.classList.contains(FORCED_CLASS)) {
            wrap.classList.remove('event-number-btn__img-wrap--loading', FORCED_CLASS);
        }
    });
}

function countDebugTargets() {
    return {
        overlayGifs: document.querySelectorAll('img.loading-gif, #loadingGif').length,
        eventSpinners: document.querySelectorAll('#eventsList .event-item-preview-image__spinner').length,
        eventThumbs: document.querySelectorAll(
            '#eventsList .event-item-preview-image:has(.event-item-preview-image__photo)',
        ).length,
        paginationThumbs: document.querySelectorAll(
            '.event-number-buttons .event-number-btn__img-wrap:not(.event-number-btn__img-wrap--empty)',
        ).length,
        inlineLoaders: document.querySelectorAll(
            '#globe-inline-loader img.loading-gif, #codex-entry-inline-loader img.loading-gif',
        ).length,
        mainMenuTiles: document.querySelectorAll('.main-menu-image-container').length,
        categoryHubTiles: document.querySelectorAll('.story-archive-category-hub__figure').length,
    };
}

function updateLegend() {
    const el = document.getElementById(LEGEND_ID);
    if (!el || !isLoadingAssetGifDebugEnabled()) return;
    const c = countDebugTargets();
    el.innerHTML = [
        '<strong>Loading asset.gif (debug)</strong>',
        `<span>Boot / inline GIF: ${c.overlayGifs + c.inlineLoaders}</span>`,
        `<span>Data Archive list: ${c.eventThumbs} (${c.eventSpinners} spinners)</span>`,
        `<span>Pagination dock: ${c.paginationThumbs}</span>`,
        `<span>Main menu: ${c.mainMenuTiles} · Category hubs: ${c.categoryHubTiles}</span>`,
        '<span class="loading-asset-gif-debug-legend__hint">Open main menu, Choose view, Data Archive categories, and an archive list.</span>',
    ].join('');
}

export function applyLoadingAssetGifDebug() {
    if (!isLoadingAssetGifDebugEnabled()) return;
    syncOverlayLoadingImages();
    forceEventListLoadingStates(true);
    forcePaginationThumbLoadingStates(true);
    markHubTileFiguresForDebug(true);
    updateLegend();
}

export function clearLoadingAssetGifDebug() {
    syncOverlayLoadingImages();
    forceEventListLoadingStates(false);
    forcePaginationThumbLoadingStates(false);
    markHubTileFiguresForDebug(false);
    document.getElementById(LEGEND_ID)?.remove();
    const list = document.getElementById('eventsList');
    const rs = typeof window !== 'undefined' ? window.EventRenderService : null;
    if (list && rs) {
        setupEventManagerImageLazyLoading(rs, list);
    }
}

export function setLoadingAssetGifDebug(enabled) {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle(BODY_CLASS, enabled);
    persistEnabled(enabled);
    const btn = document.getElementById(BTN_ID);
    if (btn) {
        btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        btn.classList.toggle('loading-asset-gif-debug-toggle--on', enabled);
        btn.textContent = enabled ? 'Loading GIF: asset (on)' : 'Loading GIF: asset (off)';
    }
    if (enabled) {
        ensureLegend();
        applyLoadingAssetGifDebug();
        startDomObserver();
    } else {
        clearLoadingAssetGifDebug();
        stopDomObserver();
    }
}

function ensureLegend() {
    let el = document.getElementById(LEGEND_ID);
    if (!el) {
        el = document.createElement('div');
        el.id = LEGEND_ID;
        el.className = 'loading-asset-gif-debug-legend';
        el.setAttribute('role', 'status');
        document.body.appendChild(el);
    }
    updateLegend();
}

function startDomObserver() {
    if (domObserver || typeof MutationObserver === 'undefined') return;
    domObserver = new MutationObserver(() => {
        if (!isLoadingAssetGifDebugEnabled()) return;
        applyLoadingAssetGifDebug();
    });
    const opts = { childList: true, subtree: true };
    const roots = [
        document.getElementById('eventsList'),
        document.getElementById('eventsManagePanel'),
        document.getElementById('storyViewerContainer'),
        document.getElementById('testContainer'),
        document.getElementById('paginationDock'),
        document.getElementById('globe-container'),
        document.getElementById('loadingOverlay'),
        document.getElementById('content'),
    ].filter(Boolean);
    if (roots.length) roots.forEach((r) => domObserver.observe(r, opts));
    else domObserver.observe(document.body, opts);
}

function stopDomObserver() {
    domObserver?.disconnect();
    domObserver = null;
}

function mountToggleButton() {
    if (!isLocalDevHost() || document.getElementById(BTN_ID)) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = BTN_ID;
    btn.className = 'loading-asset-gif-debug-toggle';
    btn.title = 'Show loading asset.gif in all loading slots (localhost debug)';
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = 'Loading GIF: asset (off)';
    btn.addEventListener('click', () => {
        setLoadingAssetGifDebug(!isLoadingAssetGifDebugEnabled());
    });
    document.body.appendChild(btn);
}

export function initLoadingAssetGifDebug() {
    if (!isLocalDevHost()) return;
    mountToggleButton();
    if (readStoredEnabled()) setLoadingAssetGifDebug(true);
}

if (typeof window !== 'undefined') {
    window.AtlasLoadingGifDebug = {
        init: initLoadingAssetGifDebug,
        isEnabled: isLoadingAssetGifDebugEnabled,
        setEnabled: setLoadingAssetGifDebug,
        apply: applyLoadingAssetGifDebug,
        LOADING_GIF_ASSET,
        LOADING_GIF_STANDARD,
    };
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLoadingAssetGifDebug);
    } else {
        initLoadingAssetGifDebug();
    }
}
