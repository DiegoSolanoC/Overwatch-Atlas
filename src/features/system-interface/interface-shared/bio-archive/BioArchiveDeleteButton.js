/**
 * Shared top-bar Delete control for story + bio-archive inline edit.
 * Story previously used a footer button inside the inline editor; bio used
 * `#eventSlideBioDeleteBtn` in the hero-locations strip. Both now use
 * `#eventSlideDeleteBtn` left of Edit.
 */

const BIO_ARCHIVE_SOURCES = new Set(['heroes', 'factions', 'npcs']);

/**
 * @returns {HTMLElement | null}
 */
function getDeleteBtn() {
    return document.getElementById('eventSlideDeleteBtn');
}

/**
 * @param {boolean} show
 */
export function setEventSlideDeleteButtonVisible(show) {
    const btn = getDeleteBtn();
    if (!btn) return;
    if (show) {
        btn.style.display = 'inline-flex';
        btn.removeAttribute('hidden');
    } else {
        btn.style.display = 'none';
        btn.setAttribute('hidden', 'hidden');
    }
}

/**
 * @param {string} archiveSource
 * @param {boolean} [isEditing]
 */
export function syncBioDeleteButtonVisibility(archiveSource, isEditing = false) {
    const src = archiveSource != null ? String(archiveSource) : '';
    const show =
        !!isEditing && (src === 'story' || BIO_ARCHIVE_SOURCES.has(src));
    setEventSlideDeleteButtonVisible(show);
    const btn = getDeleteBtn();
    if (btn && show) {
        btn.title = BIO_ARCHIVE_SOURCES.has(src) ? 'Delete entry' : 'Delete event';
    }
}

/**
 * @param {{ deleteCurrentEvent?: () => void }} slide
 */
export function wireBioDeleteButton(slide) {
    const btn = getDeleteBtn();
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
