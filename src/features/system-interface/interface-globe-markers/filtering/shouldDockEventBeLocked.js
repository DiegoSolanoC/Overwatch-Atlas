import { shouldEventBeLocked } from './shouldEventBeLocked.js';
import { shouldEventBeExcludedByManagerSearch } from '../../interface-left-panel/coordinator/search/filterEvents.js';

/**
 * Dock thumbs / page-turn lock: chip filters + Event Manager search (same curation as timeline).
 * @param {Object} event
 * @param {Set} [activeFilters]
 * @returns {boolean}
 */
export function shouldDockEventBeLocked(event, activeFilters) {
    const filters = activeFilters || (typeof window !== 'undefined' ? window.standaloneActiveFilters : null);
    if (filters?.size > 0 && shouldEventBeLocked(event, filters)) {
        return true;
    }
    const em = typeof window !== 'undefined' ? window.eventManager : null;
    return shouldEventBeExcludedByManagerSearch(em, event);
}
