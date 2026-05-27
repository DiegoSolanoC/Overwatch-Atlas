/**
 * assembleMusicService — the first step of `MusicService.init()`.
 *
 * Two phases:
 *   1. `resolveMusicDomElements(service)` — looks up the 10 music-panel DOM
 *      nodes (#musicToggle, #musicPanel, #backgroundMusic, etc.) and stashes
 *      them on the service.
 *   2. `constructMusicChildServices(service)` — instantiates the 9 child
 *      service classes (state, shuffle, volume, progress, playback, file,
 *      panel, icon, control) and wires them onto the service.
 *
 * After this returns the MusicService instance is fully assembled but inert;
 * `activateMusicService` brings it online.
 */

import { MusicStateService } from '../services/MusicStateService.js';
import { MusicShuffleService } from '../services/MusicShuffleService.js';
import { MusicVolumeService } from '../services/MusicVolumeService.js';
import { MusicProgressService } from '../services/MusicProgressService.js';
import { MusicPlaybackService } from '../services/MusicPlaybackService.js';
import { MusicFileService } from '../services/MusicFileService.js';
import { MusicPanelService } from '../panel/MusicPanelService.js';
import { MusicIconService } from '../services/MusicIconService.js';
import { MusicControlService } from '../services/MusicControlService.js';

/** @param {import('../MusicService.js').MusicService} service */
export function resolveMusicDomElements(service) {
    service.musicButton = document.getElementById('musicToggle');
    service.musicPanel = document.getElementById('filtersPanel') || document.getElementById('musicPanel');
    service.musicPanelClose = document.getElementById('filtersPanelClose') || document.getElementById('musicPanelClose');
    service.backgroundMusic = document.getElementById('backgroundMusic');
    service.volumeSlider = document.getElementById('volumeSlider');
    service.volumeValue = document.getElementById('volumeValue');
    service.muteBtn = document.getElementById('muteBtn');
    service.pauseBtn = document.getElementById('pauseBtn');
    service.skipBtn = document.getElementById('skipBtn');
    service.musicGrid = document.getElementById('musicGrid');
}

/** @param {import('../MusicService.js').MusicService} service */
export function constructMusicChildServices(service) {
    service.stateService = new MusicStateService();
    if (MusicStateService.isLocalDevHost()) {
        try {
            localStorage.removeItem(service.stateService.storageKey);
        } catch (_) { /* ignore */ }
    }
    service.shuffleService = new MusicShuffleService();
    service.volumeService = new MusicVolumeService(service.backgroundMusic);
    service.progressService = new MusicProgressService(service.backgroundMusic);
    service.playbackService = new MusicPlaybackService(service.backgroundMusic);
    service.fileService = new MusicFileService();
    service.panelService = new MusicPanelService(service.musicButton, service.musicPanel, service.musicPanelClose);
    service.iconService = new MusicIconService();
    service.controlService = new MusicControlService(
        service.backgroundMusic,
        service.volumeService,
        service.shuffleService,
        service.iconService,
        () => service.saveMusicState(),
        service
    );
}
