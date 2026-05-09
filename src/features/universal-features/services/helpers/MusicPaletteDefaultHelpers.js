/**
 * Music palette helpers: UI palette key, startup theme paths (Themes/), ambient loop (Default.ogg).
 * Manifest tracks no longer have palette-specific "defaults"; all catalog songs sort in manifest order.
 */
(function () {
    'use strict';

    var AMBIENT_REL = 'src/assets/audio/Default.ogg';
    var THEMES_BASE = 'src/assets/audio/Themes';

    /** Preferred filenames in Themes/ (first existing conceptually — browser cannot list dir). */
    var STARTUP_FILES = {
        blue: ['Overwatch.mp3', 'overwatch.mp3'],
        gray: ['Overwatch.mp3', 'overwatch.mp3'],
        crimson: ['Talon.mp3', 'talon.mp3'],
        nulled: ['Null Sector.mp3', 'Null Sector.ogg', 'null sector.mp3']
    };

    function normalizePaletteKey(saved) {
        if (saved === 'gray') return 'gray';
        if (saved === 'crimson') return 'crimson';
        if (saved === 'nulled') return 'nulled';
        return 'blue';
    }

    function getActiveMusicPaletteKey() {
        try {
            return normalizePaletteKey(localStorage.getItem('colorPalette'));
        } catch (_) {
            return 'blue';
        }
    }

    function startupPathForFilename(filename) {
        return THEMES_BASE + '/' + filename;
    }

    /**
     * Resolved path for palette startup MP3 under src/assets/audio/Themes/
     * @param {string} paletteKey
     * @returns {string|null}
     */
    function getStartupThemePath(paletteKey) {
        var key = normalizePaletteKey(paletteKey);
        var list = STARTUP_FILES[key] || STARTUP_FILES.blue;
        if (!list || list.length === 0) return null;
        return startupPathForFilename(list[0]);
    }

    function getAmbientLoopPath() {
        return AMBIENT_REL;
    }

    function pathTail(path) {
        if (!path) return '';
        var parts = path.split('/');
        return parts[parts.length - 1] || '';
    }

    function isAmbientPath(path) {
        if (!path) return false;
        return path.indexOf('Default.ogg') !== -1;
    }

    function isStartupThemePath(path) {
        if (!path) return false;
        return path.indexOf('/Themes/') !== -1 || path.indexOf('/audio/Themes/') !== -1;
    }

    function isCatalogMusicPath(path) {
        if (!path) return false;
        return path.indexOf('/audio/music/') !== -1;
    }

    /**
     * Display title for startup / ambient (now-playing label).
     * @param {string} path
     */
    function getSpecialNowPlayingTitle(path) {
        if (!path) return null;
        if (isAmbientPath(path)) return 'Site ambience';
        if (isStartupThemePath(path)) {
            var t = pathTail(path).toLowerCase();
            if (t.indexOf('talon') !== -1) return 'Talon (startup)';
            if (t.indexOf('null') !== -1) return 'Null Sector (startup)';
            if (t.indexOf('overwatch') !== -1) return 'Overwatch (startup)';
            return 'Startup theme';
        }
        return null;
    }

    function notifyMusicDefaultPaletteChange(previousPalette, newPalette) {
        try {
            var m = window.MusicManager;
            if (m && typeof m.onPaletteChanged === 'function') {
                m.onPaletteChanged(previousPalette, newPalette);
            }
        } catch (e) {
            console.error(e);
        }
    }

    window.MusicPaletteDefaultHelpers = {
        normalizePaletteKey: normalizePaletteKey,
        getActiveMusicPaletteKey: getActiveMusicPaletteKey,
        getStartupThemePath: getStartupThemePath,
        getAmbientLoopPath: getAmbientLoopPath,
        isAmbientPath: isAmbientPath,
        isStartupThemePath: isStartupThemePath,
        isCatalogMusicPath: isCatalogMusicPath,
        getSpecialNowPlayingTitle: getSpecialNowPlayingTitle,
        notifyMusicDefaultPaletteChange: notifyMusicDefaultPaletteChange
    };
})();
