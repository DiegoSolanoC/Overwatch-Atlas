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
import { buildFactionFilterImagePath } from './factionImagePaths.js';
import {
    getImageAssetVersion,
    resolveOptimizedAssetUrl,
} from '../../../universal-features/atlas-assets/imageAssetMap.js';

function versionForPath(imagePath) {
    return getImageAssetVersion(imagePath) || generateCacheBuster();
}

function withAssetVersion(imagePath) {
    const optimized = resolveOptimizedAssetUrl(imagePath);
    if (optimized && optimized !== imagePath && optimized.includes('?v=')) return optimized;
    return `${imagePath}?v=${versionForPath(imagePath)}`;
}

const RETRY_DELAY_SHORT_MS = 300;

function buildRetryUrl(type, filterKey, folder) {
    if (type === 'music') {
        const iconName = filterKey.replace(/\.(mp3|wav|ogg)$/i, '');
        return withAssetVersion(
            `${FILTER_IMAGE_PATHS.MUSIC}/${encodeURIComponent(iconName)}.png`,
        );
    }
    if (type === 'countries') {
        const raw = String(filterKey || '').startsWith('country:')
            ? String(filterKey).slice('country:'.length).trim()
            : String(filterKey || '').trim();
        const segs = raw.split('/').map(s => encodeURIComponent(s));
        return withAssetVersion(`${folder}/${segs.join('/')}`);
    }
    if (type === 'factions') {
        const pathItem = { filename: filterKey };
        return withAssetVersion(buildFactionFilterImagePath(pathItem, folder));
    }
    /* heroes / npcs — force PNG fallback (no webp) after a failed webp attempt */
    return resolveOptimizedAssetUrl(
        `${folder}/${encodeURIComponent(filterKey)}.png`,
        { preferWebp: false },
    );
}

function buildAltEncodedUrl(type, filterKey, folder) {
    if (type === 'music') {
        const iconName = filterKey.replace(/\.(mp3|wav|ogg)$/i, '');
        return withAssetVersion(
            `${FILTER_IMAGE_PATHS.MUSIC}/${iconName.replace(/\s+/g, '%20')}.png`,
        );
    }
    if (type === 'countries') {
        const raw = String(filterKey || '').startsWith('country:')
            ? String(filterKey).slice('country:'.length).trim()
            : String(filterKey || '').trim();
        const segs = raw.split('/').map(s => encodeURIComponent(s.replace(/\s+/g, '%20')));
        return withAssetVersion(`${folder}/${segs.join('/')}`);
    }
    if (type === 'factions') {
        const pathItem = { filename: filterKey };
        return withAssetVersion(buildFactionFilterImagePath(pathItem, folder));
    }
    return resolveOptimizedAssetUrl(
        `${folder}/${filterKey.replace(/\s+/g, '%20')}.png`,
        { preferWebp: false },
    );
}

function onFinalImageLoadFailure(img, type, filterKey, folder) {
    const altUrl = buildAltEncodedUrl(type, filterKey, folder);
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
            img.src = buildRetryUrl(type, filterKey, folder);
        }, RETRY_DELAY_SHORT_MS);

        img.addEventListener('error', () => {
            onFinalImageLoadFailure(img, type, filterKey, folder);
        }, { once: true });
    };
}

export function createFilterImageElement(imagePath, type, filterKey, folder) {
    const img = new Image();
    img.src = withAssetVersion(imagePath);
    img.alt = filterKey;
    attachErrorRetry(img, type, filterKey, folder);
    return img;
}
