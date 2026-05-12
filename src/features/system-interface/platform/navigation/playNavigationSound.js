/**
 * Plays a sound effect if SoundEffectsManager is available.
 * @param {string} soundName
 */
export function playNavigationSound(soundName) {
    if (window.SoundEffectsManager) {
        window.SoundEffectsManager.play(soundName);
    }
}
