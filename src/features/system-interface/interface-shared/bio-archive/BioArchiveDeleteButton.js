/**
 * Bio archive (heroes / factions / NPCs): delete control on the static edit strip.
 * Story events use the inline editor's "Delete event" button instead.
 */

const BIO_ARCHIVE_SOURCES = new Set(['heroes', 'factions', 'npcs']);

/**
 * @param {string} archiveSource
 * @param {boolean} [isEditing]
 */
export function syncBioDeleteButtonVisibility(archiveSource, isEditing = false) {
    const btn = document.getElementById('eventSlideBioDeleteBtn');
    if (!btn) return;
    const src = archiveSource != null ? String(archiveSource) : '';
    const show = isEditing && BIO_ARCHIVE_SOURCES.has(src);
    if (show) {
        btn.removeAttribute('hidden');
        btn.style.display = '';
    } else {
        btn.setAttribute('hidden', 'hidden');
        btn.style.display = 'none';
    }
}

/**
 * @param {{ deleteCurrentEvent?: () => void }} slide
 */
export function wireBioDeleteButton(slide) {
    const btn = document.getElementById('eventSlideBioDeleteBtn');
    if (!btn || btn.dataset.wired === 'true') return;
    btn.dataset.wired = 'true';
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof slide?.deleteCurrentEvent === 'function') {
            slide.deleteCurrentEvent();
        }
    });
}
