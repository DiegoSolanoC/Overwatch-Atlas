/**
 * PaletteLoaders — load/unload pair for the color palette toggle.
 *
 * `loadPalette` registers the palette button in the right header hub, loads
 * its sound effect, and wires up the toggle. `unloadPalette` tears all of
 * that down. Used by the ComponentOrchestrator under the `palette` key.
 */

import { setupPaletteToggle, resetPaletteToggleSetup } from '../../Palette/PaletteManager.js';
import {
    withLoadLifecycle,
    withUnloadLifecycle,
    checkAlreadyLoaded
} from '../../ComponentSetUp/LoadingLifecycle.js';
import { loadSoundEffect } from '../../Audio/SoundEffects/SoundEffectsLoaders.js';
import { createHeaderHubButton } from '../header/HeaderHubButton.js';
import { removeElementById } from '../../ComponentSetUp/removeElement.js';
import { updateStatus } from '../../managers/StatusManager.js';
import { getRunOperation } from '../../managers/LoadingOverlayManager.js';

export async function loadPalette(loadedComponents) {
    if (checkAlreadyLoaded(loadedComponents.palette, 'Palette')) {
        return;
    }

    await withLoadLifecycle(async () => {
        createHeaderHubButton({
            id: 'colorPaletteToggle',
            className: '',
            title: 'Toggle Color Palette',
            label: 'Palette',
            iconPath: 'src/assets/images/Icons/Mode%20Icons/Palette%20Icon.png',
            iconAlt: 'Color Palette',
            parentId: 'headerHubRightButtonGroup',
            baseClass: 'header-hub-btn header-hub-btn--icon',
            iconSpanId: 'colorPaletteIcon',
            headerOrder: 50
        });

        loadSoundEffect('colorChange', 'src/assets/audio/sfx/Color Change.mp3', 'Loading palette sound effect...');

        setupPaletteToggle();

        loadedComponents.palette = true;
    }, 'Palette', 'loadPaletteBtn', getRunOperation());
}

export async function unloadPalette(loadedComponents) {
    if (!loadedComponents.palette) {
        updateStatus('Palette not loaded', 'info');
        return;
    }

    await withUnloadLifecycle(async () => {
        removeElementById('colorPaletteToggle', 'Palette button removed');
        resetPaletteToggleSetup();
        loadedComponents.palette = false;
    }, 'Palette', 'loadPaletteBtn');
}
