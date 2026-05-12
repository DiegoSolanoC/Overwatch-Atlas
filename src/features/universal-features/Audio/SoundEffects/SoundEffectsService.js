/**
 * SoundEffectsService — runtime owner of the SFX bank.
 *
 * Loads every clip declared in `sfxBank`, plays them through the original
 * `HTMLAudioElement` (no `cloneNode` — desktop Chrome after WebGL rejects
 * cloned playback), keeps the master volume in sync between memory,
 * `localStorage`, and the music-panel slider, and unlocks audio on the
 * first user gesture so playback works after the autoplay policy kicks in.
 *
 * Loaded as `<script type="module">` from `index.html`. The singleton is
 * still exposed on `window.SoundEffectsManager` because 50+ existing call
 * sites read that global (mostly inside event handlers, which run after
 * the module evaluates).
 *
 * Debug: set `window.DEBUG_SOUND_EFFECTS = true` to log play failures.
 */

import { SFX_ROOT, SOUND_EFFECTS_BANK, getPlayVolumeMultiplier } from './primitives/sfxBank.js';
import { clearFadeTimers, scheduleFadeOut } from './primitives/sfxFadeOut.js';
import { unlockAudioElement, installFirstGestureUnlock } from './primitives/sfxAudioUnlock.js';
import { loadSavedSfxVolume, saveSfxVolume } from './primitives/sfxVolumeStorage.js';
import { wireSfxVolumeSlider } from './primitives/sfxVolumeSlider.js';

const DEFAULT_VOLUME = 0.5;

class SoundEffectsService {
    constructor() {
        /** @type {Record<string, HTMLAudioElement>} */
        this.sounds = {};
        this.volume = DEFAULT_VOLUME;
        this._audioUnlocked = false;
        this._debug = () => !!(typeof window !== 'undefined' && window.DEBUG_SOUND_EFFECTS);
    }

    /** Browser autoplay unlock — runs on first play and on first user gesture. */
    unlock() {
        if (this._audioUnlocked) return;
        this._audioUnlocked = true;
        const firstKey = Object.keys(this.sounds)[0];
        if (firstKey) unlockAudioElement(this.sounds[firstKey]);
    }

    /** Build an `HTMLAudioElement` for one clip and register it under `name`. */
    _registerClip(name, path, { volumeMultiplier = 1, playbackRate = null } = {}) {
        try {
            const audio = new Audio(path);
            audio.preload = 'auto';
            audio.volume = this.volume * volumeMultiplier;
            if (playbackRate != null) audio.playbackRate = playbackRate;
            audio.addEventListener('error', (e) => {
                console.error(`Error loading sound "${name}" from "${path}":`, e);
            });
            audio.addEventListener('canplaythrough', () => {
                console.log(`Sound "${name}" loaded successfully`);
            });
            this.sounds[name] = audio;
            return audio;
        } catch (error) {
            console.error(`Failed to create audio for "${name}":`, error);
            return null;
        }
    }

    /** Public on-demand load (used by `loadSoundEffects.js` for late SFX). */
    loadSound(name, path) {
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
        audio.currentTime = 0;
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
        this.volume = volume;
        saveSfxVolume(volume);
        Object.keys(this.sounds).forEach((name) => {
            this.sounds[name].volume = name === 'filterConfirm' ? volume * 0.5 : volume;
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
        const logAssetLoad =
            typeof window !== 'undefined' && typeof window.logAssetLoad === 'function'
                ? window.logAssetLoad
                : () => {};

        for (const row of SOUND_EFFECTS_BANK) {
            logAssetLoad('SOUND_EFFECT', row.file);
            this._registerClip(row.name, SFX_ROOT + row.file, {
                volumeMultiplier: row.volumeMultiplier ?? 1,
                playbackRate: row.playbackRate ?? null
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
            setVolume: (v) => this.setVolume(v)
        });
    }
}

if (typeof window !== 'undefined') {
    /** Legacy global — 50+ call sites read `window.SoundEffectsManager`. */
    window.SoundEffectsManager = new SoundEffectsService();
}
