/**
 * ComponentUnloadHelpers - Utilities for unloading components
 * Extracted from component-loader.js to reduce duplication in unload functions
 */

import { updateStatus } from '../managers/StatusManager.js';

/**
 * Removes an element by ID and updates status
 * @param {string} elementId - ID of the element to remove
 * @param {string} statusMessage - Status message to show (e.g., "Palette button removed")
 * @param {boolean} checkParent - If true, only remove if element has a parent
 * @returns {boolean} - True if element was found and removed, false otherwise
 */
export function removeElementById(elementId, statusMessage = null, checkParent = false) {
    const element = document.getElementById(elementId);
    if (!element) {
        return false;
    }
    
    // If checkParent is true, only remove if element has a parent
    if (checkParent && !element.parentElement) {
        return false;
    }
    
    element.remove();
    
    if (statusMessage) {
        updateStatus(`✓ ${statusMessage}`, 'success');
    }
    
    return true;
}

/**
 * Removes an element by selector and updates status
 * @param {string} selector - CSS selector for the element to remove
 * @param {string} statusMessage - Status message to show
 * @param {HTMLElement} parentElement - Parent element to search within (optional)
 * @returns {boolean} - True if element was found and removed, false otherwise
 */
export function removeElementBySelector(selector, statusMessage = null, parentElement = document) {
    const element = parentElement.querySelector(selector);
    if (!element) {
        return false;
    }
    
    element.remove();
    
    if (statusMessage) {
        updateStatus(`✓ ${statusMessage}`, 'success');
    }
    
    return true;
}

/**
 * Removes multiple elements by their IDs
 * @param {Array<{id: string, message: string, checkParent?: boolean}>} elements - Array of element configs
 * @returns {number} - Number of elements successfully removed
 */
export function removeElementsByIds(elements) {
    let removedCount = 0;
    elements.forEach(({ id, message, checkParent = false }) => {
        if (removeElementById(id, message, checkParent)) {
            removedCount++;
        }
    });
    return removedCount;
}
