/**
 * Fingerprint for the shipped Dialogue Theater conversations.json bundle.
 * Injected into index.html at GitHub Pages build time; compared against localStorage
 * so deploys / pulls replace stale theater caches instead of merging over them.
 *
 * Stamp format: `"<count>:<contentHash>"` over the conversations array.
 */

export const DIALOGUE_THEATER_BUNDLE_STAMP_KEY = 'dialogueTheaterBundleStamp';

/**
 * FNV-1a 32-bit hash → 8-char hex. Deterministic in Node and browsers.
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
 * @param {unknown[]|null|undefined} conversations
 * @returns {string}
 */
export function buildDialogueTheaterBundleStamp(conversations) {
    if (!Array.isArray(conversations) || conversations.length === 0) return '';
    let serialized = '';
    try {
        serialized = JSON.stringify(conversations);
    } catch (_) {
        serialized = '';
    }
    if (!serialized) return '';
    return `${conversations.length}:${hashString(serialized)}`;
}

/**
 * @returns {string}
 */
export function readDialogueTheaterBundleStampFromMeta() {
    try {
        const meta = document.querySelector('meta[name="dialogue-theater-bundle-stamp"]');
        return meta ? String(meta.getAttribute('content') || '').trim() : '';
    } catch (_) {
        return '';
    }
}

/**
 * @returns {string}
 */
export function readStoredDialogueTheaterBundleStamp() {
    try {
        return String(localStorage.getItem(DIALOGUE_THEATER_BUNDLE_STAMP_KEY) || '').trim();
    } catch (_) {
        return '';
    }
}

/**
 * @param {string} stamp
 */
export function writeDialogueTheaterBundleStamp(stamp) {
    if (!stamp) return;
    try {
        localStorage.setItem(DIALOGUE_THEATER_BUNDLE_STAMP_KEY, stamp);
    } catch (_) {
        /* ignore quota */
    }
}

export function clearDialogueTheaterBundleStamp() {
    try {
        localStorage.removeItem(DIALOGUE_THEATER_BUNDLE_STAMP_KEY);
    } catch (_) {
        /* ignore */
    }
}

/**
 * @returns {boolean}
 */
export function isStaticGithubPagesDeploy() {
    try {
        const meta = document.querySelector('meta[name="timeline-deploy"]');
        return meta ? String(meta.getAttribute('content') || '').trim() === 'static' : false;
    } catch (_) {
        return false;
    }
}
