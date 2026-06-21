/**
 * Embedded list chrome for Dialogue Theater — mirrors Data Archive compact layout.
 */

import { applyStoryArchiveGridSquishFromDefaults } from '../../data-workshop/archive-controls-ui/ArchiveGridSquish.js';

/**
 * @param {HTMLElement} panel
 */
export function setupDialogueTheaterCompactChrome(panel) {
    if (!panel?.classList.contains('story-viewer-panel-embedded')) return;

    const header = panel.querySelector('.events-manage-header');
    const controls = panel.querySelector('#dialogueTheaterManageControls');
    const btn = panel.querySelector('#dialogueTheaterToolbarToggleBtn');
    if (!header || !controls || !btn) return;

    const strayTitle = Array.from(controls.children).find((el) =>
        el.classList?.contains('events-manage-title-section'),
    );
    if (strayTitle && !header.contains(strayTitle)) {
        header.insertBefore(strayTitle, header.firstChild);
    }

    if (!controls.contains(btn)) {
        controls.insertBefore(btn, controls.firstChild);
    }

    header.classList.add('events-manage-header--story-empty');
    applyStoryArchiveGridSquishFromDefaults(panel);
}

/**
 * @param {HTMLElement} panel
 */
export function wireDialogueTheaterToolbarCollapse(panel) {
    const btn = panel?.querySelector('#dialogueTheaterToolbarToggleBtn');
    const controlsEl =
        panel?.querySelector('#dialogueTheaterManageControls')
        || panel?.querySelector('#dialogueTheaterManageSearch');
    if (!panel || !btn || !controlsEl) return;

    if (panel.dataset.dialogueTheaterToolbarCollapseBound === 'true') return;
    panel.dataset.dialogueTheaterToolbarCollapseBound = 'true';

    const storageKey = 'dialogueTheaterToolbarCollapsed';
    const isMobileToolbar = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        return w <= 768 || Math.min(w, h) < 600;
    };

    const LABEL_HIDE = 'Hide controls';
    const LABEL_SHOW = 'Show controls';

    const apply = () => {
        const mobile = isMobileToolbar();
        const collapsed = btn.getAttribute('aria-pressed') === 'true';

        if (!mobile) {
            panel.classList.remove('events-manage-panel--toolbar-collapsed');
            btn.setAttribute('aria-pressed', 'false');
            btn.textContent = LABEL_HIDE;
            controlsEl.style.removeProperty('display');
            return;
        }

        panel.classList.toggle('events-manage-panel--toolbar-collapsed', collapsed);
        btn.textContent = collapsed ? LABEL_SHOW : LABEL_HIDE;
        if (collapsed) {
            controlsEl.style.setProperty('display', 'none', 'important');
        } else {
            controlsEl.style.removeProperty('display');
        }
    };

    try {
        const stored = localStorage.getItem(storageKey);
        if (stored === '1') {
            btn.setAttribute('aria-pressed', 'true');
        } else if (stored === '0') {
            btn.setAttribute('aria-pressed', 'false');
        } else {
            btn.setAttribute('aria-pressed', isMobileToolbar() ? 'true' : 'false');
        }
    } catch (_) {
        btn.setAttribute('aria-pressed', isMobileToolbar() ? 'true' : 'false');
    }

    apply();

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!isMobileToolbar()) return;
        const next = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', next ? 'true' : 'false');
        apply();
        try {
            localStorage.setItem(storageKey, next ? '1' : '0');
        } catch (_) {}
    });

    const onViewportChange = () => apply();
    panel._dialogueTheaterToolbarResize = onViewportChange;
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', () => {
        requestAnimationFrame(() => apply());
    });
}

/**
 * @param {HTMLElement} panel
 */
export function unwireDialogueTheaterToolbarCollapse(panel) {
    if (panel?._dialogueTheaterToolbarResize) {
        window.removeEventListener('resize', panel._dialogueTheaterToolbarResize);
        panel._dialogueTheaterToolbarResize = null;
    }
    panel?.removeAttribute('data-dialogue-theater-toolbar-collapse-bound');
}
