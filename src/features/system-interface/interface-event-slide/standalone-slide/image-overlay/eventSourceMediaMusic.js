/**
 * Pause background music while in-app source media (YouTube / PDF) is open.
 */

/** @type {boolean} */
let musicWasPlayingBeforeSourceMedia = false;

/**
 * @returns {import('../../../../universal-features/atlas-music/MusicService.js').MusicService|null}
 */
function getMusicManager() {
    const mm = window.MusicManager;
    return mm?.backgroundMusic ? mm : null;
}

export function pauseMusicForSourceMedia() {
    const mm = getMusicManager();
    const bg = mm?.backgroundMusic;
    if (!bg || bg.paused) return;

    musicWasPlayingBeforeSourceMedia = true;
    bg.pause();
    if (mm.pauseBtn) mm.pauseBtn.classList.add('active');
    mm.iconService?.updatePauseIcon?.(true);
}

export function resumeMusicAfterSourceMedia() {
    if (!musicWasPlayingBeforeSourceMedia) return;
    musicWasPlayingBeforeSourceMedia = false;

    const mm = getMusicManager();
    const bg = mm?.backgroundMusic;
    if (!bg || !mm.currentSong) return;

    void bg.play().catch(() => {});
    if (mm.pauseBtn) mm.pauseBtn.classList.remove('active');
    mm.iconService?.updatePauseIcon?.(false);
    mm.updateNowPlaying?.();
}

export function resetSourceMediaMusicDuckState() {
    musicWasPlayingBeforeSourceMedia = false;
}

/** @deprecated aliases */
export const pauseMusicForYouTubeVideo = pauseMusicForSourceMedia;
export const resumeMusicAfterYouTubeVideo = resumeMusicAfterSourceMedia;
export const resetYouTubeMusicDuckState = resetSourceMediaMusicDuckState;
