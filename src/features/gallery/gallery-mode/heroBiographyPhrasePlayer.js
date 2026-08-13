/**
 * Single hero phrase audio at a time — random pick, no overlap until finished.
 * Wrecking Ball: hamster prefix (if mapped) then translator, like theater Match Talk.
 */

import { applyCharacterVolume } from '../../universal-features/atlas-character-audio/CharacterVolumeService.js';
import {
    buildHeroBiographyPhraseHamsterMapPath,
    buildHeroBiographyPhrasePath,
    getHeroBiographyPhraseWeight,
} from './heroBiographyPhrasePaths.js';
import { findSelectionPhraseFile } from './loadHeroPhrases.js';

/** @type {HTMLAudioElement | null} */
let activeAudio = null;

let phrasePlaying = false;

/** @type {ReturnType<typeof setTimeout> | null} */
let selectionPhraseTimer = null;

let selectionPhraseGeneration = 0;

/** Bumped to cancel in-flight sequential hamster→translator playback. */
let phrasePlaybackGeneration = 0;

/** Delay after picking a hero before the Selection voiceline plays. */
const HERO_SELECTION_PHRASE_DELAY_MS = 480;

/** @type {Map<string, Record<string, string[]> | null>} */
const hamsterPrefixCache = new Map();

function notifyPhrasePlaybackChange() {
    window.dispatchEvent(new CustomEvent('heroBiographyPhrasePlaybackChange'));
}

export function isHeroBiographyPhrasePlaying() {
    return phrasePlaying;
}

export function stopHeroBiographyPhrase() {
    phrasePlaybackGeneration += 1;
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
 * @returns {Promise<Record<string, string[]> | null>}
 */
async function loadHamsterPrefixMap(heroFilterKey) {
    const key = String(heroFilterKey || '').trim();
    if (!key) return null;
    if (hamsterPrefixCache.has(key)) return hamsterPrefixCache.get(key) || null;

    const url = buildHeroBiographyPhraseHamsterMapPath(key);
    if (!url) {
        hamsterPrefixCache.set(key, null);
        return null;
    }

    try {
        const res = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) {
            hamsterPrefixCache.set(key, null);
            return null;
        }
        const json = await res.json();
        const prefixes =
            json?.prefixes && typeof json.prefixes === 'object' && !Array.isArray(json.prefixes)
                ? json.prefixes
                : null;
        hamsterPrefixCache.set(key, prefixes);
        return prefixes;
    } catch {
        hamsterPrefixCache.set(key, null);
        return null;
    }
}

/**
 * @param {string} heroFilterKey
 * @param {string} fileName
 * @returns {Promise<string[]>} Relative phrase paths to play in order.
 */
async function resolvePhrasePlaybackFiles(heroFilterKey, fileName) {
    const file = String(fileName || '').trim().replace(/\\/g, '/');
    if (!file) return [];

    const map = await loadHamsterPrefixMap(heroFilterKey);
    const variants = map?.[file];
    if (!Array.isArray(variants) || variants.length === 0) return [file];

    const valid = variants.map((v) => String(v || '').trim().replace(/\\/g, '/')).filter(Boolean);
    if (!valid.length) return [file];

    const pick = valid[Math.floor(Math.random() * valid.length)];
    return pick && pick !== file ? [pick, file] : [file];
}

/**
 * @param {string} src
 * @param {number} generation
 * @returns {Promise<boolean>}
 */
function playAudioSrc(src, generation) {
    return new Promise((resolve) => {
        if (generation !== phrasePlaybackGeneration) {
            resolve(false);
            return;
        }

        const audio = new Audio(src);
        applyCharacterVolume(audio);
        activeAudio = audio;

        const finish = (ok) => {
            if (activeAudio === audio) {
                activeAudio.onended = null;
                activeAudio.onerror = null;
                activeAudio = null;
            }
            resolve(ok && generation === phrasePlaybackGeneration);
        };

        audio.addEventListener('ended', () => finish(true));
        audio.addEventListener('error', () => finish(false));

        audio.play().catch(() => finish(false));
    });
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

    const sequence = await resolvePhrasePlaybackFiles(heroFilterKey, file);
    if (!sequence.length) return false;

    const srcs = sequence
        .map((rel) => buildHeroBiographyPhrasePath(heroFilterKey, rel))
        .filter(Boolean);
    if (!srcs.length) return false;

    stopHeroBiographyPhrase();
    const generation = phrasePlaybackGeneration;

    window.CharacterVolumeManager?.unlock?.();

    phrasePlaying = true;
    notifyPhrasePlaybackChange();

    try {
        for (const src of srcs) {
            if (generation !== phrasePlaybackGeneration) break;
            const ok = await playAudioSrc(src, generation);
            if (!ok) break;
        }
    } catch (err) {
        console.warn('[gallery] Phrase playback failed:', err);
    }

    if (generation === phrasePlaybackGeneration) {
        phrasePlaying = false;
        activeAudio = null;
        notifyPhrasePlaybackChange();
    }
    return true;
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

    /** @type {string[]} */
    const weighted = [];
    for (const file of files) {
        const weight = Math.max(1, getHeroBiographyPhraseWeight(file));
        for (let i = 0; i < weight; i += 1) weighted.push(file);
    }
    const pick = weighted[Math.floor(Math.random() * weighted.length)];
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

/** Clears cached hamster-prefix maps (tests / hot reload). */
export function clearHeroBiographyPhraseHamsterCache() {
    hamsterPrefixCache.clear();
}
