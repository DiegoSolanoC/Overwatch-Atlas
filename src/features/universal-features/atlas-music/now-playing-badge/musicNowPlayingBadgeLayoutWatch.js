/**
 * Resize / scroll / layout MutationObservers so the passive badge stays
 * aligned when panels open, the layout shifts, or the viewport changes.
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

    const observerTargets = [
        document.getElementById('filtersPanel'),
        document.getElementById('eventSlide'),
        document.getElementById('eventsManagePanel'),
        document.querySelector('.layout-container'),
    ].filter(Boolean);

    let mo = null;
    if (typeof MutationObserver !== 'undefined' && observerTargets.length > 0) {
        mo = new MutationObserver(schedule);
        observerTargets.forEach((el) => mo.observe(el, { attributes: true, attributeFilter: ['class', 'style'] }));
    }

    return () => {
        window.removeEventListener('resize', onViewport);
        window.removeEventListener('scroll', onViewport, true);
        if (mo) mo.disconnect();
        if (pending != null) {
            cancelAnimationFrame(pending);
            pending = null;
        }
    };
}
