/**
 * ServiceUnloadHelpers - Utilities for ComponentLoaderService unloading
 * Service-compatible versions of component unloading helpers
 */

/**
 * Removes an element by ID and updates status (service-compatible)
 * @param {string} elementId - ID of the element to remove
 * @param {string} statusMessage - Status message to show
 * @param {Object} statusService - Status service for updates
 * @param {boolean} checkParent - If true, only remove if element has a parent
 * @returns {boolean} - True if element was found and removed
 */
export function removeElementById(elementId, statusMessage, statusService, checkParent = false) {
    const element = document.getElementById(elementId);
    if (!element) {
        return false;
    }
    
    if (checkParent && !element.parentElement) {
        return false;
    }
    
    element.remove();
    
    if (statusMessage && statusService) {
        statusService.update(`✓ ${statusMessage}`, 'success');
    }
    
    return true;
}

/**
 * Removes multiple elements by their IDs (service-compatible)
 * @param {Array<{id: string, message: string, checkParent?: boolean}>} elements - Array of element configs
 * @param {Object} statusService - Status service for updates
 * @returns {number} - Number of elements successfully removed
 */
export function removeElementsByIds(elements, statusService) {
    let removedCount = 0;
    elements.forEach(({ id, message, checkParent = false }) => {
        if (removeElementById(id, message, statusService, checkParent)) {
            removedCount++;
        }
    });
    return removedCount;
}

// Export for module systems and make available globally
if (typeof window !== 'undefined') {
    window.ServiceUnloadHelpers.removeElementById = removeElementById;
    window.ServiceUnloadHelpers.removeElementsByIds = removeElementsByIds;
}
