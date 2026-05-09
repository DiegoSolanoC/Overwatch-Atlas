/**
 * EventManagerDelegationHelpers - Generic delegation utilities for EventManager
 * Extracted to eliminate DRY violations from repeated delegation patterns
 */

/**
 * Generic service delegation helper
 * Creates a delegation function that checks if service exists and calls method
 */
export function createDelegation(serviceName, methodName, fallbackValue = null) {
    return function(eventManager, ...args) {
        const service = eventManager[serviceName];
        if (service && typeof service[methodName] === 'function') {
            return service[methodName](...args);
        }
        return fallbackValue;
    };
}

/**
 * Generic async service delegation helper
 */
export function createAsyncDelegation(serviceName, methodName, fallbackValue = null) {
    return async function(eventManager, ...args) {
        const service = eventManager[serviceName];
        if (service && typeof service[methodName] === 'function') {
            return await service[methodName](...args);
        }
        return fallbackValue;
    };
}

/**
 * Create getter delegation - returns data from service property
 */
export function createGetterDelegation(serviceName, propertyName, defaultValue = []) {
    return function(eventManager) {
        const service = eventManager[serviceName];
        return service ? service[propertyName] : defaultValue;
    };
}

/**
 * Create setter delegation - sets data on service property
 */
export function createSetterDelegation(serviceName, propertyName) {
    return function(eventManager, value) {
        const service = eventManager[serviceName];
        if (service) {
            service[propertyName] = value;
        }
    };
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.EventManagerDelegationHelpers) {
        window.EventManagerDelegationHelpers = {};
    }
    window.EventManagerDelegationHelpers.createDelegation = createDelegation;
    window.EventManagerDelegationHelpers.createAsyncDelegation = createAsyncDelegation;
    window.EventManagerDelegationHelpers.createGetterDelegation = createGetterDelegation;
    window.EventManagerDelegationHelpers.createSetterDelegation = createSetterDelegation;
}
