/**
 * musicRestoreFromStorage — rehydrate saved music from localStorage / sessionStorage.
 */

import { isAmbientPath, isStartupThemePath } from '../musicPaletteThemes.js';
import { audioElementMatchesLogicalPath, applyResumeFromSavedState } from './musicResumePlaybackPosition.js';

/**
 * @param {import('../MusicService.js').MusicService} service
 * @returns {boolean} true when state was restored
 */
export function restoreMusicState(service) {
    const musicState = service.stateService.loadState();
    if (!musicState) return false;

    if (musicState.currentSong && isAmbientPath(musicState.currentSong) && !isStartupThemePath(musicState.currentSong)) {
        return false;
    }

    const finalizeLoopUi = (m) => {
        const loopBtn = document.getElementById('loopBtn');
        if (loopBtn) loopBtn.classList.toggle('active', !!m.isLooping);
        if (m.iconService) m.iconService.updateLoopIcon(!!m.isLooping);
    };

    try {
        if (musicState.isShuffling && musicState.shuffleQueue && service.musicFiles.length > 0) {
            service.shuffleService.restoreShuffleState(
                service.musicFiles,
                musicState.shuffleQueue,
                musicState.currentSongIndex
            );
            const shuffleBtn = document.getElementById('shuffleBtn');
            if (shuffleBtn) shuffleBtn.classList.add('active');
        }

        service.isLooping = !service.shuffleService.isShuffling && !!musicState.isLooping;

        // Prefer saved target / last-audible. Ignore stale 0s left by fade-outs
        // that used to persist `backgroundMusic.volume` while the track faded.
        const savedVolume = typeof musicState.volume === 'number' ? musicState.volume : undefined;
        const savedLast = typeof musicState.lastAudibleVolume === 'number'
            ? musicState.lastAudibleVolume
            : undefined;
        if (savedLast > 0) {
            service.volumeService.lastAudibleVolume = Math.min(1, savedLast);
        }
        const restoredVolume = (savedVolume > 0)
            ? savedVolume
            : (service.volumeService.lastAudibleVolume > 0
                ? service.volumeService.lastAudibleVolume
                : 0.1);
        service.volumeService.setTargetVolume(restoredVolume);
        const vs = document.getElementById('volumeSlider');
        const vv = document.getElementById('volumeValue');
        if (vs) vs.value = String(Math.round(restoredVolume * 100));
        if (vv) vv.textContent = `${Math.round(restoredVolume * 100)}%`;

        // Keep element volume at the user level even while muted — silence comes
        // from the muted flag. That way unmute never has to dig out of a 0.
        service.backgroundMusic.volume = restoredVolume;
        if (musicState.muted !== undefined) {
            service.backgroundMusic.muted = musicState.muted;
            service.iconService.updateMuteIcon(musicState.muted);
            if (service.muteBtn) {
                service.muteBtn.classList.toggle('active', !!musicState.muted);
            }
        }

        if (musicState.currentSong) {
            const rawSong = musicState.currentSong;
            const isAmbient = isAmbientPath(rawSong);
            const isStartup = isStartupThemePath(rawSong);

            const clearShuffleUiIfNeeded = () => {
                if (isAmbient || isStartup) {
                    if (service.shuffleService.isShuffling) {
                        service.shuffleService.disableShuffle();
                        const shuffleBtn = document.getElementById('shuffleBtn');
                        if (shuffleBtn) shuffleBtn.classList.remove('active');
                        service.iconService.updateShuffleIcon(false);
                    }
                }
            };

            if (isAmbient || isStartup) {
                service.isLooping = false;
                clearShuffleUiIfNeeded();
                service._musicMode = isAmbient ? 'ambient' : 'startup';
                service.currentSong = rawSong;
                service.playbackService.setCurrentSong(service.currentSong);
                const encSpec0 = service.playbackService.encodeMusicPath(service.currentSong);
                const encFn0 = (p) => service.playbackService.encodeMusicPath(p);
                const already0 = audioElementMatchesLogicalPath(service.backgroundMusic, service.currentSong, encFn0);
                if (!already0) {
                    service.backgroundMusic.src = encSpec0;
                    service.backgroundMusic.load();
                }
                service.backgroundMusic.loop = isAmbient;

                service.updateNowPlaying();
                service.fileService.updateSelectedButton(
                    service.currentSong,
                    (btnPath, songPath) => service.playbackService.matchesSongPath(btnPath, songPath)
                );

                applyResumeFromSavedState(service, musicState);
                finalizeLoopUi(service);
                return true;
            }

            if (service.musicFiles.length > 0) {
                const songToRestore = service.musicFiles.find((s) => {
                    const statePath = musicState.currentSong || '';
                    return statePath.endsWith('/' + s.filename) || decodeURIComponent(statePath).endsWith('/' + s.filename);
                });

                if (songToRestore) {
                    service._musicMode = 'catalog';
                    service.currentSong = 'src/assets/audio/music/' + songToRestore.filename;
                    service.playbackService.setCurrentSong(service.currentSong);

                    const encFn1 = (p) => service.playbackService.encodeMusicPath(p);
                    const encodedPath1 = encFn1(service.currentSong);
                    const already1 = audioElementMatchesLogicalPath(service.backgroundMusic, service.currentSong, encFn1);
                    if (!already1) {
                        service.backgroundMusic.src = encodedPath1;
                        service.backgroundMusic.load();
                    }
                    service.backgroundMusic.loop = !!(service.isLooping && !service.shuffleService.isShuffling);

                    service.updateNowPlaying();
                    service.fileService.updateSelectedButton(
                        service.currentSong,
                        (btnPath, songPath) => service.playbackService.matchesSongPath(btnPath, songPath)
                    );

                    applyResumeFromSavedState(service, musicState);
                    finalizeLoopUi(service);
                    return true;
                }
            }
        }
        return false;
    } catch (e) {
        console.error('Error restoring music state:', e);
        return false;
    }
}
