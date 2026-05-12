/**
 * Category-specific styling and behavior for Data Archive.
 * Handles CSS class application and category-specific UI adaptations.
 */

import { updateStatus } from '../../universal-features/runtime/statusFeed.js';

/**
 * Apply category-specific CSS classes and behaviors.
 * @param {HTMLElement} eventsManagePanel
 * @param {string} archiveSource
 */
export function applyCategoryStyling(eventsManagePanel, archiveSource) {
    if (!eventsManagePanel) return;

    // Remove any existing category classes
    removeCategoryClasses(eventsManagePanel);

    // Apply new category class
    eventsManagePanel.classList.add(`story-archive-category--${archiveSource}`);

    updateStatus(`Applied ${archiveSource} category styling`, 'info');
}

/**
 * Remove all category-specific CSS classes.
 * @param {HTMLElement} eventsManagePanel
 */
export function removeCategoryClasses(eventsManagePanel) {
    if (!eventsManagePanel) return;

    const categoryClasses = [
        'story-archive-category--story',
        'story-archive-category--heroes', 
        'story-archive-category--factions',
        'story-archive-category--npcs',
        'story-archive-category--locations'
    ];

    categoryClasses.forEach(className => {
        eventsManagePanel.classList.remove(className);
    });
}

/**
 * Setup category-specific behaviors (placeholder for future expansion).
 * @param {HTMLElement} eventsManagePanel
 * @param {string} archiveSource
 */
export function setupCategoryBehaviors(eventsManagePanel, archiveSource) {
    // Future category-specific behaviors can be added here
    // Examples: special sorting, filtering, UI enhancements per category
    updateStatus(`Setup ${archiveSource} category behaviors`, 'info');
}
