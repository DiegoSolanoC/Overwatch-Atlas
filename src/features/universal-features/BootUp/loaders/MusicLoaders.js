/**
 * MusicLoaders — load/unload pair for music components.
 *
 * `loadMusic` adds the music toggle button, the music panel HTML, the audio
 * element, initializes MusicManager twice (immediate + delayed re-init for
 * service-readiness), and loads the music sound effect. `unloadMusic`
 * removes the button + panel and stops any playing audio.
 */

import {
    withLoadLifecycle,
    withUnloadLifecycle,
    checkAlreadyLoaded
} from '../../ComponentSetUp/LoadingLifecycle.js';
import { loadSoundEffect } from '../../Audio/SoundEffects/SoundEffectsLoaders.js';
import { createHeaderHubButton } from '../header/HeaderHubButton.js';
import { lookAndAddElement } from '../../ComponentSetUp/lookAndAddElement.js';
import { createMusicPanel } from '../../Audio/Music/MusicPanelDom.js';
import { removeElementsByIds } from '../../ComponentSetUp/removeElement.js';
import { updateStatus } from '../../runtime/statusFeed.js';
import { getRunOperation } from '../../runtime/loadingOverlayState.js';
import {
    initializeMusicManager,
    createBackgroundMusicElement
} from '../../Audio/Music/MusicHelpers.js';

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

        initializeMusicManager(true);

        loadSoundEffect('music', 'src/assets/audio/sfx/Music.mp3', 'Loading music sound effect...');

        // Second pass after a short delay — MusicManager re-init catches any
        // services that weren't ready on the first synchronous pass.
        initializeMusicManager(false, 50);

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
