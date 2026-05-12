/**
 * LocationLabelResolver — resolves `(lat, lon)` to a display label `"City, Country"`.
 *
 * Thin facade that owns the per-resolver cache + the dependency-injection slots, and
 * delegates the three actual operations:
 *
 *   - `findLocationByCoords.js`         — pure sync match against the in-memory datasets.
 *   - `nominatimReverseGeocode.js`      — async OpenStreetMap reverse-geocode fallback.
 *   - `repaintEventListLocationLabel.js` — DOM repaint of any matching manager rows after
 *                                          the async enhance returns.
 *
 * Two-stage strategy:
 *   1. **Sync match** against cities / fictional-cities / airports / seaports. Hits return
 *      immediately and are cached.
 *   2. **Async enhance** via Nominatim in the background; on success, cache + repaint the
 *      manager rows and forward the new label to `window.updateEventSlideLocation` so the
 *      slide stays in sync.
 *
 * Exposed as `window.LocationLabelResolver` (new) and `window.LocationService` (legacy alias).
 */

import { findLocationByCoords } from './findLocationByCoords.js';
import { nominatimReverseGeocode } from './nominatimReverseGeocode.js';
import { repaintEventListLocationLabel } from './repaintEventListLocationLabel.js';

class LocationLabelResolver {
    constructor() {
        this.locationCache = new Map();
        this.dataService = null;
        this.eventManager = null;
    }

    setDataService(dataService) { this.dataService = dataService; }
    setEventManager(eventManager) { this.eventManager = eventManager; }

    /**
     * @returns {string|null} Location name (sync; may be enhanced asynchronously later).
     */
    getLocationName(lat, lon, cities = [], fictionalCities = [], airports = [], seaports = []) {
        const cacheKey = `${lat.toFixed(4)}_${lon.toFixed(4)}`;
        if (this.locationCache.has(cacheKey)) return this.locationCache.get(cacheKey);

        const location = findLocationByCoords(lat, lon, cities, fictionalCities, airports, seaports);
        if (location) {
            const displayName = (this.dataService ? this.dataService.getDisplayName(location.name) : location.name) || location.name;

            // Already has country info — accept verbatim, no enhance.
            if (displayName.includes(',')) {
                this.locationCache.set(cacheKey, displayName);
                return displayName;
            }

            // Return city now, enhance with country in the background.
            this.enhanceLocationWithCountry(lat, lon, displayName);
            return displayName;
        }

        // Unknown coords — try reverse geocode in the background; sync return is null.
        this.enhanceLocationWithCountry(lat, lon, null);
        return null;
    }

    /**
     * Background enhance: reverse-geocode to learn the country, append to the cached label,
     * repaint any visible manager row, and forward to the event slide if it's open.
     */
    async enhanceLocationWithCountry(lat, lon, cityName) {
        const cacheKey = `${lat.toFixed(4)}_${lon.toFixed(4)}`;

        // Already has country info — accept verbatim, no enhance.
        if (cityName && cityName.includes(',')) {
            this.locationCache.set(cacheKey, cityName);
            return;
        }

        try {
            const countryInfo = await nominatimReverseGeocode(lat, lon);
            if (!countryInfo || !countryInfo.country) return;

            // Country is already in the name (e.g. "Mexico City, Mexico") — don't duplicate.
            if (cityName && cityName.toLowerCase().includes(countryInfo.country.toLowerCase())) {
                this.locationCache.set(cacheKey, cityName);
                return;
            }

            const enhancedName = cityName
                ? `${cityName}, ${countryInfo.country}`
                : (countryInfo.city ? `${countryInfo.city}, ${countryInfo.country}` : null);

            if (!enhancedName) return;

            this.locationCache.set(cacheKey, enhancedName);
            repaintEventListLocationLabel(this.eventManager, lat, lon, enhancedName);
            if (window.updateEventSlideLocation) {
                window.updateEventSlideLocation(lat, lon, enhancedName);
            }
        } catch (_) {
            // Already have the city name — silent failure is fine.
        }
    }

    clearCache() {
        this.locationCache.clear();
    }
}

if (typeof window !== 'undefined') {
    const instance = new LocationLabelResolver();
    window.LocationLabelResolver = instance;
    // Legacy alias — kept until all consumers migrate.
    window.LocationService = instance;
}
