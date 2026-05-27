/**
 * Best-effort lookup of the live timeline UI/data context.
 *
 * Returns the globe's own `dataModel + uiView + globe` if the globe controller is up; falls
 * back to the slide bridge that ships only `dataModel + uiView` (no globe instance) for the
 * dock-only deployments; returns null when neither is initialized yet.
 */
function resolveTimelineUiContext() {
    const gc = window.globeController;
    if (gc?.globeView && gc?.uiView && gc?.dataModel) {
        return { dataModel: gc.dataModel, uiView: gc.uiView, globe: gc };
    }
    const bridge = window.__codexEventSlideBridge;
    if (bridge?.uiView && bridge?.dataModel) {
        return { dataModel: bridge.dataModel, uiView: bridge.uiView, globe: null };
    }
    return null;
}

/**
 * Find the globe marker that backs a given event (and, when relevant, the specific variant
 * sub-marker).
 *
 * Tries two match strategies:
 *   1. Strict identity: `marker.userData.event === event`.
 *   2. Coordinate match (lat/lon within 0.0001) — guards against re-bound event objects
 *      that point to the same place.
 *
 * If a multi-event variant has its own sub-marker (`userData.variantIndex === variantIndex`),
 * prefer that one so camera framing lands on the variant rather than the parent pin.
 *
 * Returns `null` if the matching marker is locked (i.e. another slide is currently open on
 * it), to signal callers to bail out without opening anything.
 */
function findTargetMarker(globe, event, isMultiEvent, variantIndex) {
    if (!globe?.sceneModel) return undefined;
    const markers = globe.sceneModel.getMarkers();
    const eventMarker = markers.find((m) => {
        if (!m.userData || !m.userData.isEventMarker) return false;
        const markerEvent = m.userData.event;
        return (markerEvent === event)
            || (markerEvent.lat !== undefined && event.lat !== undefined
                && Math.abs(markerEvent.lat - event.lat) < 0.0001
                && Math.abs(markerEvent.lon - event.lon) < 0.0001);
    });

    if (!eventMarker) return undefined;
    if (eventMarker.userData && eventMarker.userData.isLocked) return null;

    let targetMarker = eventMarker;
    if (isMultiEvent && variantIndex > 0) {
        const variantMarker = markers.find((m) => (
            m.userData
            && m.userData.isEventMarker
            && m.userData.event === event
            && m.userData.variantIndex === variantIndex
        ));
        if (variantMarker) targetMarker = variantMarker;
    }
    return targetMarker;
}

/**
 * Frame the camera on the resolved marker, preferring the per-location-type helper if
 * available so e.g. Moon/Mars events land in the right camera mode.
 */
function frameCameraOnTarget(globe, targetMarker, displayEvent) {
    const ic = globe.interactionController;
    if (!ic) return;
    const navLoc = window.NavigationLocationHelpers;
    if (navLoc && typeof navLoc.handleLocationTypeCamera === 'function' && typeof navLoc.getLocationType === 'function') {
        navLoc.handleLocationTypeCamera(ic, targetMarker, navLoc.getLocationType(targetMarker, displayEvent), globe.sceneModel);
        return;
    }
    const locationType = targetMarker.userData ? targetMarker.userData.locationType : 'earth';
    if (locationType === 'moon' || locationType === 'mars') {
        ic.resetCameraToDefault();
    } else {
        ic.zoomToMarker(targetMarker);
    }
}

/**
 * Open the event slide UI for an event clicked from the manager list.
 *
 * Lifecycle (called via `EventInteractionService.openEventFromList`):
 *   1. **Lock interaction**: set `isOpeningEvent` so other handlers don't fight the open.
 *   2. **Page sync**: if the clicked event lives on a different page than the current one,
 *      flip the data model's page, refresh the markers via `TimelineMarkerSync`, then wait
 *      for the refresh promise before opening (so the marker we need actually exists).
 *   3. **Resolve display event**: pull the active variant (or the event itself for singles)
 *      using the per-item `eventItemVariantIndices` map.
 *   4. **Find + frame marker**: locate the globe marker for the event/variant and reposition
 *      the camera. If the marker is locked, bail without opening anything (another panel is
 *      already attached to it).
 *   5. **Open slide UI**: mobile-portrait gets the standalone slide; everything else uses the
 *      dock-style slide from `uiView`.
 *   6. **Cleanup**: close the manager panel with a short delay so the click-out doesn't fire
 *      mid-animation, then clear `isOpeningEvent` after a safety 2s timeout.
 */
