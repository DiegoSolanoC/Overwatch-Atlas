/**
 * Wire native HTML5 drag/drop on every `.event-item` card in the manager list.
 *
 * Per card we listen for four events:
 *   - `dragstart` — record the source card on `eventManager.draggedElement` so the drop
 *     handler can find it, and add the `dragging` class so CSS can dim/highlight the source.
 *   - `dragend`   — clean up the class + the source reference on the manager.
 *   - `dragover`  — prevent default (required for `drop` to fire) and highlight the hovered
 *     card via `drag-over`. The actual insertion gap is decided at drop time based on
 *     source/target indices, so we don't need an "insert line" gutter here.
 *   - `drop`      — read `from` / `to` indices off the dataset and route to `reorderEvents`,
 *     forwarding any archive-specific target keys (`factionType`, `heroRole`,
 *     `heroSubRole`) from the drop target so they get stamped onto the moved row.
 *
 * @param {any} reorderService Owning EventListReorderDragDrop.
 */
export function wireEventCardDragDrop(reorderService) {
    const items = document.querySelectorAll('.event-item');
    const arch = reorderService.eventManager.dataService?.getArchiveSource?.();

    items.forEach((item) => {
        item.addEventListener('dragstart', (e) => {
            reorderService.eventManager.draggedElement = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            document.querySelectorAll('.event-item').forEach((i) => i.classList.remove('drag-over'));
            reorderService.eventManager.draggedElement = null;
            reorderService.eventManager.dragOverIndex = null;
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            item.classList.add('drag-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            if (reorderService.eventManager.draggedElement && reorderService.eventManager.draggedElement !== item) {
                const fromIndex = parseInt(reorderService.eventManager.draggedElement.dataset.index, 10);
                const toIndex = parseInt(item.dataset.index, 10);
                const targetFactionType = (arch === 'factions' && item.dataset.factionType !== undefined)
                    ? item.dataset.factionType
                    : undefined;
                const targetHeroRole = (arch === 'heroes' && item.dataset.heroRole !== undefined)
                    ? item.dataset.heroRole
                    : undefined;
                const targetHeroSubRole = (arch === 'heroes' && item.dataset.heroSubRole !== undefined)
                    ? item.dataset.heroSubRole
                    : undefined;
                reorderService.reorderEvents(fromIndex, toIndex, {
                    targetFactionType,
                    targetHeroRole,
                    targetHeroSubRole
                });
            }
        });
    });
}
