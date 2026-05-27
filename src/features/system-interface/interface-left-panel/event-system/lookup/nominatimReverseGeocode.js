/**
 * Nominatim (OpenStreetMap) reverse-geocode wrapper used by `LocationLabelResolver` when an
 * event's `(lat, lon)` doesn't match anything in the local datasets.
 *
 * Behavior:
 *   - Sets the polite `User-Agent` header Nominatim requires.
 *   - Returns `null` (never throws) on any non-200 response, since rate-limiting is common
 *     and shouldn't surface as an error to the user.
 *   - Cherry-picks the most-relevant city-like fields out of the response (`city`, then
 *     `town`, `village`, `municipality`) so the caller doesn't have to know the schema.
 *   - Network errors are swallowed to keep the console clean; only schema-level errors get
 *     logged.
 *
 * @returns {Promise<{ city: string, country: string, display_name: string } | null>}
 */
export async function nominatimReverseGeocode(lat, lon) {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'OverwatchAtlas/1.0 (community lore project)' }
        });
        if (!response.ok) return null;

        const data = await response.json();
        if (data && data.address) {
            const city = data.address.city
                || data.address.town
                || data.address.village
                || data.address.municipality
                || '';
            const country = data.address.country || '';
            return { city, country, display_name: data.display_name || '' };
        }
        return null;
    } catch (error) {
        // Silently swallow network/fetch errors; surface only schema-level bugs.
        if (error.name !== 'TypeError' && !error.message.includes('fetch')) {
            console.error('LocationLabelResolver: Reverse geocoding error:', error);
        }
        return null;
    }
}
