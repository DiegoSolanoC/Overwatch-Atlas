/**
 * Hero Biography chip — portrait tile, toggle via selection controller (single-select).
 */

import { getFilterKeyAndDisplayName } from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { FILTER_IMAGE_PATHS } from '../../system-interface/interface-filter-menu/images/filterImagePaths.js';
import { toggleHeroBiographyChip } from './heroBiographySelection.js';
import { fitHeroChipLabelText } from './fitHeroChipLabelText.js';

const HEROES_FOLDER = FILTER_IMAGE_PATHS.HEROES;

function createChipImage(filterKey, displayName, imageService) {
    const imagePath = imageService.buildImagePath(filterKey, 'heroes', HEROES_FOLDER);
    const img = imageService.createImageElement(imagePath, 'heroes', filterKey, HEROES_FOLDER);
    img.alt = displayName;
    return img;
}

/**
 * @param {string} heroId
 * @param {import('../../system-interface/interface-filter-menu/images/FilterImageLoader.js').FilterImageService} imageService
 * @param {{ play?: (name: string) => void } | null} soundManager
 */
export function createHeroBiographyChip(heroId, imageService, soundManager) {
    const { filterKey, displayName } = getFilterKeyAndDisplayName(heroId, 'heroes');

    const wrap = document.createElement('div');
    wrap.className = 'hero-biography-hero-filters__chip-wrap';

    const chip = document.createElement('div');
    chip.className = 'filter-btn hero-biography-hero-filters__chip';
    chip.dataset.filterType = 'heroes';
    chip.dataset.filterKey = filterKey;
    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '0');
    chip.setAttribute('aria-pressed', 'false');
    chip.setAttribute('aria-label', displayName);

    const imageContainer = document.createElement('div');
    imageContainer.className = 'filter-image-container';
    imageContainer.appendChild(createChipImage(filterKey, displayName, imageService));

    const label = document.createElement('div');
    label.className = 'filter-label';
    const labelText = document.createElement('span');
    labelText.className = 'filter-label-text';
    labelText.textContent = displayName;
    label.appendChild(labelText);

    chip.appendChild(imageContainer);
    chip.appendChild(label);
    wrap.appendChild(chip);

    const scheduleLabelFit = () => {
        requestAnimationFrame(() => fitHeroChipLabelText(labelText));
    };

    const onActivate = () => {
        const selected = toggleHeroBiographyChip(wrap, chip, displayName);
        soundManager?.play?.(selected ? 'filterPick' : 'filterOff');
        if (selected) scheduleLabelFit();
    };

    chip.addEventListener('mouseenter', scheduleLabelFit);

    chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onActivate();
    });

    chip.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        onActivate();
    });

    return wrap;
}
