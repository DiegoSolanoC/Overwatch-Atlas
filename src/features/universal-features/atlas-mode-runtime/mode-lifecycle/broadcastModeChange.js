/**
 * broadcastModeChange — fires the cross-feature `appmodechange` window
 * event so listeners (the header hub set up by `AppInitializer.js`, the
 * zoom-controls visibility logic, etc.) react to a mode transition.
 *
 * Call this immediately after the orchestrator (or any caller) has
 * actually entered, restored, or exited a mode — `setCurrentMode(...)`
 * persists the new mode, this announces it.
 */

const APP_MODE_CHANGE_EVENT = 'appmodechange';

/**
 * @param {'menu'|'globe'|'glossary'|'biography'|string} mode
 */
export function broadcastModeChange(mode) {
    try {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent(APP_MODE_CHANGE_EVENT, { detail: { mode } }));
    } catch (e) {
        console.warn('broadcastModeChange failed:', e);
    }
}
