/**
 * LocationFieldManager - Handles location type switching and field visibility
 * Manages location type buttons, hidden input, and coordinate field visibility
 */

class LocationFieldManager {
    constructor() {
        this.handlerSetup = false;
    }

    /**
     * Setup location type change handler
     */
    setupLocationTypeHandler(onLocationTypeChange) {
        const locationTypeButtons = document.querySelectorAll('.location-type-btn');
        const locationTypeInput = document.getElementById('eventEditLocationType');
        
        if (locationTypeButtons.length > 0 && !this.handlerSetup) {
            this.handlerSetup = true;
            
            locationTypeButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    // Remove active class from all buttons
                    locationTypeButtons.forEach(b => b.classList.remove('active'));
                    // Add active class to clicked button
                    btn.classList.add('active');
                    // Update hidden input value
                    if (locationTypeInput) {
                        locationTypeInput.value = btn.dataset.locationType;
                    }
                    // Update location fields
                    this.updateLocationFields();
                    // Notify callback if provided
                    if (onLocationTypeChange) {
                        onLocationTypeChange(btn.dataset.locationType);
                    }
                });
            });
        }
    }

    /**
     * Set location type and update UI (buttons and hidden input)
     * @param {string} locationType - 'earth', 'moon', 'mars', or 'station'
     */
    setLocationType(locationType) {
        const locationTypeInput = document.getElementById('eventEditLocationType');
        const locationTypeButtons = document.querySelectorAll('.location-type-btn');
        
        // Update hidden input
        if (locationTypeInput) {
            locationTypeInput.value = locationType;
        }
        
        // Update button active states
        locationTypeButtons.forEach(btn => {
            if (btn.dataset.locationType === locationType) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Update location fields
        this.updateLocationFields();
    }

    /**
     * Get current location type
     * @returns {string} Current location type
     */
    getLocationType() {
        const locationTypeInput = document.getElementById('eventEditLocationType');
        return locationTypeInput ? locationTypeInput.value : 'earth';
    }

    /**
     * Update location fields based on selected location type
     */
    updateLocationFields() {
        const locationTypeInput = document.getElementById('eventEditLocationType');
        const locationType = locationTypeInput ? locationTypeInput.value : 'earth';
        const latLonFields = document.getElementById('latLonFields');
        const lonFields = document.getElementById('lonFields');
        const xyFields = document.getElementById('xyFields');
        const yFields = document.getElementById('yFields');
        const cityLookupField = document.getElementById('eventEditCity')?.closest('.event-edit-field');
        const cityDisplayNameField = document.getElementById('eventEditCityDisplayName')?.closest('.event-edit-field');
        
        if (locationType === 'earth') {
            if (latLonFields) latLonFields.style.display = '';
            if (lonFields) lonFields.style.display = '';
            if (xyFields) xyFields.style.display = 'none';
            if (yFields) yFields.style.display = 'none';
            if (cityLookupField) cityLookupField.style.display = '';
            if (cityDisplayNameField) cityDisplayNameField.style.display = '';
            const latInput = document.getElementById('eventEditLat');
            const lonInput = document.getElementById('eventEditLon');
            const xInput = document.getElementById('eventEditX');
            const yInput = document.getElementById('eventEditY');
            if (latInput) latInput.required = true;
            if (lonInput) lonInput.required = true;
            if (xInput) xInput.required = false;
            if (yInput) yInput.required = false;
        } else {
            // Moon, Mars, Station, Mars Ship: panel X/Y (orbit panel when transport is off or on map)
            if (latLonFields) latLonFields.style.display = 'none';
            if (lonFields) lonFields.style.display = 'none';
            if (xyFields) xyFields.style.display = '';
            if (yFields) yFields.style.display = '';
            if (cityLookupField) cityLookupField.style.display = 'none';
            if (cityDisplayNameField) cityDisplayNameField.style.display = '';
            const latInput = document.getElementById('eventEditLat');
            const lonInput = document.getElementById('eventEditLon');
            const xInput = document.getElementById('eventEditX');
            const yInput = document.getElementById('eventEditY');
            const cityDisplayNameInput = document.getElementById('eventEditCityDisplayName');
            if (latInput) latInput.required = false;
            if (lonInput) lonInput.required = false;
            if (xInput) xInput.required = true;
            if (yInput) yInput.required = true;

            if (xInput && !xInput.value.trim()) {
                if (locationType === 'moon') xInput.value = '60';
                else if (locationType === 'mars') xInput.value = '45';
                else if (locationType === 'station' || locationType === 'marsShip') xInput.value = '50';
            }
            if (yInput && !yInput.value.trim()) {
                if (locationType === 'moon') yInput.value = '70';
                else if (locationType === 'mars') yInput.value = '35';
                else if (locationType === 'station' || locationType === 'marsShip') yInput.value = '50';
            }

            if (cityDisplayNameInput && !cityDisplayNameInput.value.trim()) {
                if (locationType === 'moon') {
                    cityDisplayNameInput.value = 'Horizon Lunar Colony';
                } else if (locationType === 'mars') {
                    cityDisplayNameInput.value = 'Red Promise Colony';
                } else if (locationType === 'marsShip') {
                    cityDisplayNameInput.value = 'Red Promise Escape Ship';
                } else if (locationType === 'station') {
                    cityDisplayNameInput.value = 'Interstellar Journey Space Station';
                }
            }
        }
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocationFieldManager;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.LocationFieldManager = LocationFieldManager;
}
