/**
 * Load a single variant's stored data back into the live form fields.
 *
 * Called when:
 *   - The user clicks a variant tab → switch active variant.
 *   - A new variant is added via the `+` tab.
 *   - A variant is deleted and we reload whichever variant became active.
 *
 * Behavior notes:
 *   - **Implicit save first**: if there's already an active variant in `variantData`, snapshot
 *     the current form into it via `saveCurrentVariantToMemory()` before swapping out. Skipping
 *     this would silently drop in-progress edits.
 *   - **Filter places → text inputs**: hero / faction / npc tokens are pulled from the
 *     `*FilterPlaces` rows via `StoryFilterPlacesSync` and joined back into csv.
 *   - **Faction display names**: tokens stored as `filename`s are translated to
 *     `displayName`s using `factionsArrayToFormDisplayString` so the user sees friendly text.
 *   - **Station / marsShip defaults**: when no x/y stored, seed `50,50` so the form shows
 *     something reasonable instead of empty fields.
 *   - **cityDisplayName fallback chain**: variant → editing main event → empty. Important
 *     for multi-event edits where individual variants don't store their own city name.
 *
 * @param {any} formService Owning EventFormService.
 * @param {number} variantIndex Target variant index.
 */
export function loadVariantToForm(formService, variantIndex) {
    if (!formService.eventManager) return;
    if (variantIndex < 0 || variantIndex >= formService.eventManager.variantData.length) return;

    if (
        formService.eventManager.variantData.length > 0
        && formService.eventManager.activeVariantIndex >= 0
        && formService.eventManager.activeVariantIndex < formService.eventManager.variantData.length
    ) {
        formService.saveCurrentVariantToMemory();
    }

    formService.eventManager.activeVariantIndex = variantIndex;
    const variant = formService.eventManager.variantData[variantIndex];

    document.getElementById('eventEditName').value = variant.name || '';
    document.getElementById('eventEditDescription').value = variant.description || '';
    const sync = window.StoryFilterPlacesSync;
    document.getElementById('eventEditFilters').value = (sync?.getStoryEventHeroTokens?.(variant) || []).join(', ');
    const displayFactions = formService.factionsArrayToFormDisplayString(
        sync?.getStoryEventFactionTokens?.(variant) || [],
        formService.eventManager.factions || []
    );
    document.getElementById('eventEditFactions').value = displayFactions;
    const npcsLoad = document.getElementById('eventEditNpcs');
    if (npcsLoad) npcsLoad.value = (sync?.getStoryEventNpcTokens?.(variant) || []).join(', ');
    const secondaryCountriesField = document.getElementById('eventEditSecondaryCountries');
    if (secondaryCountriesField) {
        const lh = window.LocationFlagHelpers;
        const secFiles = lh?.getSecondaryCountryFlagFilenamesForEntity?.(variant) || [];
        secondaryCountriesField.value = secFiles.length ? formService.secondaryFlagsToFormString(secFiles) : '';
    }

    formService.setLocationType(variant.locationType || 'earth');

    if (variant.locationType === 'earth') {
        if (variant.lat !== undefined) document.getElementById('eventEditLat').value = variant.lat;
        if (variant.lon !== undefined) document.getElementById('eventEditLon').value = variant.lon;
    } else {
        if (variant.x !== undefined) document.getElementById('eventEditX').value = variant.x;
        if (variant.y !== undefined) document.getElementById('eventEditY').value = variant.y;
        const vLt = variant.locationType || 'earth';
        if (vLt === 'station' || vLt === 'marsShip') {
            const xEl = document.getElementById('eventEditX');
            const yEl = document.getElementById('eventEditY');
            if (xEl && !String(xEl.value).trim()) xEl.value = '50';
            if (yEl && !String(yEl.value).trim()) yEl.value = '50';
        }
    }

    if (variant.cityDisplayName !== undefined && variant.cityDisplayName !== null && variant.cityDisplayName !== '') {
        document.getElementById('eventEditCityDisplayName').value = variant.cityDisplayName;
    } else if (formService.eventManager.editingIndex !== null && formService.eventManager.editingIndex !== undefined) {
        const mainEvent = formService.eventManager.events[formService.eventManager.editingIndex];
        document.getElementById('eventEditCityDisplayName').value = (mainEvent && mainEvent.cityDisplayName) || '';
    } else {
        document.getElementById('eventEditCityDisplayName').value = '';
    }

    formService.sourceFieldManager.loadSources(variant.sources || []);
    formService.headlinesFieldManager.loadHeadlines(variant.headlines || []);
}
