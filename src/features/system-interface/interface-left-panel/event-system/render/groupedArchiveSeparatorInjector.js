/**
 * Build a stateful separator injector for one render pass of a grouped archive
 * (factions or heroes). The injector remembers the "last group key" seen so far so it can
 * emit a separator only when the bucket actually changes between consecutive events.
 *
 * Two archive types are supported:
 *   - **factions** archive — one separator per `factionType` bucket.
 *   - **heroes** archive   — two levels: `heroRole` separator, then `heroSubRole`
 *     separator nested under it. Crossing into a new role resets the sub-key tracker so
 *     the first sub-separator under the new role always fires.
 *
 * When a page slice starts mid-bucket (page 2+ within a faction group), the caller can
 * call `seedFromPreviousEvent(prevEvent)` to prime the last-key state from the entry
 * immediately preceding the slice — that way the very first card on the page doesn't
 * redundantly print its own bucket header.
 *
 * @param {DocumentFragment} fragment Where separators are appended.
 * @param {object} factories `{ createFactionArchiveTypeSeparator, createHeroArchiveRoleSeparator, createHeroArchiveSubroleSeparator }`.
 * @param {object} helpers   `{ factionArchiveGroupOrder, heroArchiveRoleOrder, npcArchiveGroupOrder }` returning the live globals.
 * @returns {{
 *   seedFromPreviousEvent: (prev: any, kind: 'factions'|'heroes'|'npcs') => void,
 *   maybeEmitForEvent: (event: any, kind: 'factions'|'heroes'|'npcs') => void
 * }}
 */
export function createGroupedArchiveSeparatorInjector(fragment, factories, helpers) {
    let lastFactionGroupKey = '';
    let lastHeroGroupKey = '';
    let lastHeroSubKey = '';
    let lastNpcGroupKey = '';

    const seedFromPreviousEvent = (prevEvent, kind) => {
        if (!prevEvent) return;
        if (kind === 'factions') {
            const fgo = helpers.factionArchiveGroupOrder();
            if (!fgo) return;
            const pr = fgo.factionArchiveTypeRank(prevEvent?.factionType);
            lastFactionGroupKey = `${pr}|${fgo.normalizeFactionArchiveType(prevEvent?.factionType)}`;
        } else if (kind === 'heroes') {
            const hro = helpers.heroArchiveRoleOrder();
            if (!hro) return;
            const prh = hro.heroArchiveRoleRank(prevEvent?.heroRole);
            const nr = hro.normalizeHeroArchiveRole(prevEvent?.heroRole);
            lastHeroGroupKey = `${prh}|${nr}`;
            lastHeroSubKey = `${hro.heroArchiveSubroleRank(prevEvent?.heroSubRole, nr)}|${hro.normalizeHeroArchiveSubrole(prevEvent?.heroSubRole, nr)}`;
        } else if (kind === 'npcs') {
            const ngo = helpers.npcArchiveGroupOrder();
            if (!ngo) return;
            const pr = ngo.npcArchiveCategoryRank(prevEvent?.npcCategory);
            lastNpcGroupKey = `${pr}|${ngo.normalizeNpcArchiveCategory(prevEvent?.npcCategory)}`;
        }
    };

    const maybeEmitForEvent = (event, kind) => {
        if (kind === 'factions') {
            const fgo = helpers.factionArchiveGroupOrder();
            if (!fgo) return;
            const gRank = fgo.factionArchiveTypeRank(event?.factionType);
            const gKey = `${gRank}|${fgo.normalizeFactionArchiveType(event?.factionType)}`;
            if (gKey !== lastFactionGroupKey) {
                lastFactionGroupKey = gKey;
                fragment.appendChild(
                    factories.createFactionArchiveTypeSeparator(
                        fgo.displayLabelForFactionArchiveType(event?.factionType),
                        fgo.normalizeFactionArchiveType(event?.factionType)
                    )
                );
            }
        } else if (kind === 'heroes') {
            const hro = helpers.heroArchiveRoleOrder();
            if (!hro) return;
            const gRankH = hro.heroArchiveRoleRank(event?.heroRole);
            const normRole = hro.normalizeHeroArchiveRole(event?.heroRole);
            const gKeyH = `${gRankH}|${normRole}`;
            if (gKeyH !== lastHeroGroupKey) {
                lastHeroGroupKey = gKeyH;
                lastHeroSubKey = '';
                fragment.appendChild(
                    factories.createHeroArchiveRoleSeparator(
                        hro.displayLabelForHeroArchiveRole(event?.heroRole),
                        normRole
                    )
                );
            }
            const gRankS = hro.heroArchiveSubroleRank(event?.heroSubRole, normRole);
            const normSub = hro.normalizeHeroArchiveSubrole(event?.heroSubRole, normRole);
            const gKeyS = `${gRankS}|${normSub}`;
            if (gKeyS !== lastHeroSubKey) {
                lastHeroSubKey = gKeyS;
                fragment.appendChild(
                    factories.createHeroArchiveSubroleSeparator(
                        hro.displayLabelForHeroArchiveSubrole(event?.heroSubRole, normRole),
                        normRole,
                        normSub
                    )
                );
            }
        } else if (kind === 'npcs') {
            const ngo = helpers.npcArchiveGroupOrder();
            if (!ngo) return;
            const gRank = ngo.npcArchiveCategoryRank(event?.npcCategory);
            const gKey = `${gRank}|${ngo.normalizeNpcArchiveCategory(event?.npcCategory)}`;
            if (gKey !== lastNpcGroupKey) {
                lastNpcGroupKey = gKey;
                fragment.appendChild(
                    factories.createNpcArchiveCategorySeparator(
                        ngo.displayLabelForNpcArchiveCategory(event?.npcCategory),
                        ngo.normalizeNpcArchiveCategory(event?.npcCategory)
                    )
                );
            }
        }
    };

    return { seedFromPreviousEvent, maybeEmitForEvent };
}
