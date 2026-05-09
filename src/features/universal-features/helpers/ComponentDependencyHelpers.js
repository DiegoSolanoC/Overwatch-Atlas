/**
 * ComponentDependencyHelpers - Utilities for checking component dependencies
 * Extracted from component-loader.js to reduce duplication
 */

import { updateStatus } from '../managers/StatusManager.js';
import { setButtonState } from '../managers/ButtonStateManager.js';

/**
 * Checks if globe base is loaded, shows error if not
 * @param {string} buttonId - Button ID for error state
 * @param {Object} loadedComponents - The loadedComponents object to check
 * @returns {boolean} - True if globe base is loaded, false otherwise
 */
export function requireGlobeBase(buttonId, loadedComponents) {
    if (!loadedComponents?.globeBase || !window.globeController) {
        updateStatus('⚠ Globe base must be loaded first!', 'error');
        if (buttonId) {
            setButtonState(buttonId, 'error');
        }
        return false;
    }
    return true;
}
