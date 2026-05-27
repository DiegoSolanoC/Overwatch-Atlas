/**
 * musicBootSequence — the music service's boot sequence: fetch manifest,
 * populate the grid, restore from storage, schedule preloads, and start the
 * palette's startup theme if no saved state takes precedence.
 *
 * Invoked from `activateMusicService()` as the final step of init.
 */

import {
    getStartupThemePath,
    getActiveMusicPaletteKey
} from '../musicPaletteThemes.js';
import { MusicStateService } from '../services/MusicStateService.js';
import { restoreMusicState } from './musicRestoreFromStorage.js';

const getLogAssetLoad = () =>
    (typeof window !== 'undefined' && typeof window.logAssetLoad === 'function')
        ? window.logAssetLoad
        : () => {};

/**
 * @param {import('../MusicService.js').MusicService} service
 * @param {Function} playMusic
 */
export function runMusicBootSequence(service, playMusic) {
    const logAssetLoad = getLogAssetLoad();

    return service.fileService.loadMusicFiles().then((musicFiles) => {
        if (!musicFiles || musicFiles.length === 0) {
            service.musicGrid.innerHTML = '<div style="color: #ff6600; padding: 20px; text-align: center;">No music files found.<br><br>1. Add files to Music folder<br>2. Add icons to src/assets/images/Music folder<br>3. Run: node scripts/generate-manifest.js<br>4. Refresh page</div>';
            return;
        }

        service.musicFiles = musicFiles;
        service.playbackService.setMusicFiles(musicFiles);

        const prioritySong = (typeof window !== 'undefined' && window.prioritySong) || null;
        if (prioritySong) {
            service.fileService.preloadPrioritySong(prioritySong, (path) =>
                service.playbackService.encodeMusicPath(path));
        }

        const restored = restoreMusicState(service);

        service.fileService.createMusicButtons(
            service.musicGrid,
            service.currentSong,
            (songPath) => {
                playMusic(songPath);
                service.updateNowPlaying();
                service.saveMusicState();
            },
            (btnPath, songPath) => service.playbackService.matchesSongPath(btnPath, songPath)
        );

        const deferPreloadAll = () => {
            service.fileService.preloadAllMusic((path) =>
                service.playbackService.encodeMusicPath(path));
        };
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(deferPreloadAll, { timeout: 5000 });
        } else {
            setTimeout(deferPreloadAll, 2000);
        }

        if (!restored && !service.currentSong && service.musicFiles.length > 0) {
            const themePath = getStartupThemePath(getActiveMusicPaletteKey());
            const onStartupErr = () => {
                service.backgroundMusic.removeEventListener('error', onStartupErr);
                service.backgroundMusic.removeEventListener('playing', onStartupPlaying);
                if (service._musicMode === 'startup' && typeof service._transitionToAmbientLoop === 'function') {
                    service._transitionToAmbientLoop();
                }
            };
            const onStartupPlaying = () => {
                service.backgroundMusic.removeEventListener('error', onStartupErr);
                service.backgroundMusic.removeEventListener('playing', onStartupPlaying);
            };
            service.backgroundMusic.addEventListener('error', onStartupErr);
            service.backgroundMusic.addEventListener('playing', onStartupPlaying);
            if (themePath) {
                if (typeof window !== 'undefined' && typeof window.scheduleWelcomeSoundForStartupTheme === 'function') {
                    window.scheduleWelcomeSoundForStartupTheme();
                }
                playMusic(themePath);
                service.updateNowPlaying();
            } else if (typeof service._transitionToAmbientLoop === 'function') {
                service.backgroundMusic.removeEventListener('error', onStartupErr);
                service._transitionToAmbientLoop();
            }
        } else if (restored) {
            logAssetLoad('MUSIC_PRIORITY', 'Music state restored successfully');
        }
    }).catch((err) => {
        console.error('Error loading manifest.json:', err);
        try {
            if (MusicStateService.isLocalDevHost()) {
                service.stateService.clearState();
            }
        } catch (_) { /* ignore */ }
        service.musicGrid.innerHTML = '<div style="color: #ff6600; padding: 20px; text-align: center;">Error loading music. Run node scripts/generate-manifest.js</div>';
    });
}
