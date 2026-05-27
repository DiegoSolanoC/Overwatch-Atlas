/**
 * musicPlayAndAdvance — factories for the two core playback closures used by
 * `MusicService`: load+play a path (`createPlayMusic`), and advance after skip
 * or natural end (`createPlayNextSong`).
 *
 * This is **not** a queue data structure — shuffle/loop/ambient transitions
 * live in `MusicShuffleService` + `MusicPlaybackService`; these functions only
 * orchestrate them around the shared `<audio id="backgroundMusic">` element.
 */

import { isAmbientPath, isStartupThemePath } from '../musicPaletteThemes.js';

/**
 * @param {import('../MusicService.js').MusicService} service
 */
export function createPlayMusic(service) {
    const bg = service.backgroundMusic;
    const shuffle = service.shuffleService;
    const progress = service.progressService;
    const playback = service.playbackService;
    const fileSvc = service.fileService;

    const fadeIn = () => {
        service.volumeService.fadeIn(progress.isSeeking, progress.isDragging);
    };

    return function playMusic(songPath) {
        if (songPath) {
            if (isStartupThemePath(songPath)) {
                service._musicMode = 'startup';
            } else if (isAmbientPath(songPath)) {
                service._musicMode = 'ambient';
            } else {
                service._musicMode = 'catalog';
            }

            if (service._musicMode !== 'catalog') {
                service.isLooping = false;
                const loopBtnClear = document.getElementById('loopBtn');
                if (loopBtnClear) loopBtnClear.classList.remove('active');
                if (service.iconService) service.iconService.updateLoopIcon(false);
            }

            if (service._musicMode === 'startup') {
                bg.loop = false;
            } else if (service._musicMode === 'ambient') {
                bg.loop = true;
            } else {
                bg.loop = !!(service.isLooping && !shuffle.isShuffling);
            }

            const progressBar = document.getElementById('musicProgressBar');
            if (progressBar) progressBar.value = 0;

            const loopOverride =
                service._musicMode === 'startup' ? false
                    : (service._musicMode === 'ambient' ? true
                        : !!(service.isLooping && !shuffle.isShuffling));
            playback.loadSong(songPath, shuffle.isShuffling, () => {
                progress.updateProgressBar();
                if (progressBar) progressBar.value = 0;
            }, loopOverride);

            service.currentSong = songPath;
            playback.setCurrentSong(songPath);
            service.updateNowPlaying();
            fileSvc.updateSelectedButton(songPath, (btnPath, sPath) =>
                playback.matchesSongPath(btnPath, sPath));
        }
        playback.play(() => {
            fadeIn();
            progress.updateProgressBar();
        });
    };
}

/**
 * @param {import('../MusicService.js').MusicService} service
 * @param {Function} playMusic
 */
export function createPlayNextSong(service, playMusic) {
    const playback = service.playbackService;
    const shuffle = service.shuffleService;

    return function playNextSong() {
        const bg = service.backgroundMusic;

        // Catalog + loop: restart the same track (loop beats shuffle on catalog).
        if (service._musicMode === 'catalog' && service.isLooping) {
            if (bg && service.currentSong) {
                try {
                    bg.currentTime = 0;
                    const restartPlay = bg.play();
                    if (restartPlay !== undefined) {
                        restartPlay.catch(() => {});
                    }
                } catch (_) { /* ignore */ }
                if (service.progressService && service.progressService.updateProgressBar) {
                    service.progressService.updateProgressBar();
                }
                if (typeof service.saveMusicState === 'function') {
                    service.saveMusicState();
                }
            }
            return;
        }

        let nextSong = null;
        if (shuffle.isShuffling) {
            // Shuffle enabled before manifest finished loading → queue may be empty.
            if (!shuffle.shuffleQueue || shuffle.shuffleQueue.length === 0) {
                shuffle.enableShuffle(service.musicFiles || [], service.currentSong);
            }
            nextSong = shuffle.getNextSong();
        } else if (service._musicMode === 'catalog' && !service.isLooping) {
            if (typeof service._transitionToAmbientLoop === 'function') {
                service._transitionToAmbientLoop();
            }
            return;
        } else {
            nextSong = playback.getNextSong();
        }

        if (nextSong && nextSong.filename) {
            playMusic('src/assets/audio/music/' + nextSong.filename);
        }
    };
}
