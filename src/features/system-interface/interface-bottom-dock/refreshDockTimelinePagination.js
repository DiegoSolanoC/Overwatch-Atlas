/**
 * Rebuild dock pagination after any dock timeline subset changes (gallery entity, era, etc.).
 */

export function refreshDockTimelinePagination() {
    const slide = window.standaloneEventSlide;
    const pagination = window.standaloneDockPagination;
    const fullDock = window.eventManager?.getDockTimelineEvents?.() ?? [];
    const curated = pagination?.getDockEvents?.() ?? fullDock;
    const subsetActive = curated.length < fullDock.length;

    if (
        slide
        && Number.isFinite(slide.currentEventIndex)
        && slide.currentEventIndex >= 0
        && subsetActive
    ) {
        const openEvent = slide.allEvents?.[slide.currentEventIndex];
        if (openEvent && !curated.includes(openEvent)) {
            slide.hideEventSlide?.();
        }
    }

    if (pagination?.goToPage) {
        pagination.goToPage(1, { skipSound: true });
    }
    if (slide?.updatePaginationUI) {
        slide.updatePaginationUI({ animate: false });
    }

    if (window.newsTickerService && pagination?.getDockEvents) {
        const page = pagination.getCurrentPage?.() || 1;
        const perPage = pagination.eventsPerPage || 10;
        const events = pagination.getDockEvents();
        const start = (page - 1) * perPage;
        window.newsTickerService.updateTicker(events.slice(start, start + perPage));
    }

    window.globeEventMarkerManager?.refreshEventMarkers?.(true);
    window.globeController?.map2dLite?.syncMarkers?.({ mode: 'pageTurn' });

    window.dispatchEvent(
        new CustomEvent('atlas-dock-timeline-page-changed', {
            detail: { page: pagination?.getCurrentPage?.() || 1 },
        }),
    );
}
