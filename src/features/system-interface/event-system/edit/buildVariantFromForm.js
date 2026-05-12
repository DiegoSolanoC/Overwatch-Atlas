/**
 * Turn one row of `variantData` (the in-memory snapshot kept on `EventManager.variantData`)
 * into the persistent shape used by `event.variants[]`.
 *
 * Three correctness invariants enforced here that the prior inline code was sloppy about:
 *
 *   - **Coordinate fields scoped to location type**: `lat`/`lon` only on earth variants,
 *     `x`/`y` only on moon/mars. No stale Earth coordinates leak onto a station variant.
 *
 *   - **Headlines normalized to array**: accepts either `string[]` or `string`, empty
 *     becomes `undefined` so the json stays clean.
 *
 *   - **FilterPlaces deep-cloned**: every `secondaryCountryPlaces` / `heroFilterPlaces` /
 *     `factionFilterPlaces` / `npcFilterPlaces` array is cloned so mutating the form can't
 *     reach back into the stored event by reference.
 */

import { cloneFilterPlaceRows } from './formValueHelpers.js';

export function buildVariantFromForm(variant) {
    let headlines;
    if (variant.headlines) {
        if (Array.isArray(variant.headlines) && variant.headlines.length > 0) {
            headlines = variant.headlines;
        } else if (typeof variant.headlines === 'string' && variant.headlines.trim()) {
            headlines = [variant.headlines.trim()];
        }
    }

    const variantObj = {
        name: variant.name || '',
        description: variant.description || '',
        sources: variant.sources && variant.sources.length > 0 ? variant.sources : undefined,
        headlines,
        image: '',
        locationType: variant.locationType || 'earth'
    };

    if (variant.locationType === 'earth') {
        if (variant.lat !== undefined) variantObj.lat = variant.lat;
        if (variant.lon !== undefined) variantObj.lon = variant.lon;
    } else {
        if (variant.x !== undefined) variantObj.x = variant.x;
        if (variant.y !== undefined) variantObj.y = variant.y;
    }

    if (variant.cityDisplayName !== undefined) {
        variantObj.cityDisplayName = variant.cityDisplayName;
    }

    const secondary = cloneFilterPlaceRows(variant.secondaryCountryPlaces);
    if (secondary) variantObj.secondaryCountryPlaces = secondary;
    const heroes = cloneFilterPlaceRows(variant.heroFilterPlaces);
    if (heroes) variantObj.heroFilterPlaces = heroes;
    const factions = cloneFilterPlaceRows(variant.factionFilterPlaces);
    if (factions) variantObj.factionFilterPlaces = factions;
    const npcs = cloneFilterPlaceRows(variant.npcFilterPlaces);
    if (npcs) variantObj.npcFilterPlaces = npcs;

    return variantObj;
}
