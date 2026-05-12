/**
 * Build the variant strip from a stored event and load its first variant into the form.
 *
 * The function handles both shapes of event in our data:
 *   - **Multi-event**: `event.variants` is a non-empty array. Each variant gets cloned into
 *     `variantData[]` with its own location type/coords/cityDisplayName.
 *   - **Single event**: top-level fields *are* the variant. We build a one-row `variantData`
 *     mirroring those fields so the rest of the form-editing code sees one consistent shape.
 *
 * Filter places (hero/faction/npc/secondaryCountry) are deep-cloned via `cloneFp` to avoid
 * mutating the live event when the user edits — `saveEvent` overwrites them on save.
 *
 * After variantData is set, the function inlines the same field-loading logic
 * `loadVariantToForm` uses for variant 0, but **without** an implicit save (the data we just
 * wrote in is the desired state; saving the empty form back would clobber it).
 *
 * Side effects:
 *   - Mutates `eventManager.variantData` and `activeVariantIndex`.
 *   - Calls `setLocationType()` which updates DOM button highlight and toggles field visibility.
 *   - Calls `updateVariantTabs()` at the end to repaint the tab strip.
 *
 * @param {any} formService Owning EventFormService.
 * @param {*} event Stored event (single- or multi-variant shape).
 */
export function populateEditForm(formService, event) {
    if (!formService.eventManager) return;

    formService.eventManager.variantData = [];
    formService.eventManager.activeVariantIndex = 0;

    const ysEl = document.getElementById('eventEditYearStart');
    const yeEl = document.getElementById('eventEditYearEnd');
    if (ysEl) ysEl.value = event.yearStart != null && event.yearStart !== '' ? String(event.yearStart) : '';
    if (yeEl) yeEl.value = event.yearEnd != null && event.yearEnd !== '' ? String(event.yearEnd) : '';
    const eraPop = document.getElementById('eventEditEraName');
    if (eraPop) eraPop.value = event.eraName != null ? String(event.eraName) : '';

    const eventNumberInput = document.getElementById('eventEditNumber');
    if (eventNumberInput && formService.eventManager.editingIndex !== null) {
        eventNumberInput.value = formService.eventManager.editingIndex + 1;
    }

    const isMultiEvent = event.variants && event.variants.length > 0;
    const mainLocationType = isMultiEvent && event.variants[0]
        ? (event.variants[0].locationType || event.locationType || 'earth')
        : (event.locationType || 'earth');

    formService.setLocationType(mainLocationType);

    if (isMultiEvent && event.variants[0]) {
        const variant = event.variants[0];
        const variantLocationType = variant.locationType || mainLocationType;
        if (variantLocationType === 'earth') {
            document.getElementById('eventEditLat').value = variant.lat !== undefined ? variant.lat : (event.lat || '');
            document.getElementById('eventEditLon').value = variant.lon !== undefined ? variant.lon : (event.lon || '');
        } else {
            document.getElementById('eventEditX').value = variant.x !== undefined ? variant.x : (event.x || '');
            document.getElementById('eventEditY').value = variant.y !== undefined ? variant.y : (event.y || '');
        }
        document.getElementById('eventEditCityDisplayName').value = variant.cityDisplayName || event.cityDisplayName || '';
    } else {
        if (mainLocationType === 'earth') {
            document.getElementById('eventEditLat').value = event.lat || '';
            document.getElementById('eventEditLon').value = event.lon || '';
        } else {
            document.getElementById('eventEditX').value = event.x || '';
            document.getElementById('eventEditY').value = event.y || '';
        }
        document.getElementById('eventEditCityDisplayName').value = event.cityDisplayName || '';
    }
    {
        const ltNow = document.getElementById('eventEditLocationType')?.value;
        if (ltNow === 'station' || ltNow === 'marsShip') {
            const xEl = document.getElementById('eventEditX');
            const yEl = document.getElementById('eventEditY');
            if (xEl && !String(xEl.value).trim()) xEl.value = '50';
            if (yEl && !String(yEl.value).trim()) yEl.value = '50';
        }
    }
    document.getElementById('eventEditCity').value = '';

    const cloneFp = (rows) => (Array.isArray(rows)
        ? rows.map((p) => ({
            locationName: p?.locationName ?? '',
            country: p?.country ?? '',
            reasoning: p?.reasoning ?? ''
        }))
        : []);

    if (isMultiEvent) {
        formService.eventManager.variantData = event.variants.map((variant) => ({
            name: variant.name || '',
            description: variant.description || '',
            sources: variant.sources || [],
            headlines: variant.headlines || [],
            locationType: variant.locationType || mainLocationType,
            lat: variant.lat !== undefined ? variant.lat : undefined,
            lon: variant.lon !== undefined ? variant.lon : undefined,
            x: variant.x !== undefined ? variant.x : undefined,
            y: variant.y !== undefined ? variant.y : undefined,
            cityDisplayName: variant.cityDisplayName || undefined,
            secondaryCountryPlaces: cloneFp(variant.secondaryCountryPlaces),
            heroFilterPlaces: cloneFp(variant.heroFilterPlaces),
            factionFilterPlaces: cloneFp(variant.factionFilterPlaces),
            npcFilterPlaces: cloneFp(variant.npcFilterPlaces)
        }));
        formService.eventManager.activeVariantIndex = 0;
    } else {
        formService.eventManager.variantData = [{
            name: event.name || '',
            description: event.description || '',
            sources: event.sources || [],
            headlines: event.headlines || [],
            locationType: event.locationType || 'earth',
            lat: event.lat !== undefined ? event.lat : undefined,
            lon: event.lon !== undefined ? event.lon : undefined,
            x: event.x !== undefined ? event.x : undefined,
            y: event.y !== undefined ? event.y : undefined,
            cityDisplayName: event.cityDisplayName || undefined,
            secondaryCountryPlaces: cloneFp(event.secondaryCountryPlaces),
            heroFilterPlaces: cloneFp(event.heroFilterPlaces),
            factionFilterPlaces: cloneFp(event.factionFilterPlaces),
            npcFilterPlaces: cloneFp(event.npcFilterPlaces)
        }];
        formService.eventManager.activeVariantIndex = 0;
    }

    if (formService.eventManager.variantData.length > 0) {
        const variant = formService.eventManager.variantData[0];
        document.getElementById('eventEditName').value = variant.name || '';
        document.getElementById('eventEditDescription').value = variant.description || '';
        const syncPop = window.StoryFilterPlacesSync;
        document.getElementById('eventEditFilters').value = (syncPop?.getStoryEventHeroTokens?.(variant) || []).join(', ');
        const displayFactions = formService.factionsArrayToFormDisplayString(
            syncPop?.getStoryEventFactionTokens?.(variant) || [],
            formService.eventManager.factions || []
        );
        document.getElementById('eventEditFactions').value = displayFactions;
        const npcsPop = document.getElementById('eventEditNpcs');
        if (npcsPop) npcsPop.value = (syncPop?.getStoryEventNpcTokens?.(variant) || []).join(', ');
        const secondaryPop = document.getElementById('eventEditSecondaryCountries');
        if (secondaryPop) {
            const lhPop = window.LocationFlagHelpers;
            const secF = lhPop?.getSecondaryCountryFlagFilenamesForEntity?.(variant) || [];
            secondaryPop.value = secF.length ? formService.secondaryFlagsToFormString(secF) : '';
        }

        formService.setLocationType(variant.locationType || 'earth');

        if (variant.locationType === 'earth') {
            if (variant.lat !== undefined) document.getElementById('eventEditLat').value = variant.lat;
            if (variant.lon !== undefined) document.getElementById('eventEditLon').value = variant.lon;
        } else {
            if (variant.x !== undefined) document.getElementById('eventEditX').value = variant.x;
            if (variant.y !== undefined) document.getElementById('eventEditY').value = variant.y;
        }

        // Only override if variant has its own cityDisplayName, otherwise keep what was set above.
        if (variant.cityDisplayName !== undefined && variant.cityDisplayName !== null && variant.cityDisplayName !== '') {
            document.getElementById('eventEditCityDisplayName').value = variant.cityDisplayName;
        }

        formService.sourceFieldManager.loadSources(variant.sources || []);
        formService.headlinesFieldManager.loadHeadlines(variant.headlines || []);
    }

    formService.updateVariantTabs();
}
