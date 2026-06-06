/**
 * When inline archive / event-slide editing is allowed.
 *
 * - Localhost: always (story + bio archives).
 * - GitHub Pages / static deploy: bio archives only (heroes, factions, npcs, locations)
 *   so collaborators can edit connection data in Data Workshop via localStorage + import/export.
 */

/** @type {ReadonlySet<string>} */
const BIO_ARCHIVE_SOURCES = new Set(['heroes', 'factions', 'npcs', 'locations']);

/**
 * @returns {boolean}
 */
function isLoopbackHost() {
    if (typeof window === 'undefined') return false;
    const h = window.location.hostname || '';
    return h === 'localhost' || h === '127.0.0.1';
}

/**
 * GitHub Pages and other static deploys (`timeline-deploy=static` meta).
 * @returns {boolean}
 */
export function isStaticDeployHost() {
    if (typeof window === 'undefined') return false;
    try {
        const m = document.querySelector('meta[name="timeline-deploy"]');
        if (m && String(m.getAttribute('content') || '').toLowerCase() === 'static') {
            return true;
        }
    } catch (_) {
        /* ignore */
    }
    const hostname = window.location.hostname || '';
    return (
        hostname === 'github.io' ||
        hostname.includes('github.io') ||
        hostname === 'pages.github.com'
    );
}

/**
 * @returns {'story'|'heroes'|'factions'|'npcs'|'locations'}
 */
export function getActiveArchiveSource() {
    const src = window.eventManager?.dataService?.getArchiveSource?.();
    return src != null ? String(src) : 'story';
}

/**
 * Data Workshop bio archive editing (slide + save/import/export) on static hosting.
 * @returns {boolean}
 */
export function isBioArchiveWorkshopEditingEnabled() {
    if (isLoopbackHost()) return true;
    if (!isStaticDeployHost()) return false;
    return BIO_ARCHIVE_SOURCES.has(getActiveArchiveSource());
}

/**
 * Add / delete / reorder list rows — local dev server only.
 * @returns {boolean}
 */
export function isArchiveStructuralEditingEnabled() {
    return isLoopbackHost();
}

/**
 * Save, export, and import JSON for the active archive bucket.
 * @returns {boolean}
 */
export function isArchiveImportExportEnabled() {
    return isBioArchiveWorkshopEditingEnabled();
}

/**
 * Event slide Edit/Save wiring.
 * @returns {boolean}
 */
export function isEventSlideEditDevHost() {
    return isBioArchiveWorkshopEditingEnabled();
}
