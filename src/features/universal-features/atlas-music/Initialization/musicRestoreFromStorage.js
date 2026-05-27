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

        if (musicState.volume !== undefined) {
            service.volumeService.setTargetVolume(musicState.volume);
            service.backgroundMusic.volume = musicState.volume;
            const vs = document.getElementById('volumeSlider');
            const vv = document.getElementById('volumeValue');
            if (vs) vs.value = Math.round(musicState.volume * 100);
            if (vv) vv.textContent = Math.round(musicState.volume * 100) + '%';
        }

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
