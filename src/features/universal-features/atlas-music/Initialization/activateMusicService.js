/**
 * activateMusicService — the moment MusicService goes live: fade graph,
 * controls, listeners, global publishes, then kicks off the boot sequence
 * (manifest fetch + grid render + state restore + startup theme).
 *
 * Called as the final step of `MusicService.init()`.
 */

import { wireNearEndFadeAndTrackEnded, wireAutoplayUnlockOnFirstGesture } from '../playback/wireBackgroundMusicPlayback.js';
import { runMusicBootSequence } from './musicBootSequence.js';
import {
    wireBackgroundAudioListeners,
    wirePersistenceListeners,
    wirePanelToggle
} from './wireMusicListeners.js';
import { updatePlayingDiscSpinning } from '../now-playing-badge/musicPlayingDiscSpinSync.js';

/**
 * @param {import('../MusicService.js').MusicService} service
 * @param {Function} playMusic
 * @param {Function} playNextSong
 */
export function activateMusicService(service, playMusic, playNextSong) {
    const fadeIn = () => {
        service.volumeService.fadeIn(service.progressService.isSeeking, service.progressService.isDragging);
    };
    const fadeOut = () => {
        service.volumeService.fadeOut(
            service.progressService.isSeeking,
            service.progressService.isDragging,
            () => {
                if (service._musicMode === 'catalog'
                    && !service.shuffleService.isShuffling
                    && service.isLooping
                    && !service.progressService.isInteracting()) {
                    service.backgroundMusic.currentTime = 0;
                    setTimeout(() => {
                        if (!service.backgroundMusic.paused && !service.progressService.isInteracting()) {
                            fadeIn();
                        }
                    }, 50);
                }
            }
        );
    };

    wireNearEndFadeAndTrackEnded(service, {
        fadeOut,
        playNextSong,
        transitionToAmbient: () => service._transitionToAmbientLoop()
    });

    service.controlService.onShuffleEnabled = () => {
        if (service._musicMode === 'ambient' || service._musicMode === 'startup') {
            playNextSong();
        }
    };

    window.encodeMusicPath = (path) => service.playbackService.encodeMusicPath(path);

    service.controlService.setupAllControls(
        () => service.musicFiles,
        () => service.currentSong,
        playNextSong
    );

    wireBackgroundAudioListeners(service);
    service.nowPlayingBadge.installEventImageOverlaySync(() => service.updateNowPlaying());
    service.progressService.setupEventListeners(() => service.saveMusicState());
    wirePersistenceListeners();

    window.saveMusicState = () => service.saveMusicState();

    wireAutoplayUnlockOnFirstGesture(service, playMusic);

    if (!service.panelService || !service.musicButton) {
        console.error('MusicService: panelService or musicButton is null');
        return;
    }
    wirePanelToggle(service);

    service.controlService.initializeButtonStates();
    updatePlayingDiscSpinning(service.backgroundMusic, service.currentSong);

    runMusicBootSequence(service, playMusic);
}
