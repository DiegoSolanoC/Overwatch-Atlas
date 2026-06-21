/**
 * Character voiceline volume — theater dialogue + gallery catchphrases.
 * Exposed on `window.CharacterVolumeManager` for legacy/global access.
 */

import { installFirstGestureUnlock, unlockAudioElement } from '../atlas-sound-effects/primitives/sfxAudioUnlock.js';
import { loadSavedCharacterVolume, saveCharacterVolume } from './characterVolumeStorage.js';
import { wireCharacterVolumeSlider } from './characterVolumeSlider.js';

const DEFAULT_VOLUME = 0.7;

/**
 * Re-encode each path segment so apostrophes and "..." survive static server routing.
 * @param {string} src
 * @returns {string}
 */
function normalizeAssetPlaybackUrl(src) {
    const raw = String(src || '').trim();
    if (!raw || /^https?:\/\//i.test(raw)) return raw;

    const segments = raw.replace(/\\/g, '/').split('/').filter(Boolean);
    return segments
        .map((segment) => {
            try {
                return encodeURIComponent(decodeURIComponent(segment));
            } catch {
                return encodeURIComponent(segment);
            }
        })
        .join('/');
}

class CharacterVolumeService {
    constructor() {
        /** @type {number} */
        this.volume = DEFAULT_VOLUME;
        this._audioUnlocked = false;
        /** @type {HTMLAudioElement|null} */
        this._unlockAudio = null;
    }

    unlock() {
        if (this._audioUnlocked) return;
        this._audioUnlocked = true;
        if (!this._unlockAudio) {
            this._unlockAudio = new Audio();
            this._unlockAudio.preload = 'auto';
        }
        unlockAudioElement(this._unlockAudio);
    }

    /** @returns {number} */
    getVolume() {
        return this.volume;
    }

    /** @param {number} volume */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        saveCharacterVolume(this.volume);
    }

    /** @param {HTMLAudioElement} audio */
    applyVolume(audio) {
        audio.volume = this.volume;
    }

    /**
     * @param {string} src
     * @returns {Promise<HTMLAudioElement|null>}
     */
    async playFromUrl(src) {
        const url = normalizeAssetPlaybackUrl(src);
        if (!url) return null;

        this.unlock();

        const audio = new Audio(url);
        this.applyVolume(audio);

        const onFail = () => {
            console.warn('[CharacterVolume] playback failed:', url);
        };

        audio.addEventListener('error', onFail, { once: true });

        try {
            await audio.play();
            return audio;
        } catch (err) {
            console.warn('[CharacterVolume] play() rejected:', url, err);
            return null;
        }
    }

    init() {
        this.setVolume(loadSavedCharacterVolume(this.volume));
        this.setupCharacterVolumeSlider();
        installFirstGestureUnlock(() => this.unlock());
    }

    setupCharacterVolumeSlider() {
        wireCharacterVolumeSlider({
            getVolume: () => this.volume,
            setVolume: (v) => this.setVolume(v),
        });
    }
}

export const characterVolumeManager = new CharacterVolumeService();

/**
 * @param {string} src
 * @returns {Promise<HTMLAudioElement|null>}
 */
export async function playCharacterAudio(src) {
    return characterVolumeManager.playFromUrl(src);
}

/**
 * @param {HTMLAudioElement} audio
 */
export function applyCharacterVolume(audio) {
    characterVolumeManager.applyVolume(audio);
}

if (typeof window !== 'undefined') {
    window.CharacterVolumeManager = characterVolumeManager;
    characterVolumeManager.init();
}
