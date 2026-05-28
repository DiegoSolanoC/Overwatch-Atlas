/**
 * Single hero phrase audio at a time — random pick, no overlap until finished.
 */

import { buildHeroBiographyPhrasePath } from './heroBiographyPhrasePaths.js';
import { findSelectionPhraseFile } from './loadHeroPhrases.js';

/** @type {HTMLAudioElement | null} */
let activeAudio = null;

let phrasePlaying = false;

/** @type {ReturnType<typeof setTimeout> | null} */
let selectionPhraseTimer = null;

let selectionPhraseGeneration = 0;

/** Delay after picking a hero before the Selection voiceline plays. */
const HERO_SELECTION_PHRASE_DELAY_MS = 480;

function notifyPhrasePlaybackChange() {
    window.dispatchEvent(new CustomEvent('heroBiographyPhrasePlaybackChange'));
}

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
    notifyPhrasePlaybackChange();
}

export function cancelHeroSelectionPhraseSchedule() {
    if (selectionPhraseTimer) {
        clearTimeout(selectionPhraseTimer);
        selectionPhraseTimer = null;
    }
    selectionPhraseGeneration += 1;
}

/**
 * @param {string} heroFilterKey
 * @param {string} fileName — basename from manifest.
 * @returns {Promise<boolean>} True if playback started.
 */
export async function playHeroBiographyPhrase(heroFilterKey, fileName) {
    if (phrasePlaying) return false;

    const file = String(fileName || '').trim();
    if (!file) return false;

    const src = buildHeroBiographyPhrasePath(heroFilterKey, file);
    if (!src) return false;

    stopHeroBiographyPhrase();

    const audio = new Audio(src);
    activeAudio = audio;
    phrasePlaying = true;
    notifyPhrasePlaybackChange();

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

/**
 * @param {string} heroFilterKey
 * @param {string[]} phraseFiles — basenames from manifest.
 * @returns {Promise<boolean>} True if playback started.
 */
export async function playRandomHeroBiographyPhrase(heroFilterKey, phraseFiles) {
    cancelHeroSelectionPhraseSchedule();

    const files = Array.isArray(phraseFiles)
        ? phraseFiles.map((f) => String(f || '').trim()).filter(Boolean)
        : [];
    if (!files.length) return false;

    const pick = files[Math.floor(Math.random() * files.length)];
    return playHeroBiographyPhrase(heroFilterKey, pick);
}

/**
 * Plays the hero's Selection clip shortly after chip pick (includes Selection in random pool).
 * @param {string} heroFilterKey
 * @param {string[]} phraseFiles
 * @param {number} [delayMs]
 */
export function scheduleHeroSelectionPhrase(heroFilterKey, phraseFiles, delayMs = HERO_SELECTION_PHRASE_DELAY_MS) {
    cancelHeroSelectionPhraseSchedule();

    const key = String(heroFilterKey || '').trim();
    const selectionFile = findSelectionPhraseFile(phraseFiles);
    if (!key || !selectionFile) return;

    const generation = selectionPhraseGeneration;
    selectionPhraseTimer = setTimeout(() => {
        selectionPhraseTimer = null;
        if (generation !== selectionPhraseGeneration) return;
        if (phrasePlaying) return;
        void playHeroBiographyPhrase(key, selectionFile);
    }, Math.max(0, delayMs));
}
