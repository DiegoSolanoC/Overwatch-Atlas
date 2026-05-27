/**
 * Event manager list filtering: title + hero/faction/NPC/country axes.
 * @param {object} mgr — EventManager instance (search* fields, dataService, eventItemVariantIndices)
 * @param {object} item — event or variant row
 */
function computeSearchAxisMatchesForItem(mgr, item) {
    const heroFilters = mgr.searchHeroFilters || [];
    const factionFilters = mgr.searchFactionFilters || [];
    const npcFilters = mgr.searchNpcFilters || [];
    const countryFilters = mgr.searchCountryFilters || [];
    const rawUnmatched = mgr.searchUnmatchedFilterTokens || [];
    const unmatchedLower = rawUnmatched.map((t) => String(t || '').trim().toLowerCase()).filter(Boolean);
    const hasU = unmatchedLower.length > 0;
    const S = typeof window !== 'undefined' ? window.StoryFilterPlacesSync : null;
    const itemHeroes = S?.getStoryEventHeroTokens?.(item) ?? item?.filters ?? [];
    const itemNpcs = S?.getStoryEventNpcTokens?.(item) ?? item?.npcs ?? [];
    const itemFactions = S?.getStoryEventFactionTokens?.(item) ?? item?.factions ?? [];
    const hasH = heroFilters.length > 0;
    const hasF = factionFilters.length > 0;
    const hasN = npcFilters.length > 0;
    const heroHit = hasH && heroFilters.some((h) => itemHeroes.includes(h));
    const npcHit = hasN && npcFilters.some((n) => itemNpcs.includes(n));
    const fh = typeof window !== 'undefined' && window.FactionMatchHelpers;
    const factionHit =
        hasF &&
        factionFilters.some((f) =>
            itemFactions.some((itemF) =>
                fh && typeof fh.factionIdsMatch === 'function' ? fh.factionIdsMatch(itemF, f) : itemF === f
            )
        );
    const nameLower = (item?.name || '').toLowerCase();
    const unmatchedHit = hasU && unmatchedLower.every((t) => nameLower.includes(t));
    let matchHeroFaction;
    if (!hasH && !hasF && !hasN && !hasU) {
        matchHeroFaction = true;
    } else {
        const hFnHit = (hasH && heroHit) || (hasF && factionHit) || (hasN && npcHit);
        const parts = [];
        if (hasH || hasF || hasN) parts.push(hFnHit);
        if (hasU) parts.push(unmatchedHit);
        matchHeroFaction = parts.some(Boolean);
    }

    const flagFn =
        typeof window !== 'undefined' &&
        window.LocationFlagHelpers &&
        typeof window.LocationFlagHelpers.getResolvedFlagFilename === 'function'
            ? window.LocationFlagHelpers.getResolvedFlagFilename
            : null;
    let matchCountry = true;
    if (countryFilters.length > 0 && flagFn) {
        const countrySet = new Set(countryFilters);
        const locName = item?.cityDisplayName ?? '';
        const locType = item?.locationType || 'earth';
        const resolved = flagFn(locName, locType);
        const primaryMatch = !!resolved && countrySet.has(resolved);
        const lhSec = typeof window !== 'undefined' ? window.LocationFlagHelpers : null;
        const secondary =
            lhSec && typeof lhSec.getSecondaryCountryFlagFilenamesForEntity === 'function'
                ? lhSec.getSecondaryCountryFlagFilenamesForEntity(item)
                : [];
        const secondaryMatch = Array.isArray(secondary) && secondary.some((fn) => countrySet.has(fn));
        matchCountry = primaryMatch || secondaryMatch;
    } else if (countryFilters.length > 0) {
        matchCountry = false;
    }
    return { matchHeroFaction, matchCountry };
}

/**
 * For list UI: which search axes match this item (variant row).
 * @param {object} mgr
 * @param {object} item
 */
export function getSearchMatchAxesForItem(mgr, item) {
    const heroFilters = mgr.searchHeroFilters || [];
    const factionFilters = mgr.searchFactionFilters || [];
    const npcFilters = mgr.searchNpcFilters || [];
    const countryFilters = mgr.searchCountryFilters || [];
    const hasUnmatched = (mgr.searchUnmatchedFilterTokens || []).some((t) => String(t || '').trim());
    const filterActive = heroFilters.length > 0 || factionFilters.length > 0 || npcFilters.length > 0 || hasUnmatched;
    const countryActive = countryFilters.length > 0;
    if (!filterActive && !countryActive) {
        return { filterActive: false, countryActive: false, filterHit: false, countryHit: false };
    }
    const { matchHeroFaction, matchCountry } = computeSearchAxisMatchesForItem(mgr, item);
    return {
        filterActive,
        countryActive,
        filterHit: filterActive && matchHeroFaction,
        countryHit: countryActive && matchCountry
    };
}

/**
 * @param {object} mgr
 * @param {Array<object>} all
 */
export function getFilteredEventsFromList(mgr, all) {
    if (!Array.isArray(all)) return [];
    const q = (mgr.searchQuery || '').trim().toLowerCase();
    const heroFilters = mgr.searchHeroFilters || [];
    const factionFilters = mgr.searchFactionFilters || [];
    const npcFilters = mgr.searchNpcFilters || [];
    const countryFilters = mgr.searchCountryFilters || [];
    const unmatchedTokens = (mgr.searchUnmatchedFilterTokens || [])
        .map((t) => String(t || '').trim())
        .filter(Boolean);
    if (
        !q &&
        heroFilters.length === 0 &&
        factionFilters.length === 0 &&
        npcFilters.length === 0 &&
        countryFilters.length === 0 &&
        unmatchedTokens.length === 0
    ) {
        return all;
    }
    const filterGroupActive =
        heroFilters.length > 0 ||
        factionFilters.length > 0 ||
        npcFilters.length > 0 ||
        unmatchedTokens.length > 0;
    const countryGroupActive = countryFilters.length > 0;

    const titleTokens = q ? q.split(/\s+/).filter((t) => t.length > 0) : [];
    const matchesItem = (item) => {
        const name = (item?.name || '').toLowerCase();
        const matchTitle =
            !q || (titleTokens.length > 0 ? titleTokens.every((t) => name.includes(t)) : name.includes(q));
        const { matchHeroFaction, matchCountry } = computeSearchAxisMatchesForItem(mgr, item);
        let dimPass = true;
        if (filterGroupActive && countryGroupActive) {
            dimPass = matchHeroFaction || matchCountry;
        } else if (filterGroupActive) {
            dimPass = matchHeroFaction;
        } else if (countryGroupActive) {
            dimPass = matchCountry;
        }
        return matchTitle && dimPass;
    };

    return all.filter((event) => {
        if (matchesItem(event)) {
            return true;
        }

        if (event?.variants && Array.isArray(event.variants) && event.variants.length > 0) {
            const matchedIndex = event.variants.findIndex((v) => matchesItem(v));
            if (matchedIndex !== -1) {
                const fullIndex = all.indexOf(event);
                if (fullIndex !== -1 && mgr.eventItemVariantIndices) {
                    mgr.eventItemVariantIndices.set(`event-${fullIndex}`, matchedIndex);
                }
                return true;
            }
        }
        return false;
    });
}
