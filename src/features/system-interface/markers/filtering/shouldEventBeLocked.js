import { entityMatchesActiveFilters } from './entityMatchesActiveFilters.js';

/**
 * True when the event should render locked (no filter match on root or any variant).
 * @param {Object} event - Event object
 * @param {Set} activeFilters - Set of active filter IDs
 * @returns {boolean}
 */
export function shouldEventBeLocked(event, activeFilters) {
    if (!activeFilters || activeFilters.size === 0) {
        return false;
    }
    if (!event) {
        return true;
    }

    const variants = event.variants;
    if (variants && variants.length > 0) {
        const rootMatches = entityMatchesActiveFilters(event, activeFilters);
        const variantMatches = variants.some((v) => entityMatchesActiveFilters(v, activeFilters));
        return !rootMatches && !variantMatches;
    }

    return !entityMatchesActiveFilters(event, activeFilters);
}
