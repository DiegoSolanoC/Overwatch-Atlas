/**
 * Environment and state checking utilities for Data Archive.
 */

/**
 * Check if current environment is localhost.
 * @returns {boolean}
 */
export function isLocalhost() {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

/**
 * Check if EventManager panel is currently mounted in Data Archive.
 * @returns {boolean}
 */
export function eventsPanelMountedInStoryArchive() {
    const c = document.getElementById('storyViewerContainer');
    const p = document.getElementById('eventsManagePanel');
    return !!(c && p && c.contains(p));
}
