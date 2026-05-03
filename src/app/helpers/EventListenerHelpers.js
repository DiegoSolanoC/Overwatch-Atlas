/**
 * EventListenerHelpers - Utilities for setting up event listeners
 * Extracted from component-loader.js to reduce duplication
 */

import { showLoadingOverlay, hideLoadingOverlay } from '../../managers/LoadingOverlayManager.js';
import { updateStatus } from '../../managers/StatusManager.js';
import { openGlobeMapLaunchChoice } from '../../utils/GlobeMapLaunchChoice.js';

/**
 * Creates a run operation handler wrapper
 * @param {Function} asyncFn - The async function to run
 * @param {Function} setIsRunOperation - Function to set run operation flag
 * @returns {Function} - The wrapped event handler
 */
export function createRunOperationHandler(asyncFn, setIsRunOperation) {
    return async function() {
        setIsRunOperation(true);
        showLoadingOverlay();
        try {
            await asyncFn();
        } catch (error) {
            console.error(`Error in ${asyncFn.name}:`, error);
            updateStatus(`✗ Error: ${error.message}`, 'error');
            setIsRunOperation(false);
            hideLoadingOverlay();
        }
    };
}

/**
 * Creates a simple async handler with error handling
 * @param {Function} asyncFn - The async function to run
 * @returns {Function} - The wrapped event handler
 */
export function createAsyncHandler(asyncFn) {
    return async function() {
        try {
            await asyncFn();
        } catch (error) {
            console.error(`Error in ${asyncFn.name}:`, error);
            updateStatus(`✗ Error: ${error.message}`, 'error');
        }
    };
}

/**
 * Sets up a button listener with optional duplicate prevention
 * @param {string} buttonId - ID of the button
 * @param {Function} handler - Event handler function
 * @param {boolean} preventDuplicate - Whether to prevent duplicate listeners
 * @param {string} logName - Name for logging
 */
export function setupButtonListener(buttonId, handler, preventDuplicate = false, logName = null) {
    const button = document.getElementById(buttonId);
    if (!button) {
        if (logName) {
            console.warn(`test-loader.js: ${logName} not found!`);
        }
        return;
    }
    
    if (preventDuplicate && button.hasAttribute('data-listener-attached')) {
        return;
    }
    
    if (preventDuplicate) {
        button.setAttribute('data-listener-attached', 'true');
    }
    
    if (logName) {
        console.log(`test-loader.js: Wiring up ${logName}`);
    }
    
    button.addEventListener('click', handler);
}

/**
 * Sets up all component loader event listeners
 * @param {Object} handlers - Object containing all handler functions
 * @param {Function} setIsRunOperation - Function to set run operation flag
 */
export function setupAllEventListeners(handlers, setIsRunOperation) {
    // Universal features
    setupButtonListener('loadPaletteBtn', handlers.loadPalette);
    setupButtonListener('loadMusicBtn', handlers.loadMusic);
    setupButtonListener('runUniversalBtn', createRunOperationHandler(handlers.runUniversalFeatures, setIsRunOperation));
    setupButtonListener('killUniversalBtn', handlers.killUniversalFeatures);
    
    // Menu components
    setupButtonListener('loadMenuBtn', handlers.loadMenu);
    setupButtonListener('runMenuBtn', createRunOperationHandler(handlers.runMenuComponents, setIsRunOperation), false, 'runMenuBtn');
    setupButtonListener('killMenuBtn', createAsyncHandler(handlers.killMenuComponents));
    
    // Globe components
    setupButtonListener('loadGlobeBaseBtn', createAsyncHandler(handlers.loadGlobeBase), false, 'loadGlobeBaseBtn');
    setupButtonListener('loadTransportBtn', createAsyncHandler(handlers.loadTransport), false, 'loadTransportBtn');
    setupButtonListener('loadControlsBtn', createAsyncHandler(handlers.loadControls), false, 'loadControlsBtn');
    setupButtonListener('loadEventsBtn', createAsyncHandler(handlers.loadEvents), false, 'loadEventsBtn');
    setupButtonListener(
        'runGlobeBtn',
        () =>
            void openGlobeMapLaunchChoice({
                launchGlobe: createRunOperationHandler(handlers.runGlobeComponents, setIsRunOperation)
            }),
        true
    );
    setupButtonListener('killGlobeBtn', createAsyncHandler(handlers.killGlobeComponents));
    
    // Glossary components
    setupButtonListener('runGlossaryBtn', createRunOperationHandler(handlers.runGlossaryComponents, setIsRunOperation), true);
    setupButtonListener('killGlossaryBtn', createAsyncHandler(handlers.killGlossaryComponents));
    
    // Biography components
    setupButtonListener('runBiographyBtn', createRunOperationHandler(handlers.runBiographyComponents, setIsRunOperation), true);
    setupButtonListener('killBiographyBtn', createAsyncHandler(handlers.killBiographyComponents));
}
