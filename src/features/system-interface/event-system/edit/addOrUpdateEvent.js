/**
 * Insert a new event into the archive, fix up `unsavedEventIndices`, and pick which page
 * the manager UI should land on after the insert.
 *
 * Two paths:
 *   - **At end** (`targetPosition === null` or past end): pushed onto the array; manager jumps
 *     to the last page so the new row is visible.
 *   - **Inserted mid-list**: splice in place; every existing unsaved index `>= targetPosition`
 *     gets bumped forward by one; manager navigates to whichever page now contains the row.
 *
 * @param {any} editService Owning EventEditService.
 * @param {Object} event Event object to add.
 * @param {number|null} [targetPosition=null] 0-indexed insertion slot, or null to append.
 * @returns {{ success: boolean, error?: string, newIndex?: number, newCurrentPage?: number }}
 */
export function addEvent(editService, event, targetPosition = null) {
    if (!editService.eventManager) {
        return { success: false, error: 'EventManager not set' };
    }

    const events = editService.eventManager.events;
    let newIndex;
    let newCurrentPage = editService.eventManager.currentPage;

    if (targetPosition !== null && targetPosition <= events.length) {
        events.splice(targetPosition, 0, event);
        newIndex = targetPosition;

        const newUnsaved = new Set();
        editService.eventManager.unsavedEventIndices.forEach((oldIndex) => {
            if (oldIndex >= targetPosition) newUnsaved.add(oldIndex + 1);
            else newUnsaved.add(oldIndex);
        });
        newUnsaved.add(targetPosition);
        editService.eventManager.unsavedEventIndices = newUnsaved;

        newCurrentPage = Math.ceil((targetPosition + 1) / editService.eventManager.eventsPerPage);
    } else {
        newIndex = events.length;
        events.push(event);
        editService.eventManager.unsavedEventIndices.add(newIndex);

        const totalPages = Math.ceil(events.length / editService.eventManager.eventsPerPage);
        newCurrentPage = totalPages;
    }

    return { success: true, newIndex, newCurrentPage };
}

/**
 * Replace an event in-place, or move it to a new position and replace.
 *
 * Path A (`targetPosition === null` or unchanged): straight assignment + mark unsaved.
 *
 * Path B (move): splice out of old slot, then splice into adjusted new slot. The
 * "adjusted" target accounts for the fact that removing the old element shifts indices,
 * so when the user picks a target *after* the old position, we subtract 1 from it.
 *
 * Path B also rewrites `unsavedEventIndices` because every index between old and new
 * positions slides by 1 in some direction:
 *   - Moving forward (`oldIndex < adjustedTargetPosition`): indices in `(oldIndex,
 *     adjustedTargetPosition]` decrement by 1.
 *   - Moving backward (`oldIndex > adjustedTargetPosition`): indices in
 *     `[adjustedTargetPosition, oldIndex)` increment by 1.
 *
 * In all cases the moved event itself is marked unsaved at its new index.
 *
 * @param {any} editService Owning EventEditService.
 * @param {number} oldIndex Current index of the event.
 * @param {Object} event Updated event object.
 * @param {number|null} [targetPosition=null] Desired position, or null to update in place.
 * @returns {{ success: boolean, error?: string, newIndex?: number, newCurrentPage?: number }}
 */
export function updateEvent(editService, oldIndex, event, targetPosition = null) {
    if (!editService.eventManager) {
        return { success: false, error: 'EventManager not set' };
    }

    const events = editService.eventManager.events;
    if (oldIndex < 0 || oldIndex >= events.length) {
        return { success: false, error: 'Invalid index' };
    }

    let newIndex = oldIndex;
    let newCurrentPage = editService.eventManager.currentPage;

    if (targetPosition !== null && targetPosition !== oldIndex) {
        const maxPosition = events.length - 1;
        const clampedTargetPosition = Math.min(targetPosition, maxPosition);

        if (clampedTargetPosition === oldIndex) {
            events[oldIndex] = event;
            editService.eventManager.unsavedEventIndices.add(oldIndex);
            newCurrentPage = Math.ceil((oldIndex + 1) / editService.eventManager.eventsPerPage);
        } else {
            events.splice(oldIndex, 1);

            const adjustedTargetPosition = clampedTargetPosition > oldIndex
                ? clampedTargetPosition - 1
                : clampedTargetPosition;

            events.splice(adjustedTargetPosition, 0, event);
            newIndex = adjustedTargetPosition;

            const newUnsaved = new Set();
            editService.eventManager.unsavedEventIndices.forEach((oldIdx) => {
                if (oldIdx === oldIndex) {
                    newUnsaved.add(adjustedTargetPosition);
                } else if (oldIndex < adjustedTargetPosition) {
                    if (oldIdx > oldIndex && oldIdx <= adjustedTargetPosition) {
                        newUnsaved.add(oldIdx - 1);
                    } else {
                        newUnsaved.add(oldIdx);
                    }
                } else if (oldIdx >= adjustedTargetPosition && oldIdx < oldIndex) {
                    newUnsaved.add(oldIdx + 1);
                } else {
                    newUnsaved.add(oldIdx);
                }
            });
            newUnsaved.add(adjustedTargetPosition);
            editService.eventManager.unsavedEventIndices = newUnsaved;

            newCurrentPage = Math.ceil((adjustedTargetPosition + 1) / editService.eventManager.eventsPerPage);
        }
    } else {
        events[oldIndex] = event;
        editService.eventManager.unsavedEventIndices.add(oldIndex);
        newCurrentPage = Math.ceil((oldIndex + 1) / editService.eventManager.eventsPerPage);
    }

    return { success: true, newIndex, newCurrentPage };
}
