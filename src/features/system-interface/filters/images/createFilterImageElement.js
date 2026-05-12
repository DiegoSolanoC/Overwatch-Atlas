/**
 * Build the `<img>` for a filter chip with a two-stage retry policy:
 *   1. Initial load fails  -> re-fetch with a fresh cache buster after 300ms
 *      (asset may have been mid-deploy; the browser cached the 404 response).
 *   2. Retry still fails   -> rebuild the URL using `%20` instead of `+` for
 *      spaces (some hosts encode spaces inconsistently between filter chips
 *      and the originals on disk).
 *   3. Both retries fail   -> hide the `<img>` and tint the chip background
 *      red so a missing asset is visible at a glance during dev.
 */

import { FILTER_IMAGE_PATHS, generateCacheBuster } from './filterImagePaths.js';

const RETRY_DELAY_SHORT_MS = 300;

function buildRetryUrl(type, filterKey, folder, cacheBuster) {
    if (type === 'music') {
        const iconName = filterKey.replace(/\.(mp3|wav|ogg)$/i, '');
        return `${FILTER_IMAGE_PATHS.MUSIC}/${encodeURIComponent(iconName)}.png?v=${cacheBuster}`;
    }
    if (type === 'countries') {
        const raw = String(filterKey || '').startsWith('country:')
            ? String(filterKey).slice('country:'.length).trim()
            : String(filterKey || '').trim();
        const segs = raw.split('/').map(s => encodeURIComponent(s));
        return `${folder}/${segs.join('/')}?v=${cacheBuster}`;
    }
    /* heroes / npcs / factions all share the same encoded basename pattern. */
    return `${folder}/${encodeURIComponent(filterKey)}.png?v=${cacheBuster}`;
}

function buildAltEncodedUrl(type, filterKey, folder, cacheBuster) {
    if (type === 'music') {
        const iconName = filterKey.replace(/\.(mp3|wav|ogg)$/i, '');
        return `${FILTER_IMAGE_PATHS.MUSIC}/${iconName.replace(/\s+/g, '%20')}.png?v=${cacheBuster}`;
    }
    if (type === 'countries') {
        const raw = String(filterKey || '').startsWith('country:')
            ? String(filterKey).slice('country:'.length).trim()
            : String(filterKey || '').trim();
        const segs = raw.split('/').map(s => encodeURIComponent(s.replace(/\s+/g, '%20')));
        return `${folder}/${segs.join('/')}?v=${cacheBuster}`;
    }
    return `${folder}/${filterKey.replace(/\s+/g, '%20')}.png?v=${cacheBuster}`;
}

function onFinalImageLoadFailure(img, type, filterKey, folder) {
    const altUrl = buildAltEncodedUrl(type, filterKey, folder, generateCacheBuster());
    if (img.src !== altUrl) {
        img.src = altUrl;
        return;
    }
    /* Final fallback: hide the image but flag the chip with a red tint so a
       missing asset is visible at a glance during dev. */
    img.style.display = 'none';
    if (img.parentElement) {
        img.parentElement.style.background = 'rgba(255, 0, 0, 0.3)';
    }
}

function attachErrorRetry(img, type, filterKey, folder) {
    img.onerror = () => {
        setTimeout(() => {
            img.src = buildRetryUrl(type, filterKey, folder, generateCacheBuster());
        }, RETRY_DELAY_SHORT_MS);

        img.addEventListener('error', () => {
            onFinalImageLoadFailure(img, type, filterKey, folder);
        }, { once: true });
    };
}

export function createFilterImageElement(imagePath, type, filterKey, folder) {
    const img = new Image();
    img.src = `${imagePath}?v=${generateCacheBuster()}`;
    img.alt = filterKey;
    attachErrorRetry(img, type, filterKey, folder);
    return img;
}
