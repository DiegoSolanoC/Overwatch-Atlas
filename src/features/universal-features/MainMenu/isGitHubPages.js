/**
 * Detects whether the app is running on GitHub Pages (or similar static hosting).
 *
 * Used by the main menu to gate developer-only affordances (the Auto preload
 * checkbox and the LOAD/UNLOAD Event System Load Out button), and to force
 * `autoPreloadEventSystem` on by default for public viewers.
 *
 * @returns {boolean}
 */
export function isGitHubPages() {
    const hostname = window.location.hostname;
    return hostname.includes('github.io') ||
           hostname.includes('github.com') ||
           (hostname === 'localhost' && window.location.port === '');
}
