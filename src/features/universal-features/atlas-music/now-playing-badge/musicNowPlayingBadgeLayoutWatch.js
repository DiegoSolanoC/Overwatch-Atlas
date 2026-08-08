/**
 * Resize / scroll observers so the passive badge stays aligned under the right
 * header hub. Horizontal position is viewport-fixed (not panel-driven).
 */

import { BADGE_VISIBLE_CLASS } from './musicNowPlayingBadgeCssClasses.js';

/**
 * @param {{
 *   getBadge: () => HTMLElement|null,
 *   isEventImageOverlayOpen: () => boolean,
 *   reposition: () => void,
 *   onOverlayBlocksBadge: () => void,
 * }} ctx
 * @returns {() => void} cleanup
 */
export function startNowPlayingBadgeLayoutWatch(ctx) {
    const { getBadge, isEventImageOverlayOpen, reposition, onOverlayBlocksBadge } = ctx;

    let pending = null;
    const schedule = () => {
        if (pending != null) return;
        pending = requestAnimationFrame(() => {
            pending = null;
            const badge = getBadge();
            if (!badge || !badge.classList.contains(BADGE_VISIBLE_CLASS)) return;
            if (isEventImageOverlayOpen()) {
                onOverlayBlocksBadge();
                return;
            }
            reposition();
        });
    };

    const onViewport = () => schedule();
    window.addEventListener('resize', onViewport);
    window.addEventListener('scroll', onViewport, true);

    return () => {
        window.removeEventListener('resize', onViewport);
        window.removeEventListener('scroll', onViewport, true);
        if (pending != null) {
            cancelAnimationFrame(pending);
            pending = null;
        }
    };
}
