/**
 * Data Archive sound effects utilities.
 * Consolidated sound effects for category interactions and UI feedback.
 */

/**
 * Play category selection sound effect.
 * Reuses the same Event Manager sound for consistency.
 */
export function playStoryArchiveCategorySfx() {
    const sfx = window.SoundEffectsManager;
    if (!sfx) return;
    if (sfx.sounds && sfx.sounds.eventManager) {
        sfx.play('eventManager');
        return;
    }
    if (typeof sfx.loadSound === 'function') {
        sfx.loadSound('eventManager', 'src/assets/audio/sfx/Event Manager.mp3');
        setTimeout(() => {
            if (sfx.sounds && sfx.sounds.eventManager) {
                sfx.play('eventManager');
            }
        }, 60);
    }
}

/**
 * Play filter interaction sound effect.
 * Used for filter panel interactions.
 */
export function playFilterInteractionSfx() {
    const sfx = window.SoundEffectsManager;
    if (!sfx) return;
    if (sfx.sounds && sfx.sounds.filterPick) {
        sfx.play('filterPick');
    }
}

/**
 * Play mode transition sound effect.
 * Used for switching between Data Archive modes.
 */
export function playModeTransitionSfx() {
    const sfx = window.SoundEffectsManager;
    if (!sfx) return;
    if (sfx.sounds && sfx.sounds.modeSwitch) {
        sfx.play('modeSwitch');
    }
}
