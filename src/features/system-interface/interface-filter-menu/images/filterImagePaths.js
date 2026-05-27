/**
 * Path construction for filter chip thumbnails.
 *
 * Each filter type follows a different URL convention because the underlying
 * assets are organized differently on disk:
 *   - `factions`   : `<folder>/<encoded filename>.png`
 *   - `countries`  : `<folder>/<encoded flag-file path>` (slashes preserved)
 *   - `music`      : `src/assets/images/Music/<encoded icon name>.png`
 *   - `heroes` / `npcs` (default): `<folder>/<encoded item>.png`
 *
 * The cache buster appended to image URLs by the loader is generated here so
 * tests can stub `generateCacheBuster` if needed.
 */

export const FILTER_IMAGE_PATHS = {
    HEROES: 'src/assets/images/Filters/Heroes',
    FACTIONS: 'src/assets/images/Filters/Factions',
    NPCS: 'src/assets/images/Filters/NPCs',
    FLAGS: 'src/assets/images/Filters/Flags',
    MUSIC: 'src/assets/images/Music'
};

export function generateCacheBuster() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * @param {*} item — string for heroes/npcs; `{filename, displayName}` for factions;
 *                   `{commonName, flagFile}` for countries; `{filename, name}` for music.
 * @param {'heroes'|'factions'|'npcs'|'countries'|'music'} type
 * @param {string} folder
 * @returns {string} unversioned path; callers append `?v=cacheBuster` to bypass the browser cache.
 */
export function buildFilterImagePath(item, type, folder) {
    if (type === 'factions') {
        return `${folder}/${encodeURIComponent(item.filename)}.png`;
    }
    if (type === 'countries') {
        const fn = (item && item.flagFile != null) ? String(item.flagFile).trim() : '';
        if (!fn) return `${folder}/`;
        return `${folder}/${fn.split('/').map(s => encodeURIComponent(s)).join('/')}`;
    }
    if (type === 'music') {
        const iconName = item.filename.replace(/\.(mp3|wav|ogg)$/i, '');
        return `${FILTER_IMAGE_PATHS.MUSIC}/${encodeURIComponent(iconName)}.png`;
    }
    /* heroes / npcs: item is a plain string id. */
    return `${folder}/${encodeURIComponent(item)}.png`;
}
