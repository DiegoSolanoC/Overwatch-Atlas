/**
 * PaletteConstants — asset paths and pure helpers for the four saved palettes
 * (`blue`, `gray`, `crimson`, `nulled`). No DOM wiring here.
 */

export const MAP_TEXTURE_BLUE = 'src/assets/images/Maps/Earth%20Textures/MAP Blue.png';
export const MAP_TEXTURE_GRAY = 'src/assets/images/Maps/Earth%20Textures/MAP Black.png';
export const MAP_TEXTURE_CRIMSON = 'src/assets/images/Maps/Earth%20Textures/MAP Crimson.png';
export const MAP_TEXTURE_NULLED = 'src/assets/images/Maps/Earth%20Textures/MAP Nulled.png';

export const MOON_TEXTURE = 'src/assets/images/Misc/Celestial%20Panels/Moon.png';
export const MARS_TEXTURE = 'src/assets/images/Misc/Celestial%20Panels/Mars.png';

const WEBSITE_LOGO_DEFAULT = 'src/assets/images/Misc/Website%20Icons/Website.png';
const WEBSITE_LOGO_CRIMSON = 'src/assets/images/Misc/Website%20Icons/Website%20Crimson.png';
const WEBSITE_LOGO_NULLED = 'src/assets/images/Misc/Website%20Icons/Website%20Nulled.png';

/**
 * @param {string | null | undefined} saved
 * @returns {'blue'|'gray'|'crimson'|'nulled'}
 */
export function normalizeSavedPalette(saved) {
    if (saved === 'gray') return 'gray';
    if (saved === 'crimson') return 'crimson';
    if (saved === 'nulled') return 'nulled';
    return 'blue';
}

/**
 * @param {'blue'|'gray'|'crimson'|'nulled'} palette
 */
export function applyPaletteBodyClasses(palette) {
    document.body.classList.remove('color-palette-gray', 'color-palette-crimson', 'color-palette-nulled');
    if (palette === 'gray') document.body.classList.add('color-palette-gray');
    else if (palette === 'crimson') document.body.classList.add('color-palette-crimson');
    else if (palette === 'nulled') document.body.classList.add('color-palette-nulled');
}

/**
 * @param {'blue'|'gray'|'crimson'|'nulled'|string} palette
 */
export function updateHeaderWebsiteLogo(palette) {
    const img = document.querySelector('.header-title-badge-logo');
    if (!img) return;
    const p = normalizeSavedPalette(palette);
    if (p === 'crimson') img.src = WEBSITE_LOGO_CRIMSON;
    else if (p === 'nulled') img.src = WEBSITE_LOGO_NULLED;
    else img.src = WEBSITE_LOGO_DEFAULT;
}

/**
 * @param {'map'|'moon'|'mars'} mapKind
 * @param {'blue'|'gray'|'crimson'|'nulled'} normalized
 */
export function texturePathForPalette(mapKind, normalized) {
    if (mapKind === 'moon') return MOON_TEXTURE;
    if (mapKind === 'mars') return MARS_TEXTURE;
    if (normalized === 'gray') return MAP_TEXTURE_GRAY;
    if (normalized === 'crimson') return MAP_TEXTURE_CRIMSON;
    if (normalized === 'nulled') return MAP_TEXTURE_NULLED;
    return MAP_TEXTURE_BLUE;
}
