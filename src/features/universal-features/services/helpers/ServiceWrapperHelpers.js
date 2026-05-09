/**
 * ServiceWrapperHelpers - Wrapper utilities for ComponentLoaderService load/unload functions
 * Extracted to reduce repetitive try/catch/overlay/button state management
 */

/**
 * Wraps a load function with standard overlay, button state, and error handling
 * @param {Function} loadFn - The async load function to execute
 * @param {Object} params - Parameters
 * @param {string} params.componentName - Component name (e.g., 'Palette')
 * @param {string} params.buttonId - Button ID (e.g., 'loadPaletteBtn')
 * @param {boolean} params.isRunOperation - Whether this is a run operation
 * @param {Object} params.overlayService - Overlay service
 * @param {Object} params.buttonStateService - Button state service
 * @param {Object} params.statusService - Status service
 * @param {Function} params.setLoaded - Function to set loadedComponents flag
 * @returns {Promise<void>}
 */
export async function withLoadWrapper(loadFn, { componentName, buttonId, isRunOperation, overlayService, buttonStateService, statusService, setLoaded }) {
    // Show overlay if not in run operation
    if (!isRunOperation) {
        overlayService.show();
    }
    buttonStateService.setState(buttonId, 'loading');
    statusService.update(`Starting ${componentName} load...`, 'info');
    
    try {
        await loadFn();
        setLoaded(true);
        buttonStateService.setState(buttonId, 'loaded');
        statusService.update(`✓ ${componentName} components fully loaded!`, 'success');
    } catch (error) {
        console.error(`Error loading ${componentName}:`, error);
        statusService.update(`✗ Error loading ${componentName}: ${error.message}`, 'error');
        buttonStateService.setState(buttonId, 'error');
        throw error;
    } finally {
        if (!isRunOperation) {
            overlayService.hide();
        }
    }
}

/**
 * Wraps an unload function with standard error handling and status updates
 * @param {Function} unloadFn - The async unload function to execute
 * @param {Object} params - Parameters
 * @param {string} params.componentName - Component name (e.g., 'Palette')
 * @param {string} params.buttonId - Button ID (e.g., 'loadPaletteBtn')
 * @param {Object} params.buttonStateService - Button state service
 * @param {Object} params.statusService - Status service
 * @param {Function} params.setLoaded - Function to set loadedComponents flag
 * @returns {Promise<void>}
 */
export async function withUnloadWrapper(unloadFn, { componentName, buttonId, buttonStateService, statusService, setLoaded }) {
    statusService.update(`Unloading ${componentName}...`, 'info');
    
    try {
        await unloadFn();
        setLoaded(false);
        buttonStateService.setState(buttonId, 'default');
        statusService.update(`✓ ${componentName} components unloaded!`, 'success');
    } catch (error) {
        console.error(`Error unloading ${componentName}:`, error);
        statusService.update(`✗ Error unloading ${componentName}: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Checks if component is already loaded and returns early if so
 * @param {boolean} isLoaded - Whether component is loaded
 * @param {string} componentName - Component name
 * @param {Object} statusService - Status service
 * @returns {boolean} - True if already loaded (should return early)
 */
export function checkAlreadyLoaded(isLoaded, componentName, statusService) {
    if (isLoaded) {
        statusService.update(`→ ${componentName} already loaded!`, 'info');
        return true;
    }
    return false;
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.ServiceWrapperHelpers) {
        window.ServiceWrapperHelpers = {};
    }
    window.ServiceWrapperHelpers.withLoadWrapper = withLoadWrapper;
    window.ServiceWrapperHelpers.withUnloadWrapper = withUnloadWrapper;
    window.ServiceWrapperHelpers.checkAlreadyLoaded = checkAlreadyLoaded;
}
