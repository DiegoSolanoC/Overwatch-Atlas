/**
 * Search row toolbar: back to category hub + archive icon buttons (embedded Event Manager only).
 */

/**
 * @typedef {'story'|'heroes'|'factions'|'npcs'|'locations'} StoryArchiveSource
 */

const STRIP_CATEGORIES = [
    { archive: 'story', label: 'Story', icon: 'src/assets/images/Icons/Mode%20Icons/Story%20Icon.png' },
    { archive: 'heroes', label: 'Heroes', icon: 'src/assets/images/Icons/Filter%20Icons/Heroes%20Icon.png' },
    { archive: 'factions', label: 'Factions', icon: 'src/assets/images/Icons/Filter%20Icons/Factions%20Icon.png' },
    { archive: 'npcs', label: 'NPCs', icon: 'src/assets/images/Icons/Filter%20Icons/NPC%20Icon.png' },
    { archive: 'locations', label: 'Locations', icon: 'src/assets/images/Icons/Filter%20Icons/Location%20Icon.png' }
];

/**
 * @param {HTMLElement} eventsManagePanel
 * @param {{
 *   playCategorySfx?: () => void,
 *   onBackToHub: () => void,
 *   onSelectArchive: (archive: StoryArchiveSource) => void
 * }} callbacks
 */
export function mountStoryArchiveCategoryStrip(eventsManagePanel, callbacks) {
    if (!eventsManagePanel?.classList.contains('story-viewer-panel-embedded')) return;
    if (document.getElementById('storyArchiveSearchCategoryStrip')) return;

    const primaryRow = eventsManagePanel.querySelector(
        '#eventsManageSearch .events-manage-search-row--primary'
    );
    if (!primaryRow) return;

    const titleInput = document.getElementById('eventsSearchInput');
    const strip = document.createElement('div');
    strip.id = 'storyArchiveSearchCategoryStrip';
    strip.className = 'story-archive-search-category-strip';
    strip.setAttribute('role', 'toolbar');
    strip.setAttribute('aria-label', 'Data Archive categories');

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
    strip.appendChild(backBtn);

    STRIP_CATEGORIES.forEach((c) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'story-viewer-action-btn story-archive-category-icon-btn';
        b.dataset.storyArchive = c.archive;
        b.title = `Open ${c.label} archive`;
        b.setAttribute('aria-label', c.label);
        b.innerHTML = `<img class="story-archive-category-icon-btn__img" src="${c.icon}" alt="" width="22" height="22" decoding="async" draggable="false" />`;
        b.addEventListener('click', () => {
            callbacks.playCategorySfx?.();
            callbacks.onSelectArchive(c.archive);
        });
        strip.appendChild(b);
    });

    if (titleInput?.parentNode === primaryRow) {
        primaryRow.insertBefore(strip, titleInput.nextSibling);
    } else {
        primaryRow.insertBefore(strip, primaryRow.firstChild);
    }
}

/**
 * @param {StoryArchiveSource | string} archiveSource
 */
export function updateStoryArchiveCategoryStripActive(archiveSource) {
    const strip = document.getElementById('storyArchiveSearchCategoryStrip');
    if (!strip) return;
    strip.querySelectorAll('[data-story-archive]').forEach((el) => {
        el.classList.toggle('story-archive-category-icon-btn--active', el.dataset.storyArchive === archiveSource);
    });
}
