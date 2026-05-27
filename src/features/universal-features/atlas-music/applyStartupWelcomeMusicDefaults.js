/**
 * applyStartupWelcomeMusicDefaults — unmutes music and sets a comfortable
 * target volume when the first-run startup theme + welcome SFX path runs.
 *
 * Called from `welcomeSoundEffect.js` (SFX side) before the welcome cue plays.
 * Published on `window` for optional use by classic scripts.
 */

const STARTUP_WELCOME_MUSIC_VOLUME = 0.3;

export function applyStartupWelcomeMusicDefaults() {
    try {
        const mm = window.MusicManager;
        if (!mm || !mm.initialized || !mm.volumeService || !mm.backgroundMusic) {
            return;
        }
        mm.volumeService.stopFade();
        mm.backgroundMusic.muted = false;
        if (mm.muteBtn) {
            mm.muteBtn.classList.remove('active');
        }
        if (mm.iconService && typeof mm.iconService.updateMuteIcon === 'function') {
            mm.iconService.updateMuteIcon(false);
        }
        mm.volumeService.setTargetVolume(STARTUP_WELCOME_MUSIC_VOLUME);
        mm.volumeService.setVolume(STARTUP_WELCOME_MUSIC_VOLUME);
        mm.backgroundMusic.volume = STARTUP_WELCOME_MUSIC_VOLUME;
        if (mm.volumeSlider) {
            mm.volumeSlider.value = Math.round(STARTUP_WELCOME_MUSIC_VOLUME * 100);
        }
        if (mm.volumeValue) {
            mm.volumeValue.textContent = Math.round(STARTUP_WELCOME_MUSIC_VOLUME * 100) + '%';
        }
        if (typeof mm.saveMusicState === 'function') {
            mm.saveMusicState();
        }
    } catch {
        /* ignore */
    }
}

if (typeof window !== 'undefined') {
    window.applyStartupWelcomeMusicDefaults = applyStartupWelcomeMusicDefaults;
}
