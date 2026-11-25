/**
 * Character voiceline volume — theater dialogue + gallery catchphrases.
 * Exposed on `window.CharacterVolumeManager` for legacy/global access.
 *
 * IMPORTANT: index.html may load this as `CharacterVolumeService.js?v=N` while
 * feature modules import the bare path. Those are different module instances in
 * the browser — always route through `window.CharacterVolumeManager` so the
 * music-menu slider and Intel phrases share one volume.
 */

import { installFirstGestureUnlock, unlockAudioElement } from '../atlas-sound-effects/primitives/sfxAudioUnlock.js';
import { normalizeAssetPlaybackUrl } from '../atlas-shared-ui/media/normalizeAssetPlaybackUrl.js';
import { loadSavedCharacterVolume, saveCharacterVolume } from './characterVolumeStorage.js';
import { wireCharacterVolumeSlider } from './characterVolumeSlider.js';

const DEFAULT_VOLUME = 0.7;

class CharacterVolumeService {
    constructor() {
        /** @type {number} */
        this.volume = DEFAULT_VOLUME;
        this._audioUnlocked = false;
        /** @type {HTMLAudioElement|null} */
        this._unlockAudio = null;
        /** Currently playing voicelines — updated live when the slider moves. */
        /** @type {Set<HTMLAudioElement>} */
        this._activeAudios = new Set();
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

    /**
     * @param {HTMLAudioElement} audio
     */
    _trackActive(audio) {
        if (!audio || this._activeAudios.has(audio)) return;
        this._activeAudios.add(audio);
        const release = () => {
            this._activeAudios.delete(audio);
            audio.removeEventListener('ended', release);
            audio.removeEventListener('error', release);
        };
        audio.addEventListener('ended', release);
        audio.addEventListener('error', release);
    }

    /** @param {number} volume */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, Number(volume)));
        saveCharacterVolume(this.volume);
        for (const audio of [...this._activeAudios]) {
            try {
                audio.volume = this.volume;
            } catch (_) {
                this._activeAudios.delete(audio);
            }
        }
    }

    /** @param {HTMLAudioElement} audio */
    applyVolume(audio) {
        if (!audio) return;
        audio.volume = this.volume;
        this._trackActive(audio);
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
        /* Re-assert after decode — some engines reset volume on first buffer. */
        const syncVol = () => {
            audio.volume = this.volume;
        };
        audio.addEventListener('playing', syncVol, { once: true });
        audio.addEventListener('loadeddata', syncVol, { once: true });

        const onFail = () => {
            console.warn('[CharacterVolume] playback failed:', url);
            this._activeAudios.delete(audio);
        };

        audio.addEventListener('error', onFail, { once: true });

        try {
            await audio.play();
            syncVol();
            return audio;
        } catch (err) {
            console.warn('[CharacterVolume] play() rejected:', url, err);
            this._activeAudios.delete(audio);
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

function getOrCreateCharacterVolumeManager() {
    if (typeof window !== 'undefined' && window.CharacterVolumeManager) {
        return window.CharacterVolumeManager;
    }
    const mgr = new CharacterVolumeService();
    if (typeof window !== 'undefined') {
        window.CharacterVolumeManager = mgr;
        mgr.init();
    }
    return mgr;
}

export const characterVolumeManager = getOrCreateCharacterVolumeManager();

/**
 * @param {string} src
 * @returns {Promise<HTMLAudioElement|null>}
 */
export async function playCharacterAudio(src) {
    return getOrCreateCharacterVolumeManager().playFromUrl(src);
}

/**
 * @param {HTMLAudioElement} audio
 */
export function applyCharacterVolume(audio) {
    getOrCreateCharacterVolumeManager().applyVolume(audio);
}
