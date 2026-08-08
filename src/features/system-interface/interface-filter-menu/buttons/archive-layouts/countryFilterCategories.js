/**
 * Country filter tiers by timeline usage count.
 *   - Primary:   ≥ {@link COUNTRY_PRIMARY_MIN_ENTRIES} story entries
 *   - Occasional: 1 … primaryMin − 1
 *   - Unvisited: 0 (search-only visibility)
 */

export const COUNTRY_PRIMARY_MIN_ENTRIES = 5;

/** @typedef {'primary'|'occasional'|'unvisited'} CountryFilterTier */

/** @type {readonly { key: CountryFilterTier, label: string }[]} */
export const COUNTRY_FILTER_TIER_ORDER = Object.freeze([
    { key: 'primary', label: 'Primary Locations' },
    { key: 'occasional', label: 'Occasional Locations' },
    { key: 'unvisited', label: 'Unvisited Locations' },
]);

/**
 * @param {number} eventMatchCount
 * @returns {CountryFilterTier}
 */
export function countryFilterTierForCount(eventMatchCount) {
    const n = Number(eventMatchCount) || 0;
    if (n >= COUNTRY_PRIMARY_MIN_ENTRIES) return 'primary';
    if (n > 0) return 'occasional';
    return 'unvisited';
}

/**
 * @param {Array<{ commonName?: string, flagFile?: string, eventMatchCount?: number }>} items
 * @returns {Record<CountryFilterTier, typeof items>}
 */
export function groupCountriesByFilterTier(items) {
    /** @type {Record<CountryFilterTier, typeof items>} */
    const groups = {
        primary: [],
        occasional: [],
        unvisited: [],
    };

    const list = Array.isArray(items) ? items.slice() : [];
    list.sort((a, b) =>
        String(a?.commonName || '').localeCompare(String(b?.commonName || ''), undefined, {
            numeric: true,
            sensitivity: 'base',
        }),
    );

    for (const item of list) {
        const tier = countryFilterTierForCount(item?.eventMatchCount);
        groups[tier].push(item);
    }
    return groups;
}
