/**
 * Browser-native group-label / place-name suggestions for story-event location fields.
 *
 * Mines cityDisplayName and grouped place rows from timeline events, then surfaces them
 * through `<datalist>` + `autocomplete="on"` (same approach as city lookup / source names).
 * Picking a known group label can fill the paired country field on relevant-location rows.
 *
 * Country fields use FormTokenAutocomplete (flag icons) — not wired here.
 */

const PLACE_NAME_DATALIST_ID = 'storyEventPlaceNameList';
const PLACE_NAME_FIELD_NAME = 'story-event-place-name';

/** @type {{ placeNames: Set<string>, countryByPlaceKey: Map<string, string> } | null} */
let cachedLocationData = null;

/**
 * @param {string} text
 * @returns {string}
 */
function normalizeKey(text) {
    return String(text || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
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
 * @param {Set<string>} placeNames
 * @param {Map<string, { country: string, count: number }>} pairCounts
 * @param {Object} event
 */
function ingestEvent(placeNames, pairCounts, event) {
    if (!event || typeof event !== 'object') return;

    const city = String(event.cityDisplayName || '').trim();
    if (city) placeNames.add(city);

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
        if (variantCity) placeNames.add(variantCity);
        for (const key of placeKeys) {
            const rows = variant[key];
            if (!Array.isArray(rows)) continue;
            rows.forEach((row) => ingestPlaceRow(placeNames, pairCounts, row));
        }
    });
}

/**
 * @returns {{ placeNames: Set<string>, countryByPlaceKey: Map<string, string> }}
 */
function getLocationAutocompleteData() {
    if (cachedLocationData) return cachedLocationData;

    const placeNames = new Set();
    /** @type {Map<string, { country: string, count: number }>} */
    const pairCounts = new Map();

    for (const event of getTimelineEventsForMining()) {
        ingestEvent(placeNames, pairCounts, event);
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

    cachedLocationData = { placeNames, countryByPlaceKey };
    return cachedLocationData;
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
 */
function wirePlaceNameField(input) {
    if (!input || input.dataset.storyEventPlaceAutocomplete === 'true') return;
    input.dataset.storyEventPlaceAutocomplete = 'true';
    refreshStoryEventLocationDatalists();
    input.setAttribute('autocomplete', 'on');
    input.setAttribute('list', PLACE_NAME_DATALIST_ID);
    input.setAttribute('name', PLACE_NAME_FIELD_NAME);
}

/**
 * @param {HTMLInputElement} nameInput
 * @param {HTMLInputElement|null|undefined} countryInput
 */
export function wirePlaceNameInput(nameInput, countryInput) {
    if (!nameInput) return;
    wirePlaceNameField(nameInput);
    if (!countryInput) return;
    const onCommit = () => syncCountryFromPlaceName(nameInput, countryInput);
    nameInput.addEventListener('input', onCommit);
    nameInput.addEventListener('change', onCommit);
    nameInput.addEventListener('blur', onCommit);
}

/**
 * Wire slide + event-manager city fields that share the same place-name pool.
 */
export function wireStoryEventCityInputs() {
    if (typeof document === 'undefined') return;
    const ids = ['eventSlideEditCityLookup', 'eventSlideEditCityDisplayName', 'eventEditCityDisplayName'];
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
        syncCountryFromPlaceName,
    };
}
