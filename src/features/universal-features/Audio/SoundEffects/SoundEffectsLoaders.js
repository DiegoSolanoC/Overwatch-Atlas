/**
 * SoundEffectsLoaders — thin convenience wrappers over the runtime-global
 * `window.SoundEffectsManager` (mounted by `SoundEffectsManager.js`).
 *
 * These exist so loader files (palette, music, controls, toggles) can declare
 * their sound effects without re-typing the `if (window.SoundEffectsManager)`
 * guard each time, and so failures are surfaced to the status line rather
 * than silently swallowed.
 *
 *   - `loadSoundEffect(name, path, statusMessage?)` — single sound.
 *   - `loadSoundEffects(sounds, statusMessage?)` — batch (`[{ name, path }, ...]`).
 */

import { updateStatus } from '../../managers/StatusManager.js';

/**
 * @param {string} soundName
 * @param {string} soundPath
 * @param {string|null} statusMessage - Optional pre-load status toast.
 */
export function loadSoundEffect(soundName, soundPath, statusMessage = null) {
    if (window.SoundEffectsManager) {
        if (statusMessage) {
            updateStatus(statusMessage, 'info');
        }
        window.SoundEffectsManager.loadSound(soundName, soundPath);
        if (statusMessage) {
            updateStatus(`✓ ${soundName} sound effect loaded`, 'success');
        }
    }
}

/**
 * @param {Array<{ name: string, path: string }>} sounds
 * @param {string} statusMessage - Status toast emitted before the batch starts.
 */
export function loadSoundEffects(sounds, statusMessage = 'Loading sound effects...') {
    if (!window.SoundEffectsManager) {
        return;
    }

    updateStatus(statusMessage, 'info');
    sounds.forEach(({ name, path }) => {
        window.SoundEffectsManager.loadSound(name, path);
    });
    updateStatus(`✓ ${sounds.length} sound effects loaded`, 'success');
}
