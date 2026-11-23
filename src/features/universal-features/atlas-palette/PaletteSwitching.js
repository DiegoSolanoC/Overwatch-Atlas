/**
 * PaletteSwitching — applies a chosen palette across CSS, globe, scene,
 * transport, markers, music bridge, and SFX; persists to `localStorage`.
 */

import { applyCurrentPaletteToTransportVehicles } from '../../world/worldview-shared-assets/utils/TransportPaletteColors.js';
import { applyPaletteToExistingEventMarkers } from '../../system-interface/interface-globe-markers/styling/markerColors.js';
import {
    normalizeSavedPalette,
    applyPaletteBodyClasses,
    updateHeaderWebsiteLogo,
    texturePathForPalette
} from './PaletteConstants.js';
import { updatePaletteMenuActiveState } from './PaletteMenuDom.js';
import { closePaletteMenu } from './PaletteMenuPositioning.js';
import { notifyMusicDefaultPaletteChange } from '../atlas-music/musicPaletteThemes.js';

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

    /* Body classes first so getMarkerColor() / CSS agree before any marker work. */
    applyPaletteBodyClasses(normalized);
    localStorage.setItem('colorPalette', normalized);
    updateHeaderWebsiteLogo(normalized);
    updatePaletteMenuActiveState(normalized);

    const isGray = normalized === 'gray';
    const isCrimson = normalized === 'crimson';
    const isNulled = normalized === 'nulled';

    /* Markers ease in the same turn as the globe — not after a late slap. */
    if (window.globeController?.sceneModel) {
        applyPaletteToExistingEventMarkers(window.globeController.sceneModel);
    }

    if (window.globeController && window.globeController.globeView) {
        const gv = window.globeController.globeView;
        /* Instant accents + earth crossfade in the same turn as CSS body classes. */
        if (typeof gv.applyCelestialPaletteTint === 'function') {
            gv.applyCelestialPaletteTint(normalized);
        }
        if (typeof gv.updateRimGlowPalette === 'function') {
            gv.updateRimGlowPalette(normalized);
        } else if (typeof gv.updateGlobePatternPalette === 'function') {
            gv.updateGlobePatternPalette(normalized);
        }
        gv.changeGlobeTexture(texturePathForPalette('map', normalized));
    }

    if (window.globeController && window.globeController.sceneModel) {
        const bgColor = isGray ? 0x0f0f0f : isCrimson ? 0x14080c : isNulled ? 0x100818 : 0x050d18;
        window.globeController.sceneModel.setBackgroundColor(bgColor);
    }

    if (window.globeController?.transportModel) {
        applyCurrentPaletteToTransportVehicles(window.globeController.transportModel);
    }

    playColorChangeSound();

    notifyMusicDefaultPaletteChange(previousPalette, normalized);

    closePaletteMenu();
}
