/**
 * createEventFromForm — assemble a persisted event object from the live edit form.
 *
 * Two output branches driven by `variantData.length`:
 *
 *   - **Multi-event** (`length > 1`): produces `{ variants: [...] }`. The top-level event
 *     copies the first variant's `locationType` and coords for backward compatibility with
 *     non-variant-aware consumers.
 *
 *   - **Single event** (`length <= 1`): produces a flat event. `*FilterPlaces` rows stored
 *     on `variantData[0]` win; if absent, we synthesize a single row from the main CSV
 *     strings the user typed in the form (so legacy edit flows that never touched the
 *     filter-place table still produce sane data).
 *
 * Validation:
 *   - Earth events require numeric `lat` and `lon`.
 *   - Non-Earth events require `x` and `y` in [0, 100].
 *   - `mainName` is required.
 *   - Multi-events must have ≥2 named variants.
 *   - Returns `{ error: string }` on any failure; otherwise `{ event }`.
 *
 * Delegates:
 *   - `timelineFormParsing.js`  — `yearStart`/`yearEnd`/era validation + writeback.
 *   - `buildVariantFromForm.js` — one variantData row → persisted variant shape.
 *   - `formValueHelpers.js`     — `cloneFilterPlaceRows`, `processFiltersAndFactions`.
 */

import {
    parseTimelineFormStrings,
    applyTimelineToEvent,
    applyEraNameToEvent
} from './timelineFormParsing.js';
import { cloneFilterPlaceRows, processFiltersAndFactions } from './formValueHelpers.js';
import { buildVariantFromForm } from './buildVariantFromForm.js';

/**
 * @param {Object} formData See destructure below for shape.
 * @param {Array}  variantData In-memory `EventManager.variantData`.
 * @param {Array}  factions Manifest faction list for display-name resolution.
 */
export function createEventFromForm(formData, variantData = [], factions = []) {
    const {
        locationType,
        lat, lon,
        x, y,
        mainName,
        mainDescription,
        mainFiltersStr,
        mainFactionsStr,
        mainSources,
        mainHeadlines,
        cityDisplayName,
        yearStartStr,
        yearEndStr,
        eraNameStr
    } = formData;

    const timeline = parseTimelineFormStrings(yearStartStr, yearEndStr);
    if (timeline.error) return { error: timeline.error };

    if (locationType === 'earth') {
        if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) {
            return { error: 'Please fill in Latitude and Longitude' };
        }
    } else {
        if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) {
            return { error: 'Please fill in X and Y coordinates (0-100)' };
        }
        if (x < 0 || x > 100 || y < 0 || y > 100) {
            return { error: 'X and Y coordinates must be between 0 and 100' };
        }
    }
    if (!mainName) {
        return { error: 'Please fill in the required field (Title)' };
    }

    const isMultiEvent = variantData.length > 1;
    const mainData = processFiltersAndFactions(mainFiltersStr, mainFactionsStr, factions);

    let event;
    if (isMultiEvent) {
        const variants = variantData.map(buildVariantFromForm).filter((v) => v.name);
        if (variants.length < 2) {
            return { error: 'Multi-events must have at least 2 variants' };
        }

        const firstVariant = variants[0];
        const firstVariantLocationType = firstVariant && firstVariant.locationType
            ? firstVariant.locationType
            : locationType;
        event = {
            locationType: firstVariantLocationType,
            cityDisplayName: cityDisplayName || undefined,
            variants
        };
        if (firstVariantLocationType === 'earth') {
            event.lat = firstVariant && firstVariant.lat !== undefined ? firstVariant.lat : lat;
            event.lon = firstVariant && firstVariant.lon !== undefined ? firstVariant.lon : lon;
        } else {
            event.x = firstVariant && firstVariant.x !== undefined ? firstVariant.x : x;
            event.y = firstVariant && firstVariant.y !== undefined ? firstVariant.y : y;
        }
    } else {
        const v0 = variantData[0];

        // FilterPlaces rows: prefer explicit per-row data; fall back to synthesizing a
        // single row from the main CSV strings so legacy flows still produce sane data.
        const secondaryPlaces0 = cloneFilterPlaceRows(v0?.secondaryCountryPlaces) || undefined;
        let heroPlaces0 = cloneFilterPlaceRows(v0?.heroFilterPlaces);
        if (!heroPlaces0 && mainData.filters.length > 0) {
            heroPlaces0 = [{ locationName: '', country: mainData.filters.join(', '), reasoning: '' }];
        }
        let factionPlaces0 = cloneFilterPlaceRows(v0?.factionFilterPlaces);
        if (!factionPlaces0 && mainData.factions.length > 0) {
            factionPlaces0 = [{ locationName: '', country: mainData.factions.join(', '), reasoning: '' }];
        }
        let npcPlaces0 = cloneFilterPlaceRows(v0?.npcFilterPlaces);
        if (!npcPlaces0 && Array.isArray(v0?.npcs) && v0.npcs.length > 0) {
            npcPlaces0 = [{ locationName: '', country: v0.npcs.join(', '), reasoning: '' }];
        }

        event = {
            name: mainName,
            locationType,
            cityDisplayName: cityDisplayName || undefined,
            description: mainDescription,
            image: '',
            sources: mainSources.length > 0 ? mainSources : undefined,
            headlines: mainHeadlines && mainHeadlines.length > 0 ? mainHeadlines : undefined
        };
        if (secondaryPlaces0) event.secondaryCountryPlaces = secondaryPlaces0;
        if (heroPlaces0) event.heroFilterPlaces = heroPlaces0;
        if (factionPlaces0) event.factionFilterPlaces = factionPlaces0;
        if (npcPlaces0) event.npcFilterPlaces = npcPlaces0;

        if (locationType === 'earth') {
            event.lat = lat;
            event.lon = lon;
        } else {
            event.x = x;
            event.y = y;
        }
    }

    applyTimelineToEvent(event, timeline);
    const eraTrimmed = (eraNameStr != null ? String(eraNameStr) : '').trim();
    applyEraNameToEvent(event, eraTrimmed);
    return { event };
}
