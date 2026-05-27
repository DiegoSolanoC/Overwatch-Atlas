/**
 * Remove `events[index]` from the active archive and patch up the dependent state
 * (`unsavedEventIndices` and the manager pagination cursor) so the UI stays consistent.
 *
 * Notes:
 *   - **GitHub Pages guard**: deletion is disabled on the live published site since there's
 *     no API to write back to. Returns `{ success: false, reason: 'github-pages' }`.
 *   - **Unsaved index shift**: any saved-vs-unsaved markers for items *after* the deleted
 *     event need their indices decremented; otherwise we'd flag the wrong rows as dirty.
 *   - **Mark-all-unsaved**: after deletion we also mark every remaining event as unsaved.
 *     That's slightly aggressive but ensures the next persist round-trips the full file.
 *   - **Pagination**: if the deletion emptied the current page (and we're not on page 1),
 *     step back one page so the UI doesn't land on a blank list.
 *
 * @param {any} editService Owning EventEditService (for `eventManager` back-reference).
 * @param {number} index Event index to delete.
 * @returns {{ success: boolean, reason?: string, deletedEvent?: any, newCurrentPage?: number, newTotalPages?: number }}
 */
export function deleteEventAtIndex(editService, index) {
    if (!editService.eventManager) {
        console.error('EventEditService: EventManager not set!');
        return { success: false };
    }

    if (editService.eventManager.isGitHubPages && editService.eventManager.isGitHubPages()) {
        return { success: false, reason: 'github-pages' };
    }

    const events = editService.eventManager.events;
    if (index < 0 || index >= events.length) {
        return { success: false, reason: 'invalid-index' };
    }

    const currentPageStartIndex = (editService.eventManager.currentPage - 1) * editService.eventManager.eventsPerPage;
    const currentPageEndIndex = currentPageStartIndex + editService.eventManager.eventsPerPage;

    const deletedEvent = events.splice(index, 1)[0];

    const newUnsaved = new Set();
    editService.eventManager.unsavedEventIndices.forEach((oldIndex) => {
        if (oldIndex < index) newUnsaved.add(oldIndex);
        else if (oldIndex > index) newUnsaved.add(oldIndex - 1);
    });
    editService.eventManager.unsavedEventIndices = newUnsaved;

    events.forEach((_, idx) => editService.eventManager.unsavedEventIndices.add(idx));

    const newTotalPages = Math.max(1, Math.ceil(events.length / editService.eventManager.eventsPerPage));
    let newCurrentPage = editService.eventManager.currentPage;
    if (newCurrentPage > newTotalPages) newCurrentPage = newTotalPages;

    if (events.length > 0 && index >= currentPageStartIndex && index < currentPageEndIndex) {
        const remainingOnPage = events.slice(currentPageStartIndex, currentPageEndIndex - 1).length;
        if (remainingOnPage === 0 && newCurrentPage > 1) newCurrentPage--;
    }

    return {
        success: true,
        deletedEvent,
        newCurrentPage,
        newTotalPages
    };
}
