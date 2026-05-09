/**
 * CityLookupService - Handles city coordinate lookup and geocoding
 * Separates city lookup logic from event management
 */

class CityLookupService {
    constructor() {
        this.eventManager = null; // Reference to EventManager (for state access)
    }

    /**
     * Set the EventManager instance (dependency injection)
     */
    setEventManager(eventManager) {
        this.eventManager = eventManager;
    }

    /**
     * Lookup city coordinates (code lookup or API geocoding).
     * @param {Object} [fieldIds] - Optional DOM ids (defaults match edit modal).
     * @param {string} [fieldIds.cityId]
     * @param {string} [fieldIds.latId]
     * @param {string} [fieldIds.lonId]
     * @param {string} [fieldIds.displayNameId]
     * @param {string} [fieldIds.lookupBtnId]
     * @param {string} [fieldIds.useCodeLookupId]
     */
    async lookupCity(fieldIds = null) {
        if (!this.eventManager) return;

        const ids = fieldIds && typeof fieldIds === 'object' ? fieldIds : {};
        const cityInput = document.getElementById(ids.cityId || 'eventEditCity');
        const latInput = document.getElementById(ids.latId || 'eventEditLat');
        const lonInput = document.getElementById(ids.lonId || 'eventEditLon');
        const lookupBtn = document.getElementById(ids.lookupBtnId || 'lookupCityBtn');
        const useCodeLookup = document.getElementById(ids.useCodeLookupId || 'useCodeLookup');

        if (!cityInput || !latInput || !lonInput) return;

        const cityName = cityInput.value.trim();
        if (!cityName) {
            alert('Please enter a city name');
            return;
        }

        // Disable button and show loading state
        if (lookupBtn) {
            lookupBtn.disabled = true;
            lookupBtn.textContent = '🔍 Looking up...';
        }

        // Check if user wants code lookup or API search
        const useCode = useCodeLookup ? useCodeLookup.checked : true;

        const cityDisplayNameInput = document.getElementById(ids.displayNameId || 'eventEditCityDisplayName');
        
        if (useCode) {
            // Use local data lookup only
            const localCoords = this.eventManager.findCityCoordinates ? 
                this.eventManager.findCityCoordinates(cityName) : null;
            if (localCoords) {
                latInput.value = localCoords.lat;
                lonInput.value = localCoords.lon;
                // Auto-fill city display name with the found name
                if (cityDisplayNameInput) {
                    cityDisplayNameInput.value = localCoords.name;
                }
                if (lookupBtn) {
                    lookupBtn.disabled = false;
                    lookupBtn.textContent = '🔍 Lookup';
                }
                alert(`Found ${localCoords.name} in local data: ${localCoords.lat}, ${localCoords.lon}`);
            } else {
                if (lookupBtn) {
                    lookupBtn.disabled = false;
                    lookupBtn.textContent = '🔍 Lookup';
                }
                alert(`City "${cityName}" not found in local data. Uncheck "Use Code Lookup" to search online.`);
            }
        } else {
            // Use geocoding API
            try {
                const coords = await this.geocodeCity(cityName);
                if (coords) {
                    latInput.value = coords.lat;
                    lonInput.value = coords.lon;
                    // Auto-fill city display name with the found name
                    if (cityDisplayNameInput) {
                        cityDisplayNameInput.value = coords.name;
                    }
                    alert(`Found ${coords.name}: ${coords.lat}, ${coords.lon}`);
                } else {
                    alert(`City "${cityName}" not found. Please enter coordinates manually.`);
                }
            } catch (error) {
                console.error('Geocoding error:', error);
                alert(`Error looking up city "${cityName}". Please enter coordinates manually.`);
            } finally {
                if (lookupBtn) {
                    lookupBtn.disabled = false;
                    lookupBtn.textContent = '🔍 Lookup';
                }
            }
        }
    }

    /**
     * Geocode a city name using OpenStreetMap Nominatim API
     * @param {string} cityName - Name of the city to geocode
     * @returns {Promise<{lat: number, lon: number, name: string}|null>}
     */
    async geocodeCity(cityName) {
        try {
            // Use OpenStreetMap Nominatim API (free, no API key required)
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=1&addressdetails=1`;
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'OverwatchAtlas/1.0 (community lore project)' // Required by Nominatim
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.length > 0) {
                const result = data[0];
                return {
                    lat: parseFloat(result.lat),
                    lon: parseFloat(result.lon),
                    name: result.display_name || cityName
                };
            }
            
            return null;
        } catch (error) {
            console.error('Geocoding error:', error);
            throw error;
        }
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CityLookupService;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.CityLookupService = new CityLookupService();
}
