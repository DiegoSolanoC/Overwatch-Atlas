/**
 * Data Archive / Story list / Dialogue Theater embedded panels — mobile search toolbar.
 */

/** @returns {boolean} */
export function isCompactMobileViewport() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return w <= 768 || Math.min(w, h) < 600;
}

/**
 * On mobile, Story list + Dialogue Theater keep search visible (no collapse).
 * @param {HTMLElement | null | undefined} panel
 * @returns {boolean}
 */
export function shouldPinEmbeddedArchiveSearchToolbar(panel) {
    if (!panel || !isCompactMobileViewport()) return false;
    if (panel.classList.contains('dialogue-theater-panel-embedded')) return true;
    if (
        panel.classList.contains('story-viewer-panel-embedded')
        && panel.classList.contains('story-viewer-panel-embedded--list-view')
    ) {
        return true;
    }
    return false;
}
