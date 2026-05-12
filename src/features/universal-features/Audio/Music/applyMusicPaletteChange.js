/**
 * applyMusicPaletteChange — when the color palette changes mid-session and
 * we're currently playing the previous palette's startup theme, fade out,
 * swap to the new palette's startup theme, and fade back in. Also rebuilds
 * the music grid (palette-aware tile coloring).
 *
 * Called by `MusicService.onPaletteChanged()`.
 */

import { getStartupThemePath, normalizePaletteKey } from './musicPaletteThemes.js';

/**
 * @param {import('./MusicService.js').MusicService} service
 */
export function applyMusicPaletteChange(service, previousPalette, newPalette) {
    if (!service.initialized) return;
    if (!service.musicFiles || service.musicFiles.length === 0) return;

    const prev = normalizePaletteKey(previousPalette);
    const next = normalizePaletteKey(newPalette);
    if (prev === next) return;

    if (!service.shuffleService.isShuffling
        && service._musicMode === 'startup'
        && typeof service._playMusic === 'function') {
        const themePath = getStartupThemePath(next);
        if (themePath) {
            service.volumeService.fadeOut(false, false, () => {
                service._playMusic(themePath);
                setTimeout(() => {
                    service.volumeService.fadeIn(false, false);
                }, 300);
                service.updateNowPlaying();
                service.saveMusicState();
            });
        }
    }

    service.createMusicButtons();
}
