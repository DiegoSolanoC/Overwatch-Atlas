/**
 * Find the first entry in the in-memory location datasets whose `(lat, lon)` is within
 * 0.01° of the query.
 *
 * Search order matches the original behavior: cities → fictionalCities → airports → seaports.
 * Within each set, the first hit wins. The returned object is shallow-merged with a `type`
 * tag (`'city' | 'fictionalCity' | 'airport' | 'seaport'`) so callers can drive type-specific
 * UI without re-checking which array they came from.
 *
 * @returns {object | null}
 */
export function findLocationByCoords(lat, lon, cities, fictionalCities, airports, seaports) {
    const tolerance = 0.01;
    const allLocations = [
        ...cities.map((c) => ({ ...c, type: 'city' })),
        ...fictionalCities.map((c) => ({ ...c, type: 'fictionalCity' })),
        ...airports.map((a) => ({ ...a, type: 'airport' })),
        ...seaports.map((s) => ({ ...s, type: 'seaport' }))
    ];
    return allLocations.find((loc) =>
        Math.abs(loc.lat - lat) < tolerance && Math.abs(loc.lon - lon) < tolerance
    ) || null;
}
