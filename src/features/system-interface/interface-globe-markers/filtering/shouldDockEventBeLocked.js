import { shouldEventBeLocked } from './shouldEventBeLocked.js';
import { shouldEventBeExcludedByManagerSearch } from '../../interface-left-panel/coordinator/search/filterEvents.js';
import { isHeroBiographyDockFilterActive } from '../../../gallery/gallery-mode/heroBiographyDockTimeline.js';
import { isDialogueTheaterDockEvent } from '../../../dialogue-theater/dialogue-theater-mode/dialogueTheaterDockTimeline.js';

/**
 * Dock thumbs / page-turn lock: chip filters + Event Manager Filters/Country axes.
 * Free-text Search does not lock dock entries.
 * Gallery curated dock is already filtered to matching events — never lock those thumbs.
 * @param {Object} event
 * @param {Set} [activeFilters]
 * @returns {boolean}
 */
export function shouldDockEventBeLocked(event, activeFilters) {
    if (isDialogueTheaterDockEvent(event)) return false;
    if (isHeroBiographyDockFilterActive()) {
        return false;
    }
    const filters = activeFilters || (typeof window !== 'undefined' ? window.standaloneActiveFilters : null);
    if (filters?.size > 0 && shouldEventBeLocked(event, filters)) {
        return true;
    }
    const em = typeof window !== 'undefined' ? window.eventManager : null;
    return shouldEventBeExcludedByManagerSearch(em, event);
}
