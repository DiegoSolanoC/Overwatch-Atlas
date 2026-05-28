/**
 * Render bio-archive connections in the Gallery connections panel (read-only).
 */

import { normalizeBioBiographyCategory } from './bioBiographyCategories.js';

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {object | null} entry
 * @returns {string}
 */
export function buildHeroBiographyConnectionsHtml(entry, category = 'heroes') {
    const createHtml =
        typeof window !== 'undefined' && window.__SlideBioConnections?.createBioConnectionsSlideHtml;
    if (!createHtml || !entry) return '';
    const arch = normalizeBioBiographyCategory(category);
    if (arch === 'locations') return '';
    return createHtml(entry, arch) || '';
}

/**
 * @param {HTMLElement} container
 * @param {object | null} entry
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} [category]
 */
export function renderHeroBiographyConnectionsView(container, entry, category = 'heroes') {
    if (!container) return;

    const inner = buildHeroBiographyConnectionsHtml(entry, category);
    if (!inner) {
        container.replaceChildren();
        return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'event-slide-bio-connections gallery-mode__archive-connections-inner';
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
