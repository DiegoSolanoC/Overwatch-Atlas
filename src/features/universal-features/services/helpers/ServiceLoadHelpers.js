/**
 * ServiceLoadHelpers - Utilities for ComponentLoaderService
 * Service-compatible versions of component loading helpers
 */

import { createGlobeControlButton as appCreateGlobeControlButton } from '../../helpers/ComponentLoadHelpers.js';

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    window.ServiceLoadHelpers = {};
}

/**
 * Creates a standard globe control button (service-compatible).
 * Delegates to app helpers so desktop/mobile responsive mounting matches component-loader.
 */
export function createGlobeControlButton(config, _statusService) {
    return appCreateGlobeControlButton(config);
}

// Export for module systems and make available globally
if (typeof window !== 'undefined') {
    window.ServiceLoadHelpers.createGlobeControlButton = createGlobeControlButton;
}

/**
 * Loads a sound effect (service-compatible)
 * @param {string} soundName - Name of the sound effect
 * @param {string} soundPath - Path to the sound file
 * @param {Object} statusService - Status service for updates
 * @returns {boolean} - True if sound was loaded successfully
 */
export function loadSoundEffect(soundName, soundPath, statusService) {
    if (!window.SoundEffectsManager) {
        return false;
    }
    
    if (statusService) {
        statusService.update(`Loading ${soundName} sound effect...`, 'info');
    }
    
    window.SoundEffectsManager.loadSound(soundName, soundPath);
    
    if (statusService) {
        statusService.update(`✓ ${soundName} sound effect loaded`, 'success');
    }
    
    return true;
}

/**
 * Checks if globe base is loaded (service-compatible)
 * @param {Object} loadedComponents - The loadedComponents object
 * @param {string} buttonId - Button ID for error state
 * @param {Object} statusService - Status service for updates
 * @param {Object} buttonStateService - Button state service
 * @returns {boolean} - True if globe base is loaded
 */
export function requireGlobeBase(loadedComponents, buttonId, statusService, buttonStateService) {
    if (!loadedComponents?.globeBase || !window.globeController) {
        if (statusService) {
            statusService.update('⚠ Globe base must be loaded first!', 'error');
        }
        if (buttonId && buttonStateService) {
            buttonStateService.setState(buttonId, 'error');
        }
        return false;
    }
    return true;
}
