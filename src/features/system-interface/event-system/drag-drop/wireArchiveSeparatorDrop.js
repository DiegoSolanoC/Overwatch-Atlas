/**
 * Wire drop behavior on the grouped-archive section dividers — the lines rendered by
 * `render/archiveSeparators.js` for the **factions** and **heroes** archives.
 *
 * The divider acts as a drop target so the user can drop an event card directly onto a
 * section header to move it into that group (faction type / hero role / hero subrole) even
 * if the section is currently empty.
 *
 * Behavior per archive:
 *   - **factions**: drop targets carry `data-drop-faction-type`. We resolve the target
 *     index via `findFirstIndexForFactionTypeInList(events, typeKey)` so the moved row
 *     lands at the top of the section, and pass `targetFactionType` so the moved row's
 *     `factionType` is rewritten.
 *   - **heroes**: drop targets carry `data-drop-hero-role` and optionally
 *     `data-drop-hero-sub-role`. Without sub-role we set `clearHeroSubRoleOnRoleDrop:true`
 *     so dropping on a role divider clears any stale sub-role on the moved row.
 *
 * The whole function is a no-op when the active archive isn't `factions`/`heroes` or when
 * the corresponding helper global (`FactionArchiveGroupOrderHelpers` /
 * `HeroArchiveRoleOrderHelpers`) isn't loaded yet.
 *
 * @param {any} reorderService Owning EventListReorderDragDrop.
 */
export function wireArchiveSeparatorDrop(reorderService) {
    const fgo = typeof window !== 'undefined' ? window.FactionArchiveGroupOrderHelpers : null;
    const hro = typeof window !== 'undefined' ? window.HeroArchiveRoleOrderHelpers : null;
    const archSrc = reorderService.eventManager.dataService?.getArchiveSource?.();
    if (!((fgo && archSrc === 'factions') || (hro && archSrc === 'heroes'))) return;

    document.querySelectorAll('.event-archive-type-separator').forEach((sep) => {
        sep.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        sep.addEventListener('drop', (e) => {
            e.preventDefault();
            const dragged = reorderService.eventManager.draggedElement;
            if (!dragged || !dragged.classList.contains('event-item')) return;
            const fromIndex = parseInt(dragged.dataset.index, 10);
            const evs = reorderService.eventManager.events;

            if (archSrc === 'factions' && fgo && sep.dataset.dropFactionType !== undefined) {
                const typeKey = sep.dataset.dropFactionType != null ? sep.dataset.dropFactionType : '';
                const toIndex = fgo.findFirstIndexForFactionTypeInList(evs, typeKey);
                reorderService.reorderEvents(fromIndex, toIndex, { targetFactionType: typeKey });
            } else if (archSrc === 'heroes' && hro && sep.dataset.dropHeroRole !== undefined) {
                const roleKey = sep.dataset.dropHeroRole != null ? sep.dataset.dropHeroRole : '';
                if ('dropHeroSubRole' in sep.dataset) {
                    const subKey = sep.dataset.dropHeroSubRole != null ? sep.dataset.dropHeroSubRole : '';
                    const toIndex = hro.findFirstIndexForHeroRoleAndSubroleInList(evs, roleKey, subKey);
                    reorderService.reorderEvents(fromIndex, toIndex, {
                        targetHeroRole: roleKey,
                        targetHeroSubRole: subKey
                    });
                } else {
                    const toIndex = hro.findFirstIndexForHeroRoleInList(evs, roleKey);
                    reorderService.reorderEvents(fromIndex, toIndex, {
                        targetHeroRole: roleKey,
                        clearHeroSubRoleOnRoleDrop: true
                    });
                }
            }
        });
    });
}
