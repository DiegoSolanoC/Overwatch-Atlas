/**
 * Drive the bottom news ticker from whatever set of events is currently "on screen on the globe".
 *
 * Source preference:
 *   1. `window.globeController.dataModel.getEventsForCurrentPage()` — the live globe page (10 events).
 *      Always preferred when the globe is up, even if `displayedEvents` (manager list) shows a
 *      different slice; the ticker is meant to mirror the globe, not the manager filter.
 *   2. `displayedEvents`  — fallback when the globe isn't ready yet (e.g. early boot).
 *
 * The ticker is lazy-instantiated on first use. If `window.NewsTickerService` hasn't loaded yet,
 * we re-poll every 100ms — this can happen during a cold boot when EventRenderService renders
 * before FooterNewsTicker.js finishes parsing.
 *
 * The ticker also waits for `footer.timeline-loaded` so the strip doesn't flash empty text
 * before the timeline UI is ready.
 *
 * @param {Array<Record<string, any>>} displayedEvents Manager-list slice (fallback only).
 */
export function updateNewsTicker(displayedEvents) {
    if (window.globeController && window.globeController.dataModel) {
        const currentPageEvents = window.globeController.dataModel.getEventsForCurrentPage();
        updateNewsTickerFromGlobePage(currentPageEvents);
    } else {
        updateNewsTickerFromGlobePage(displayedEvents);
    }
}

function updateNewsTickerFromGlobePage(currentPageEvents) {
    if (!window.newsTickerService) {
        if (window.NewsTickerService) {
            window.newsTickerService = new window.NewsTickerService();
            window.newsTickerService.init();
        } else {
            // Service script hasn't parsed yet during cold boot — poll until it has.
            setTimeout(() => updateNewsTickerFromGlobePage(currentPageEvents), 100);
            return;
        }
    }

    // Wait for the timeline UI to be ready before showing the ticker.
    const footer = document.querySelector('footer');
    if (!footer || !footer.classList.contains('timeline-loaded')) {
        return;
    }

    if (window.newsTickerService && window.newsTickerService.updateTicker) {
        window.newsTickerService.updateTicker(currentPageEvents);
    }
}
