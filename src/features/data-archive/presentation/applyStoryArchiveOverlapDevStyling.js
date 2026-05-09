/**
 * DEV: highlight overlap badges in the embedded Event Manager (localhost debugging).
 * @param {HTMLElement | null} eventsManagePanel
 */
export function applyStoryArchiveOverlapDevStyling(eventsManagePanel) {
    if (!eventsManagePanel) return;

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
