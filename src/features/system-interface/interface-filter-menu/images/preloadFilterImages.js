/**
 * Preload filter thumbnails in small batches when a tab becomes active, so
 * switching to e.g. "Factions" later doesn't pay a fresh round-trip per chip.
 *
 * Why batches? A flat `forEach` over hundreds of items would fire all
 * requests at once and starve the main image loader (and saturate dev-server
 * connection limits). Batches of 5 spread the load across ~100ms ticks.
 *
 * On a single-image fetch failure we retry once after `RETRY_DELAY_MS` with a
 * fresh cache buster. After that we give up — the chip will retry on display
 * via `createFilterImageElement`.
 */

import { buildFilterImagePath, generateCacheBuster } from './filterImagePaths.js';

const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES_MS = 100;
const RETRY_DELAY_MS = 500;

export function preloadFilterImages(items, type, folder) {
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        setTimeout(() => {
            batch.forEach(item => {
                const imagePath = buildFilterImagePath(item, type, folder);
                const img = new Image();
                img.src = `${imagePath}?v=${generateCacheBuster()}`;
                img.onerror = function () {
                    setTimeout(() => {
                        this.src = `${imagePath}?v=${generateCacheBuster()}`;
                    }, RETRY_DELAY_MS);
                };
            });
        }, (i / BATCH_SIZE) * DELAY_BETWEEN_BATCHES_MS);
    }
}
