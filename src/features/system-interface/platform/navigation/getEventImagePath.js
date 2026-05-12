/**
 * Resolve the image path for an event, preferring `eventManager.getEventImagePath`
 * for consistency with the rest of the app; falling back to a name-derived path.
 *
 * @param {Object} displayEvent
 * @param {string} eventName
 * @param {string} [imageArchiveOverride] e.g. `'story'` for dock thumbs while editing heroes
 * @returns {string|null}
 */
export function getEventImagePath(displayEvent, eventName, imageArchiveOverride) {
    if (window.eventManager && typeof window.eventManager.getEventImagePath === 'function') {
        return window.eventManager.getEventImagePath(
            displayEvent.name,
            displayEvent.image,
            imageArchiveOverride
        );
    }

    let imagePath = displayEvent.image || null;
    if (!imagePath || !imagePath.trim()) {
        const normalizedName = eventName.replace(/\s+/g, ' ').trim();
        const encodedFileName = encodeURIComponent(normalizedName);
        imagePath = `src/assets/images/Archive/Events/${encodedFileName}.png`;
    }
    return imagePath;
}

/* Compat alias: `window.NavigationImageHelpers.getEventImagePath` is still read by
 * load-out / standalone-slide modules that pre-date ES-module migration. */
if (typeof window !== 'undefined') {
    if (!window.NavigationImageHelpers) {
        window.NavigationImageHelpers = {};
    }
    window.NavigationImageHelpers.getEventImagePath = getEventImagePath;
}
