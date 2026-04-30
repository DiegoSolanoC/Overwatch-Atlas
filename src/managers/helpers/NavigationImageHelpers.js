/**
 * NavigationImageHelpers - Image path utilities for event navigation
 */

/**
 * Gets the image path for an event
 * @param {Object} displayEvent - Event object to get image for
 * @param {string} eventName - Event name (fallback)
 * @param {string} [imageArchiveOverride] - e.g. `'story'` for dock thumbs while editing heroes
 * @returns {string|null} - Image path or null
 */
export function getEventImagePath(displayEvent, eventName, imageArchiveOverride) {
    // Use EventManager's function if available for consistency
    if (window.eventManager && typeof window.eventManager.getEventImagePath === 'function') {
        const imagePath = window.eventManager.getEventImagePath(
            displayEvent.name,
            displayEvent.image,
            imageArchiveOverride
        );
        console.log(`[NavigationImageHelpers] Image path for "${eventName}": ${imagePath}`);
        return imagePath;
    }
    
    // Fallback: construct path manually
    let imagePath = displayEvent.image || null;
    if (!imagePath || !imagePath.trim()) {
        const normalizedName = eventName.replace(/\s+/g, ' ').trim();
        const encodedFileName = encodeURIComponent(normalizedName);
        imagePath = `assets/images/Archive%20data/events/${encodedFileName}.png`;
    }
    console.log(`[NavigationImageHelpers] Image path (fallback) for "${eventName}": ${imagePath}`);
    return imagePath;
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.NavigationImageHelpers) {
        window.NavigationImageHelpers = {};
    }
    window.NavigationImageHelpers.getEventImagePath = getEventImagePath;
}
