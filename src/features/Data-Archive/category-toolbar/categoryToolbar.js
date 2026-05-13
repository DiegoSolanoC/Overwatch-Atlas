/**
 * Category toolbar for Data Archive - provides category switching and back navigation.
 * Handles the toolbar strip that appears when viewing archive categories.
 */

import { STRIP_CATEGORIES } from '../archive-ordering/category-types.js';

/**
 * Mount category toolbar with back button and category icons.
 * @param {HTMLElement} eventsManagePanel
 * @param {{
 *   playCategorySfx?: () => void,
 *   onBackToHub: () => void,
 *   onSelectArchive: (archive: string) => void
 * }} callbacks
 */
export function mountCategoryToolbar(eventsManagePanel, callbacks) {
    if (!eventsManagePanel?.classList.contains('story-viewer-panel-embedded')) return;
    if (document.getElementById('storyArchiveSearchCategoryStrip')) return;

    const primaryRow = eventsManagePanel.querySelector(
        '#eventsManageSearch .events-manage-search-row--primary'
    );
    if (!primaryRow) return;

    const titleInput = document.getElementById('eventsSearchInput');
    const toolbar = createCategoryToolbar(callbacks);
    
    // Insert toolbar after title input or at beginning
    if (titleInput?.parentNode === primaryRow) {
        primaryRow.insertBefore(toolbar, titleInput.nextSibling);
    } else {
        primaryRow.insertBefore(toolbar, primaryRow.firstChild);
    }
}

/**
 * Update active category button styling.
 * @param {string} archiveSource
 */
export function updateActiveCategory(archiveSource) {
    const toolbar = document.getElementById('storyArchiveSearchCategoryStrip');
    if (!toolbar) return;
    
    toolbar.querySelectorAll('[data-story-archive]').forEach((el) => {
        el.classList.toggle('story-archive-category-icon-btn--active', el.dataset.storyArchive === archiveSource);
    });
}

/**
 * Remove category toolbar from DOM.
 */
export function unmountCategoryToolbar() {
    const toolbar = document.getElementById('storyArchiveSearchCategoryStrip');
    if (toolbar) {
        toolbar.remove();
    }
}

/**
 * Create the category toolbar DOM structure.
 * @param {{
 *   playCategorySfx?: () => void,
 *   onBackToHub: () => void,
 *   onSelectArchive: (archive: string) => void
 * }} callbacks
 * @returns {HTMLElement}
 */
function createCategoryToolbar(callbacks) {
    const toolbar = document.createElement('div');
    toolbar.id = 'storyArchiveSearchCategoryStrip';
    toolbar.className = 'story-archive-search-category-strip';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Data Archive categories');

    // Add back to categories button
    const backBtn = createBackButton(callbacks);
    toolbar.appendChild(backBtn);

    // Add category icon buttons
    Object.keys(STRIP_CATEGORIES).forEach((categoryKey) => {
        const category = STRIP_CATEGORIES[categoryKey];
        const categoryBtn = createCategoryButton(categoryKey, category, callbacks);
        toolbar.appendChild(categoryBtn);
    });

    return toolbar;
}

/**
 * Create back to categories button.
 * @param {{
 *   playCategorySfx?: () => void,
 *   onBackToHub: () => void
 * }} callbacks
 * @returns {HTMLButtonElement}
 */
function createBackButton(callbacks) {
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.id = 'storyArchiveBackToHubBtn';
    backBtn.className = 'story-viewer-action-btn story-archive-back-to-hub-btn';
    backBtn.setAttribute('title', 'Back to Data Archive categories');
    backBtn.innerHTML = `
        <span class="story-archive-back-to-hub-btn__icon-wrap" aria-hidden="true">
            <img class="story-archive-back-to-hub-btn__icon" src="src/assets/images/Icons/Utility%20Icons/Back%20Arrow.png" alt="" width="18" height="18" decoding="async" draggable="false" />
        </span>
        <span class="story-archive-back-to-hub-btn__label">Categories</span>
    `;
    
    backBtn.addEventListener('click', () => {
        callbacks.playCategorySfx?.();
        callbacks.onBackToHub();
    });
    
    return backBtn;
}

/**
 * Create category icon button.
 * @param {string} categoryKey - The category key (e.g., 'heroes', 'factions')
 * @param {{label: string, icon: string}} category - The category data
 * @param {{
 *   playCategorySfx?: () => void,
 *   onSelectArchive: (archive: string) => void
 * }} callbacks
 * @returns {HTMLButtonElement}
 */
function createCategoryButton(categoryKey, category, callbacks) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'story-viewer-action-btn story-archive-category-icon-btn';
    button.dataset.storyArchive = categoryKey;
    button.title = `Open ${category.label} archive`;
    button.setAttribute('aria-label', category.label);
    button.innerHTML = `<img class="story-archive-category-icon-btn__img" src="${category.icon}" alt="" width="22" height="22" decoding="async" draggable="false" />`;
    
    button.addEventListener('click', () => {
        callbacks.playCategorySfx?.();
        callbacks.onSelectArchive(categoryKey);
    });
    
    return button;
}
