/**
 * Data Archive category hub DOM (Story + Heroes / Factions / NPCs / Locations tiles).
 * Orchestrator supplies callbacks so this module stays free of `window` / loader coupling.
 */

/**
 * @typedef {'story'|'heroes'|'factions'|'npcs'|'locations'} StoryArchiveSource
 */

/**
 * @param {{
 *   onSelectArchive: (archive: StoryArchiveSource) => void,
 *   onCancel: () => void,
 *   playCategorySfx?: () => void
 * }} callbacks
 * @returns {HTMLElement}
 */
export function buildStoryArchiveCategoryHub(callbacks) {
    const root = document.createElement('div');
    root.id = 'storyArchiveCategoryHub';
    root.className = 'story-archive-category-hub';
    root.setAttribute('role', 'navigation');
    root.setAttribute('aria-label', 'Data Archive categories');

    const heading = document.createElement('h2');
    heading.id = 'storyArchiveHubHeading';
    heading.className = 'story-archive-category-hub-heading';
    heading.textContent = 'Data Archive';

    const lead = document.createElement('p');
    lead.className = 'story-archive-category-hub-lead';
    lead.textContent =
        'Browse the story timeline, heroes, factions, NPCs, and locations—each category loads its own data into the same viewer.';

    root.setAttribute('aria-labelledby', 'storyArchiveHubHeading');

    const tiles = [
        { id: 'story', label: 'Story', src: 'src/assets/images/Archive/Categories/Story.png', archive: 'story', isFeature: true },
        { id: 'heroes', label: 'Heroes', src: 'src/assets/images/Archive/Categories/Heroes.png', archive: 'heroes' },
        { id: 'factions', label: 'Factions', src: 'src/assets/images/Archive/Categories/Factions.png', archive: 'factions' },
        { id: 'npcs', label: 'NPCs', src: 'src/assets/images/Archive/Categories/NPCs.png', archive: 'npcs' },
        { id: 'locations', label: 'Locations', src: 'src/assets/images/Archive/Categories/Locations.png', archive: 'locations' }
    ];

    const featureSlot = document.createElement('div');
    featureSlot.className = 'story-archive-category-hub__feature';

    const gridSlot = document.createElement('div');
    gridSlot.className = 'story-archive-category-hub__grid';

    tiles.forEach((t) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'story-archive-category-hub__tile';
        btn.dataset.category = t.id;
        btn.innerHTML = `
                <span class="story-archive-category-hub__figure" aria-hidden="true">
                    <img class="story-archive-category-hub__img" src="${t.src}" alt="" width="160" height="160" decoding="async" draggable="false" />
                </span>
                <span class="story-archive-category-hub__label">${t.label}</span>
            `;
        btn.title = `Open ${t.label} archive`;
        btn.addEventListener('click', () => {
            callbacks.playCategorySfx?.();
            callbacks.onSelectArchive(t.archive);
        });
        if (t.isFeature) {
            btn.classList.add('story-archive-category-hub__tile--story');
        }

        if (t.isFeature) {
            featureSlot.appendChild(btn);
        } else {
            gridSlot.appendChild(btn);
        }
    });

    root.appendChild(heading);
    root.appendChild(lead);
    root.appendChild(featureSlot);
    root.appendChild(gridSlot);

    const dismissRow = document.createElement('div');
    dismissRow.className = 'story-archive-category-hub__dismiss-row';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'story-viewer-action-btn story-archive-category-hub-dismiss';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.setAttribute('title', 'Return to main menu');
    cancelBtn.addEventListener('click', () => {
        callbacks.onCancel();
    });
    dismissRow.appendChild(cancelBtn);
    root.appendChild(dismissRow);

    return root;
}
