/**
 * Fingerprint for the shipped story-timeline JSON bundle.
 * Injected into index.html at GitHub Pages build time; compared against localStorage
 * so deploys replace stale cached rows without waiting for module load.
 */

export const TIMELINE_BUNDLE_STAMP_KEY = 'timelineEventsBundleStamp';

/**
 * @param {unknown[]|null|undefined} events
 * @returns {string}
 */
export function buildTimelineBundleStamp(events) {
    if (!Array.isArray(events) || events.length === 0) return '';
    const last = events[events.length - 1];
    const lastName = last && typeof last === 'object' ? String(last.name ?? '').trim() : '';
    return `${events.length}:${lastName}`;
}

/**
 * @returns {string}
 */
export function readTimelineBundleStampFromMeta() {
    try {
        const meta = document.querySelector('meta[name="timeline-bundle-stamp"]');
        return meta ? String(meta.getAttribute('content') || '').trim() : '';
    } catch (_) {
        return '';
    }
}

/**
 * @param {string} stamp
 */
export function writeTimelineBundleStamp(stamp) {
    if (!stamp) return;
    try {
        localStorage.setItem(TIMELINE_BUNDLE_STAMP_KEY, stamp);
    } catch (_) {}
}

export function clearTimelineBundleStamp() {
    try {
        localStorage.removeItem(TIMELINE_BUNDLE_STAMP_KEY);
    } catch (_) {}
}
