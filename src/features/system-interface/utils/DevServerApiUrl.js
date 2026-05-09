/**
 * Resolves repo-relative dev API paths against the current document URL so
 * `api/events` works on GitHub Pages project roots, nested paths, and LAN :8000.
 * Loaded as a classic script before EventDataService / Codex (see `features/connection-codex/services/CodexCanvasService.js`).
 */
(function (global) {
    function resolveDevApiUrl(path) {
        var clean = String(path || '').replace(/^\//, '');
        try {
            return new URL(clean, global.location.href).href;
        } catch (e) {
            return clean;
        }
    }
    global.resolveDevApiUrl = resolveDevApiUrl;
})(typeof window !== 'undefined' ? window : globalThis);
