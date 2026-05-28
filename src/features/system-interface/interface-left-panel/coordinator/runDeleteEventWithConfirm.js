/**
 * Delete one row via EventEditService; refresh list + globe on success.
 * @param {object} mgr — EventManager
 * @param {number} index
 * @returns {boolean} whether the event was removed
 */
export function runDeleteEventAtIndex(mgr, index) {
    if (mgr.isGitHubPages()) {
        console.log('Event deletion is disabled on GitHub Pages');
        return false;
    }
    if (!mgr.editService) {
        console.error('EventManager: EventEditService not available!');
        return false;
    }
    const result = mgr.editService.deleteEvent(index);
    if (!result.success) {
        return false;
    }
    mgr.currentPage = result.newCurrentPage;
    mgr.renderEvents();
    mgr.refreshGlobeEvents();

    const arch = mgr.dataService?.getArchiveSource?.() || 'story';
    if (arch !== 'story') {
        mgr.dataService?.saveEvents?.();
        if (typeof window.FilterService?.invalidateBioArchiveFilterLayouts === 'function') {
            window.FilterService.invalidateBioArchiveFilterLayouts();
        }
    }

    return true;
}

/**
 * @param {object} mgr — EventManager
 * @param {number} index
 * @returns {boolean}
 */
export function runDeleteEventWithConfirm(mgr, index) {
    const eventName = mgr.events[index]?.name || mgr.events[index]?.variants?.[0]?.name || 'this event';
    if (!confirm(`Are you sure you want to delete "${eventName}"?`)) {
        return false;
    }
    return runDeleteEventAtIndex(mgr, index);
}