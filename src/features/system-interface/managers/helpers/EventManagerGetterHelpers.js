/**
 * EventManagerGetterHelpers - Consolidated getter methods for EventManager
 * Extracted to reduce repetition and follow DRY principle
 */

/**
 * Get data property from dataService
 */
export function getDataProperty(dataService, propertyName, defaultValue = []) {
    return dataService ? dataService[propertyName] : defaultValue;
}

/**
 * Create all data getters at once
 */
export function createDataGetters(dataService) {
    return {
        get cities() { return getDataProperty(dataService, 'cities', []); },
        get fictionalCities() { return getDataProperty(dataService, 'fictionalCities', []); },
        get airports() { return getDataProperty(dataService, 'airports', []); },
        get seaports() { return getDataProperty(dataService, 'seaports', []); },
        get heroes() { return getDataProperty(dataService, 'heroes', []); },
        get factions() { return getDataProperty(dataService, 'factions', []); },
        get displayNames() { return getDataProperty(dataService, 'displayNames', {}); }
    };
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.EventManagerGetterHelpers) {
        window.EventManagerGetterHelpers = {};
    }
    window.EventManagerGetterHelpers.getDataProperty = getDataProperty;
    window.EventManagerGetterHelpers.createDataGetters = createDataGetters;
}
