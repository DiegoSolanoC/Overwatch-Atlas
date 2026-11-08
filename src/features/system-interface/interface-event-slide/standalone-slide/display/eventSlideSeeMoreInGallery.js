/**
 * Bio-archive info panel CTA → open the same entity in Gallery mode.
 */

import { openBioEntityInGallery } from '../../../../gallery/gallery-mode/openBioEntityInGallery.js';

const GALLERY_ARCHIVE_KINDS = new Set(['heroes', 'factions', 'npcs', 'locations']);

/**
 * @param {string} archiveSource
 * @returns {boolean}
 */
function isGalleryArchiveKind(archiveSource) {
    return GALLERY_ARCHIVE_KINDS.has(String(archiveSource || '').trim());
}

/** Hide the CTA (story slides / close). */
export function clearEventSlideSeeMoreInGallery() {
    const btn = document.getElementById('eventSlideSeeMoreInGallery');
    if (!btn) return;
    btn.hidden = true;
    delete btn.dataset.galleryKind;
    delete btn.dataset.galleryName;
}

/**
 * Show/hide + bind target for the current bio/location archive entry.
 *
 * @param {string} archiveSource
 * @param {string} entityName
 */
export function syncEventSlideSeeMoreInGallery(archiveSource, entityName) {
    wireEventSlideSeeMoreInGallery();
    const btn = document.getElementById('eventSlideSeeMoreInGallery');
    if (!btn) return;

    const kind = String(archiveSource || '').trim();
    const name = String(entityName || '').trim();
    const show = isGalleryArchiveKind(kind) && !!name;
    btn.hidden = !show;
    if (!show) {
        delete btn.dataset.galleryKind;
        delete btn.dataset.galleryName;
        return;
    }
    btn.dataset.galleryKind = kind;
    btn.dataset.galleryName = name;
}

/** One-time click wiring. */
export function wireEventSlideSeeMoreInGallery() {
    const btn = document.getElementById('eventSlideSeeMoreInGallery');
    if (!btn || btn.dataset.wired === '1') return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const kind = String(btn.dataset.galleryKind || '').trim();
        const name = String(btn.dataset.galleryName || '').trim();
        if (!kind || !name) return;
        void openBioEntityInGallery(kind, name);
    });
}
