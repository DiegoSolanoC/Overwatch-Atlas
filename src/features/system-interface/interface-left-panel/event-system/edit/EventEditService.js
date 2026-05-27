/**
 * EventEditService - Thin orchestrator for event CRUD operations.
 *
 * State lives on this instance (just a back-reference to `EventManager`); all real logic is
 * in the sibling modules:
 *
 *   - `timelineFormParsing.js`           — yearStart/yearEnd + eraName parsing/applying
 *   - `createEventFromForm.js`           — DOM form snapshot → event object
 *   - `deleteEventAtIndex.js`            — delete + pagination/unsaved-index fix-up
 *   - `addOrUpdateEvent.js`              — insert/move with index reshuffling
 *   - `buildBlankEventForArchiveSource.js` — schema-aware default rows for "add blank"
 *
 * Inline slide edit and other callers read timeline helpers off the class via
 * `window.EventEditService.constructor.<staticName>(…)`, so the static surface is preserved
 * on the class itself for backward compatibility.
 */

import {
    parseTimelineFormStrings,
    applyTimelineToEvent,
    applyEraNameToEvent
} from './timelineFormParsing.js';
import { createEventFromForm } from './createEventFromForm.js';
import { deleteEventAtIndex } from './deleteEventAtIndex.js';
import { addEvent, updateEvent } from './addOrUpdateEvent.js';
import { buildBlankEventForArchiveSource } from './buildBlankEventForArchiveSource.js';

class EventEditService {
    constructor() {
        this.eventManager = null;
    }

    setEventManager(eventManager) {
        this.eventManager = eventManager;
    }

    deleteEvent(index) {
        return deleteEventAtIndex(this, index);
    }

    createEventFromForm(formData, variantData = [], factions = []) {
        return createEventFromForm(formData, variantData, factions);
    }

    addEvent(event, targetPosition = null) {
        return addEvent(this, event, targetPosition);
    }

    updateEvent(oldIndex, event, targetPosition = null) {
        return updateEvent(this, oldIndex, event, targetPosition);
    }

    static parseTimelineFormStrings(yearStartStr, yearEndStr) {
        return parseTimelineFormStrings(yearStartStr, yearEndStr);
    }

    static applyTimelineToEvent(event, timeline) {
        applyTimelineToEvent(event, timeline);
    }

    static applyEraNameToEvent(event, trimmedName) {
        applyEraNameToEvent(event, trimmedName);
    }

    static buildBlankEventForArchiveSource(archiveSrc) {
        return buildBlankEventForArchiveSource(archiveSrc);
    }
}

if (typeof window !== 'undefined') {
    window.EventEditService = new EventEditService();
}

export default EventEditService;
