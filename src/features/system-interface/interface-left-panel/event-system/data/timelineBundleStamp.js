/**
 * Fingerprint for the shipped story-timeline JSON bundle.
 * Injected into index.html at GitHub Pages build time; compared against localStorage
 * so deploys replace stale cached rows without waiting for module load.
 *
 * The stamp is `"<count>:<contentHash>"`. The hash covers the full events array, so
 * ANY content change (new rows, edits, reorders, source fixes) produces a new stamp —
 * not just a change in row count or the last event's name. This is what lets a deploy
 * override a stale browser cache reliably.
 */

export const TIMELINE_BUNDLE_STAMP_KEY = 'timelineEventsBundleStamp';

/**
 * FNV-1a 32-bit hash → 8-char hex. Deterministic in Node (build) and browsers (runtime),
 * so a stamp computed at build time matches one computed from the same fetched JSON.
 * @param {string} str
 * @returns {string}
 */
function hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}

/**
 * @param {unknown[]|null|undefined} events
 * @returns {string}
 */
export function buildTimelineBundleStamp(events) {
    if (!Array.isArray(events) || events.length === 0) return '';
    let serialized = '';
    try {
        serialized = JSON.stringify(events);
    } catch (_) {
        serialized = '';
    }
    if (!serialized) return '';
    return `${events.length}:${hashString(serialized)}`;
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
 * The stamp of the bundle the current localStorage cache was derived from.
 * @returns {string}
 */
export function readStoredTimelineBundleStamp() {
    try {
        return String(localStorage.getItem(TIMELINE_BUNDLE_STAMP_KEY) || '').trim();
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
