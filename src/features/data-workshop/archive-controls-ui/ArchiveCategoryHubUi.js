/**
 * Data Archive category selection interface UI.
 * Bio archives only — story timeline is a separate app mode.
 */

import { CATEGORY_METADATA, BIO_ARCHIVE_CATEGORIES } from '../archive-category-shared/ArchiveCategoryTypes.js';
import { wireLoadingAssetImage } from '../../universal-features/atlas-ui/loadingAssetSlot.js';

/**
 * @typedef {'heroes'|'factions'|'npcs'|'locations'} DataArchiveSource
 */

/**
 * @param {{
 *   onSelectArchive: (archive: DataArchiveSource) => void,
 *   onCancel: () => void,
 *   playCategorySfx?: () => void
 * }} callbacks
 * @returns {HTMLElement}
 */
export function buildCategoryHubUI(callbacks) {
    const root = document.createElement('div');
    root.id = 'storyArchiveCategoryHub';
    root.className = 'story-archive-category-hub story-archive-category-hub--bio-only';
    root.setAttribute('role', 'navigation');
    root.setAttribute('aria-label', 'Data Workshop categories');

    const heading = document.createElement('h2');
    heading.id = 'storyArchiveHubHeading';
    heading.className = 'story-archive-category-hub-heading';
    heading.textContent = 'Data Workshop';

    const lead = document.createElement('p');
    lead.className = 'story-archive-category-hub-lead';
    lead.textContent =
        'Browse heroes, factions, NPCs, and locations—each category loads its own entries into the viewer. Use Story mode for the main chronology.';

    root.setAttribute('aria-labelledby', 'storyArchiveHubHeading');

    const gridSlot = document.createElement('div');
    gridSlot.className = 'story-archive-category-hub__grid';

    BIO_ARCHIVE_CATEGORIES.forEach((categoryKey) => {
        const metadata = CATEGORY_METADATA[categoryKey];
        if (!metadata) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'story-archive-category-hub__tile';
        btn.dataset.category = categoryKey;
        btn.innerHTML = `
            <span class="story-archive-category-hub__figure" aria-hidden="true">
                <img class="story-archive-category-hub__img" src="${metadata.icon}" alt="" width="160" height="160" decoding="async" draggable="false" />
            </span>
            <span class="story-archive-category-hub__label">${metadata.label}</span>
        `;
        btn.title = `Open ${metadata.label} archive`;
        btn.addEventListener('click', () => {
            callbacks.playCategorySfx?.();
            callbacks.onSelectArchive(categoryKey);
        });

        const hubImg = btn.querySelector('.story-archive-category-hub__img');
        const hubFigure = btn.querySelector('.story-archive-category-hub__figure');
        wireLoadingAssetImage(hubImg, { wrap: hubFigure });

        gridSlot.appendChild(btn);
    });

    root.appendChild(heading);
    root.appendChild(lead);
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

/** Primary export name for the category tile hub. */
export function buildDataArchiveCategoryHub(callbacks) {
    return buildCategoryHubUI(callbacks);
}

/**
 * @deprecated Use {@link buildDataArchiveCategoryHub} or {@link buildCategoryHubUI}.
 */
export function buildStoryArchiveCategoryHub(callbacks) {
    return buildDataArchiveCategoryHub(callbacks);
}
