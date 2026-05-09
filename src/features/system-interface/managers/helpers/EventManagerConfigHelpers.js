/**
 * EventManagerConfigHelpers - Utilities for configuring EventManager services
 * Extracted from EventManager to reduce file size
 */

/**
 * Configure all services with EventManager instance
 */
export function configureServices(services, eventManager) {
    if (services.renderService) {
        services.renderService.setEventManager(eventManager);
    }
    if (services.locationService) {
        services.locationService.setDataService(services.dataService);
        services.locationService.setEventManager(eventManager);
    }
    if (services.editService) {
        services.editService.setEventManager(eventManager);
    }
    if (services.formService) {
        services.formService.setEventManager(eventManager);
    }
    if (services.dragDropService) {
        services.dragDropService.setEventManager(eventManager);
    }
    if (services.listenerService) {
        services.listenerService.setEventManager(eventManager);
    }
    if (services.interactionService) {
        services.interactionService.setEventManager(eventManager);
    }
    if (services.initService) {
        services.initService.setEventManager(eventManager);
    }
    if (services.cityLookupService) {
        services.cityLookupService.setEventManager(eventManager);
    }
    if (services.imagePathService) {
        services.imagePathService.setEventManager(eventManager);
    }
    if (services.globeSyncService) {
        services.globeSyncService.setEventManager(eventManager);
    }
}

/**
 * Fallback service initialization (if helper not available)
 */
export function initializeServicesFallback() {
    const dataService = window.EventDataService || null;
    return {
        dataService,
        renderService: window.EventRenderService || null,
        locationService: window.LocationService || null,
        editService: window.EventEditService || null,
        formService: window.EventFormService || null,
        dragDropService: window.EventDragDropService || null,
        listenerService: window.EventListenerService || null,
        interactionService: window.EventInteractionService || null,
        initService: window.EventInitService || null,
        cityLookupService: window.CityLookupService || null,
        imagePathService: window.ImagePathService || null,
        globeSyncService: window.GlobeSyncService || null
    };
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.EventManagerConfigHelpers) {
        window.EventManagerConfigHelpers = {};
    }
    window.EventManagerConfigHelpers.configureServices = configureServices;
    window.EventManagerConfigHelpers.initializeServicesFallback = initializeServicesFallback;
}
