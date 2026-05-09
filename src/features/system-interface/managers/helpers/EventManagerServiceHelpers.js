/**
 * EventManagerServiceHelpers - Utilities for EventManager service initialization
 * Extracted from EventManager to reduce duplication
 */

/**
 * Initializes a service with optional setup callbacks
 * @param {Object} service - Service instance (may be null)
 * @param {Function} setupCallback - Optional callback to configure the service
 * @returns {Object|null} - The service instance or null
 */
export function initializeService(service, setupCallback) {
    if (service && setupCallback) {
        setupCallback(service);
    }
    return service;
}

/**
 * Initializes all EventManager services
 * @param {Object} eventManager - EventManager instance
 * @returns {Object} - Object containing all initialized services
 */
export function initializeAllServices(eventManager) {
    const dataService = window.EventDataService || null;
    
    const services = {
        dataService,
        renderService: initializeService(window.EventRenderService, (service) => {
            service.setEventManager(eventManager);
        }),
        locationService: initializeService(window.LocationService, (service) => {
            service.setDataService(dataService);
            service.setEventManager(eventManager);
        }),
        editService: initializeService(window.EventEditService, (service) => {
            service.setEventManager(eventManager);
        }),
        formService: initializeService(window.EventFormService, (service) => {
            service.setEventManager(eventManager);
        }),
        dragDropService: initializeService(window.EventDragDropService, (service) => {
            service.setEventManager(eventManager);
        }),
        listenerService: initializeService(window.EventListenerService, (service) => {
            service.setEventManager(eventManager);
        }),
        interactionService: initializeService(window.EventInteractionService, (service) => {
            service.setEventManager(eventManager);
        }),
        initService: initializeService(window.EventInitService, (service) => {
            service.setEventManager(eventManager);
        }),
        cityLookupService: initializeService(window.CityLookupService, (service) => {
            service.setEventManager(eventManager);
        }),
        imagePathService: initializeService(window.ImagePathService, (service) => {
            service.setEventManager(eventManager);
        }),
        globeSyncService: initializeService(window.GlobeSyncService, (service) => {
            service.setEventManager(eventManager);
        })
    };
    
    return services;
}

/**
 * Creates a getter function that delegates to a data service property
 * @param {Object} dataService - Data service instance
 * @param {string} propertyName - Property name to access
 * @returns {Function} - Getter function
 */
export function createDataServiceGetter(dataService, propertyName) {
    return () => dataService ? dataService[propertyName] : [];
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.EventManagerServiceHelpers) {
        window.EventManagerServiceHelpers = {};
    }
    window.EventManagerServiceHelpers.initializeAllServices = initializeAllServices;
    window.EventManagerServiceHelpers.createDataServiceGetter = createDataServiceGetter;
}
