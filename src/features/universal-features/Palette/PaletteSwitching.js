/**
 * PaletteSwitching — applies a chosen palette across CSS, globe, scene,
 * transport, markers, music bridge, and SFX; persists to `localStorage`.
 */

import { applyCurrentPaletteToTransportVehicles } from '../../Interactive-Worldview/utils/TransportPaletteColors.js';
import { applyPaletteToExistingEventMarkers } from '../../system-interface/markers/styling/markerColors.js';
import {
    normalizeSavedPalette,
    applyPaletteBodyClasses,
    updateHeaderWebsiteLogo,
    texturePathForPalette
} from './PaletteConstants.js';
import { updatePaletteMenuActiveState } from './PaletteMenuDom.js';
import { closePaletteMenu } from './PaletteMenuPositioning.js';
import { notifyMusicDefaultPaletteChange } from '../Audio/Music/musicPaletteThemes.js';

const COLOR_CHANGE_SFX = 'src/assets/audio/sfx/Color Change.mp3';

export function playColorChangeSound() {
    if (!window.SoundEffectsManager) return;
    if (window.SoundEffectsManager.sounds && window.SoundEffectsManager.sounds.colorChange) {
        window.SoundEffectsManager.play('colorChange');
        return;
    }
    window.SoundEffectsManager.loadSound('colorChange', COLOR_CHANGE_SFX);
    setTimeout(() => {
        if (window.SoundEffectsManager.sounds && window.SoundEffectsManager.sounds.colorChange) {
            window.SoundEffectsManager.play('colorChange');
        }
    }, 100);
}

/**
 * @param {string} palette — raw `dataset.palette` value from a menu button
 */
export function changePalette(palette) {
    const normalized = normalizeSavedPalette(palette);
    const previousPalette = normalizeSavedPalette(localStorage.getItem('colorPalette'));

    applyPaletteBodyClasses(normalized);
    updateHeaderWebsiteLogo(normalized);
    updatePaletteMenuActiveState(normalized);
    localStorage.setItem('colorPalette', normalized);

    const isGray = normalized === 'gray';
    const isCrimson = normalized === 'crimson';
    const isNulled = normalized === 'nulled';

    if (window.globeController && window.globeController.globeView) {
        window.globeController.globeView.changeGlobeTexture(texturePathForPalette('map', normalized));
        if (typeof window.globeController.globeView.applyCelestialPaletteTint === 'function') {
            window.globeController.globeView.applyCelestialPaletteTint(normalized);
        }
        if (typeof window.globeController.globeView.updateRimGlowPalette === 'function') {
            window.globeController.globeView.updateRimGlowPalette(normalized);
        }
    }

    if (window.globeController && window.globeController.sceneModel) {
        const bgColor = isGray ? 0x0f0f0f : isCrimson ? 0x14080c : isNulled ? 0x100818 : 0x050d18;
        window.globeController.sceneModel.setBackgroundColor(bgColor);
    }

    if (window.globeController?.transportModel) {
        applyCurrentPaletteToTransportVehicles(window.globeController.transportModel);
    }

    if (window.globeController?.sceneModel) {
        applyPaletteToExistingEventMarkers(window.globeController.sceneModel);
    }

    playColorChangeSound();

    notifyMusicDefaultPaletteChange(previousPalette, normalized);

    closePaletteMenu();
}
