/**
 * ControlsLoaders — load/unload pair for the globe rail's Map view, Auto-
 * Rotation, and Exit controls.
 *
 * `loadControls` creates the `mapViewToggle` and `autoRotateToggle` buttons
 * (this is the sole owner of those two — `TogglesLoaders` used to mirror
 * them, but that just made unload asymmetric), creates the Exit button
 * (which kills globe components and returns to the menu), wires the
 * rotation/map handlers on the globe view, and loads the rotation SFX.
 *
 * The Exit button delegation goes through `window.modeOrchestrator`
 * instead of a direct import so this module stays free of the orchestrator
 * cycle (the orchestrator already imports this loader).
 */

import {
    withLoadLifecycle,
    withUnloadLifecycle,
    checkAlreadyLoaded
} from '../../atlas-shared-ui/loading/LoadingLifecycle.js';
import { loadSoundEffect } from '../../atlas-sound-effects/loadSoundEffects.js';
import { createHeaderHubButton } from '../../atlas-header/HeaderHubButton.js';
import { requireGlobeBase } from '../../../world/worldview-mode-entry/WorldviewRequireGlobe.js';
import { removeElementsByIds } from '../../atlas-shared-ui/dom/removeElement.js';
import { createExitButton } from '../../atlas-shared-ui/AtlasExitButton.js';
import { updateStatus } from '../../atlas-mode-runtime/statusFeed.js';
import {
    getRunOperation,
    setRunOperation
} from '../../atlas-mode-runtime/loadingOverlayState.js';

export async function loadControls(loadedComponents) {
    if (checkAlreadyLoaded(loadedComponents.controls, 'Controls')) {
        return;
    }

    if (!requireGlobeBase('loadControlsBtn', loadedComponents)) {
        return;
    }

    await withLoadLifecycle(async () => {
        const controller = window.globeController;

        createHeaderHubButton({
            id: 'mapViewToggle',
            className: 'dock-globe-rail__btn',
            title: 'Toggle Map View',
            label: 'Map',
            iconPath: 'src/assets/images/Icons/Worldview%20Icons/Switch%20to%20Globe%20Icon.png',
            iconAlt: 'Globe',
            parentId: 'dockGlobeRailLeft',
            baseClass: 'globe-control-btn',
            iconSpanId: 'mapViewToggleIcon',
            headerOrder: 10,
            mobileParentId: 'dockGlobeRailLeft',
            mobileBaseClass: 'globe-control-btn',
            mobileClassName: 'dock-globe-rail__btn'
        });

        createHeaderHubButton({
            id: 'autoRotateToggle',
            className: 'dock-globe-rail__btn',
            title: 'Toggle Auto-Rotation',
            label: 'Rotation',
            iconPath: 'src/assets/images/Icons/Worldview%20Icons/Rotation%20Icon.png',
            iconAlt: 'Rotate',
            parentId: 'dockGlobeRailLeft',
            baseClass: 'globe-control-btn',
            iconSpanId: 'rotateIcon',
            headerOrder: 50,
            mobileParentId: 'dockGlobeRailLeft',
            mobileBaseClass: 'globe-control-btn',
            mobileClassName: 'dock-globe-rail__btn'
        });

        // Exit button needs `killGlobeComponents` from the orchestrator. We
        // pull it off `window` to avoid a circular import — the orchestrator
        // already depends on this loader.
        createExitButton(setRunOperation, () => window.modeOrchestrator?.killGlobeComponents());

        if (controller.uiView) {
            controller.uiView.setupAutoRotateToggle();
            if (typeof controller.uiView.setupMapViewToggle === 'function') {
                controller.uiView.setupMapViewToggle();
            }
            updateStatus('✓ Rotation toggle initialized', 'success');
        }

        loadSoundEffect('rotationToggle', 'src/assets/audio/sfx/Rotation Toggle.mp3', 'Loading rotation sound effect...');

        loadedComponents.controls = true;
    }, 'Controls', 'loadControlsBtn', getRunOperation());
}

export async function unloadControls(loadedComponents) {
    if (!loadedComponents.controls) {
        updateStatus('Controls not loaded', 'info');
        return;
    }

    await withUnloadLifecycle(async () => {
        removeElementsByIds([
            { id: 'autoRotateToggle', message: 'Rotation toggle removed' },
            { id: 'mapViewToggle', message: 'Map view toggle removed' },
            { id: 'exitButton', message: 'Exit button removed' }
        ]);

        loadedComponents.controls = false;
    }, 'Controls', 'loadControlsBtn');
}
