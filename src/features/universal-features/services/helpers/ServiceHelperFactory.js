/**
 * ServiceHelperFactory - Factory for creating wrapper parameters
 * Extracted to reduce repetitive parameter object creation
 */

/**
 * Creates standard load wrapper parameters
 * @param {Object} service - ComponentLoaderService instance
 * @param {string} componentName - Component name
 * @param {string} buttonId - Button ID
 * @param {Function} setLoaded - Function to set loadedComponents flag
 * @returns {Object} - Parameters object for withLoadWrapper
 */
export function createLoadParams(service, componentName, buttonId, setLoaded) {
    return {
        componentName,
        buttonId,
        isRunOperation: service.isRunOperation(),
        overlayService: service.overlayService,
        buttonStateService: service.buttonStateService,
        statusService: service.statusService,
        setLoaded
    };
}

/**
 * Creates standard unload wrapper parameters
 * @param {Object} service - ComponentLoaderService instance
 * @param {string} componentName - Component name
 * @param {string} buttonId - Button ID
 * @param {Function} setLoaded - Function to set loadedComponents flag
 * @returns {Object} - Parameters object for withUnloadWrapper
 */
export function createUnloadParams(service, componentName, buttonId, setLoaded) {
    return {
        componentName,
        buttonId,
        buttonStateService: service.buttonStateService,
        statusService: service.statusService,
        setLoaded
    };
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.ServiceHelperFactory) {
        window.ServiceHelperFactory = {};
    }
    window.ServiceHelperFactory.createLoadParams = createLoadParams;
    window.ServiceHelperFactory.createUnloadParams = createUnloadParams;
}
