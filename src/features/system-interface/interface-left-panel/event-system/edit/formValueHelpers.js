/**
 * formValueHelpers — small pure helpers shared by `createEventFromForm` and
 * `buildVariantFromForm`.
 *
 *   - `cloneFilterPlaceRows`     — deep-clones `*FilterPlaces` arrays, retaining only the
 *     three persisted fields (`locationName`, `country`, `reasoning`). Used so editing the
 *     edit form never mutates the stored event until `addEvent` / `updateEvent` commits.
 *
 *   - `processFiltersAndFactions` — resolves free-text faction tokens to manifest
 *     `displayName`s. Filters CSV is just trimmed; factions get a three-way match
 *     (displayName / filename / `FactionMatchHelpers.factionIdsMatch`) so users can paste
 *     either form. Unmatched tokens pass through verbatim so we don't silently lose typos.
 */

/** Deep-clone an array of `{ locationName, country, reasoning }` rows, dropping junk fields. */
export function cloneFilterPlaceRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows.map((p) => ({
        locationName: p.locationName,
        country: p.country,
        reasoning: p.reasoning
    }));
}

/**
 * @param {string} filtersStr Raw user-entered csv string for filters/heroes.
 * @param {string} factionsStr Raw user-entered csv string for factions.
 * @param {{ filename: string, displayName: string }[]} availableFactions Manifest list.
 */
export function processFiltersAndFactions(filtersStr, factionsStr, availableFactions) {
    const filters = filtersStr ? filtersStr.split(',').map((f) => f.trim()).filter((f) => f) : [];
    const factionDisplayNames = factionsStr ? factionsStr.split(',').map((f) => f.trim()).filter((f) => f) : [];
    const fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
    const factionsResolved = factionDisplayNames.map((displayName) => {
        const dn = displayName.trim();
        const found = availableFactions.find((f) =>
            f.displayName.toLowerCase() === dn.toLowerCase()
            || f.filename.toLowerCase() === dn.toLowerCase()
            || (fh && typeof fh.factionIdsMatch === 'function' && (
                fh.factionIdsMatch(f.filename, dn) || fh.factionIdsMatch(f.displayName, dn)
            ))
        );
        return found ? found.displayName : dn;
    });
    return { filters, factions: factionsResolved };
}
