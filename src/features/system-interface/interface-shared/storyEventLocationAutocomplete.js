/**
 * Browser-native group-label / place-name suggestions for story-event location fields.
 *
 * Mines cityDisplayName and grouped place rows from timeline events, then surfaces them
 * through `<datalist>` + `autocomplete="on"` (same approach as city lookup / source names).
 * Picking a known group label can fill the paired country field on relevant-location rows.
 *
 * Country fields use FormTokenAutocomplete (flag icons) — not wired here.
 */

import {
    buildMatches,
    normalizeForPredictiveMatch,
} from '../interface-left-panel/event-system/form/autocomplete/tokenInputMatching.js';
import {
    ensureAutocompleteAnchor,
    mountAnchoredAutocompleteList,
} from '../interface-left-panel/event-system/form/autocomplete/autocompleteListAnchor.js';

const PLACE_NAME_DATALIST_ID = 'storyEventPlaceNameList';
const PLACE_NAME_FIELD_NAME = 'story-event-place-name';

/**
 * @typedef {{ cityDisplayName: string, locationType: string, lat?: number, lon?: number, x?: number, y?: number, count: number }} PlacePlacement
 */

/** @type {{ placeNames: Set<string>, countryByPlaceKey: Map<string, string>, placementByPlaceKey: Map<string, PlacePlacement> } | null} */
let cachedLocationData = null;

/** City-lookup inputs: picking a prior choice also copies coords + location label. */
const CITY_LOOKUP_INPUT_IDS = new Set(['eventSlideEditCityLookup', 'eventEditCity']);

/**
 * @param {string} text
 * @returns {string}
 */
function normalizeKey(text) {
    return normalizeForPredictiveMatch(text);
}

/**
 * @returns {Array<Object>}
 */
function getTimelineEventsForMining() {
    const em = typeof window !== 'undefined' ? window.eventManager : null;
    const dock = em?.getDockTimelineEvents?.();
    if (Array.isArray(dock) && dock.length > 0) return dock;
    return Array.isArray(em?.events) ? em.events : [];
}

/**
 * @param {Map<string, { country: string, count: number }>} pairCounts
 * @param {string} locationName
 * @param {string} country
 */
function ingestPlaceCountryPair(pairCounts, locationName, country) {
    const placeKey = normalizeKey(locationName);
    const countryText = String(country || '').trim();
    if (!placeKey || !countryText) return;
    const pairKey = `${placeKey}\0${normalizeKey(countryText)}`;
    const prev = pairCounts.get(pairKey);
    if (prev) {
        prev.count += 1;
        return;
    }
    pairCounts.set(pairKey, { locationName, country: countryText, count: 1 });
}

/**
 * @param {Set<string>} placeNames
 * @param {Map<string, { country: string, count: number }>} pairCounts
 * @param {{ locationName?: string, country?: string } | null | undefined} row
 */
function ingestPlaceRow(placeNames, pairCounts, row) {
    if (!row || typeof row !== 'object') return;
    const locationName = String(row.locationName || '').trim();
    const countryRaw = String(row.country || '').trim();
    if (locationName) placeNames.add(locationName);
    if (countryRaw) {
        countryRaw
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
            .forEach((country) => {
                if (locationName) ingestPlaceCountryPair(pairCounts, locationName, country);
            });
    }
}

/**
 * Remember lat/lon (or x/y) for a prior cityDisplayName so autocomplete can copy placement.
 * @param {Map<string, PlacePlacement>} placementByPlaceKey
 * @param {string} cityDisplayName
 * @param {Object} source
 */
function ingestCityPlacement(placementByPlaceKey, cityDisplayName, source) {
    const placeKey = normalizeKey(cityDisplayName);
    if (!placeKey || !source || typeof source !== 'object') return;

    const locationType = String(source.locationType || 'earth').trim() || 'earth';
    /** @type {PlacePlacement} */
    const entry = {
        cityDisplayName,
        locationType,
        count: 1,
    };

    if (locationType === 'earth') {
        if (source.lat == null || source.lon == null) return;
        const lat = Number(source.lat);
        const lon = Number(source.lon);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return;
        entry.lat = lat;
        entry.lon = lon;
    } else {
        if (source.x == null || source.y == null) return;
        const x = Number(source.x);
        const y = Number(source.y);
        if (Number.isNaN(x) || Number.isNaN(y)) return;
        entry.x = x;
        entry.y = y;
    }

    const prev = placementByPlaceKey.get(placeKey);
    if (prev) {
        prev.count += 1;
        return;
    }
    placementByPlaceKey.set(placeKey, entry);
}

/**
 * @param {Set<string>} placeNames
 * @param {Map<string, { country: string, count: number }>} pairCounts
 * @param {Map<string, PlacePlacement>} placementByPlaceKey
 * @param {Object} event
 */
