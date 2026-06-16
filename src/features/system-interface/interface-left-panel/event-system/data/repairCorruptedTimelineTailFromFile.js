/**
 * Heal story-timeline tail corruption when a new event save overwrote the last row
 * (e.g. "Facing Demons" replaced by a duplicate "City of Harmony" at the end).
 * Runs when localStorage wins over bundled timeline-events.json on load.
 */

/**
 * @param {unknown[]} events
 * @param {unknown[]|null} fileEvents
 * @returns {unknown[]}
 */
export function repairCorruptedTimelineTailFromFile(events, fileEvents) {
    if (!Array.isArray(events) || events.length === 0) return events || [];
    if (!Array.isArray(fileEvents) || fileEvents.length === 0) return events;

    const fileFacing = fileEvents.find(
        (row) => row && typeof row === 'object' && String(row.name || '').trim() === 'Facing Demons',
    );
    if (!fileFacing) return events;

    const localFacingIdx = events.findIndex(
        (row) => row && typeof row === 'object' && String(row.name || '').trim() === 'Facing Demons',
    );
    if (localFacingIdx >= 0) return events;

    const last = events[events.length - 1];
    const lastName = String(last?.name || '').trim();

    // Known corruption: tail row renamed to a mid-timeline insert duplicate.
    if (lastName === 'City of Harmony') {
        const out = events.slice();
        out[out.length - 1] = { ...fileFacing };
        return out;
    }

    // Missing tail event — append canonical row from disk.
    return [...events, { ...fileFacing }];
}
