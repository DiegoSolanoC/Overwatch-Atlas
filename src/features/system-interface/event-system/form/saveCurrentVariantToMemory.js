/**
 * Snapshot the live form values into `eventManager.variantData[activeVariantIndex]`.
 *
 * Field handling notes:
 *   - **Hero / faction / npc text inputs** are split on `,`, trimmed, and resolved against
 *     `eventManager.factions` / `eventManager.npcs`. Resolved values become a *single*
 *     `*FilterPlaces` row with all tokens joined back into the `country` field — matches the
 *     story-archive grouped-filter schema (`{ locationName: '', country: 'csv', reasoning: '' }`).
 *   - The actual write goes through `window.StoryFilterPlacesSync.applyStoryFilterPlacesToTarget`,
 *     which knows how to fold those rows back into the canonical fields without losing existing
 *     `locationName`/`reasoning` text.
 *   - **Secondary countries** are parsed via `window.LocationFlagHelpers.parseSecondaryCountryList`
 *     and stored as `secondaryCountryPlaces` (single row csv). Legacy `secondaryCountryFlags`
 *     is always deleted on save.
 *   - **Coordinates** read from one of `(lat, lon)` or `(x, y)` depending on `locationType`,
 *     and the unused pair is explicitly set to `undefined` so old values can't bleed through.
 *   - **Headlines** are preserved if the form is empty but the variant had non-empty headlines
 *     stored before (defensive — prevents accidentally wiping headlines on a routine save).
 *
 * @param {any} formService Owning EventFormService.
 */
export function saveCurrentVariantToMemory(formService) {
    if (!formService.eventManager || formService.eventManager.variantData.length === 0) return;

    const variant = formService.eventManager.variantData[formService.eventManager.activeVariantIndex];
    if (!variant) return;

    variant.name = document.getElementById('eventEditName').value.trim();
    variant.description = document.getElementById('eventEditDescription').value.trim();

    const filtersStr = document.getElementById('eventEditFilters').value.trim();
    const heroTokens = filtersStr ? filtersStr.split(',').map((f) => f.trim()).filter(Boolean) : [];
    const heroRows = heroTokens.length
        ? [{ locationName: '', country: heroTokens.join(', '), reasoning: '' }]
        : [];

    const factionsStr = document.getElementById('eventEditFactions').value.trim();
    const factionDisplayNames = factionsStr ? factionsStr.split(',').map((f) => f.trim()).filter((f) => f) : [];
    const fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
    const resolvedFactions = factionDisplayNames.map((displayName) => {
        const dn = displayName.trim();
        const found = formService.eventManager.factions.find((f) =>
            f.displayName.toLowerCase() === dn.toLowerCase()
            || f.filename.toLowerCase() === dn.toLowerCase()
            || (fh && typeof fh.factionIdsMatch === 'function' && (
                fh.factionIdsMatch(f.filename, dn) || fh.factionIdsMatch(f.displayName, dn)
            ))
        );
        return found ? found.displayName : dn;
    });
    const factionRows = resolvedFactions.length
        ? [{ locationName: '', country: resolvedFactions.join(', '), reasoning: '' }]
        : [];

    const npcsField = document.getElementById('eventEditNpcs');
    let npcRows = [];
    if (npcsField) {
        const npcsStr = npcsField.value.trim();
        const npcTokens = npcsStr ? npcsStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
        const manifestNpcs = formService.eventManager.npcs || [];
        const npcCanon = new Map(manifestNpcs.map((n) => [String(n).toLowerCase(), n]));
        const resolvedNpcs = npcTokens.map((t) => npcCanon.get(t.toLowerCase()) || t);
        npcRows = resolvedNpcs.length
            ? [{ locationName: '', country: resolvedNpcs.join(', '), reasoning: '' }]
            : [];
    }
    const applyFp = window.StoryFilterPlacesSync?.applyStoryFilterPlacesToTarget;
    if (applyFp) {
        applyFp(variant, heroRows, factionRows, npcRows);
    }

    const secondaryCountriesInput = document.getElementById('eventEditSecondaryCountries');
    const parseSecondary = window.LocationFlagHelpers && typeof window.LocationFlagHelpers.parseSecondaryCountryList === 'function'
        ? window.LocationFlagHelpers.parseSecondaryCountryList
        : null;
    if (secondaryCountriesInput && parseSecondary) {
        const ltInput = document.getElementById('eventEditLocationType');
        const locForSecondary = (ltInput && ltInput.value) ? ltInput.value : (variant.locationType || 'earth');
        const secondaryList = parseSecondary(secondaryCountriesInput.value, locForSecondary);
        if (secondaryList.length > 0) {
            variant.secondaryCountryPlaces = [{
                locationName: '',
                country: formService.secondaryFlagsToFormString(secondaryList),
                reasoning: ''
            }];
        } else {
            delete variant.secondaryCountryPlaces;
        }
        delete variant.secondaryCountryFlags;
    } else if (secondaryCountriesInput) {
        delete variant.secondaryCountryFlags;
    }

    const locationTypeInput = document.getElementById('eventEditLocationType');
    if (locationTypeInput) {
        variant.locationType = locationTypeInput.value;
    }

    const latInput = document.getElementById('eventEditLat');
    const lonInput = document.getElementById('eventEditLon');
    const xInput = document.getElementById('eventEditX');
    const yInput = document.getElementById('eventEditY');

    if (variant.locationType === 'earth') {
        if (latInput && latInput.value.trim()) {
            const lat = parseFloat(latInput.value.trim());
            variant.lat = isNaN(lat) ? undefined : lat;
        } else {
            variant.lat = undefined;
        }
        if (lonInput && lonInput.value.trim()) {
            const lon = parseFloat(lonInput.value.trim());
            variant.lon = isNaN(lon) ? undefined : lon;
        } else {
            variant.lon = undefined;
        }
        // Clear non-Earth coords so an old value can't leak through after type swap.
        variant.x = undefined;
        variant.y = undefined;
    } else {
        if (xInput && xInput.value.trim()) {
            const x = parseFloat(xInput.value.trim());
            variant.x = isNaN(x) ? undefined : x;
        } else {
            variant.x = undefined;
        }
        if (yInput && yInput.value.trim()) {
            const y = parseFloat(yInput.value.trim());
            variant.y = isNaN(y) ? undefined : y;
        } else {
            variant.y = undefined;
        }
        variant.lat = undefined;
        variant.lon = undefined;
    }

    const cityDisplayNameInput = document.getElementById('eventEditCityDisplayName');
    if (cityDisplayNameInput) {
        const cityDisplayName = cityDisplayNameInput.value.trim();
        variant.cityDisplayName = cityDisplayName || undefined;
    }

    variant.sources = formService.sourceFieldManager.getSourcePairsData();

    const headlines = formService.headlinesFieldManager.getHeadlinesData();

    // Don't wipe stored headlines when the form is empty but the variant had them — guards
    // against losing data on a quick variant switch + save round-trip.
    if (headlines.length > 0) {
        variant.headlines = headlines;
    } else if (!(variant.headlines && Array.isArray(variant.headlines) && variant.headlines.length > 0)) {
        variant.headlines = undefined;
    }
}
