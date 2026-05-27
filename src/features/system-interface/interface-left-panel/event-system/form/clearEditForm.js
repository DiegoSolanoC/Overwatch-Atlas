/**
 * Reset every field on the event edit form back to empty defaults, then drop in a single
 * empty `variantData[0]` so the variant tabs immediately re-render with the "1" tab visible.
 *
 * The event-number field gets a sensible default of "append at end" (`events.length + 1`),
 * because the manager always opens this form for a new event.
 *
 * Side effects:
 *   - Resets location type to `'earth'` (which itself triggers `updateLocationFields()`).
 *   - Clears all source-pair rows and headline rows via the field-manager helpers.
 *   - Resets `activeVariantIndex` to 0 and renders the variant tab strip.
 *
 * @param {any} formService Owning EventFormService.
 */
export function clearEditForm(formService) {
    if (!formService.eventManager) return;

    document.getElementById('eventEditName').value = '';
    // Default to appending after the current list.
    const defaultEventNumber = formService.eventManager.events.length + 1;
    document.getElementById('eventEditNumber').value = defaultEventNumber;
    document.getElementById('eventEditCity').value = '';
    document.getElementById('eventEditCityDisplayName').value = '';
    document.getElementById('eventEditLat').value = '';
    document.getElementById('eventEditLon').value = '';
    document.getElementById('eventEditX').value = '';
    document.getElementById('eventEditY').value = '';
    document.getElementById('eventEditDescription').value = '';
    document.getElementById('eventEditFilters').value = '';
    document.getElementById('eventEditFactions').value = '';
    const npcsClear = document.getElementById('eventEditNpcs');
    if (npcsClear) npcsClear.value = '';
    const yStart = document.getElementById('eventEditYearStart');
    const yEnd = document.getElementById('eventEditYearEnd');
    if (yStart) yStart.value = '';
    if (yEnd) yEnd.value = '';
    const eraEl = document.getElementById('eventEditEraName');
    if (eraEl) eraEl.value = '';
    const secondaryCountriesEl = document.getElementById('eventEditSecondaryCountries');
    if (secondaryCountriesEl) secondaryCountriesEl.value = '';

    // Setting location type cascades to updateLocationFields() which sets the per-type defaults.
    formService.setLocationType('earth');
    formService.clearSourcePairs();
    formService.clearHeadlineFields();

    // Always show at least one variant tab.
    formService.eventManager.variantData = [{
        name: '',
        description: '',
        sources: [],
        headlines: [],
        locationType: 'earth'
    }];
    formService.eventManager.activeVariantIndex = 0;
    formService.updateVariantTabs();
}
