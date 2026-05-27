/**
 * EventListReorderDragDrop — drag/drop reorder for the event-manager list.
 *
 * Thin orchestrator that holds the back-reference to `EventManager` and delegates the three
 * real behaviors to siblings:
 *
 *   - `wireEventCardDragDrop.js`      — per-card dragstart/over/end/drop listeners
 *   - `wireArchiveSeparatorDrop.js`   — drop targets on `.event-archive-type-separator`
 *     dividers for the faction-type / hero-role / hero-subrole grouped archives
 *   - `reorderEventsInList.js`        — array mutation + per-archive metadata writes +
 *     re-render + unsaved-index bookkeeping
 *
 * GitHub Pages is read-only by policy, so `setupDragAndDrop()` early-returns there.
 *
 * Global: `window.EventListReorderDragDrop` (new) and `window.EventDragDropService`
 * (legacy alias).
 */

import { wireEventCardDragDrop } from './wireEventCardDragDrop.js';
import { wireArchiveSeparatorDrop } from './wireArchiveSeparatorDrop.js';
import { reorderEventsInList } from './reorderEventsInList.js';

class EventListReorderDragDrop {
    constructor() {
        this.eventManager = null;
    }

    setEventManager(eventManager) {
        this.eventManager = eventManager;
    }

    setupDragAndDrop() {
        if (!this.eventManager) return;
        if (this.eventManager.isGitHubPages && this.eventManager.isGitHubPages()) return;

        wireEventCardDragDrop(this);
        wireArchiveSeparatorDrop(this);
    }

    reorderEvents(fromIndex, toIndex, options = {}) {
        reorderEventsInList(this, fromIndex, toIndex, options);
    }
}

if (typeof window !== 'undefined') {
    const instance = new EventListReorderDragDrop();
    window.EventListReorderDragDrop = instance;
    // Legacy alias — kept until all consumers migrate.
    window.EventDragDropService = instance;
}

export default EventListReorderDragDrop;
