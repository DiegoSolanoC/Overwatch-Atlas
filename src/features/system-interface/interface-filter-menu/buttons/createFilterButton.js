/**
 * Build a single filter chip — Gallery-style portrait tile + hover label.
 * Returns a `.filters-chip-wrap` containing `.filter-btn.filters-chip`.
 */

import { getFilterKeyAndDisplayName } from './filterKeyMapping.js';
import { fitHeroChipLabelText } from '../../../gallery/gallery-mode/fitHeroChipLabelText.js';
import {
    applyBioChipPortraitBackground,
} from '../../../gallery/gallery-mode/bioChipPortraitBackground.js';
import { loadCodexNodesForGalleryStyle } from '../../../gallery/gallery-mode/galleryConnectionCanvasCodexStyle.js';
import {
    applyGalleryExclusiveFilterPick,
    isAtlasGalleryOpen,
} from '../../../gallery/gallery-mode/galleryFiltersBridge.js';

function createFilterImageForButton(filterKey, displayName, type, folder, imageService) {
    const pathItem = type === 'factions'
        ? { filename: filterKey }
        : (type === 'countries' && typeof filterKey === 'string' && filterKey.startsWith('country:'))
            ? { flagFile: filterKey.slice('country:'.length).trim() }
            : filterKey;
    const imagePath = imageService.buildImagePath(pathItem, type, folder);
    const img = imageService.createImageElement(imagePath, type, filterKey, folder);
    img.alt = displayName;
    return img;
}

function attachFilterChipClickHandler(
    filterBtn,
    filterKey,
    displayName,
    type,
    stateManager,
    soundManager,
    updateFilterCounts,
) {
    filterBtn.addEventListener('click', () => {
        const isSelected = stateManager.has(filterKey);

        if (isAtlasGalleryOpen()) {
            applyGalleryExclusiveFilterPick({
                filterBtn,
                filterKey,
                displayName,
                type,
                stateManager,
                wasSelected: isSelected,
            });
            soundManager?.play?.(isSelected ? 'filterOff' : 'filterPick');
            updateFilterCounts();
            return;
        }

        if (isSelected) {
            stateManager.remove(filterKey);
            filterBtn.classList.remove('selected');
            filterBtn.setAttribute('aria-pressed', 'false');
            soundManager?.play?.('filterOff');
        } else {
            stateManager.add(filterKey);
            filterBtn.classList.add('selected');
            filterBtn.setAttribute('aria-pressed', 'true');
            soundManager?.play?.('filterPick');
        }
        updateFilterCounts();
    });
}

/**
 * @returns {HTMLElement} `.filters-chip-wrap` (contains the clickable `.filter-btn`)
 */
export function createFilterButton(item, type, folder, stateManager, imageService, soundManager, updateFilterCounts) {
    const { filterKey, displayName } = getFilterKeyAndDisplayName(item, type);

    const wrap = document.createElement('div');
    wrap.className = 'filters-chip-wrap';
    wrap.dataset.filterType = type;
    wrap.dataset.filterKey = filterKey;

    const filterBtn = document.createElement('div');
    filterBtn.className = 'filter-btn filters-chip';
    filterBtn.dataset.filterType = type;
    filterBtn.dataset.filterKey = filterKey;
    filterBtn.setAttribute('role', 'button');
    filterBtn.setAttribute('tabindex', '0');
    filterBtn.setAttribute('aria-pressed', stateManager.has(filterKey) ? 'true' : 'false');
    filterBtn.setAttribute('aria-label', displayName);
    if (type === 'countries') {
        wrap.classList.add('filters-chip-wrap--flag');
        filterBtn.classList.add('filters-chip--flag');
        const n = item && typeof item.eventMatchCount === 'number' ? item.eventMatchCount : 0;
        filterBtn.dataset.eventMatchCount = String(n);
        wrap.dataset.eventMatchCount = String(n);
    }

    const imageContainer = document.createElement('div');
    imageContainer.className = 'filter-image-container';
    imageContainer.appendChild(createFilterImageForButton(filterKey, displayName, type, folder, imageService));

    const label = document.createElement('div');
    label.className = 'filter-label';
    const labelText = document.createElement('span');
    labelText.className = 'filter-label-text';
    labelText.textContent = displayName;
    label.appendChild(labelText);

    filterBtn.appendChild(imageContainer);
    filterBtn.appendChild(label);
    wrap.appendChild(filterBtn);

    applyBioChipPortraitBackground(filterBtn, type, filterKey);
    if (type === 'factions') {
        void loadCodexNodesForGalleryStyle().then((nodes) => {
            applyBioChipPortraitBackground(filterBtn, type, filterKey, nodes);
        });
    }

    if (stateManager.has(filterKey)) filterBtn.classList.add('selected');
    attachFilterChipClickHandler(
        filterBtn,
        filterKey,
        displayName,
        type,
        stateManager,
        soundManager,
        updateFilterCounts,
    );

    filterBtn.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        filterBtn.click();
    });

    filterBtn.addEventListener('mouseenter', () => {
        requestAnimationFrame(() => fitHeroChipLabelText(labelText));
    });

    return wrap;
}
