/**
 * PDF source URLs for in-viewer embed (external CDN links in event sources).
 * @param {string} url
 * @returns {boolean}
 */
export function isPdfSourceUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return false;
    if (/\.pdf(\?|#|$)/i.test(raw)) return true;
    try {
        const path = new URL(raw).pathname;
        return /\.pdf$/i.test(path);
    } catch {
        return false;
    }
}

/**
 * Stable key for matching active PDF source buttons.
 * @param {string} url
 * @returns {string}
 */
export function pdfSourceKey(url) {
    return String(url || '').trim();
}

/**
 * PDF.js embed viewer URL (two-page spread on load).
 * @param {string} pdfUrl
 * @returns {string}
 */
export function buildPdfViewerEmbedUrl(pdfUrl) {
    const clean = pdfSourceKey(pdfUrl);
    if (!clean) return '';
    try {
        const viewer = new URL('src/assets/pdf-viewer/embed.html', window.location.href);
        viewer.searchParams.set('file', clean);
        return viewer.href;
    } catch {
        return clean;
    }
}
