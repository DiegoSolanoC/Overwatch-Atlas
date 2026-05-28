/**
 * Hero biography portrait paths under src/assets/images/Bios/<heroId>/<look>.png
 */

export const HERO_BIOGRAPHY_BIOS_ROOT = 'src/assets/images/Bios';
export const DEFAULT_HERO_BIO_LOOK = 'Heroic';

/**
 * Heroic first, Classic second, then A–Z.
 * @param {string[]} lookNames — basenames (no .png).
 * @returns {string[]}
 */
export function sortHeroBioLookNames(lookNames) {
    const seen = new Set();
    const unique = [];
    for (const name of lookNames) {
        const base = String(name).replace(/\.png$/i, '').trim();
        if (!base || seen.has(base)) continue;
        seen.add(base);
        unique.push(base);
    }
    const norm = (s) => s.toLowerCase();
    const heroic = unique.filter((x) => norm(x) === 'heroic');
    const classic = unique.filter((x) => norm(x) === 'classic');
    const rest = unique.filter((x) => norm(x) !== 'heroic' && norm(x) !== 'classic');
    rest.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
    return [...heroic, ...classic, ...rest];
}

/**
 * @param {string} heroFilterKey
 * @param {string} [lookName]
 * @returns {string}
 */
export function buildHeroBiographyLookPath(heroFilterKey, lookName = DEFAULT_HERO_BIO_LOOK) {
    const key = String(heroFilterKey || '').trim();
    const look = String(lookName || DEFAULT_HERO_BIO_LOOK).trim();
    if (!key || !look) return '';
    return `${HERO_BIOGRAPHY_BIOS_ROOT}/${encodeURIComponent(key)}/${encodeURIComponent(look)}.png`;
}

/**
 * @param {string} heroFilterKey
 * @returns {string}
 */
export function buildHeroBiographyHeroicPath(heroFilterKey) {
    return buildHeroBiographyLookPath(heroFilterKey, DEFAULT_HERO_BIO_LOOK);
}
