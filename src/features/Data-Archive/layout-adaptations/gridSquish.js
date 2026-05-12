/**
 * Grid column inset for Data Archive embedded Event Manager (CSS vars on panel).
 */

function storyArchiveSquishToLayout(squish0to100) {
    const t = Math.min(100, Math.max(0, squish0to100)) / 100;
    const gutter = 10 + t * 70;
    const maxW = Math.round(3000 - t * 1900);
    return { gutter, maxW };
}

/**
 * Fixed preview-grid squish (0–100): localhost/dev = 3, GitHub Pages static deploy = 20.
 * Slider UI removed for now; values stay fixed unless this logic is extended later.
 * @returns {number}
 */
function getStoryArchiveDefaultGridSquish() {
    try {
        const m = document.querySelector('meta[name="timeline-deploy"]');
        if (m && String(m.getAttribute('content') || '').toLowerCase() === 'static') {
            return 20;
        }
    } catch (_) {
        /* ignore */
    }
    const h = window.location.hostname || '';
    if (h.includes('github.io') || h === 'pages.github.com') {
        return 20;
    }
    return 3;
}

/**
 * @param {HTMLElement} eventsManagePanel
 * @param {number} squish0to100
 */
export function applyStoryArchiveGridSquish(eventsManagePanel, squish0to100) {
    if (!eventsManagePanel) return;
    const { gutter, maxW } = storyArchiveSquishToLayout(squish0to100);
    eventsManagePanel.style.setProperty('--story-archive-list-gutter', `${gutter}px`);
    eventsManagePanel.style.setProperty('--story-archive-list-max-width', `${maxW}px`);
}

/**
 * Apply grid inset for Data Archive (no localStorage; see default squish helper).
 * @param {HTMLElement} eventsManagePanel
 */
export function applyStoryArchiveGridSquishFromDefaults(eventsManagePanel) {
    if (!eventsManagePanel || !eventsManagePanel.classList.contains('story-viewer-panel-embedded')) {
        return;
    }
    const squishVal = getStoryArchiveDefaultGridSquish();
    applyStoryArchiveGridSquish(eventsManagePanel, squishVal);
}
