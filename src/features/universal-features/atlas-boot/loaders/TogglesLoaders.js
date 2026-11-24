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

function isAtlasLocalhost() {
    try {
        const host = window.location.hostname || '';
        return host === 'localhost' || host === '127.0.0.1';
    } catch {
        return false;
    }
}

function ensureWorldDevRouteTogglesHost() {
    let host = document.getElementById('worldDevRouteToggles');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'worldDevRouteToggles';
    host.className = 'world-dev-route-toggles';
    host.setAttribute('aria-label', 'Dev route toggles');
    document.body.appendChild(host);
    return host;
}

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

        /*
         * Flights / Sea lanes — localhost-only dev tools. Park under the header
         * (same band as Codex Edit), text chips, never on GitHub Pages.
         */
        if (isAtlasLocalhost()) {
            ensureWorldDevRouteTogglesHost();
            createHeaderHubButton({
                id: 'planeRoutesToggle',
                className: 'atlas-dev-text-chip plane-routes-btn',
                title: 'Toggle flight routes (dev)',
                label: 'Flights',
                iconPath: null,
                iconAlt: '',
                parentId: 'worldDevRouteToggles',
                baseClass: 'globe-control-btn',
                iconSpanId: 'planeRoutesIcon',
                headerOrder: 20,
                mobileParentId: 'worldDevRouteToggles',
                mobileBaseClass: 'globe-control-btn',
                mobileClassName: 'atlas-dev-text-chip plane-routes-btn',
            });

            createHeaderHubButton({
                id: 'boatRoutesToggle',
                className: 'atlas-dev-text-chip boat-routes-btn',
                title: 'Toggle sail routes (dev)',
                label: 'Sails',
                iconPath: null,
                iconAlt: '',
                parentId: 'worldDevRouteToggles',
                baseClass: 'globe-control-btn',
                iconSpanId: 'boatRoutesIcon',
                headerOrder: 30,
                mobileParentId: 'worldDevRouteToggles',
                mobileBaseClass: 'globe-control-btn',
                mobileClassName: 'atlas-dev-text-chip boat-routes-btn',
            });
        } else {
            document.getElementById('planeRoutesToggle')?.remove();
            document.getElementById('boatRoutesToggle')?.remove();
            document.getElementById('worldDevRouteToggles')?.remove();
        }

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
            if (isAtlasLocalhost()) {
                controller.uiView.setupPlaneRoutesToggle((visible) => {
                    controller.globeView?.setTransportRoutesVisible?.('plane', visible);
                });
                controller.uiView.setupBoatRoutesToggle((visible) => {
                    controller.globeView?.setTransportRoutesVisible?.('boat', visible);
                });
            }
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
        [
            'hyperloopToggle',
            'weatherEffectsToggle',
            'lightingToggle',
            'planeRoutesToggle',
            'boatRoutesToggle',
            'worldDevRouteToggles',
        ].forEach((id) => {
            document.getElementById(id)?.remove();
        });
        updateStatus('✓ Toggles removed', 'success');

        loadedComponents.transport = false;
    }, 'Toggles', 'loadTogglesBtn');
}
