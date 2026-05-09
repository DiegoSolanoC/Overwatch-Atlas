/**
 * EventSoundHelpers - Utilities for loading event sound effects
 * Extracted from ComponentLoaderService to reduce duplication
 */

/**
 * Loads all event sound effects
 * @param {Function} loadSoundEffect - Function to load individual sound effects
 * @param {Object} statusService - Status service for updates
 */
export function loadEventSoundEffects(loadSoundEffect, statusService) {
    if (statusService) {
        statusService.update('Loading event sound effects...', 'info');
    }
    
    const eventSounds = [
        { name: 'filterPick', path: 'src/assets/audio/sfx/Filter Pick.mp3' },
        { name: 'filterOff', path: 'src/assets/audio/sfx/Filter Off.mp3' },
        { name: 'filterConfirm', path: 'src/assets/audio/sfx/Filter Confirm.mp3' },
        { name: 'filterClear', path: 'src/assets/audio/sfx/Filter Clear.mp3' },
        { name: 'filterButton', path: 'src/assets/audio/sfx/Filter Button.mp3' },
        { name: 'eventClick', path: 'src/assets/audio/sfx/Event Click.mp3' },
        { name: 'eventManager', path: 'src/assets/audio/sfx/Event Manager.mp3' },
        { name: 'switchEvent', path: 'src/assets/audio/sfx/Switch Event.mp3' },
        { name: 'page', path: 'src/assets/audio/sfx/Page.mp3' }
    ];
    
    eventSounds.forEach(({ name, path }) => {
        loadSoundEffect(name, path, null); // Don't update status for each one
    });
    
    if (statusService) {
        statusService.update('✓ Event sound effects loaded', 'success');
    }
}

/**
 * Initializes the filter panel
 * @param {Object} statusService - Status service for updates
 */
export function initializeFilterPanel(statusService) {
    if (statusService) {
        statusService.update('Initializing filter panel...', 'info');
    }
    
    if (window.FilterService && typeof window.FilterService.init === 'function') {
        window.FilterService.init();
        if (statusService) {
            statusService.update('✓ Filter panel initialized', 'success');
        }
    } else {
        if (statusService) {
            statusService.update('⚠ FilterService not found - filter panel may not work', 'error');
        }
    }
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.ServiceEventSoundHelpers) {
        window.ServiceEventSoundHelpers = {};
    }
    window.ServiceEventSoundHelpers.loadEventSoundEffects = loadEventSoundEffects;
    window.ServiceEventSoundHelpers.initializeFilterPanel = initializeFilterPanel;
}
