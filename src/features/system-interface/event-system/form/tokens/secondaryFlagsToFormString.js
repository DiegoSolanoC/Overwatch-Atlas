/**
 * Reverse-map a list of country flag filenames (e.g. `"jp.png"`) to the user-facing
 * display labels stored in `window.FLAG_FILE_BY_COMMON` (e.g. `"Japan"`), and join them
 * with `", "` for the secondary-countries text input.
 *
 * If a filename isn't in the map (or the map is missing entirely), fall back to stripping
 * the `.png` extension and trimming — same heuristic LocationFlagHelpers uses elsewhere.
 *
 * @param {string[]} flagFilenames
 * @returns {string}
 */
export function secondaryFlagsToFormString(flagFilenames) {
    if (!flagFilenames || flagFilenames.length === 0) return '';
    const map = typeof window !== 'undefined' ? window.FLAG_FILE_BY_COMMON : null;
    return flagFilenames.map((fn) => {
        if (map) {
            const keys = Object.keys(map).sort();
            for (let i = 0; i < keys.length; i++) {
                if (map[keys[i]] === fn) return keys[i];
            }
        }
        return String(fn).replace(/\.png$/i, '').trim();
    }).join(', ');
}
