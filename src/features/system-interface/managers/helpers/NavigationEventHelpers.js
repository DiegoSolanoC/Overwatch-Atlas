/**
 * NavigationEventHelpers - Event navigation utilities
 */

import { getEventImagePath } from './NavigationImageHelpers.js';
import { handleLocationTypeCamera, getLocationType } from './NavigationLocationHelpers.js';

/**
 * Handles clicking a number button to navigate to an event
 * @param {Object} params - Parameters
 * @param {Object} params.targetEvent - Target event to navigate to
 * @param {Object} params.eventMarker - Marker for the event (variant marker when multi-event)
 * @param {Object} params.eventSlideManager - EventSlideManager instance
 * @param {Object} params.interactionController - InteractionController instance
 * @param {number} [params.variantIndex] - Active variant index for multi-events (pagination thumb / filters)
 */
export function handleNumberButtonClick({
    targetEvent,
    eventMarker,
    eventSlideManager,
    interactionController,
    variantIndex
}) {
    const hasVariants = Array.isArray(targetEvent?.variants) && targetEvent.variants.length > 0;
    const isMultiEvent = !!(hasVariants && targetEvent.variants.length > 1);
    let vi = 0;
    if (isMultiEvent && variantIndex !== undefined && variantIndex !== null) {
        vi = Math.max(0, Math.min(targetEvent.variants.length - 1, Number(variantIndex)));
    } else if (isMultiEvent && eventMarker?.userData?.variantIndex !== undefined) {
        vi = Math.max(0, Math.min(targetEvent.variants.length - 1, eventMarker.userData.variantIndex));
    }
    let displayEvent = targetEvent;
    if (isMultiEvent) {
        displayEvent = targetEvent.variants[vi] || targetEvent.variants[0];
    } else if (hasVariants) {
        displayEvent = targetEvent.variants[0];
    }

    const eventName = displayEvent.name || (eventMarker && eventMarker.userData && eventMarker.userData.eventName) || '';
    const eventDescription = displayEvent.description;

    // Get image path using helper
    const imagePath = getEventImagePath(displayEvent, eventName);

    // Zoom to marker or reset to default view (for Moon/Mars/Station) and show event slide
    if (interactionController && eventMarker) {
        const locationType = getLocationType(eventMarker, displayEvent);
        const sceneModel = window.globeController?.sceneModel;
        handleLocationTypeCamera(interactionController, eventMarker, locationType, sceneModel);
    }

    eventSlideManager.showEventSlide(
        eventName,
        imagePath,
        eventDescription,
        eventMarker,
        targetEvent
    );
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.NavigationEventHelpers) {
        window.NavigationEventHelpers = {};
    }
    window.NavigationEventHelpers.handleNumberButtonClick = handleNumberButtonClick;
}
