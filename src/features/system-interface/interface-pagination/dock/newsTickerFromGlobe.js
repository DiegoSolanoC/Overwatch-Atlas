/**
 * newsTickerFromGlobe — bridge that pushes the globe's current page of events
 * into the news ticker after a page change.
 *
 *   - updateNewsTickerFromGlobe(): looks up the active dataModel via
 *     globeController or the codex slide bridge, then forwards the page's
 *     events to window.newsTickerService.
 */

export function updateNewsTickerFromGlobe() {
    const dm = window.globeController?.dataModel || window.__codexEventSlideBridge?.dataModel;
    if (dm && window.newsTickerService?.updateTicker) {
        const currentPageEvents = dm.getEventsForCurrentPage();
        window.newsTickerService.updateTicker(currentPageEvents);
    }
}
