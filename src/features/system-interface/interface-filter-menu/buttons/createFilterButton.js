/**
 * Build a single filter chip (`.filter-btn`) — image container + label + click
 * handler that toggles membership in the pending selection set.
 *
 * Sound effects (`filterPick` / `filterOff`) and count refresh are wired here
 * rather than in the panel orchestrator so newly-created chips work even when
 * they appear later (e.g. when switching tabs).
 */

import { getFilterKeyAndDisplayName } from './filterKeyMapping.js';

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

function attachFilterChipClickHandler(filterBtn, filterKey, stateManager, soundManager, updateFilterCounts) {
    filterBtn.addEventListener('click', () => {
        const isSelected = stateManager.has(filterKey);
        if (isSelected) {
            stateManager.remove(filterKey);
            filterBtn.classList.remove('selected');
            soundManager?.play?.('filterOff');
        } else {
            stateManager.add(filterKey);
            filterBtn.classList.add('selected');
            soundManager?.play?.('filterPick');
        }
        updateFilterCounts();
    });
}

export function createFilterButton(item, type, folder, stateManager, imageService, soundManager, updateFilterCounts) {
    const { filterKey, displayName } = getFilterKeyAndDisplayName(item, type);

    const filterBtn = document.createElement('div');
    filterBtn.className = 'filter-btn';
    filterBtn.dataset.filterType = type;
    filterBtn.dataset.filterKey = filterKey;
    if (type === 'countries') {
        const n = item && typeof item.eventMatchCount === 'number' ? item.eventMatchCount : 0;
        filterBtn.dataset.eventMatchCount = String(n);
    }

    const imageContainer = document.createElement('div');
    imageContainer.className = 'filter-image-container';
    imageContainer.appendChild(createFilterImageForButton(filterKey, displayName, type, folder, imageService));

    /* Outer .filter-label centers; inner span holds line-clamp for long names. */
    const label = document.createElement('div');
    label.className = 'filter-label';
    const labelText = document.createElement('span');
    labelText.className = 'filter-label-text';
    labelText.textContent = displayName;
    label.appendChild(labelText);

    filterBtn.appendChild(imageContainer);
    filterBtn.appendChild(label);

    if (stateManager.has(filterKey)) filterBtn.classList.add('selected');
    attachFilterChipClickHandler(filterBtn, filterKey, stateManager, soundManager, updateFilterCounts);

    return filterBtn;
}
