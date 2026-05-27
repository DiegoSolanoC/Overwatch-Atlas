/**
 * Thin facade matching the legacy `FilterImageService` shape so the rest of
 * the codebase keeps calling `imageService.buildImagePath / createImageElement
 * / preloadImages` without caring that the implementation now lives in three
 * separate modules.
 *
 * Class name preserved as `FilterImageService` (and assigned to
 * `window.FilterImageService`) for backwards compatibility, though the only
 * remaining consumer is `FiltersPanel.js` itself.
 */

import { buildFilterImagePath, generateCacheBuster } from './filterImagePaths.js';
import { createFilterImageElement } from './createFilterImageElement.js';
import { preloadFilterImages } from './preloadFilterImages.js';

class FilterImageService {
    generateCacheBuster() { return generateCacheBuster(); }
    buildImagePath(item, type, folder) { return buildFilterImagePath(item, type, folder); }
    createImageElement(imagePath, type, filterKey, folder) {
        return createFilterImageElement(imagePath, type, filterKey, folder);
    }
    preloadImages(items, type, folder) { preloadFilterImages(items, type, folder); }
}

export { FilterImageService };
export default FilterImageService;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilterImageService;
}
if (typeof window !== 'undefined') {
    window.FilterImageService = FilterImageService;
}
