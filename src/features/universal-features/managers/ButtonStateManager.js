/**
 * ButtonStateManager - Handles button state management
 * Extracted from component-loader.js to improve maintainability
 */

/**
 * Set button state (loading, loaded, default)
 * @param {string} buttonId - ID of the button element
 * @param {string} state - Button state ('loading', 'loaded', 'default')
 */
export function setButtonState(buttonId, state) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    
    btn.classList.remove('loading', 'loaded');
    if (state === 'loading') {
        btn.classList.add('loading');
        btn.disabled = true;
    } else if (state === 'loaded') {
        btn.classList.add('loaded');
        btn.disabled = false;
    } else {
        btn.disabled = false;
    }
}
