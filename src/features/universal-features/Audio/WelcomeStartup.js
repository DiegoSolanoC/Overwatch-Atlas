/**
 * WelcomeStartup — first-run welcome SFX + startup-music volume defaults.
 *
 * The "welcome" cue plays once per page load when the app is also playing
 * the palette's startup theme (no restored music session, manifest is
 * non-empty, theme path resolves). The defaults function unmutes music
 * and dials it to a comfortable volume so the welcome cue can sit on top.
 *
 * Both functions are also published on `window` because
 * `MusicManagerInitHelpers` (loaded as a classic script) calls
 * `window.scheduleWelcomeSoundForStartupTheme()` from inside the music
 * loading flow.
 */

const WELCOME_SFX_URL = 'src/assets/audio/sfx/Welcome.mp3';
/** ms after overlay is shown — lets the screen settle before the greeting. */
const WELCOME_SFX_DELAY_MS = 650;
/** Quieter than typical UI SFX; scales with Sound Effects volume slider. */
const WELCOME_SFX_VOLUME_SCALE = 0.38;
const WELCOME_SFX_VOLUME_CAP = 0.28;
/** When startup theme + welcome path runs, music should be audible at this level. */
const STARTUP_WELCOME_MUSIC_VOLUME = 0.3;
/** Fallback Sound Effects volume if the SFX manager hasn't published one yet. */
const SFX_VOLUME_FALLBACK = 0.55;
/** Floor on the welcome cue's volume so a low SFX slider can't silence it entirely. */
const WELCOME_SFX_VOLUME_FLOOR = 0.05;

/**
 * Unmute and set music volume for the first-run startup theme + welcome SFX path.
 */
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
    } catch (_) {
        /* ignore */
    }
}

function attachAutoplayRetryFallback(audio) {
    const retry = function () {
        document.removeEventListener('click', retry, true);
        document.removeEventListener('keydown', retry, true);
        document.removeEventListener('touchstart', retry, true);
        audio.play().catch(function () { /* ignore second-try failure */ });
    };
    document.addEventListener('click', retry, { capture: true, once: true });
    document.addEventListener('keydown', retry, { capture: true, once: true });
    document.addEventListener('touchstart', retry, { capture: true, once: true });
}

/**
 * One-shot welcome SFX — only when the app plays a palette startup theme.
 * Same eligibility as the first startup MP3: no restored music session, no
 * current song yet, manifest non-empty, theme path exists.
 */
export function scheduleWelcomeSoundForStartupTheme() {
    if (typeof window !== 'undefined' && window.__welcomeStartupSfxScheduled) {
        return;
    }
    if (typeof window !== 'undefined') {
        window.__welcomeStartupSfxScheduled = true;
    }
    applyStartupWelcomeMusicDefaults();
    window.setTimeout(function () {
        applyStartupWelcomeMusicDefaults();
        try {
            const audio = new Audio(WELCOME_SFX_URL);
            audio.preload = 'auto';
            const sfx = typeof window !== 'undefined' ? window.SoundEffectsManager : null;
            const base = sfx && typeof sfx.volume === 'number' && !isNaN(sfx.volume)
                ? sfx.volume
                : SFX_VOLUME_FALLBACK;
            audio.volume = Math.max(
                WELCOME_SFX_VOLUME_FLOOR,
                Math.min(WELCOME_SFX_VOLUME_CAP, base * WELCOME_SFX_VOLUME_SCALE)
            );
            const promise = audio.play();
            if (promise !== undefined) {
                promise.catch(function () {
                    attachAutoplayRetryFallback(audio);
                });
            }
        } catch (_) {
            /* ignore */
        }
    }, WELCOME_SFX_DELAY_MS);
}

if (typeof window !== 'undefined') {
    window.scheduleWelcomeSoundForStartupTheme = scheduleWelcomeSoundForStartupTheme;
    window.applyStartupWelcomeMusicDefaults = applyStartupWelcomeMusicDefaults;
}
