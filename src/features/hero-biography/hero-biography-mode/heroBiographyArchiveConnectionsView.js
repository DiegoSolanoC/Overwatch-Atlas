/**
 * Render heroes-archive connections in the biography intel panel (read-only).
 */

const HEROES_ARCHIVE = 'heroes';

/**
 * @param {object | null} entry
 * @returns {string}
 */
export function buildHeroBiographyConnectionsHtml(entry) {
    const createHtml =
        typeof window !== 'undefined' && window.__SlideBioConnections?.createBioConnectionsSlideHtml;
    if (!createHtml || !entry) return '';
    return createHtml(entry, HEROES_ARCHIVE) || '';
}

/**
 * @param {HTMLElement} container
 * @param {object | null} entry
 */
export function renderHeroBiographyConnectionsView(container, entry) {
    if (!container) return;

    const inner = buildHeroBiographyConnectionsHtml(entry);
    if (!inner) {
        container.replaceChildren();
        const empty = document.createElement('p');
        empty.className = 'hero-biography-mode__archive-description-empty';
        empty.textContent = 'No connections recorded for this hero.';
        container.append(empty);
        return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'event-slide-bio-connections hero-biography-mode__archive-connections-inner';
    wrap.innerHTML = inner;
    container.replaceChildren(wrap);

    const wire = window.__SlideBioConnections?.wireStoryFilterSectionBioArchiveNav;
    if (typeof wire === 'function') wire(container);
}

/**
 * @param {HTMLElement | null} container
 */
export function clearHeroBiographyConnectionsView(container) {
    container?.replaceChildren();
}
