/**
 * Development styling helpers for Data Archive.
 * Applies overlap styling for development environments.
 */

/**
 * Apply development-specific styling to Data Archive.
 * @param {HTMLElement} eventsManagePanel
 */
export function applyStoryArchiveOverlapDevStyling(eventsManagePanel) {
    if (!eventsManagePanel) return;
    
    // Only apply in development/localhost
    if (!isDevelopmentEnvironment()) return;
    
    eventsManagePanel.classList.add('story-archive-dev-styling');
}

/**
 * Apply overlap badge highlighting for development debugging.
 * @param {HTMLElement} eventsManagePanel
 */
export function applyOverlapBadgeHighlighting(eventsManagePanel) {
    if (!eventsManagePanel) return;
    if (!isDevelopmentEnvironment()) return;

    const overlapBadges = eventsManagePanel.querySelectorAll('.event-number-badge--overlap');
    console.log(
        '[data-archive] overlap badges:',
        overlapBadges.length,
        '— applying dev highlight styling'
    );
    overlapBadges.forEach((badge) => {
        badge.style.setProperty('color', '#ff4444', 'important');
        badge.style.setProperty(
            'text-shadow',
            '0 1px 3px rgba(0, 0, 0, 0.85), 0 2px 12px rgba(0, 0, 0, 0.45)',
            'important'
        );
    });
}

/**
 * Check if current environment is development.
 * @returns {boolean}
 */
function isDevelopmentEnvironment() {
    try {
        const hostname = window.location.hostname || '';
        return hostname === 'localhost' || hostname === '127.0.0.1';
    } catch (_) {
        return false;
    }
}

/**
 * Remove development styling from Data Archive.
 * @param {HTMLElement} eventsManagePanel
 */
export function removeStoryArchiveOverlapDevStyling(eventsManagePanel) {
    if (!eventsManagePanel) return;
    eventsManagePanel.classList.remove('story-archive-dev-styling');
}
