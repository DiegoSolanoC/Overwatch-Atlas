import { shouldEventBeLocked } from './shouldEventBeLocked.js';
import { shouldEventBeExcludedByManagerSearch } from '../../interface-left-panel/coordinator/search/filterEvents.js';
import { isHeroBiographyDockFilterActive } from '../../../gallery/gallery-mode/heroBiographyDockTimeline.js';
import { isDialogueTheaterDockEvent } from '../../../dialogue-theater/dialogue-theater-mode/dialogueTheaterDockTimeline.js';

/**
 * Dock thumbs / page-turn lock: chip filters + Event Manager Filters/Country axes.
 * Free-text Search does not lock dock entries.
 * Intel: no entity → lock against the full timeline; entity selected → lock within
 * that curated strip (filters still apply on top of curation).
 * @param {Object} event
 * @param {Set} [activeFilters]
 * @returns {boolean}
 */
export function shouldDockEventBeLocked(event, activeFilters) {
    if (isDialogueTheaterDockEvent(event)) return false;
    const filters = activeFilters || (typeof window !== 'undefined' ? window.standaloneActiveFilters : null);
    if (filters?.size > 0 && shouldEventBeLocked(event, filters)) {
        return true;
    }
    /* Manager-axis search does not re-lock an already entity-curated Intel strip. */
    if (isHeroBiographyDockFilterActive()) {
        return false;
    }
    const em = typeof window !== 'undefined' ? window.eventManager : null;
    return shouldEventBeExcludedByManagerSearch(em, event);
}
