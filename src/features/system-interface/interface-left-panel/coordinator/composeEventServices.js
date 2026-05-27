/**
 * Wires Event* globals onto an EventManager (setEventManager / setDataService).
 * Single pass — avoids duplicate configuration if split across two helpers.
 * @param {object} eventManager
 */
export function composeEventServices(eventManager) {
    const dataService = window.EventDataService || null;

    const renderService = window.EventRenderService || null;
    if (renderService) renderService.setEventManager(eventManager);

    const locationService = window.LocationService || null;
    if (locationService) {
        locationService.setDataService(dataService);
        locationService.setEventManager(eventManager);
    }

    const editService = window.EventEditService || null;
    if (editService) editService.setEventManager(eventManager);

    const formService = window.EventFormService || null;
    if (formService) formService.setEventManager(eventManager);

    const dragDropService = window.EventDragDropService || null;
    if (dragDropService) dragDropService.setEventManager(eventManager);

    const listenerService = window.EventListenerService || null;
    if (listenerService) listenerService.setEventManager(eventManager);

    const interactionService = window.EventInteractionService || null;
    if (interactionService) interactionService.setEventManager(eventManager);

    const initService = window.EventInitService || null;
    if (initService) initService.setEventManager(eventManager);

    const cityLookupService = window.CityLookupService || null;
    if (cityLookupService) cityLookupService.setEventManager(eventManager);

    const imagePathService = window.ImagePathService || null;
    if (imagePathService) imagePathService.setEventManager(eventManager);

    const globeSyncService = window.GlobeSyncService || null;
    if (globeSyncService) globeSyncService.setEventManager(eventManager);

    return {
        dataService,
        renderService,
        locationService,
        editService,
        formService,
        dragDropService,
        listenerService,
        interactionService,
        initService,
        cityLookupService,
        imagePathService,
        globeSyncService
    };
}
