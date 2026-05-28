/**
 * Phrase button — plays a random voiceline for the selected hero (one at a time).
 */

import { HERO_BIOGRAPHY_PHRASE_ICON_PATH } from './heroBiographyPhrasePaths.js';
import {
    getPhrasesForHero,
    loadHeroPhrasesMap,
} from './loadHeroPhrases.js';
import {
    cancelHeroSelectionPhraseSchedule,
    isHeroBiographyPhrasePlaying,
    playRandomHeroBiographyPhrase,
    scheduleHeroSelectionPhrase,
    stopHeroBiographyPhrase,
} from './heroBiographyPhrasePlayer.js';

/** @type {HTMLButtonElement | null} */
let phraseBtn = null;

/** @type {string | null} */
let activeHeroId = null;

/** @type {string[]} */
let activePhraseFiles = [];

/** @type {Record<string, string[]> | null} */
let heroPhrasesMap = null;

async function ensureHeroPhrasesMap() {
    if (!heroPhrasesMap) {
        heroPhrasesMap = await loadHeroPhrasesMap();
    }
    return heroPhrasesMap;
}

function updatePhraseButtonState() {
    if (!phraseBtn) return;

    const hasPhrases = activePhraseFiles.length > 0;
    const playing = isHeroBiographyPhrasePlaying();

    phraseBtn.disabled = !activeHeroId || !hasPhrases || playing;
    phraseBtn.classList.toggle('is-playing', playing);
    phraseBtn.title = !activeHeroId
        ? 'Select a hero to play phrases'
        : !hasPhrases
            ? 'No voicelines for this hero yet'
            : playing
                ? 'Playing phrase…'
                : 'Play a random voiceline';
}

/**
 * @param {HTMLElement} controlsRow — shared row with the Look dropdown.
 */
export function initHeroBiographyPhraseButton(controlsRow) {
    if (phraseBtn) return;

    phraseBtn = document.createElement('button');
    phraseBtn.type = 'button';
    phraseBtn.className = 'gallery-mode__phrase-btn';
    phraseBtn.setAttribute('aria-label', 'Play random phrase');
    phraseBtn.disabled = true;

    const icon = document.createElement('img');
    icon.className = 'gallery-mode__phrase-btn-icon';
    icon.src = HERO_BIOGRAPHY_PHRASE_ICON_PATH;
    icon.alt = '';
    icon.decoding = 'async';

    const label = document.createElement('span');
    label.className = 'gallery-mode__phrase-btn-label';
    label.textContent = 'Phrase';

    phraseBtn.append(icon, label);

    phraseBtn.addEventListener('click', () => {
        if (!activeHeroId || !activePhraseFiles.length || isHeroBiographyPhrasePlaying()) {
            return;
        }

        updatePhraseButtonState();

        void playRandomHeroBiographyPhrase(activeHeroId, activePhraseFiles).then((started) => {
            if (started && phraseBtn && window.flashButton) {
                window.flashButton(phraseBtn, 'flash-green');
            }
            if (started) {
                window.SoundEffectsManager?.play?.('filterButton');
            }

            const pollEnd = () => {
                if (isHeroBiographyPhrasePlaying()) {
                    requestAnimationFrame(pollEnd);
                    return;
                }
                updatePhraseButtonState();
            };
            if (started) {
                requestAnimationFrame(pollEnd);
            } else {
                updatePhraseButtonState();
            }
        });
    });

    window.addEventListener('heroBiographyPhrasePlaybackChange', updatePhraseButtonState);

    controlsRow.appendChild(phraseBtn);
}

/**
 * @param {string | null} heroFilterKey
 */
export async function setHeroBiographyPhraseButtonHero(heroFilterKey) {
    cancelHeroSelectionPhraseSchedule();
    activeHeroId = heroFilterKey ? String(heroFilterKey).trim() : null;
    activePhraseFiles = [];

    if (!activeHeroId) {
        stopHeroBiographyPhrase();
        updatePhraseButtonState();
        return;
    }

    try {
        const map = await ensureHeroPhrasesMap();
        activePhraseFiles = getPhrasesForHero(map, activeHeroId);
    } catch (err) {
        console.warn('[gallery] Could not load hero phrases:', err);
        activePhraseFiles = [];
    }

    updatePhraseButtonState();
    scheduleHeroSelectionPhrase(activeHeroId, activePhraseFiles);
}

export function destroyHeroBiographyPhraseButton() {
    window.removeEventListener('heroBiographyPhrasePlaybackChange', updatePhraseButtonState);
    cancelHeroSelectionPhraseSchedule();
    stopHeroBiographyPhrase();
    phraseBtn?.remove();
    phraseBtn = null;
    activeHeroId = null;
    activePhraseFiles = [];
    heroPhrasesMap = null;
}
