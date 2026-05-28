/**
 * Biography mode entity chip — portrait tile, single-select via selection controller.
 */

import { FILTER_IMAGE_PATHS } from '../../system-interface/interface-filter-menu/images/filterImagePaths.js';
import { normalizeBioBiographyCategory } from './bioBiographyCategories.js';
import { resolveBioManifestChipIdentity } from './loadBioFilterManifest.js';
import { toggleBioBiographyChip } from './heroBiographySelection.js';
import { fitHeroChipLabelText } from './fitHeroChipLabelText.js';

/** @type {Record<string, string>} */
const IMAGE_FOLDER_BY_CATEGORY = {
    heroes: FILTER_IMAGE_PATHS.HEROES,
    factions: FILTER_IMAGE_PATHS.FACTIONS,
    npcs: FILTER_IMAGE_PATHS.NPCS,
};

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {string} filterKey
 * @param {string} displayName
 * @param {import('../../system-interface/interface-filter-menu/images/FilterImageLoader.js').FilterImageService} imageService
 */
function createChipImage(category, filterKey, displayName, imageService) {
    const cat = normalizeBioBiographyCategory(category);
    const folder = IMAGE_FOLDER_BY_CATEGORY[cat] || FILTER_IMAGE_PATHS.HEROES;
    const filterType = cat === 'factions' ? 'factions' : cat === 'npcs' ? 'npcs' : 'heroes';
    const imagePath = imageService.buildImagePath(filterKey, filterType, folder);
    const img = imageService.createImageElement(imagePath, filterType, filterKey, folder);
    img.alt = displayName;
    return img;
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {string|{ filename: string, displayName: string }} manifestItem
 * @param {import('../../system-interface/interface-filter-menu/images/FilterImageLoader.js').FilterImageService} imageService
 * @param {{ play?: (name: string) => void } | null} soundManager
 */
export function createBioBiographyChip(category, manifestItem, imageService, soundManager) {
    const cat = normalizeBioBiographyCategory(category);
    const { filterKey, displayName } = resolveBioManifestChipIdentity(cat, manifestItem);
    const filterType = cat === 'factions' ? 'factions' : cat === 'npcs' ? 'npcs' : 'heroes';

    const wrap = document.createElement('div');
    wrap.className = 'gallery-hero-filters__chip-wrap';
    wrap.dataset.bioCategory = cat;

    const chip = document.createElement('div');
    chip.className = 'filter-btn gallery-hero-filters__chip';
    chip.dataset.filterType = filterType;
    chip.dataset.filterKey = filterKey;
    chip.dataset.bioCategory = cat;
    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '0');
    chip.setAttribute('aria-pressed', 'false');
    chip.setAttribute('aria-label', displayName);

    const imageContainer = document.createElement('div');
    imageContainer.className = 'filter-image-container';
    imageContainer.appendChild(createChipImage(cat, filterKey, displayName, imageService));

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
        const selected = toggleBioBiographyChip(cat, wrap, chip, displayName, filterKey);
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
