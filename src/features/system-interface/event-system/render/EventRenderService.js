/**
 * EventRenderService — facade for the Event Manager render pipeline.
 *
 * Owns three pieces of mutable state and delegates everything else:
 *
 *   - `_animateNextPageRender` — single-shot flag the caller primes via
 *     `requestPageEntranceAnimation()`; the next render plays the staggered entrance wave
 *     and then clears the flag.
 *   - `_entranceAnimToken`     — increments per animation kick so superseded waves bail
 *     mid-flight (read by `staggeredEntranceAnimation.js`).
 *   - `_eventManagerImgObserver` — active `IntersectionObserver` for lazy image load; held
 *     here so the next render can disconnect it cleanly before installing a fresh one.
 *
 * The real per-render pipeline lives in `renderEventsList.js`. Per-card construction lives
 * in `createEventItem.js`.
 *
 * Exposes `window.EventRenderService` (singleton instance) for back-compat with
 * classic-script consumers.
 */

import { renderEventsList } from './renderEventsList.js';
import { createEventItem } from './createEventItem.js';

class EventRenderService {
    constructor() {
        this.eventManager = null;
        this._animateNextPageRender = false;
        this._entranceAnimToken = 0;
        this._eventManagerImgObserver = null;
    }

    setEventManager(eventManager) {
        this.eventManager = eventManager;
    }

    /** Prime the entrance wave for the next render. Cleared automatically after rendering. */
    requestPageEntranceAnimation() {
        this._animateNextPageRender = true;
    }

    updateStatus(message, type = 'info') {
        if (typeof window.updateStatus === 'function') {
            window.updateStatus(message, type);
        }
    }

    /**
     * @param {Array} events Events to render (post-filter).
     * @param {number} currentPage
     * @param {number} eventsPerPage
     * @param {Function} [onRenderComplete] Drag/drop wire-up etc; fires after DOM insert.
     */
    renderEvents(events, currentPage, eventsPerPage, onRenderComplete) {
        renderEventsList(this, events, currentPage, eventsPerPage, onRenderComplete);
    }

    /** Older consumers that call the helper directly land here. */
    createEventItem(event, index, allEvents, options = {}) {
        return createEventItem(this, event, index, allEvents, options);
    }
}

if (typeof window !== 'undefined') {
    window.EventRenderService = new EventRenderService();
}

export default EventRenderService;
