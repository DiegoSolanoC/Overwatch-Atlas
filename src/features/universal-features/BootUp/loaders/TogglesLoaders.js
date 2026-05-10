/**
 * TogglesLoaders — load/unload pair for the globe transport / weather /
 * lighting toggle buttons that live on the globe rail.
 *
 * `loadToggles` requires the globe base to be loaded first (gated by
 * `requireGlobeBase`). It mounts three buttons (Vehicles / Weather /
 * Lighting), wires the corresponding handlers on the globe view, loads
 * the related SFX, and syncs transport visibility. `unloadToggles`
 * removes the same three buttons.
 *
 * Map and Rotation buttons live in `ControlsLoaders` exclusively — they
 * used to be mirrored here as well, but that just made unload asymmetric
 * (load created 5, unload removed 3) and relied on Controls always running
 * in tandem. Single-owner is simpler and removes a leak path.
 */

import {
    withLoadLifecycle,
    withUnloadLifecycle,
    checkAlreadyLoaded
} from '../../ComponentSetUp/LoadingLifecycle.js';
import { loadSoundEffect } from '../../Audio/SoundEffects/SoundEffectsLoaders.js';
import { createHeaderHubButton } from '../header/HeaderHubButton.js';
import { requireGlobeBase } from '../../../Interactive-Worldview/application/requireGlobeBase.js';
import { updateStatus } from '../../managers/StatusManager.js';
import { getRunOperation } from '../../managers/LoadingOverlayManager.js';

export async function loadToggles(loadedComponents) {
    if (checkAlreadyLoaded(loadedComponents.transport, 'Toggles')) {
        return;
    }

    if (!requireGlobeBase('loadTogglesBtn', loadedComponents)) {
        return;
    }

    await withLoadLifecycle(async () => {
        const controller = window.globeController;

        createHeaderHubButton({
            id: 'hyperloopToggle',
            className: 'hyperloop-btn dock-globe-rail__btn',
            title: 'Toggle hyperloop',
            label: 'Vehicles',
            iconPath: 'src/assets/images/Icons/Worldview%20Icons/Train%20Icon.png',
            iconAlt: 'Transport',
            parentId: 'dockGlobeRailLeft',
            baseClass: 'globe-control-btn',
            iconSpanId: 'hyperloopIcon',
            headerOrder: 20,
            mobileParentId: 'dockGlobeRailLeft',
            mobileBaseClass: 'globe-control-btn',
            mobileClassName: 'hyperloop-btn dock-globe-rail__btn'
        });

        createHeaderHubButton({
            id: 'weatherEffectsToggle',
            className: 'weather-effects-btn dock-globe-rail__btn',
            title: 'Toggle weather',
            label: 'Weather',
            iconPath: 'src/assets/images/Icons/Worldview%20Icons/Weather%20Icon.png',
            iconAlt: 'Weather',
            parentId: 'dockGlobeRailLeft',
            baseClass: 'globe-control-btn',
            iconSpanId: 'weatherEffectsIcon',
            headerOrder: 30,
            mobileClassName: 'weather-effects-btn dock-globe-rail__btn'
        });

        createHeaderHubButton({
            id: 'lightingToggle',
            className: 'lighting-btn dock-globe-rail__btn',
            title: 'Toggle Lighting',
            label: 'Lighting',
            iconPath: 'src/assets/images/Icons/Worldview%20Icons/Lighting%20Icon.png',
            iconAlt: 'Lighting',
            parentId: 'dockGlobeRailLeft',
            baseClass: 'globe-control-btn',
            iconSpanId: 'lightingIcon',
            headerOrder: 40,
            mobileParentId: 'dockGlobeRailLeft',
            mobileBaseClass: 'globe-control-btn',
            mobileClassName: 'lighting-btn dock-globe-rail__btn'
        });

        if (controller.uiView) {
            controller.uiView.setupHyperloopToggle(() => {
                if (typeof controller.onHyperloopToggled === 'function') {
                    controller.onHyperloopToggled();
                } else {
                    controller.transportView.updateHyperloopVisibility();
                }
            });
            controller.uiView.setupWeatherEffectsToggle(() => {
                if (controller.globeView) {
                    controller.globeView.setWeatherEffectsVisible(controller.sceneModel.getGlobeWeatherEffectsVisible());
                }
            });
            controller.uiView.setupLightingToggle(() => {
                if (controller.globeView) {
                    controller.globeView.setGlobeLightingVisible(controller.sceneModel.getGlobeLightingVisible());
                }
            });
            updateStatus('✓ Toggles initialized', 'success');
        }

        loadSoundEffect('transportToggle', 'src/assets/audio/sfx/Transport Toggle.mp3', 'Loading toggle sound effect...');
        loadSoundEffect('weather', 'src/assets/audio/sfx/Weather.mp3', 'Loading weather sound effect...');
        loadSoundEffect('light', 'src/assets/audio/sfx/light.mp3', 'Loading lighting sound effect...');

        if (controller.transportView) {
            controller.transportView.updateHyperloopVisibility();
        }

        loadedComponents.transport = true;
    }, 'Toggles', 'loadTogglesBtn', getRunOperation());
}

export async function unloadToggles(loadedComponents) {
    if (!loadedComponents.transport) {
        updateStatus('Toggles not loaded', 'info');
        return;
    }

    await withUnloadLifecycle(async () => {
        ['hyperloopToggle', 'weatherEffectsToggle', 'lightingToggle'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
        updateStatus('✓ Toggles removed', 'success');

        loadedComponents.transport = false;
    }, 'Toggles', 'loadTogglesBtn');
}
