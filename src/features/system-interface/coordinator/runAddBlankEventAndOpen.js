/**
 * Append a blank row for the active archive, jump pagination to it, re-render, then open the slide.
 * @param {object} mgr — EventManager
 */
export function runAddBlankEventAndOpen(mgr) {
    if (mgr.isGitHubPages()) return;
    if (!mgr.editService) {
        console.error('EventManager: EventEditService not available');
        return;
    }

    mgr._resetSearchInputs();

    const archiveSrc =
        typeof mgr.dataService?.getArchiveSource === 'function' ? mgr.dataService.getArchiveSource() : 'story';
    const isStoryArchive = archiveSrc === 'story';

    const blank = mgr.editService.constructor.buildBlankEventForArchiveSource(archiveSrc);
    const result = mgr.editService.addEvent(blank, null);
    if (!result.success) return;

    const newIndex = result.newIndex;
    const event = mgr.events[newIndex];

    const displayed = mgr.getFilteredEvents();
    const pos = displayed.indexOf(event);
    const perPage = mgr.showAllEventsInManager
        ? Math.max(1, displayed.length)
        : Math.max(1, parseInt(mgr.eventsPerPageSetting || 50, 10) || 50);
    mgr.eventsPerPage = perPage;
    if (mgr.showAllEventsInManager) {
        mgr.currentPage = 1;
    } else if (pos >= 0) {
        mgr.currentPage = Math.max(1, Math.ceil((pos + 1) / perPage));
    } else {
        mgr.currentPage = result.newCurrentPage;
    }

    mgr.renderEvents();

    const open = () => {
        if (mgr.openEventFromList) {
            mgr.openEventFromList(event, newIndex);
        }
    };

    if (isStoryArchive) {
        const p = mgr.refreshGlobeEvents();
        if (p && typeof p.then === 'function') {
            p.then(open).catch(open);
        } else {
            requestAnimationFrame(open);
        }
    } else {
        requestAnimationFrame(open);
    }
}