function ingestEvent(placeNames, pairCounts, placementByPlaceKey, event) {
    if (!event || typeof event !== 'object') return;

    const city = String(event.cityDisplayName || '').trim();
    if (city) {
        placeNames.add(city);
        ingestCityPlacement(placementByPlaceKey, city, event);
    }

    const placeKeys = [
        'secondaryCountryPlaces',
        'relevantLocations',
        'heroFilterPlaces',
        'factionFilterPlaces',
        'npcFilterPlaces',
    ];
    for (const key of placeKeys) {
        const rows = event[key];
        if (!Array.isArray(rows)) continue;
        rows.forEach((row) => ingestPlaceRow(placeNames, pairCounts, row));
    }

    (event.variants || []).forEach((variant) => {
        if (!variant || typeof variant !== 'object') return;
        const variantCity = String(variant.cityDisplayName || '').trim();
        if (variantCity) {
            placeNames.add(variantCity);
            // Variant may omit coords — fall back to parent event placement fields.
            ingestCityPlacement(placementByPlaceKey, variantCity, {
                locationType: variant.locationType || event.locationType,
                lat: variant.lat !== undefined ? variant.lat : event.lat,
                lon: variant.lon !== undefined ? variant.lon : event.lon,
                x: variant.x !== undefined ? variant.x : event.x,
                y: variant.y !== undefined ? variant.y : event.y,
            });
        }
        for (const key of placeKeys) {
            const rows = variant[key];
            if (!Array.isArray(rows)) continue;
            rows.forEach((row) => ingestPlaceRow(placeNames, pairCounts, row));
        }
    });
}

/**
 * @returns {{ placeNames: Set<string>, countryByPlaceKey: Map<string, string>, placementByPlaceKey: Map<string, PlacePlacement> }}
 */
function getLocationAutocompleteData() {
    if (cachedLocationData) return cachedLocationData;

    const placeNames = new Set();
    /** @type {Map<string, { country: string, count: number }>} */
    const pairCounts = new Map();
    /** @type {Map<string, PlacePlacement>} */
    const placementByPlaceKey = new Map();

    for (const event of getTimelineEventsForMining()) {
        ingestEvent(placeNames, pairCounts, placementByPlaceKey, event);
    }

    /** @type {Map<string, { country: string, count: number }>} */
    const bestByPlace = new Map();
    for (const entry of pairCounts.values()) {
        const placeKey = normalizeKey(entry.locationName);
        const prev = bestByPlace.get(placeKey);
        if (!prev || entry.count > prev.count) {
            bestByPlace.set(placeKey, entry);
        }
    }

    const countryByPlaceKey = new Map();
    for (const [placeKey, entry] of bestByPlace) {
        countryByPlaceKey.set(placeKey, entry.country);
    }

    cachedLocationData = { placeNames, countryByPlaceKey, placementByPlaceKey };
    return cachedLocationData;
}

/**
 * @param {string} locationName
 * @returns {PlacePlacement | null}
 */
export function resolvePlacementForPlaceName(locationName) {
    const key = normalizeKey(locationName);
    if (!key) return null;
    return getLocationAutocompleteData().placementByPlaceKey.get(key) || null;
}

/**
 * Fill lat/lon (or x/y), location type, and location label from a prior timeline choice.
 * Falls back to Lookup when no prior coords are known.
 * @param {string} inputId
 * @param {string} placeText
 */
function applyPriorPlacementForCityLookup(inputId, placeText) {
    if (!CITY_LOOKUP_INPUT_IDS.has(inputId)) return;

    const placement = resolvePlacementForPlaceName(placeText);
    if (!placement) {
        if (inputId === 'eventSlideEditCityLookup') {
            void window.eventManager?.lookupCitySlide?.();
        } else if (inputId === 'eventEditCity') {
            void window.eventManager?.cityLookupService?.lookupCity?.();
        }
        return;
    }

    if (inputId === 'eventSlideEditCityLookup') {
        const display = document.getElementById('eventSlideEditCityDisplayName');
        const latInput = document.getElementById('eventSlideEditLat');
        const lonInput = document.getElementById('eventSlideEditLon');
        const xInput = document.getElementById('eventSlideEditX');
        const yInput = document.getElementById('eventSlideEditY');
        const locTypeInput = document.getElementById('eventSlideEditLocationType');

        if (display) display.value = placement.cityDisplayName;
        if (locTypeInput) locTypeInput.value = placement.locationType || 'earth';

        if (latInput) latInput.value = '';
        if (lonInput) lonInput.value = '';
        if (xInput) xInput.value = '';
        if (yInput) yInput.value = '';

        if ((placement.locationType || 'earth') === 'earth') {
            if (latInput && placement.lat != null) latInput.value = String(placement.lat);
            if (lonInput && placement.lon != null) lonInput.value = String(placement.lon);
        } else {
            if (xInput && placement.x != null) xInput.value = String(placement.x);
            if (yInput && placement.y != null) yInput.value = String(placement.y);
        }

        window.standaloneEventSlide?.syncLocationTypeUI?.();
        return;
    }

    // Modal edit form
    const display = document.getElementById('eventEditCityDisplayName');
    const latInput = document.getElementById('eventEditLat');
    const lonInput = document.getElementById('eventEditLon');
    const locMgr = window.eventManager?.formService?.locationFieldManager;
    if (display) display.value = placement.cityDisplayName;
    if (typeof locMgr?.setLocationType === 'function') {
        locMgr.setLocationType(placement.locationType || 'earth');
    }
    if ((placement.locationType || 'earth') === 'earth') {
        if (latInput && placement.lat != null) latInput.value = String(placement.lat);
        if (lonInput && placement.lon != null) lonInput.value = String(placement.lon);
    }
}

