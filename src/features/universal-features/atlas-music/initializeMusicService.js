/**
 * initializeMusicService — boot-time wrapper that calls `window.MusicManager.init()`
 * with status-line messages and an error fallback.
 *
 * Two passes are run from `MusicLoaders.loadMusic`:
 *   1. `immediate=true` right after the music DOM mounts (fast happy path).
 *   2. `immediate=false, delay=50` as a defensive re-init in case any sibling
 *      service module hadn't finished evaluating on the first pass.
 *
 * The second call is a cheap no-op when init already succeeded — `MusicService.init()`
 * short-circuits when `initialized && musicButton && musicPanel` are all set.
 */

import { updateStatus } from '../atlas-mode-runtime/statusFeed.js';

/**
 * @param {boolean} immediate - If true, init synchronously; if false, delay via setTimeout.
 * @param {number} delay - Milliseconds for the delayed pass (default 50ms).
 */
export function initializeMusicService(immediate = false, delay = 50) {
    const initFunction = () => {
        if (window.MusicManager && typeof window.MusicManager.init === 'function') {
            updateStatus('Initializing MusicService...', 'info');
            window.MusicManager.init();
            updateStatus('✓ MusicService initialized', 'success');
        } else if (immediate) {
            console.warn('MusicService not available after loading music components');
        } else {
            console.error('MusicService not available:', { hasGlobal: !!window.MusicManager });
            updateStatus('⚠ MusicService not found — music panel may not work', 'error');
        }
    };

    if (immediate) {
        initFunction();
    } else {
        updateStatus('Initializing music panel...', 'info');
        setTimeout(initFunction, delay);
    }
}
