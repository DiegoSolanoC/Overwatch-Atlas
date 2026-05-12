/**
 * Event Manager adapter state management utilities.
 * Provides centralized state tracking for the adapter system.
 */

// === Adapter State ===============================================

/** @type {Node | null} Where `#eventsManagePanel` lived before being moved into Data Archive */
export let originalEventsPanelParent = null;
/** @type {string | null} ClassName the panel had before Data Archive started rewriting it */
export let originalEventsPanelClasses = null;
/** @type {string | null} Current archive source */
export let currentArchiveSource = null;

// === State Management Functions ==================================

/**
 * Store original EventManager panel state.
 * @param {Node} parent - Original parent element
 * @param {string} classes - Original className
 */
export function storeOriginalPanelState(parent, classes) {
    originalEventsPanelParent = parent;
    originalEventsPanelClasses = classes;
}

/**
 * Clear stored EventManager panel state.
 */
export function clearOriginalPanelState() {
    originalEventsPanelParent = null;
    originalEventsPanelClasses = null;
}

/**
 * Set current archive source.
 * @param {string} archiveSource - Current archive source
 */
export function setCurrentArchiveSource(archiveSource) {
    currentArchiveSource = archiveSource;
}

/**
 * Get current archive source.
 * @returns {string | null} Current archive source
 */
export function getCurrentArchiveSource() {
    return currentArchiveSource;
}

/**
 * Check if adapter has stored original state.
 * @returns {boolean} True if original state is stored
 */
export function hasOriginalState() {
    return !!(originalEventsPanelParent && originalEventsPanelClasses);
}

/**
 * Reset all adapter state.
 */
export function resetAdapterState() {
    originalEventsPanelParent = null;
    originalEventsPanelClasses = null;
    currentArchiveSource = null;
}
