/**
 * loadSoundEffects — thin wrappers over the runtime-global
 * `window.SoundEffectsManager` (a `SoundEffectsService` singleton mounted by
 * `SoundEffectsService.js`).
 *
 * These exist so feature loaders (palette, music, controls, toggles, events)
 * can declare their sound effects without re-typing the
 * `if (window.SoundEffectsManager)` guard, and so failures surface on the
 * status line instead of being silently swallowed.
 *
 *   - `loadSoundEffect(name, path, statusMessage?)` — single sound.
 *   - `loadSoundEffects(sounds, statusMessage?)` — batch (`[{ name, path }, ...]`).
 */

import { updateStatus } from '../../runtime/statusFeed.js';

/**
 * @param {string} soundName
 * @param {string} soundPath
 * @param {string|null} [statusMessage] - Optional pre-load status toast.
 */
export function loadSoundEffect(soundName, soundPath, statusMessage = null) {
    if (!window.SoundEffectsManager) return;

    if (statusMessage) updateStatus(statusMessage, 'info');
    window.SoundEffectsManager.loadSound(soundName, soundPath);
    if (statusMessage) updateStatus(`✓ ${soundName} sound effect loaded`, 'success');
}

/**
 * @param {Array<{ name: string, path: string }>} sounds
 * @param {string} [statusMessage] - Status toast emitted before the batch starts.
 */
export function loadSoundEffects(sounds, statusMessage = 'Loading sound effects...') {
    if (!window.SoundEffectsManager) return;

    updateStatus(statusMessage, 'info');
    sounds.forEach(({ name, path }) => {
        window.SoundEffectsManager.loadSound(name, path);
    });
    updateStatus(`✓ ${sounds.length} sound effects loaded`, 'success');
}
