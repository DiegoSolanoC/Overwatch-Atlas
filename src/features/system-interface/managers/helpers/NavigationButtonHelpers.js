/**
 * NavigationButtonHelpers - Button utilities for event navigation
 */

/**
 * Clones a button element to remove all event listeners
 * @param {HTMLElement} button - Button element to clone
 * @returns {HTMLElement} - New cloned button element
 */
export function cloneButton(button) {
    if (!button || !button.parentNode) {
        return button;
    }
    const clone = button.cloneNode(true);
    button.parentNode.replaceChild(clone, button);
    // Elements without id: getElementById('') is unreliable; return the clone we just inserted
    if (!button.id) return clone;
    return document.getElementById(button.id) || clone;
}

/**
 * Clones multiple buttons by their IDs
 * @param {Array<string>} buttonIds - Array of button IDs to clone
 * @returns {Object} - Object with button IDs as keys and cloned elements as values
 */
export function cloneButtons(buttonIds) {
    const cloned = {};
    buttonIds.forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            cloned[id] = cloneButton(button);
        }
    });
    return cloned;
}

/**
 * Plays a sound effect if SoundEffectsManager is available
 * @param {string} soundName - Name of sound to play
 */
export function playNavigationSound(soundName) {
    if (window.SoundEffectsManager) {
        window.SoundEffectsManager.play(soundName);
    }
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.NavigationButtonHelpers) {
        window.NavigationButtonHelpers = {};
    }
    window.NavigationButtonHelpers.cloneButton = cloneButton;
    window.NavigationButtonHelpers.cloneButtons = cloneButtons;
    window.NavigationButtonHelpers.playNavigationSound = playNavigationSound;
}
