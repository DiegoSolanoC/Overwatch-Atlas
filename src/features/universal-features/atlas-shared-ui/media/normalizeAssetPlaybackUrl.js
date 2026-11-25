/**
 * Encode each path segment so spaces, apostrophes, and "..." survive static
 * server routing and `new Audio(url)` / fetch.
 *
 * @param {string} src
 * @returns {string}
 */
export function normalizeAssetPlaybackUrl(src) {
    const raw = String(src || '').trim();
    if (!raw || /^https?:\/\//i.test(raw)) return raw;

    const segments = raw.replace(/\\/g, '/').split('/').filter(Boolean);
    return segments
        .map((segment) => {
            try {
                return encodeURIComponent(decodeURIComponent(segment));
            } catch {
                return encodeURIComponent(segment);
            }
        })
        .join('/');
}
