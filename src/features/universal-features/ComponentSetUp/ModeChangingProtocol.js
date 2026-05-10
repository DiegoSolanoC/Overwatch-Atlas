/**
 * Mode-changing protocol — the cross-feature signal that the active app mode
 * just changed (menu, globe, glossary, biography).
 *
 * Listeners on `window` (e.g. the header hub set up by `AppInitializer.js`, the zoom
 * controls visibility logic) react to the `appmodechange` event this fires.
 */

const APP_MODE_CHANGE_EVENT = 'appmodechange';

/**
 * Runs the mode-changing protocol: announces to every listener on `window`
 * that the app's current mode is now `mode`. Call this immediately after the
 * orchestrator (or any caller) has actually entered, restored, or exited a mode.
 *
 * @param {string} mode - Recognized values: `'menu'`, `'globe'`, `'glossary'`, `'biography'`.
 */
export function runModeChangingProtocol(mode) {
    try {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent(APP_MODE_CHANGE_EVENT, { detail: { mode } }));
    } catch (e) {
        console.warn('runModeChangingProtocol failed:', e);
    }
}
