/**
 * Wires the Event Manager toolbar collapse button (`#eventsManageToolbarToggleBtn`).
 *
 * Mobile detection matches the pagination "phone" rule:
 *   width <= 768  OR  short-edge < 600  (covers landscape phones >768px wide).
 *
 * Behaviour:
 *   - Desktop: toolbar always visible, button state cleared.
 *   - Mobile (Event Manager dock): button toggles collapse; defaults collapsed.
 *   - Mobile (Story list embedded): search always visible; toggle hidden.
 *   - Re-applies on `resize` and `orientationchange` (1-frame deferred for orientation).
 *
 * Idempotent: `listenerService._eventsManageToolbarCollapseBound` blocks double-wiring.
 *
 * @param {{ _eventsManageToolbarCollapseBound?: boolean }} listenerService
 * @param {HTMLElement} panel
 */
import { isCompactMobileViewport, shouldPinEmbeddedArchiveSearchToolbar } from '../../../interface-shared/embeddedArchiveMobileSearch.js';

export function wireToolbarCollapse(listenerService, panel) {
    if (listenerService._eventsManageToolbarCollapseBound) return;
    const btn = document.getElementById('eventsManageToolbarToggleBtn');
    const controlsEl =
        document.getElementById('eventsManageControls') || document.getElementById('eventsManageSearch');
    if (!panel || !btn) return;
    listenerService._eventsManageToolbarCollapseBound = true;

    const storageKey = 'eventsManageToolbarCollapsed';

    const LABEL_HIDE = 'Hide controls';
    const LABEL_SHOW = 'Show controls';

    const apply = () => {
        const pinned = shouldPinEmbeddedArchiveSearchToolbar(panel);
        const mobile = isCompactMobileViewport();
        const collapsed = !pinned && btn.getAttribute('aria-pressed') === 'true';

        if (!mobile || pinned) {
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
            btn.setAttribute('aria-pressed', isCompactMobileViewport() ? 'true' : 'false');
        }
    } catch (_) {
        btn.setAttribute('aria-pressed', isCompactMobileViewport() ? 'true' : 'false');
    }

    apply();

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!isCompactMobileViewport() || shouldPinEmbeddedArchiveSearchToolbar(panel)) return;
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
