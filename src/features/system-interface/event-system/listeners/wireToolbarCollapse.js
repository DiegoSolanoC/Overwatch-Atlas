/**
 * Wires the Event Manager toolbar collapse button (`#eventsManageToolbarToggleBtn`).
 *
 * Mobile detection matches the pagination "phone" rule:
 *   width <= 768  OR  short-edge < 600  (covers landscape phones >768px wide).
 *
 * Behaviour:
 *   - Desktop: toolbar always visible, button state cleared.
 *   - Mobile: button toggles `events-manage-panel--toolbar-collapsed` on the panel and hides
 *     the search controls. State persists in `localStorage.eventsManageToolbarCollapsed`
 *     (`'1'` collapsed, `'0'` expanded). No stored value → default to collapsed on mobile.
 *   - Re-applies on `resize` and `orientationchange` (1-frame deferred for orientation).
 *
 * Idempotent: `listenerService._eventsManageToolbarCollapseBound` blocks double-wiring.
 *
 * @param {{ _eventsManageToolbarCollapseBound?: boolean }} listenerService
 * @param {HTMLElement} panel
 */
export function wireToolbarCollapse(listenerService, panel) {
    if (listenerService._eventsManageToolbarCollapseBound) return;
    const btn = document.getElementById('eventsManageToolbarToggleBtn');
    const controlsEl =
        document.getElementById('eventsManageControls') || document.getElementById('eventsManageSearch');
    if (!panel || !btn) return;
    listenerService._eventsManageToolbarCollapseBound = true;

    const storageKey = 'eventsManageToolbarCollapsed';
    const isEventsManageMobileToolbar = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        return w <= 768 || Math.min(w, h) < 600;
    };

    const LABEL_HIDE = 'Hide controls';
    const LABEL_SHOW = 'Show controls';

    const apply = () => {
        const mobile = isEventsManageMobileToolbar();
        const collapsed = btn.getAttribute('aria-pressed') === 'true';

        if (!mobile) {
            panel.classList.remove('events-manage-panel--toolbar-collapsed');
            btn.setAttribute('aria-pressed', 'false');
            btn.textContent = LABEL_HIDE;
            if (controlsEl) controlsEl.style.removeProperty('display');
            return;
        }

        panel.classList.toggle('events-manage-panel--toolbar-collapsed', collapsed);
        btn.textContent = collapsed ? LABEL_SHOW : LABEL_HIDE;
        if (controlsEl) {
            if (collapsed) {
                controlsEl.style.setProperty('display', 'none', 'important');
            } else {
                controlsEl.style.removeProperty('display');
            }
        }
    };

    try {
        const stored = localStorage.getItem(storageKey);
        if (stored === '1') {
            btn.setAttribute('aria-pressed', 'true');
        } else if (stored === '0') {
            btn.setAttribute('aria-pressed', 'false');
        } else {
            // First visit: default to collapsed on mobile (portrait + landscape).
            btn.setAttribute('aria-pressed', isEventsManageMobileToolbar() ? 'true' : 'false');
        }
    } catch (_) {
        btn.setAttribute('aria-pressed', isEventsManageMobileToolbar() ? 'true' : 'false');
    }

    apply();

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!isEventsManageMobileToolbar()) return;
        const next = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', next ? 'true' : 'false');
        apply();
        try {
            localStorage.setItem(storageKey, next ? '1' : '0');
        } catch (_) {}
    });

    const onViewportChange = () => apply();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', () => {
        requestAnimationFrame(() => apply());
    });
}
