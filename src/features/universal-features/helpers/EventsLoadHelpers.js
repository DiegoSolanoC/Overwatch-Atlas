/**
 * EventsLoadHelpers - Utilities for loading events components
 * Extracted from component-loader.js to reduce duplication
 */

import { createGlobeControlButton } from './ComponentLoadHelpers.js';
import { getOrCreateElement, createEventPagination, createFiltersPanel } from './ComponentDOMHelpers.js';
import { initializeEventManager, setupEventManagerListeners, syncEventsWithGlobe, verifyEventPanels } from './EventManagerHelpers.js';
import { loadSoundEffect, loadSoundEffects } from './ComponentLoadHelpers.js';
import { updateStatus } from '../managers/StatusManager.js';

/**
 * Sets up all event-related UI components
 * @param {Object} params - Parameters
 * @param {Function} params.updateStatus - Status update function
 */
export function setupEventUIComponents({ updateStatus }) {
    // NOTE: All Event System UI (buttons, pagination, filters panel) are now created by
    // standalone Event System Load Out only (MenuServiceHelpers.js / MenuHelpers.js)
    // Globe no longer creates any event-related UI - it relies entirely on standalone
    
    // This function is kept for backwards compatibility but does nothing
    // as standalone Event System handles all event UI creation
    updateStatus('→ Event UI handled by standalone Event System', 'info');
}

/**
 * Loads all event-related sound effects
 */
export function loadEventSoundEffects() {
    loadSoundEffects([
        { name: 'filterPick', path: 'src/assets/audio/sfx/Filter Pick.mp3' },
        { name: 'filterOff', path: 'src/assets/audio/sfx/Filter Off.mp3' },
        { name: 'filterConfirm', path: 'src/assets/audio/sfx/Filter Confirm.mp3' },
        { name: 'filterClear', path: 'src/assets/audio/sfx/Filter Clear.mp3' },
        { name: 'filterButton', path: 'src/assets/audio/sfx/Filter Button.mp3' },
        { name: 'eventClick', path: 'src/assets/audio/sfx/Event Click.mp3' },
        { name: 'eventManager', path: 'src/assets/audio/sfx/Event Manager.mp3' },
        { name: 'switchEvent', path: 'src/assets/audio/sfx/Switch Event.mp3' },
        { name: 'page', path: 'src/assets/audio/sfx/Page.mp3' }
    ], 'Loading event sound effects...');
}

/**
 * Initializes filter panel functionality
 * @param {Function} updateStatus - Status update function
 */
export function initializeFilterPanel(updateStatus) {
    updateStatus('Initializing filter panel...', 'info');
    if (window.FilterService && typeof window.FilterService.init === 'function') {
        window.FilterService.init();
        updateStatus('✓ Filter panel initialized', 'success');
    } else {
        updateStatus('⚠ FilterService not found - filter panel may not work', 'error');
    }
}

/**
 * Sets up event manager listeners after a delay
 * @param {Object} eventManager - EventManager instance
 * @param {Function} setupEventManagerListeners - Function to setup listeners
 */
export function setupEventListenersDelayed(eventManager, setupEventManagerListeners) {
    if (eventManager) {
        setTimeout(() => {
            setupEventManagerListeners(eventManager);
        }, 50);
    }
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.EventsLoadHelpers) {
        window.EventsLoadHelpers = {};
    }
    window.EventsLoadHelpers.setupEventUIComponents = setupEventUIComponents;
    window.EventsLoadHelpers.loadEventSoundEffects = loadEventSoundEffects;
    window.EventsLoadHelpers.initializeFilterPanel = initializeFilterPanel;
    window.EventsLoadHelpers.setupEventListenersDelayed = setupEventListenersDelayed;
}
