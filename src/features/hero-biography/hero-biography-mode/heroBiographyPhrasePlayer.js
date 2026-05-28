/**
 * Single hero phrase audio at a time — random pick, no overlap until finished.
 */

import { buildHeroBiographyPhrasePath } from './heroBiographyPhrasePaths.js';

/** @type {HTMLAudioElement | null} */
let activeAudio = null;

let phrasePlaying = false;

export function isHeroBiographyPhrasePlaying() {
    return phrasePlaying;
}

export function stopHeroBiographyPhrase() {
    if (activeAudio) {
        activeAudio.pause();
        activeAudio.currentTime = 0;
        activeAudio.onended = null;
        activeAudio.onerror = null;
        activeAudio = null;
    }
    phrasePlaying = false;
}

/**
 * @param {string} heroFilterKey
 * @param {string[]} phraseFiles — basenames from manifest.
 * @returns {Promise<boolean>} True if playback started.
 */
export async function playRandomHeroBiographyPhrase(heroFilterKey, phraseFiles) {
    if (phrasePlaying) return false;

    const files = Array.isArray(phraseFiles)
        ? phraseFiles.map((f) => String(f || '').trim()).filter(Boolean)
        : [];
    if (!files.length) return false;

    const pick = files[Math.floor(Math.random() * files.length)];
    const src = buildHeroBiographyPhrasePath(heroFilterKey, pick);
    if (!src) return false;

    stopHeroBiographyPhrase();

    const audio = new Audio(src);
    activeAudio = audio;
    phrasePlaying = true;

    const release = () => {
        if (activeAudio !== audio) return;
        stopHeroBiographyPhrase();
    };

    audio.addEventListener('ended', release);
    audio.addEventListener('error', release);

    try {
        await audio.play();
        return true;
    } catch (err) {
        console.warn('[hero-biography] Phrase playback failed:', err);
        release();
        return false;
    }
}