export function openEventFromList(interactionService, event, index) {
    if (!interactionService.eventManager) return;

    interactionService.eventManager.isOpeningEvent = true;

    const closeManagerPanel = () => {
        const panel = document.getElementById('eventsManagePanel');
        if (panel) panel.classList.remove('open');
        const toggleBtn = document.getElementById('eventsManageToggle');
        if (toggleBtn) toggleBtn.classList.remove('active');
        setTimeout(() => {
            interactionService.eventManager.isOpeningEvent = false;
        }, 320);
    };

    const openSlideForListItem = () => {
        const ctx = resolveTimelineUiContext();
        if (!ctx?.uiView) {
            closeManagerPanel();
            return;
        }

        const { uiView, globe } = ctx;

        const isMultiEvent = event.variants && event.variants.length > 0;
        let variantIndex = 0;
        if (isMultiEvent) {
            const itemKey = `event-${index}`;
            variantIndex = interactionService.eventManager.eventItemVariantIndices.get(itemKey) || 0;
        }
        const displayEvent = isMultiEvent ? event.variants[variantIndex] : event;

        const targetMarker = findTargetMarker(globe, event, isMultiEvent, variantIndex);
        if (targetMarker === null) {
            closeManagerPanel();
            return;
        }
        if (targetMarker) {
            frameCameraOnTarget(globe, targetMarker, displayEvent);
        }

        const eventName = displayEvent.name
            || (targetMarker && targetMarker.userData && targetMarker.userData.eventName)
            || event.name;
        const eventDescription = displayEvent.description;
        const imagePath = interactionService.eventManager.getEventImagePath
            ? interactionService.eventManager.getEventImagePath(displayEvent.name, displayEvent.image)
            : null;

        // Mobile-portrait uses the standalone slide (same list as the manager); desktop /
        // mobile-landscape use the dock-style slide on `uiView`.
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isMobilePortrait = isTouchDevice && window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
        if (isMobilePortrait && window.standaloneEventSlide) {
            const listEv = interactionService.eventManager.events || [];
            const eventIndex = listEv.indexOf(event);
            if (eventIndex >= 0) {
                window.standaloneEventSlide.showEvent(eventIndex, { eventList: listEv });
            }
        } else {
            uiView.showEventSlide(eventName, imagePath, eventDescription, targetMarker, event);
        }

        interactionService.resetAllEventVariants();
        closeManagerPanel();
    };

    const runOpenFlow = () => {
        const ctx = resolveTimelineUiContext();
        if (!ctx?.dataModel) {
            openSlideForListItem();
            return;
        }

        const { dataModel, uiView } = ctx;
        const currentPage = dataModel.getCurrentEventPage();
        const eventsPerPage = dataModel.eventsPerPage || 10;
        const eventPage = Math.floor(index / eventsPerPage) + 1;

        if (eventPage !== currentPage) {
            dataModel.setCurrentEventPage(eventPage);
            if (uiView && typeof uiView.updatePaginationUI === 'function') {
                uiView.updatePaginationUI();
            }
            const T = typeof window !== 'undefined' ? window.TimelineMarkerSync : null;
            const refreshPromise = T && typeof T.refreshTimelineEventMarkers === 'function'
                ? T.refreshTimelineEventMarkers(false)
                : null;
            if (refreshPromise && typeof refreshPromise.then === 'function') {
                refreshPromise
                    .then(() => requestAnimationFrame(openSlideForListItem))
                    .catch(() => setTimeout(openSlideForListItem, 50));
            } else {
                requestAnimationFrame(openSlideForListItem);
            }
            return;
        }
        openSlideForListItem();
    };

    runOpenFlow();

    // Safety unlock — every code path above also clears this, but if a thrown exception
    // skips them we don't want the manager stuck in "opening" mode forever.
    setTimeout(() => {
        interactionService.eventManager.isOpeningEvent = false;
    }, 2000);
}
