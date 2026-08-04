/**
 * Resolve a free-text city/location name to coordinates against the loaded location datasets.
 *
 * Search order (exact match first, then substring both ways):
 *   1. `dataService.cities`          (real-world cities)
 *   2. `dataService.fictionalCities` (lore cities)
 *   3. `dataService.airports`        (substring only)
 *   4. `dataService.seaports`        (substring only)
 *
 * Returns `{ lat, lon, name }` on a hit, or `null` if no dataset matches.
 *
 * @param {import('./EventDataService.js').default} dataService
 * @param {string} cityName
 */

import { normalizeForPredictiveMatch } from '../form/autocomplete/tokenInputMatching.js';

function namesMatchLoose(a, b) {
    const na = normalizeForPredictiveMatch(a);
    const nb = normalizeForPredictiveMatch(b);
    if (!na || !nb) return false;
    return na === nb || na.includes(nb) || nb.includes(na);
}

export function findCityCoordinates(dataService, cityName) {
    if (!cityName) return null;

    const searchName = normalizeForPredictiveMatch(cityName);
    if (!searchName) return null;

    let city = dataService.cities.find((c) => normalizeForPredictiveMatch(c.name) === searchName);
    if (!city) {
        city = dataService.cities.find((c) => namesMatchLoose(c.name, cityName));
    }
    if (city) {
        return { lat: city.lat, lon: city.lon, name: city.name };
    }

    let fictionalCity = dataService.fictionalCities.find(
        (c) => normalizeForPredictiveMatch(c.name) === searchName,
    );
    if (!fictionalCity) {
        fictionalCity = dataService.fictionalCities.find((c) => namesMatchLoose(c.name, cityName));
    }
    if (fictionalCity) {
        return { lat: fictionalCity.lat, lon: fictionalCity.lon, name: fictionalCity.name };
    }

    const airport = dataService.airports.find((a) => namesMatchLoose(a.name, cityName));
    if (airport) {
        return { lat: airport.lat, lon: airport.lon, name: airport.name };
    }

    const seaport = dataService.seaports.find((s) => namesMatchLoose(s.name, cityName));
    if (seaport) {
        return { lat: seaport.lat, lon: seaport.lon, name: seaport.name };
    }

    return null;
}
