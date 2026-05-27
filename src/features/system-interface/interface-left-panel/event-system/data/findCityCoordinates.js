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
export function findCityCoordinates(dataService, cityName) {
    if (!cityName) return null;

    const searchName = cityName.toLowerCase().trim();

    let city = dataService.cities.find((c) => c.name.toLowerCase() === searchName);
    if (!city) {
        city = dataService.cities.find(
            (c) =>
                c.name.toLowerCase().includes(searchName) ||
                searchName.includes(c.name.toLowerCase())
        );
    }
    if (city) {
        return { lat: city.lat, lon: city.lon, name: city.name };
    }

    let fictionalCity = dataService.fictionalCities.find((c) => c.name.toLowerCase() === searchName);
    if (!fictionalCity) {
        fictionalCity = dataService.fictionalCities.find(
            (c) =>
                c.name.toLowerCase().includes(searchName) ||
                searchName.includes(c.name.toLowerCase())
        );
    }
    if (fictionalCity) {
        return { lat: fictionalCity.lat, lon: fictionalCity.lon, name: fictionalCity.name };
    }

    const airport = dataService.airports.find(
        (a) =>
            a.name.toLowerCase() === searchName ||
            a.name.toLowerCase().includes(searchName) ||
            searchName.includes(a.name.toLowerCase())
    );
    if (airport) {
        return { lat: airport.lat, lon: airport.lon, name: airport.name };
    }

    const seaport = dataService.seaports.find(
        (s) =>
            s.name.toLowerCase() === searchName ||
            s.name.toLowerCase().includes(searchName) ||
            searchName.includes(s.name.toLowerCase())
    );
    if (seaport) {
        return { lat: seaport.lat, lon: seaport.lon, name: seaport.name };
    }

    return null;
}
