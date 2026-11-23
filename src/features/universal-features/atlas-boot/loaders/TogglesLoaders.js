/**
 * TogglesLoaders — load/unload pair for the globe transport / weather /
 * lighting toggle buttons that live on the globe rail.
 *
 * `loadToggles` requires the globe base to be loaded first (gated by
 * `requireGlobeBase`). It mounts Vehicles / Weather / Lighting / Flights /
 * Sea lanes buttons, wires handlers on the globe view, loads related SFX,
 * and syncs transport visibility. `unloadToggles` removes those buttons.
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
} from '../../atlas-shared-ui/loading/LoadingLifecycle.js';
import { loadSoundEffect } from '../../atlas-sound-effects/loadSoundEffects.js';
import { createHeaderHubButton } from '../../atlas-header/HeaderHubButton.js';
import { requireGlobeBase } from '../../../world/worldview-mode-entry/WorldviewRequireGlobe.js';
import { updateStatus } from '../../atlas-mode-runtime/statusFeed.js';
import { getRunOperation } from '../../atlas-mode-runtime/loadingOverlayState.js';
import { reflowDockTrapFlankButtons } from '../../../system-interface/interface-bottom-dock/dockTrapezoidCap.js';

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
            className: 'hyperloop-btn dock-trap-flank__btn',
            title: 'Toggle hyperloop',
            label: 'Vehicles',
            iconPath: 'src/assets/images/Icons/Worldview%20Icons/Train%20Icon.png',
            iconAlt: 'Transport',
            parentId: 'dockTrapFlankLeft',
            baseClass: 'globe-control-btn',
            iconSpanId: 'hyperloopIcon',
            headerOrder: 40,
            /* Mobile: top mode rail with Map/Flights/Ports — keep white flank style class */
            mobileParentId: 'dockGlobeRailLeft',
            mobileBaseClass: 'globe-control-btn',
            mobileClassName: 'hyperloop-btn dock-trap-flank__btn'
        });

        createHeaderHubButton({
            id: 'weatherEffectsToggle',
            className: 'weather-effects-btn dock-trap-flank__btn',
            title: 'Toggle weather',
            label: 'Weather',
            iconPath: 'src/assets/images/Icons/Worldview%20Icons/Weather%20Icon.png',
            iconAlt: 'Weather',
            parentId: 'dockTrapFlankLeft',
            baseClass: 'globe-control-btn',
            iconSpanId: 'weatherEffectsIcon',
            headerOrder: 50,
            mobileParentId: 'dockGlobeRailLeft',
            mobileBaseClass: 'globe-control-btn',
            mobileClassName: 'weather-effects-btn dock-trap-flank__btn'
        });

        createHeaderHubButton({
            id: 'lightingToggle',
            className: 'lighting-btn dock-trap-flank__btn',
            title: 'Toggle Lighting',
            label: 'Lighting',
            iconPath: 'src/assets/images/Icons/Worldview%20Icons/Lighting%20Icon.png',
            iconAlt: 'Lighting',
            parentId: 'dockTrapFlankRight',
            baseClass: 'globe-control-btn',
            iconSpanId: 'lightingIcon',
            headerOrder: 60,
            mobileParentId: 'dockGlobeRailLeft',
            mobileBaseClass: 'globe-control-btn',
            mobileClassName: 'lighting-btn dock-trap-flank__btn'
        });

        createHeaderHubButton({
            id: 'planeRoutesToggle',
            className: 'plane-routes-btn dock-globe-rail__btn',
            title: 'Toggle flight routes',
            label: 'Flights',
            iconPath: 'src/assets/images/Icons/Utility%20Icons/Arrow%20Icon.png',
            iconAlt: 'Flight routes',
            parentId: 'dockGlobeRailLeft',
            baseClass: 'globe-control-btn',
            iconSpanId: 'planeRoutesIcon',
            headerOrder: 20,
            mobileParentId: 'dockGlobeRailLeft',
            mobileBaseClass: 'globe-control-btn',
            mobileClassName: 'plane-routes-btn dock-globe-rail__btn'
        });

        createHeaderHubButton({
            id: 'boatRoutesToggle',
            className: 'boat-routes-btn dock-globe-rail__btn',
            title: 'Toggle boat routes',
            label: 'Sea lanes',
            iconPath: 'src/assets/images/Icons/Filter%20Icons/Location%20Icon.png',
            iconAlt: 'Boat routes',
            parentId: 'dockGlobeRailLeft',
            baseClass: 'globe-control-btn',
            iconSpanId: 'boatRoutesIcon',
            headerOrder: 30,
            mobileParentId: 'dockGlobeRailLeft',
            mobileBaseClass: 'globe-control-btn',
            mobileClassName: 'boat-routes-btn dock-globe-rail__btn'
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
            controller.uiView.setupPlaneRoutesToggle((visible) => {
                controller.globeView?.setTransportRoutesVisible?.('plane', visible);
            });
            controller.uiView.setupBoatRoutesToggle((visible) => {
                controller.globeView?.setTransportRoutesVisible?.('boat', visible);
            });
            updateStatus('✓ Toggles initialized', 'success');
        }

        loadSoundEffect('transportToggle', 'src/assets/audio/sfx/Transport Toggle.mp3', 'Loading toggle sound effect...');
        loadSoundEffect('weather', 'src/assets/audio/sfx/Weather.mp3', 'Loading weather sound effect...');
        loadSoundEffect('light', 'src/assets/audio/sfx/light.mp3', 'Loading lighting sound effect...');

        if (controller.transportView) {
            controller.transportView.updateHyperloopVisibility();
        }

        reflowDockTrapFlankButtons();
        loadedComponents.transport = true;
    }, 'Toggles', 'loadTogglesBtn', getRunOperation());
}

export async function unloadToggles(loadedComponents) {
    if (!loadedComponents.transport) {
        updateStatus('Toggles not loaded', 'info');
        return;
    }

    await withUnloadLifecycle(async () => {
        ['hyperloopToggle', 'weatherEffectsToggle', 'lightingToggle', 'planeRoutesToggle', 'boatRoutesToggle'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
        updateStatus('✓ Toggles removed', 'success');

        loadedComponents.transport = false;
    }, 'Toggles', 'loadTogglesBtn');
}
