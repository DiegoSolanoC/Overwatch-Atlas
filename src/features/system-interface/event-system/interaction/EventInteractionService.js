/**
 * EventInteractionService - Thin orchestrator for click-driven event interactions.
 *
 * State lives on this instance (just a back-reference to `EventManager`); all real logic
 * is in the sibling modules:
 *
 *   - `openEventFromList.js`     — open the slide UI from a manager-list click
 *   - `eventVariantCycling.js`   — cycle / reset multi-event variants
 *   - `updateEventItemPreview.js` — repaint a single card with a chosen variant
 */

import { openEventFromList } from './openEventFromList.js';
import { cycleEventVariant, resetAllEventVariants } from './eventVariantCycling.js';
import { updateEventItemPreview } from './updateEventItemPreview.js';

class EventInteractionService {
    constructor() {
        this.eventManager = null;
    }

    setEventManager(eventManager) {
        this.eventManager = eventManager;
    }

    openEventFromList(event, index) {
        openEventFromList(this, event, index);
    }

    cycleEventVariant(eventIndex, event, itemElement) {
        cycleEventVariant(this, eventIndex, event, itemElement);
    }

    resetAllEventVariants() {
        resetAllEventVariants(this);
    }

    updateEventItemPreview(eventIndex, event, itemElement, variantIndex) {
        updateEventItemPreview(this, eventIndex, event, itemElement, variantIndex);
    }
}

if (typeof window !== 'undefined') {
    window.EventInteractionService = new EventInteractionService();
}

export default EventInteractionService;
