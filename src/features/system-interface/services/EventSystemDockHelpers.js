/**
 * Event-system dock helpers — small DOM/animation utilities used while
 * mounting and tearing down the heavy "Event System Load Out" UI.
 *
 *   - teardownMenuHelpersEventSystemLayout(): remove the resize/orientation
 *     listeners stored on `window.__menuHelpersEventSystemLayout`, then
 *     null the slot.
 *   - sweepEventSystemDockOrphans(): scrub stale dock/pagination chrome so a
 *     second LOAD pass cannot double-mount the same controls.
 *   - ensureDockGlobeRailCenterRestored(): re-insert the center rail
 *     (`#dockGlobeRailCenter`) next to the left rail if it was removed.
 *   - thumbPageTurnShrinkKeyframes() / thumbPageTurnGrowKeyframes(): WAAPI
 *     keyframes for the dock-thumb page-turn shrink/grow animation. Pure
 *     functions; output matches the globe's own thumb animation.
 *
 * Extracted from main-menu/event-system-load-out/EventSystemLoadOut.js.
 */

/**
 * Tear down the resize/orientation listeners installed by the LOAD path
 * (stored on the `window.__menuHelpersEventSystemLayout` shared slot).
 */
export function teardownMenuHelpersEventSystemLayout() {
    const st = window.__menuHelpersEventSystemLayout;
    if (!st) return;
    if (st.moveChrome) {
        window.removeEventListener('resize', st.moveChrome);
        window.removeEventListener('orientationchange', st.moveChrome);
    }
    if (st.moveDock) {
        window.removeEventListener('resize', st.moveDock);
        window.removeEventListener('orientationchange', st.moveDock);
    }
    window.__menuHelpersEventSystemLayout = null;
}

/**
 * Remove stray dock/pagination chrome so a second Event System load cannot
 * double-mount controls (defensive — UNLOAD should already have done this).
 */
export function sweepEventSystemDockOrphans() {
    const ids = [
        'prevPageBtn',
        'prevEventBtn',
        'nextEventBtn',
        'nextPageBtn',
        'globalImageToggle',
        'filtersToggle',
        'eventsManageToggle',
        'pageInput',
        'pageTotal',
    ];
    ids.forEach((id) => document.getElementById(id)?.remove());
    document.querySelectorAll('.page-input-container').forEach((el) => el.remove());
}

/**
 * Re-insert `#dockGlobeRailCenter` next to `#dockGlobeRailLeft` if missing.
 * Falls back to appending to `document.body` if the left rail is gone.
 */
export function ensureDockGlobeRailCenterRestored() {
    if (document.getElementById('dockGlobeRailCenter')) return;
    const el = document.createElement('div');
    el.id = 'dockGlobeRailCenter';
    el.className = 'dock-globe-rail dock-globe-rail--center';
    el.setAttribute('aria-label', 'Pagination and navigation');
    const left = document.getElementById('dockGlobeRailLeft');
    if (left?.parentNode) {
        left.parentNode.insertBefore(el, left.nextSibling);
    } else {
        document.body.appendChild(el);
    }
}

/**
 * WAAPI keyframes for the thumb-shrink half of a page-turn transition.
 * Matches the globe implementation. Desktop variant preserves the skew.
 */
export function thumbPageTurnShrinkKeyframes(isThumbsDesktop, locked) {
    if (isThumbsDesktop) {
        const from = locked
            ? { opacity: 0.5, transform: 'skewX(-11deg)' }
            : { opacity: 1, transform: 'skewX(-11deg) scale(1)' };
        const to = { opacity: 0, transform: 'skewX(-11deg) scale(0.6)' };
        return [from, to];
    }
    const from = locked ? { opacity: 0.5 } : { opacity: 1 };
    const to = { opacity: 0 };
    return [from, to];
}

/**
 * WAAPI keyframes for the thumb-grow half of a page-turn transition.
 * Counterpart to {@link thumbPageTurnShrinkKeyframes}.
 */
export function thumbPageTurnGrowKeyframes(isThumbsDesktop, locked) {
    if (isThumbsDesktop) {
        const from = {
            opacity: 0,
            transform: 'skewX(-11deg) scale(0.6)'
        };
        const to = locked
            ? { opacity: 0.5, transform: 'skewX(-11deg) scale(1)' }
            : { opacity: 1, transform: 'skewX(-11deg) scale(1)' };
        return [from, to];
    }
    const from = { opacity: 0 };
    const to = locked ? { opacity: 0.5 } : { opacity: 1 };
    return [from, to];
}
