/**
 * MenuLoadHelpers - Utilities for menu loading logic
 * Extracted from ComponentLoaderService to reduce complexity
 */

/**
 * Checks if menu is already loaded and handles early return
 * @param {boolean} isLoaded - Whether menu is loaded
 * @param {boolean} isRunOperation - Whether this is a run operation
 * @param {Object} overlayService - Overlay service
 * @param {Object} statusService - Status service
 * @returns {boolean} - True if already loaded (should return early)
 */
export function checkMenuAlreadyLoaded(isLoaded, isRunOperation, overlayService, statusService) {
    if (isLoaded) {
        if (statusService) {
            statusService.update('✓ Menu components already loaded!', 'success');
        }
        if (!isRunOperation && overlayService) {
            overlayService.hide();
        }
        return true;
    }
    return false;
}

/**
 * Handles case where menu buttons already exist in DOM
 * @param {Object} statusService - Status service
 * @param {Object} buttonStateService - Button state service
 * @param {Function} setLoaded - Function to set loaded state
 * @returns {boolean} - True if menu buttons exist (should return early)
 */
export function handleExistingMenuButtons(statusService, buttonStateService, setLoaded) {
    const existingMenuButtons = document.querySelector('.main-menu-buttons');
    if (existingMenuButtons) {
        if (statusService) {
            statusService.update('Menu buttons already exist, setting up listeners...', 'info');
        }
        if (window.setupMenuButtonListeners) {
            window.setupMenuButtonListeners();
        }
        setLoaded(true);
        if (buttonStateService) {
            buttonStateService.setState('loadMenuBtn', 'loaded');
        }
        if (statusService) {
            statusService.update('✓ Menu components fully loaded!', 'success');
        }
        return true;
    }
    return false;
}

/**
 * Finalizes menu loading by setting state and status
 * @param {Function} setLoaded - Function to set loaded state
 * @param {Object} buttonStateService - Button state service
 * @param {Object} statusService - Status service
 */
export function finalizeMenuLoad(setLoaded, buttonStateService, statusService) {
    setLoaded(true);
    if (buttonStateService) {
        buttonStateService.setState('loadMenuBtn', 'loaded');
    }
    if (statusService) {
        statusService.update('✓ Menu components fully loaded!', 'success');
    }
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.ServiceMenuLoadHelpers) {
        window.ServiceMenuLoadHelpers = {};
    }
    window.ServiceMenuLoadHelpers.checkMenuAlreadyLoaded = checkMenuAlreadyLoaded;
    window.ServiceMenuLoadHelpers.handleExistingMenuButtons = handleExistingMenuButtons;
    window.ServiceMenuLoadHelpers.finalizeMenuLoad = finalizeMenuLoad;
}
