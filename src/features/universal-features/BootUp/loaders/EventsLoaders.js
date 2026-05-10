/**
 * EventsLoaders — load/unload pair for the event system (markers, panels,
 * pagination, filters, EventManager).
 *
 * `loadEvents` requires the globe base, then initializes the
 * `EventManager`, mounts the event UI components, syncs events with the
 * globe twice (markers want pagination DOM present, then a final sync
 * after listeners are wired), and loads all event-related SFX.
 *
 * `unloadEvents` removes the event UI elements, clears `window.eventManager`
 * and removes globe markers via the universal cleanup helpers.
 */

import {
    withLoadLifecycle,
    withUnloadLifecycle,
    checkAlreadyLoaded
} from '../../ComponentSetUp/LoadingLifecycle.js';
import { requireGlobeBase } from '../../../Interactive-Worldview/application/requireGlobeBase.js';
import { removeElementsByIds } from '../../ComponentSetUp/removeElement.js';
import { updateStatus } from '../../managers/StatusManager.js';
import { getRunOperation } from '../../managers/LoadingOverlayManager.js';
import {
    initializeEventManager,
    setupEventManagerListeners,
    syncEventsWithGlobe
} from '../../../system-interface/services/EventManagerHelpers.js';
import {
    clearEventManager,
    removeAllEventMarkers
} from '../../../system-interface/services/EventCleanupHelpers.js';
import {
    setupEventUIComponents,
    loadEventSoundEffects,
    initializeFilterPanel,
    setupEventListenersDelayed
} from '../../../system-interface/services/EventsLoadHelpers.js';

export async function loadEvents(loadedComponents) {
    if (checkAlreadyLoaded(loadedComponents.events, 'Events')) {
        return;
    }

    if (!requireGlobeBase('loadEventsBtn', loadedComponents)) {
        return;
    }

    await withLoadLifecycle(async () => {
        window.eventManager = await initializeEventManager();

        // Pagination + header controls must exist before UIView binds
        // number buttons / hover preview.
        setupEventUIComponents({ updateStatus });

        const filtersToggleBtn = document.getElementById('filtersToggle');
        if (filtersToggleBtn) {
            filtersToggleBtn.style.setProperty('display', 'flex', 'important');
        }

        // First sync: pagination DOM is present so markers can bind.
        syncEventsWithGlobe(window.globeController, window.eventManager);

        loadEventSoundEffects();
        initializeFilterPanel(updateStatus);
        setupEventListenersDelayed(window.eventManager, setupEventManagerListeners);

        // Second sync: after listeners are wired so any state changes flow
        // through to the globe.
        syncEventsWithGlobe(window.globeController, window.eventManager);

        loadedComponents.events = true;
    }, 'Events', 'loadEventsBtn', getRunOperation());
}

export async function unloadEvents(loadedComponents) {
    if (!loadedComponents.events) {
        updateStatus('Events not loaded', 'info');
        return;
    }

    await withUnloadLifecycle(async () => {
        // Universal header chrome (timeline / codex / home) survives mode
        // switches; only event-system-specific UI is removed here.
        removeElementsByIds([
            { id: 'filtersToggle', message: 'Filter button removed' },
            { id: 'eventsManageToggle', message: 'Event manager button removed' },
            { id: 'eventPagination', message: 'Event pagination removed' },
            { id: 'filtersPanel', message: null, checkParent: true },
            { id: 'paginationDock', message: 'Pagination dock removed' },
            { id: 'paginationDockCollapseStrip', message: 'Pagination dock collapse strip removed' }
        ]);

        clearEventManager();
        removeAllEventMarkers();

        loadedComponents.events = false;
    }, 'Events', 'loadEventsBtn');
}
