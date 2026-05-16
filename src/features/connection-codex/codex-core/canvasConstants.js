/** Canvas-local constants (not mount session state). */
export const DOUBLE_RIGHT_MS = 900;
export const capOpts = Object.freeze({ capture: true });
export const CODEX_JUNCTION_PREVIEW_DATA_URI =
    'data:image/svg+xml,'
    + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">'
        + '<circle cx="24" cy="24" r="14" fill="rgba(196,181,253,0.4)" stroke="rgba(233,213,255,0.95)" stroke-width="3"/>'
        + '</svg>'
    );
export const MAX_SUGGEST = 8;
export const CODEX_DEBUG_UI_PREF_KEY = 'timelineCodexShowDebugging';
/** @deprecated read for migration only */
export const CODEX_DEBUG_UI_PREF_KEY_LEGACY = 'timelineCodexShowJunctionControls';
export const CODEX_MODE_PREF_KEY = 'timelineCodexMode';
