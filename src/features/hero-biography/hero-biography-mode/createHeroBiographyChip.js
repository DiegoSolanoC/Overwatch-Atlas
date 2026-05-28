/**
 * Hero Biography chip — delegates to shared biography chip builder.
 */

import { createBioBiographyChip } from './createBioBiographyChip.js';

/**
 * @param {string} heroId
 * @param {import('../../system-interface/interface-filter-menu/images/FilterImageLoader.js').FilterImageService} imageService
 * @param {{ play?: (name: string) => void } | null} soundManager
 */
export function createHeroBiographyChip(heroId, imageService, soundManager) {
    return createBioBiographyChip('heroes', heroId, imageService, soundManager);
}
