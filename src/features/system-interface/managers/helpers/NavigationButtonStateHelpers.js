/**
 * NavigationButtonStateHelpers - Button state utilities for event navigation
 */

/**
 * Resets button styles to default state
 * @param {HTMLElement} btn - Button element to reset
 * @param {{ skipOpacityTransform?: boolean }} [opts] - When true, keep inline opacity/transform (in-flight WAAPI page-turn)
 */
export function resetButtonStyles(btn, opts = {}) {
    const skipOpacityTransform = opts.skipOpacityTransform === true;
    btn.style.display = 'flex';
    btn.disabled = false;
    btn.removeAttribute('disabled');  // ensure attribute is gone (can persist after .disabled=true)
    btn.classList.remove('locked');
    btn.style.pointerEvents = 'auto'; // re-enable events after .locked/:disabled (CSS uses pointer-events: none)
    // Only remove specific style properties we might have set, keep display
    if (!skipOpacityTransform) {
        btn.style.opacity = '';
        btn.style.transform = '';
    }
    btn.style.filter = '';
    btn.style.background = '';
    btn.style.borderColor = '';
    btn.style.color = '';
    btn.style.cursor = '';
    btn.style.boxShadow = '';
}

/**
 * Checks if an event marker is locked
 * @param {Object} targetEvent - Target event to check
 * @param {Array} markers - Array of markers
 * @param {Object} coordinateMatcher - CoordinateMatcher instance
 * @returns {boolean} - True if marker is locked
 */
export function isEventMarkerLocked(targetEvent, markers, coordinateMatcher) {
    if (!markers || !targetEvent) return false;
    
    // Try to find marker - check all possible locations (globe, moon, mars, station)
    let marker = null;
    
    // First try direct event reference match
    marker = markers.find(m => {
        if (m.userData && m.userData.isEventMarker) {
            return m.userData.event === targetEvent;
        }
        return false;
    });
    
    // If not found, try coordinate matching
    if (!marker && coordinateMatcher) {
        marker = coordinateMatcher.findMarkerForEvent(markers, targetEvent);
    }
    
    // Check if marker is locked
    return marker && marker.userData && marker.userData.isLocked;
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.NavigationButtonStateHelpers) {
        window.NavigationButtonStateHelpers = {};
    }
    window.NavigationButtonStateHelpers.resetButtonStyles = resetButtonStyles;
    window.NavigationButtonStateHelpers.isEventMarkerLocked = isEventMarkerLocked;
}
