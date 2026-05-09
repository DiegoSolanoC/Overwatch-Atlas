/**
 * LocationService - Handles location name resolution and geocoding
 * Separates location lookup logic from event management
 */

class LocationService {
    constructor() {
        this.locationCache = new Map(); // Cache for location names with countries
        this.dataService = null; // Reference to EventDataService
        this.eventManager = null; // Reference to EventManager (for events access)
    }

    /**
     * Set the EventDataService instance (dependency injection)
     */
    setDataService(dataService) {
        this.dataService = dataService;
    }

    /**
     * Set the EventManager instance (dependency injection)
     */
    setEventManager(eventManager) {
        this.eventManager = eventManager;
    }

    /**
     * Get location name from coordinates - returns "City, Country" format
     * Shows city name immediately, then enhances with country in background
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @param {Array} cities - Cities array
     * @param {Array} fictionalCities - Fictional cities array
     * @param {Array} airports - Airports array
     * @param {Array} seaports - Seaports array
     * @returns {string|null} Location name or null
     */
    getLocationName(lat, lon, cities = [], fictionalCities = [], airports = [], seaports = []) {
        // Check cache first
        const cacheKey = `${lat.toFixed(4)}_${lon.toFixed(4)}`;
        if (this.locationCache.has(cacheKey)) {
            return this.locationCache.get(cacheKey);
        }

        const tolerance = 0.01; // Small tolerance for coordinate matching

        const allLocations = [
            ...cities.map(c => ({ ...c, type: 'city' })),
            ...fictionalCities.map(c => ({ ...c, type: 'fictionalCity' })),
            ...airports.map(a => ({ ...a, type: 'airport' })),
            ...seaports.map(s => ({ ...s, type: 'seaport' }))
        ];

        const location = allLocations.find(loc => 
            Math.abs(loc.lat - lat) < tolerance && Math.abs(loc.lon - lon) < tolerance
        );

        if (location) {
            // Check if there's a custom display name
            const displayName = (this.dataService ? this.dataService.getDisplayName(location.name) : location.name) || location.name;
            
            // If display name already contains country info (has comma), use it directly
            if (displayName.includes(',')) {
                this.locationCache.set(cacheKey, displayName);
                return displayName;
            }
            
            // Otherwise, return display name immediately and enhance with country in background
            this.enhanceLocationWithCountry(lat, lon, displayName);
            return displayName;
        }

        // If not found, try reverse geocoding in background
        this.enhanceLocationWithCountry(lat, lon, null);
        return null;
    }

    /**
     * Enhance location name with country (non-blocking, updates UI later)
     * Only adds country if the name doesn't already contain country information
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @param {string|null} cityName - City name (optional)
     */
    async enhanceLocationWithCountry(lat, lon, cityName) {
        const cacheKey = `${lat.toFixed(4)}_${lon.toFixed(4)}`;
        
        // If cityName already contains a comma, it likely has country info - don't enhance
        if (cityName && cityName.includes(',')) {
            this.locationCache.set(cacheKey, cityName);
            return;
        }
        
        try {
            const countryInfo = await this.reverseGeocode(lat, lon);
            if (countryInfo && countryInfo.country) {
                // Check if the country is already in the name (avoid duplicates like "Mexico, Mexico")
                if (cityName && cityName.toLowerCase().includes(countryInfo.country.toLowerCase())) {
                    // Country already in name, don't add it again
                    this.locationCache.set(cacheKey, cityName);
                    return;
                }
                
                const enhancedName = cityName 
                    ? `${cityName}, ${countryInfo.country}`
                    : (countryInfo.city ? `${countryInfo.city}, ${countryInfo.country}` : null);
                
                if (enhancedName) {
                    this.locationCache.set(cacheKey, enhancedName);
                    // Update the display in the UI
                    this.updateLocationDisplay(lat, lon, enhancedName);
                    
                    // Also update location in event slide if it's open
                    if (window.updateEventSlideLocation) {
                        window.updateEventSlideLocation(lat, lon, enhancedName);
                    }
                }
            }
        } catch (error) {
            // Silently fail - we already have the city name
        }
    }

    /**
     * Update location display in the UI (non-blocking)
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @param {string} locationName - Location name to display
     */
    updateLocationDisplay(lat, lon, locationName) {
        if (!this.eventManager) return;
        
        // Find and update the location element if it exists
        const eventItems = document.querySelectorAll('.event-item');
        eventItems.forEach(item => {
            const locationEl = item.querySelector('.event-item-location');
            if (locationEl) {
                // Check if coordinates match (within tolerance)
                const itemIndex = parseInt(item.dataset.index);
                if (itemIndex !== undefined && this.eventManager.events && this.eventManager.events[itemIndex]) {
                    const event = this.eventManager.events[itemIndex];
                    const tolerance = 0.01;
                    if (Math.abs(event.lat - lat) < tolerance && Math.abs(event.lon - lon) < tolerance) {
                        const rowInner = (typeof window !== 'undefined' && window.LocationFlagHelpers && typeof window.LocationFlagHelpers.createLocationRowInnerHtml === 'function')
                            ? window.LocationFlagHelpers.createLocationRowInnerHtml(locationName, 'earth')
                            : `<img class="event-location-pin" src="src/assets/images/Icons/Filter%20Icons/Location%20Icon.png" alt="" width="28" height="28" decoding="async" /> ${locationName}`;
                        locationEl.innerHTML = rowInner;
                    }
                }
            }
        });
    }

    /**
     * Reverse geocode coordinates to get city and country
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {Promise<Object|null>} Object with city, country, and display_name, or null
     */
    async reverseGeocode(lat, lon) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'OverwatchAtlas/1.0 (community lore project)'
                }
            });

            if (!response.ok) {
                // Don't log HTTP errors - they're common with rate limiting
                return null;
            }

            const data = await response.json();
            
            if (data && data.address) {
                const city = data.address.city || data.address.town || data.address.village || data.address.municipality || '';
                const country = data.address.country || '';
                return {
                    city: city,
                    country: country,
                    display_name: data.display_name || ''
                };
            }
            
            return null;
        } catch (error) {
            // Silently fail - don't spam console with network errors
            // Only log if it's not a network/fetch error
            if (error.name !== 'TypeError' && !error.message.includes('fetch')) {
                console.error('LocationService: Reverse geocoding error:', error);
            }
            return null;
        }
    }

    /**
     * Clear location cache
     */
    clearCache() {
        this.locationCache.clear();
    }

    /**
     * Get cache size (for debugging)
     */
    getCacheSize() {
        return this.locationCache.size;
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocationService;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.LocationService = new LocationService();
}
