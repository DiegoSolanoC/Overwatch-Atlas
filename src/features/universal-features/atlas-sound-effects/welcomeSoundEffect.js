/**
 * welcomeSoundEffect — one-shot welcome SFX when a palette startup theme plays.
 *
 * `runMusicBootSequence` (in `Audio/Music/Initialization/musicBootSequence.js`) calls `window.scheduleWelcomeSoundForStartupTheme()`
 * from the music load flow when the first-visit startup theme is about to play.
 *
 * Side-imported from `AppInitializer.js` so `window.*` hooks exist before music loads.
 */

import { applyStartupWelcomeMusicDefaults } from '../atlas-music/applyStartupWelcomeMusicDefaults.js';

const WELCOME_SFX_URL = 'src/assets/audio/sfx/Welcome.mp3';
/** ms after overlay is shown — lets the screen settle before the greeting. */
const WELCOME_SFX_DELAY_MS = 650;
/** Quieter than typical UI SFX; scales with Sound Effects volume slider. */
const WELCOME_SFX_VOLUME_SCALE = 0.38;
const WELCOME_SFX_VOLUME_CAP = 0.28;
/** Fallback Sound Effects volume if the SFX manager hasn't published one yet. */
const SFX_VOLUME_FALLBACK = 0.55;
/** Floor on the welcome cue's volume so a low SFX slider can't silence it entirely. */
const WELCOME_SFX_VOLUME_FLOOR = 0.05;

function attachAutoplayRetryFallback(audio) {
    const retry = function () {
        document.removeEventListener('click', retry, true);
        document.removeEventListener('keydown', retry, true);
        document.removeEventListener('touchstart', retry, true);
        audio.play().catch(function () {
            /* ignore second-try failure */
        });
    };
    document.addEventListener('click', retry, { capture: true, once: true });
    document.addEventListener('keydown', retry, { capture: true, once: true });
    document.addEventListener('touchstart', retry, { capture: true, once: true });
}

/**
 * One-shot welcome SFX — only when the app plays a palette startup theme.
 * Same eligibility as the first startup MP3: no restored music session, no
 * current song yet, manifest non-empty, theme path exists (enforced in music init).
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
            const base =
                sfx && typeof sfx.volume === 'number' && !isNaN(sfx.volume)
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
        } catch {
            /* ignore */
        }
    }, WELCOME_SFX_DELAY_MS);
}

if (typeof window !== 'undefined') {
    window.scheduleWelcomeSoundForStartupTheme = scheduleWelcomeSoundForStartupTheme;
}
