/**
 * SoundEffectsService — runtime owner of the SFX bank.
 *
 * Loads every clip declared in `sfxBank`, plays them through the original
 * `HTMLAudioElement` (no `cloneNode` — desktop Chrome after WebGL rejects
 * cloned playback), keeps the master volume in sync between memory,
 * `localStorage`, and the music-panel slider, and unlocks audio on the
 * first user gesture so playback works after the autoplay policy kicks in.
 *
 * IMPORTANT: `SoundEffectsService.js?v=N` (script tag) and bare imports are
 * different module instances — always use `window.SoundEffectsManager`.
 *
 * Debug: set `window.DEBUG_SOUND_EFFECTS = true` to log play / load detail.
 */

import { SFX_ROOT, SOUND_EFFECTS_BANK, getPlayVolumeMultiplier } from './primitives/sfxBank.js';
import { clearFadeTimers, scheduleFadeOut } from './primitives/sfxFadeOut.js';
import { unlockAudioElement, installFirstGestureUnlock } from './primitives/sfxAudioUnlock.js';
import { loadSavedSfxVolume, saveSfxVolume } from './primitives/sfxVolumeStorage.js';
import { wireSfxVolumeSlider } from './primitives/sfxVolumeSlider.js';
import { normalizeAssetPlaybackUrl } from '../atlas-shared-ui/media/normalizeAssetPlaybackUrl.js';

const DEFAULT_VOLUME = 0.5;

/** MEDIA_ERR_ABORTED — fired when a clip is replaced or the load is cancelled. */
const MEDIA_ERR_ABORTED = 1;

/**
 * Resolve a repo-relative SFX path against the current page directory.
 *
 * Must NOT force origin-root `/src/...` — that 404s on GitHub Pages project
 * sites (`/Overwatch-Atlas/src/...` is correct; `/src/...` is not).
 *
 * @param {string} path
 * @returns {string}
 */
