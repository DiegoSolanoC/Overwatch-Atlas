/**
 * Keep `eventsPerPage` / `currentPage` aligned with the filtered list before `renderService.renderEvents`.
 * @param {object} mgr — EventManager
 * @param {Array<unknown>} displayed
 */
export function syncManagerPaginationForDisplay(mgr, displayed) {
    const perPage = mgr.showAllEventsInManager
        ? Math.max(1, displayed.length)
        : Math.max(1, parseInt(mgr.eventsPerPageSetting || 50, 10) || 50);
    mgr.eventsPerPage = perPage;
    if (mgr.showAllEventsInManager) {
        mgr.currentPage = 1;
    }
    const totalPages = Math.max(1, Math.ceil(displayed.length / mgr.eventsPerPage));
    if (mgr.currentPage > totalPages) {
        mgr.currentPage = totalPages;
    }
}
