/**
 * Move `events[fromIndex]` to slot `toIndex`, fix up any per-archive metadata on the moved
 * row, repaint the manager list, and mark every event as unsaved (the file order changed
 * so the on-disk ordering is now stale).
 *
 * Bounds & no-op handling:
 *   - Returns immediately when either index is out of range or when source == target.
 *   - When moving forward, the target index gets decremented by 1 to account for the
 *     splice-out: removing `[fromIndex]` shifts all later indices back by one, so the
 *     user-visible "drop here" slot needs the same adjustment.
 *
 * Per-archive metadata writes (driven by `options`):
 *   - **factions** archive — write `moved.factionType` to the drop target's type key.
 *   - **heroes** archive — write `moved.heroRole`; optionally `moved.heroSubRole` from
 *     the drop target, or clear the subrole when the user drops directly on a role
 *     separator (`clearHeroSubRoleOnRoleDrop`).
 *   - **npcs** archive — write `moved.npcCategory` to the drop target's category key.
 *
 * @param {any} reorderService Owning EventListReorderDragDrop.
 * @param {number} fromIndex Source row.
 * @param {number} toIndex Target slot (pre-splice).
 * @param {{
 *   targetFactionType?: string,
 *   targetHeroRole?: string,
 *   targetHeroSubRole?: string,
 *   clearHeroSubRoleOnRoleDrop?: boolean,
 *   targetNpcCategory?: string
 * }} [options]
 */
export function reorderEventsInList(reorderService, fromIndex, toIndex, options = {}) {
    if (!reorderService.eventManager) return;

    const events = reorderService.eventManager.events;
    if (fromIndex < 0 || fromIndex >= events.length || toIndex < 0 || toIndex > events.length) {
        return;
    }
    if (fromIndex === toIndex) return;

    const [moved] = events.splice(fromIndex, 1);
    let insertAt = toIndex;
    if (fromIndex < toIndex) insertAt = toIndex - 1;
    if (insertAt < 0) insertAt = 0;
    if (insertAt > events.length) insertAt = events.length;
    events.splice(insertAt, 0, moved);

    const arch = reorderService.eventManager.dataService?.getArchiveSource?.();
    if (arch === 'factions' && options && options.targetFactionType !== undefined) {
        moved.factionType = options.targetFactionType;
    }
    if (arch === 'heroes' && options && options.targetHeroRole !== undefined) {
        moved.heroRole = options.targetHeroRole;
    }
    if (arch === 'heroes' && options && options.clearHeroSubRoleOnRoleDrop) {
        moved.heroSubRole = '';
    } else if (arch === 'heroes' && options && options.targetHeroSubRole !== undefined) {
        moved.heroSubRole = options.targetHeroSubRole;
    }
    if (arch === 'npcs' && options && options.targetNpcCategory !== undefined) {
        moved.npcCategory = options.targetNpcCategory;
    }

    if (reorderService.eventManager.renderEvents) {
        reorderService.eventManager.renderEvents();
    }
    events.forEach((_, idx) => reorderService.eventManager.unsavedEventIndices.add(idx));
}