function toSfxPlaybackUrl(path) {
    const encoded = normalizeAssetPlaybackUrl(path);
    if (!encoded) return '';
    if (/^https?:\/\//i.test(encoded)) return encoded;
    try {
        if (typeof window !== 'undefined' && window.location?.href) {
            const pageDir = new URL('.', window.location.href);
            return new URL(encoded.replace(/^\/+/, ''), pageDir).href;
        }
        return encoded.replace(/^\/+/, '');
    } catch {
        return encoded;
    }
}

class SoundEffectsService {
    constructor() {
        /** @type {Record<string, HTMLAudioElement>} */
        this.sounds = {};
        this.volume = DEFAULT_VOLUME;
        this._audioUnlocked = false;
        this._initialized = false;
        this._debug = () => !!(typeof window !== 'undefined' && window.DEBUG_SOUND_EFFECTS);
    }

    /** Browser autoplay unlock — runs on first play and on first user gesture. */
    unlock() {
        if (this._audioUnlocked) return;
        this._audioUnlocked = true;
        const firstKey = Object.keys(this.sounds)[0];
        if (firstKey) unlockAudioElement(this.sounds[firstKey]);
    }

    /**
     * @param {string} name
     * @param {string} path
     * @param {{ volumeMultiplier?: number, playbackRate?: number|null }} [opts]
     * @param {number} [attempt]
     */
    _registerClip(name, path, opts = {}, attempt = 0) {
        const { volumeMultiplier = 1, playbackRate = null } = opts;
        if (this.sounds[name] && attempt === 0) {
            return this.sounds[name];
        }

        try {
            const url = toSfxPlaybackUrl(path);
            const audio = new Audio();
            audio.preload = 'auto';
            audio.volume = Math.max(0, Math.min(1, this.volume * volumeMultiplier));
            if (playbackRate != null) audio.playbackRate = playbackRate;

            audio.addEventListener('error', () => {
                const code = audio.error?.code;
                if (code === MEDIA_ERR_ABORTED) return;
                if (attempt < 1) {
                    window.setTimeout(() => {
                        if (this.sounds[name] === audio) {
                            delete this.sounds[name];
                        }
                        this._registerClip(name, path, opts, attempt + 1);
                    }, 120);
                    return;
                }
                console.error(
                    `Error loading sound "${name}" from "${url}"` +
                        (code != null ? ` (media error ${code})` : ''),
                );
            });

            if (this._debug()) {
                audio.addEventListener('canplaythrough', () => {
                    console.log(`Sound "${name}" loaded successfully`);
                }, { once: true });
            }

            audio.src = url;
            this.sounds[name] = audio;
            return audio;
        } catch (error) {
            console.error(`Failed to create audio for "${name}":`, error);
            return null;
        }
    }

    /**
     * Public on-demand load (used by `loadSoundEffects.js` for late SFX).
     * Never replaces an existing bank entry — that aborted in-flight loads and
     * flooded the console after Event System boot re-registered the same keys.
     */
    loadSound(name, path) {
        if (this.sounds[name]) return this.sounds[name];
        return this._registerClip(name, path);
    }

    /**
     * Play a registered clip.
     * @param {string} name
     * @param {{ playbackRate?: number, fadeOutAfterMs?: number, fadeOutDurationMs?: number }} [options]
     */
    play(name, options = {}) {
        const audio = this.sounds[name];
        if (!audio) {
            if (this._debug()) {
                console.warn('[SFX] play: sound not loaded:', name, 'loaded:', Object.keys(this.sounds));
            }
            console.warn(`Sound effect "${name}" not loaded`);
            return null;
        }

        if (!this._audioUnlocked) this.unlock();

        const vol = Math.max(0, Math.min(1, this.volume)) * getPlayVolumeMultiplier(name);

        clearFadeTimers(audio);
        try {
            audio.currentTime = 0;
        } catch (_) {
            /* ignore seek before ready */
        }
        const rate = options.playbackRate ?? audio.playbackRate;
        if (rate) audio.playbackRate = rate;
        audio.volume = vol;

        const p = audio.play();
        if (p && typeof p.then === 'function') {
            p.catch((err) => {
                if (this._debug()) {
                    console.warn('[SFX] play failed:', name, err?.name || err);
                }
            });
        }
        scheduleFadeOut(audio, options);
        return audio;
    }

    /** Apply a master volume to every loaded clip + persist + sync gear-tick pool. */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, Number(volume)));
        saveSfxVolume(this.volume);
        Object.keys(this.sounds).forEach((name) => {
            const audio = this.sounds[name];
            if (!audio) return;
            audio.volume = Math.max(0, Math.min(1, this.volume * getPlayVolumeMultiplier(name)));
        });
        if (
            typeof window !== 'undefined' &&
            window.PanelResizeGearTick &&
            typeof window.PanelResizeGearTick.syncFromSoundEffectsVolume === 'function'
        ) {
            window.PanelResizeGearTick.syncFromSoundEffectsVolume();
        }
    }

    /** Boot: build the bank, restore saved volume, wire slider, install unlock. */
    init() {
        if (this._initialized) {
            this.setupSoundEffectsSlider();
            return;
        }
        this._initialized = true;

        const logAssetLoad =
            typeof window !== 'undefined' && typeof window.logAssetLoad === 'function'
                ? window.logAssetLoad
                : () => {};

        for (const row of SOUND_EFFECTS_BANK) {
            logAssetLoad('SOUND_EFFECT', row.file);
            this._registerClip(row.name, SFX_ROOT + row.file, {
                volumeMultiplier: row.volumeMultiplier ?? 1,
                playbackRate: row.playbackRate ?? null,
            });
        }

        this.setVolume(loadSavedSfxVolume(this.volume));
        this.setupSoundEffectsSlider();
        installFirstGestureUnlock(() => this.unlock());
    }

    /** Re-runnable slider wiring — the music panel mounts after `init()` runs. */
    setupSoundEffectsSlider() {
        wireSfxVolumeSlider({
            getVolume: () => this.volume,
            setVolume: (v) => this.setVolume(v),
        });
    }
}

function getOrCreateSoundEffectsManager() {
    if (typeof window !== 'undefined' && window.SoundEffectsManager) {
        return window.SoundEffectsManager;
    }
    const mgr = new SoundEffectsService();
    if (typeof window !== 'undefined') {
        window.SoundEffectsManager = mgr;
        mgr.init();
    }
    return mgr;
}

/** Legacy global — 50+ call sites read `window.SoundEffectsManager`. */
export const soundEffectsManager = getOrCreateSoundEffectsManager();

if (typeof window !== 'undefined' && window.SoundEffectsManager && !window.SoundEffectsManager._initialized) {
    window.SoundEffectsManager.init();
}
