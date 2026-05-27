/**
 * MusicLoaders — load/unload pair for music components.
 *
 * `loadMusic` adds the music toggle button, the music panel HTML, the audio
 * element, initializes MusicService twice (immediate + delayed re-init for
 * service-readiness), and loads the music sound effect. `unloadMusic`
 * removes the button + panel and stops any playing audio.
 */

import {
    withLoadLifecycle,
    withUnloadLifecycle,
    checkAlreadyLoaded
} from '../../atlas-shared-ui/loading/LoadingLifecycle.js';
import { loadSoundEffect } from '../../atlas-sound-effects/loadSoundEffects.js';
import { createHeaderHubButton } from '../../atlas-header/HeaderHubButton.js';
import { lookAndAddElement } from '../../atlas-shared-ui/dom/lookAndAddElement.js';
import { createMusicPanel } from '../../atlas-music/panel/musicPanelMarkup.js';
import { removeElementsByIds } from '../../atlas-shared-ui/dom/removeElement.js';
import { updateStatus } from '../../atlas-mode-runtime/statusFeed.js';
import { getRunOperation } from '../../atlas-mode-runtime/loadingOverlayState.js';
import { initializeMusicService } from '../../atlas-music/initializeMusicService.js';
import { createBackgroundMusicElement } from '../../atlas-music/createBackgroundMusicElement.js';

export async function loadMusic(loadedComponents) {
    if (checkAlreadyLoaded(loadedComponents.music, 'Music')) {
        return;
    }

    await withLoadLifecycle(async () => {
        createHeaderHubButton({
            id: 'musicToggle',
            className: '',
            title: 'Music Options',
            label: 'Music',
            iconPath: 'src/assets/images/Icons/Music%20Icons/Music%20Icon.png',
            iconAlt: 'Music',
            parentId: 'headerHubRightButtonGroup',
            baseClass: 'header-hub-btn header-hub-btn--icon',
            headerOrder: 60
        });

        lookAndAddElement('musicPanel', () => {
            updateStatus('Adding music panel...', 'info');
            return createMusicPanel();
        }, 'Music panel');

        lookAndAddElement('backgroundMusic', () => {
            updateStatus('Adding audio element...', 'info');
            return createBackgroundMusicElement();
        }, 'Audio element');

        initializeMusicService(true);

        loadSoundEffect('music', 'src/assets/audio/sfx/Music.mp3', 'Loading music sound effect...');

        // Second pass after a short delay — MusicService re-init catches any
        // sibling service modules that weren't ready on the first synchronous pass.
        initializeMusicService(false, 50);

        loadedComponents.music = true;
    }, 'Music', 'loadMusicBtn', getRunOperation());
}

export async function unloadMusic(loadedComponents) {
    if (!loadedComponents.music) {
        updateStatus('Music not loaded', 'info');
        return;
    }

    await withUnloadLifecycle(async () => {
        removeElementsByIds([
            { id: 'musicToggle', message: 'Music button removed' },
            { id: 'musicPanel', message: 'Music panel removed' }
        ]);

        if (window.currentAudio) {
            window.currentAudio.pause();
            window.currentAudio = null;
        }

        loadedComponents.music = false;
    }, 'Music', 'loadMusicBtn');
}
