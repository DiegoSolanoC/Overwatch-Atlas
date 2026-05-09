/**
 * EventPanelHelpers - Utilities for verifying event panels exist
 * Extracted from ComponentLoaderService to reduce duplication
 */

import { syncEventsWithGlobeCore } from '../../integration/syncEventsWithGlobeCore.js';

/**
 * Verifies that required event panels exist in the DOM
 * @param {Object} statusService - Status service for updates
 */
export function verifyEventPanels(statusService) {
    const panels = [
        { id: 'eventSlide', name: 'Event slide panel' },
        { id: 'eventImageOverlay', name: 'Event image overlay' },
        { id: 'eventsManagePanel', name: 'Event manager panel' }
    ];
    
    panels.forEach(({ id, name }) => {
        const element = document.getElementById(id);
        if (!element) {
            if (statusService) {
                statusService.update(`⚠ ${name} not found in HTML`, 'error');
            }
        } else {
            if (statusService) {
                statusService.update(`✓ ${name} found`, 'success');
            }
        }
    });
}

/**
 * Sets up event listeners for event manager with retry logic
 * @param {Object} eventManager - EventManager instance
 * @param {Object} statusService - Status service for updates
 */
export function setupEventManagerListeners(eventManager, statusService) {
    if (!eventManager) {
        return;
    }
    
    statusService.update('Setting up event listeners for add/edit functionality...', 'info');
    const panel = document.getElementById('eventsManagePanel');
    const addBtn = document.getElementById('addEventBtn');

    if (panel && addBtn) {
        setTimeout(() => {
            eventManager.setupEventListeners();
            statusService.update('✓ Event listeners set up - add/edit functionality ready', 'success');
        }, 50);
    } else {
        statusService.update(`⚠ Some elements not found! Panel: ${!!panel}, AddBtn: ${!!addBtn}`, 'error');
        setTimeout(() => {
            if (eventManager) {
                const retryPanel = document.getElementById('eventsManagePanel');
                const retryAddBtn = document.getElementById('addEventBtn');
                if (retryPanel && retryAddBtn) {
                    eventManager.setupEventListeners();
                    statusService.update('✓ Event listeners set up (retry successful)', 'success');
                } else {
                    statusService.update(`✗ Failed to set up event listeners - elements still missing`, 'error');
                }
            }
        }, 200);
    }
}

/**
 * Syncs events with globe and sets up pagination
 * @param {Object} globeController - GlobeController instance
 * @param {Object} eventManager - EventManager instance
 * @param {Object} statusService - Status service for updates
 */
export function syncEventsWithGlobe(globeController, eventManager, statusService) {
    const notify =
        statusService && typeof statusService.update === 'function'
            ? (msg, level) => statusService.update(msg, level)
            : undefined;
    syncEventsWithGlobeCore(globeController, eventManager, notify);
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.ServiceEventPanelHelpers) {
        window.ServiceEventPanelHelpers = {};
    }
    window.ServiceEventPanelHelpers.verifyEventPanels = verifyEventPanels;
    window.ServiceEventPanelHelpers.setupEventManagerListeners = setupEventManagerListeners;
    window.ServiceEventPanelHelpers.syncEventsWithGlobe = syncEventsWithGlobe;
}
