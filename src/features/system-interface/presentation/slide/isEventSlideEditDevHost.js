/**
 * Event slide Edit/Save is dev-only: localhost loopback, not GitHub Pages or LAN previews.
 * @returns {boolean}
 */
export function isEventSlideEditDevHost() {
    if (typeof window === 'undefined') return false;
    const h = window.location.hostname || '';
    return h === 'localhost' || h === '127.0.0.1';
}
