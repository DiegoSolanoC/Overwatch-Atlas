/**
 * playModeSwitchSound — fires the "Mode Switch" SFX when the user
 * deliberately changes app mode.
 *
 * Skipped for auto-load flows (boot-time mode restore, header switches
 * driven by code) so we don't blare a chime at the user every time a
 * preference triggers a mode change in the background.
 *
 * If the SFX bank hasn't been loaded yet (race against `SoundEffectsManager`
 * boot), this kicks off an on-demand load and plays after a short tick —
 * the audio either lands or it doesn't, but mode entry isn't blocked.
 */

const MODE_SWITCH_SFX_KEY = 'modeSwitch';
const MODE_SWITCH_SFX_PATH = 'src/assets/audio/sfx/Mode Switch.mp3';
const LATE_LOAD_PLAYBACK_DELAY_MS = 100;

/**
 * @param {boolean} isAutoLoad - When `true`, no sound plays.
 */
export function playModeSwitchSound(isAutoLoad) {
    if (isAutoLoad) return;

    const manager = window.SoundEffectsManager;
    if (!manager) return;

    if (manager.sounds && manager.sounds[MODE_SWITCH_SFX_KEY]) {
        manager.play(MODE_SWITCH_SFX_KEY);
        return;
    }

    manager.loadSound(MODE_SWITCH_SFX_KEY, MODE_SWITCH_SFX_PATH);
    setTimeout(() => {
        manager.play(MODE_SWITCH_SFX_KEY);
    }, LATE_LOAD_PLAYBACK_DELAY_MS);
}
