/**
 * musicPaletteThemes — palette → startup-theme path resolver and music-path classifiers.
 *
 * Two responsibilities:
 *   1. Map the active color-palette key to the palette's startup theme MP3 in src/assets/audio/Themes/.
 *   2. Classify music paths as ambient loop (`Default.ogg`) or startup theme (`/Themes/...`).
 *
 * Manifest tracks no longer have palette-specific "defaults"; all catalog songs sort
 * in manifest order regardless of palette.
 */

const AMBIENT_REL = 'src/assets/audio/Default.ogg';
const THEMES_BASE = 'src/assets/audio/Themes';

/** Preferred filenames in Themes/ per palette (browser cannot list dir contents). */
const STARTUP_FILES = {
    blue: ['Overwatch.mp3', 'overwatch.mp3'],
    gray: ['Overwatch.mp3', 'overwatch.mp3'],
    crimson: ['Talon.mp3', 'talon.mp3'],
    nulled: ['Null Sector.mp3', 'Null Sector.ogg', 'null sector.mp3']
};

export function normalizePaletteKey(saved) {
    if (saved === 'gray') return 'gray';
    if (saved === 'crimson') return 'crimson';
    if (saved === 'nulled') return 'nulled';
    return 'blue';
}

export function getActiveMusicPaletteKey() {
    try {
        return normalizePaletteKey(localStorage.getItem('colorPalette'));
    } catch (_) {
        return 'blue';
    }
}

/**
 * @param {string} paletteKey
 * @returns {string|null} Path under src/assets/audio/Themes/ for the palette startup theme.
 */
export function getStartupThemePath(paletteKey) {
    const key = normalizePaletteKey(paletteKey);
    const list = STARTUP_FILES[key] || STARTUP_FILES.blue;
    if (!list || list.length === 0) return null;
    return `${THEMES_BASE}/${list[0]}`;
}

export function getAmbientLoopPath() {
    return AMBIENT_REL;
}

export function isAmbientPath(path) {
    if (!path) return false;
    return path.indexOf('Default.ogg') !== -1;
}

export function isStartupThemePath(path) {
    if (!path) return false;
    return path.indexOf('/Themes/') !== -1 || path.indexOf('/audio/Themes/') !== -1;
}

/**
 * Notify the running MusicService that the palette changed so it can swap the
 * startup theme mid-flight. Safe no-op if the service is not yet attached.
 */
export function notifyMusicDefaultPaletteChange(previousPalette, newPalette) {
    try {
        const m = window.MusicManager;
        if (m && typeof m.onPaletteChanged === 'function') {
            m.onPaletteChanged(previousPalette, newPalette);
        }
    } catch (e) {
        console.error(e);
    }
}
