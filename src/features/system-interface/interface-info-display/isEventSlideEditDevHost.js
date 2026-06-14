/**
 * When inline archive / event-slide editing is allowed.
 *
 * - Localhost: always (story + bio archives).
 * - GitHub Pages / static deploy: Story Timeline, Gallery, Data Workshop bio archives,
 *   and Codex — localStorage + import/export (no dev-server JSON writes).
 */

import { eventsPanelMountedInStoryArchive } from '../../data-workshop/archive-support/ArchiveEnvironmentChecks.js';

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
 * Story Timeline or bio archive editing on static hosting (localStorage + import/export).
 * @returns {boolean}
 */
export function isCollaborativeArchiveEditingEnabled() {
    if (isLoopbackHost()) return true;
    if (!isStaticDeployHost()) return false;

    const src = getActiveArchiveSource();
    if (BIO_ARCHIVE_SOURCES.has(src)) return true;
    if (src === 'story' && eventsPanelMountedInStoryArchive()) return true;
    return false;
}

/**
 * Data Workshop bio archive editing (slide + save/import/export) on static hosting.
 * @returns {boolean}
 */
export function isBioArchiveWorkshopEditingEnabled() {
    return isCollaborativeArchiveEditingEnabled();
}

/**
 * Add / delete / reorder list rows.
 * @returns {boolean}
 */
export function isArchiveStructuralEditingEnabled() {
    return isCollaborativeArchiveEditingEnabled();
}

/**
 * Save, export, and import JSON for the active archive bucket.
 * @returns {boolean}
 */
export function isArchiveImportExportEnabled() {
    return isCollaborativeArchiveEditingEnabled();
}

/**
 * Event slide Edit/Save wiring.
 * @returns {boolean}
 */
export function isEventSlideEditDevHost() {
    return isCollaborativeArchiveEditingEnabled();
}
