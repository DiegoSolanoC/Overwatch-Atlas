/**
 * dockChromeLifecycle — mount/unmount-time helpers for the pagination dock chrome.
 *
 *   - teardownMenuHelpersEventSystemLayout(): remove the resize/orientation
 *     listeners stored on `window.__menuHelpersEventSystemLayout`, then null
 *     the slot.
 *   - sweepEventSystemDockOrphans(): scrub stale dock/pagination chrome so a
 *     second LOAD pass cannot double-mount the same controls.
 *   - ensureDockGlobeRailCenterRestored(): re-insert the center rail
 *     (`#dockGlobeRailCenter`) next to the left rail if it was removed.
 *
 * Extracted from the legacy EventSystemDockHelpers.js (the WAAPI keyframes are
 * now in thumbPageTurnKeyframes.js).
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

export function ensureDockGlobeRailCenterRestored() {
    const existing = document.getElementById('dockGlobeRailCenter');
    if (existing) return existing;
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
    return el;
}
