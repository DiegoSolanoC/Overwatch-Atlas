/**
 * Pages image map — content-hash + optional WebP from `build:pages`.
 *
 * Local/dev: map 404 → identity (paths unchanged).
 * Deploy: `src/data/platform/image-asset-map.json` rewrites URLs to
 * `…webp?v=<hash>` (or original + hash) so browsers can cache while
 * replacements/additions bust only the changed asset.
 */

const MAP_URL = 'src/data/platform/image-asset-map.json';

/** @type {Record<string, { v: string, webp?: string }>|null} */
let assets = null;
/** @type {Promise<void>|null} */
let loadPromise = null;
/** @type {boolean|null} */
let webpSupport = null;

function detectWebpSupport() {
    if (webpSupport != null) return webpSupport;
    try {
        const c = document.createElement('canvas');
        c.width = 1;
        c.height = 1;
        webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
        webpSupport = false;
    }
    return webpSupport;
}

/**
 * Decode path segments safely; keep `/` separators.
 * @param {string} pathPart
 */
function fullyDecodePath(pathPart) {
    let previous = '';
    let current = String(pathPart || '');
    while (current !== previous) {
        previous = current;
        try {
            const decoded = decodeURIComponent(current);
            if (decoded === current) break;
            current = decoded;
        } catch {
            break;
        }
    }
    return current;
}

/**
 * @param {string} url
 * @returns {{ path: string, search: string }}
 */
function splitUrl(url) {
    const raw = String(url || '').trim();
    const q = raw.indexOf('?');
    if (q === -1) return { path: raw, search: '' };
    return { path: raw.slice(0, q), search: raw.slice(q) };
}

/**
 * Normalize to map key: `src/assets/images/…` with decoded filename.
 * @param {string} pathPart
 */
export function normalizeImageAssetKey(pathPart) {
    let p = fullyDecodePath(pathPart).replace(/\\/g, '/');
    // Strip leading ./
    p = p.replace(/^\.\//, '');
    // GitHub project pages sometimes include repo base — keep relative form.
    const idx = p.indexOf('src/assets/images/');
    if (idx > 0) p = p.slice(idx);
    return p;
}

/**
 * Encode each path segment for use in img.src (spaces → %20).
 * @param {string} key
 */
function encodeAssetPath(key) {
    return String(key || '')
        .split('/')
        .map((seg) => encodeURIComponent(fullyDecodePath(seg)))
        .join('/');
}

/**
 * Load map once (safe to call many times).
 * @returns {Promise<void>}
 */
export function ensureImageAssetMapLoaded() {
    if (assets) return Promise.resolve();
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
        try {
            const res = await fetch(`${MAP_URL}?boot=1`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    Pragma: 'no-cache',
                },
            });
            if (!res.ok) {
                assets = {};
                return;
            }
            const data = await res.json();
            assets = data && typeof data.assets === 'object' && data.assets ? data.assets : {};
        } catch {
            assets = {};
        } finally {
            if (typeof window !== 'undefined') {
                window.__ImageAssetMapReady = true;
                window.resolveOptimizedAssetUrl = resolveOptimizedAssetUrl;
            }
        }
    })();

    return loadPromise;
}

/**
 * @param {string|null|undefined} url
 * @param {{ preferWebp?: boolean }} [opts]
 * @returns {string}
 */
export function resolveOptimizedAssetUrl(url, opts = {}) {
    if (url == null) return url;
    const raw = String(url).trim();
    if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;

    const { path: pathPart } = splitUrl(raw);
    const key = normalizeImageAssetKey(pathPart);
    if (!key.startsWith('src/assets/images/')) return raw;

    const map = assets;
    if (!map) {
        // Map not loaded yet — return original; callers that boot after ensure* get hashes.
        return raw;
    }

    const entry = map[key];
    if (!entry || !entry.v) return raw;

    const preferWebp = opts.preferWebp !== false && detectWebpSupport();
    const chosenKey = preferWebp && entry.webp ? entry.webp : key;
    return `${encodeAssetPath(chosenKey)}?v=${encodeURIComponent(entry.v)}`;
}

/**
 * Content hash only (for filter retry helpers that append their own path).
 * @param {string} url
 * @returns {string|null}
 */
export function getImageAssetVersion(url) {
    if (!assets || url == null) return null;
    const key = normalizeImageAssetKey(splitUrl(String(url)).path);
    const entry = assets[key];
    return entry?.v || null;
}

if (typeof window !== 'undefined') {
    window.ensureImageAssetMapLoaded = ensureImageAssetMapLoaded;
    window.resolveOptimizedAssetUrl = resolveOptimizedAssetUrl;
    window.getImageAssetVersion = getImageAssetVersion;
}
