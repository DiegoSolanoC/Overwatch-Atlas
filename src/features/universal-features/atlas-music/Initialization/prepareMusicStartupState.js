/**
 * prepareMusicStartupState — second step of `MusicService.init()`.
 *
 * Reads saved state to seed the volume slider, decide whether to early-preload
 * a "priority" resumed track (publishes `window.prioritySong` for the boot
 * sequence to honor), and applies the initial volume to the audio element.
 */

import { isAmbientPath, isStartupThemePath } from '../musicPaletteThemes.js';

const getLogAssetLoad = () =>
    (typeof window !== 'undefined' && typeof window.logAssetLoad === 'function')
        ? window.logAssetLoad
        : () => {};

/** @param {import('../MusicService.js').MusicService} service */
export function applyInitialVolumeAndPriorityPreload(service) {
    const savedState = service.stateService.loadState();
    let prioritySong = null;
    let initialVolume = 0.1;
    if (savedState) {
        if (savedState.currentSong) {
            const ambientOnlySaved = isAmbientPath(savedState.currentSong)
                && !isStartupThemePath(savedState.currentSong);
            if (!ambientOnlySaved) {
                prioritySong = savedState.currentSong;
                getLogAssetLoad()('MUSIC_PRIORITY', 'Priority loading: ' + prioritySong);
            }
        }
        if (savedState.volume !== undefined && savedState.volume > 0) {
            initialVolume = savedState.volume;
        }
    }
    window.prioritySong = prioritySong;

    service.volumeService.setTargetVolume(initialVolume);
    service.backgroundMusic.volume = initialVolume;
    if (service.volumeSlider) service.volumeSlider.value = Math.round(initialVolume * 100);
    if (service.volumeValue) service.volumeValue.textContent = Math.round(initialVolume * 100) + '%';

    if (prioritySong && service.backgroundMusic && service.playbackService) {
        try {
            service.backgroundMusic.preload = 'auto';
            service.backgroundMusic.src = service.playbackService.encodeMusicPath(prioritySong);
            service.playbackService.setCurrentSong(prioritySong);
            service.currentSong = prioritySong;
            service.backgroundMusic.load();
        } catch (earlyErr) {
            console.warn('MusicService: early track preload failed', earlyErr);
        }
    }
}