export function clearStoryEventLocationOptionsCache() {
    cachedLocationData = null;
    refreshStoryEventLocationDatalists();
}

/**
 * @param {string} id
 * @returns {HTMLDataListElement}
 */
function ensureDatalist(id) {
    let datalist = document.getElementById(id);
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = id;
        document.body.appendChild(datalist);
    }
    return /** @type {HTMLDataListElement} */ (datalist);
}

function fillDatalist(id, values) {
    if (typeof document === 'undefined') return;
    const datalist = ensureDatalist(id);
    datalist.replaceChildren();
    const sorted = [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    for (const value of sorted) {
        const option = document.createElement('option');
        option.value = value;
        datalist.appendChild(option);
    }
}

export function refreshStoryEventLocationDatalists() {
    const { placeNames } = getLocationAutocompleteData();
    fillDatalist(PLACE_NAME_DATALIST_ID, placeNames);
}

/**
 * @param {string} locationName
 * @returns {string}
 */
export function resolveCountryForPlaceName(locationName) {
    const key = normalizeKey(locationName);
    if (!key) return '';
    return getLocationAutocompleteData().countryByPlaceKey.get(key) || '';
}

/**
 * @param {HTMLInputElement} nameInput
 * @param {HTMLInputElement|null|undefined} countryInput
 */
export function syncCountryFromPlaceName(nameInput, countryInput) {
    if (!nameInput || !countryInput) return;
    const country = resolveCountryForPlaceName(nameInput.value);
    if (country) countryInput.value = country;
}

/**
 * @param {HTMLInputElement} input
 * @param {HTMLInputElement|null|undefined} [countryInput]
 */
function wirePlaceNameField(input, countryInput) {
    if (!input || input.dataset.storyEventPlaceAutocomplete === 'true') return;
    input.dataset.storyEventPlaceAutocomplete = 'true';
    refreshStoryEventLocationDatalists();
    input.setAttribute('autocomplete', 'off');
    input.removeAttribute('list');
    input.setAttribute('name', PLACE_NAME_FIELD_NAME);
    ensureAutocompleteAnchor(input);

    /** @type {HTMLElement|null} */
    let listEl = null;
    const removeList = () => {
        listEl?.remove();
        listEl = null;
    };

    const renderSuggestions = () => {
        removeList();
        const names = [...getLocationAutocompleteData().placeNames];
        const matches = buildMatches(input.value, names, 'countries').slice(0, 8);
        if (!matches.length) return;

        listEl = document.createElement('div');
        listEl.className = 'filter-autocomplete-list';
        matches.forEach((text) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'filter-autocomplete-item';
            btn.textContent = text;
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = text;
                removeList();
                if (countryInput) syncCountryFromPlaceName(input, countryInput);
                if (CITY_LOOKUP_INPUT_IDS.has(input.id)) {
                    applyPriorPlacementForCityLookup(input.id, text);
                }
            });
            listEl.appendChild(btn);
        });
        mountAnchoredAutocompleteList(input, listEl);
    };

    input.addEventListener('input', () => {
        renderSuggestions();
        if (countryInput) syncCountryFromPlaceName(input, countryInput);
    });
    input.addEventListener('change', () => {
        if (countryInput) syncCountryFromPlaceName(input, countryInput);
    });
    input.addEventListener('blur', () => {
        window.setTimeout(removeList, 120);
        if (countryInput) syncCountryFromPlaceName(input, countryInput);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') removeList();
    });
}

/**
 * @param {HTMLInputElement} nameInput
 * @param {HTMLInputElement|null|undefined} countryInput
 */
export function wirePlaceNameInput(nameInput, countryInput) {
    if (!nameInput) return;
    wirePlaceNameField(nameInput, countryInput);
}

/**
 * Wire slide + event-manager city fields that share the same place-name pool.
 */
export function wireStoryEventCityInputs() {
    if (typeof document === 'undefined') return;
    const ids = [
        'eventSlideEditCityLookup',
        'eventSlideEditCityDisplayName',
        'eventEditCity',
        'eventEditCityDisplayName',
    ];
    ids.forEach((id) => {
        const input = document.getElementById(id);
        if (input instanceof HTMLInputElement) wirePlaceNameField(input);
    });
}

if (typeof window !== 'undefined') {
    window.StoryEventLocationAutocomplete = {
        wirePlaceNameInput,
        wireStoryEventCityInputs,
        clearStoryEventLocationOptionsCache,
        refreshStoryEventLocationDatalists,
        resolveCountryForPlaceName,
        resolvePlacementForPlaceName,
        syncCountryFromPlaceName,
    };
}
