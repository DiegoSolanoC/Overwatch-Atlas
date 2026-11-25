/**
 * Phrase button — plays a random voiceline for the selected hero (one at a time).
 * Mounted on the Intel dock right trap flank (World-style parallelogram chip).
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

/** When true (Intel selection screen), Phrase stays grayed regardless of hero. */
let forceDisabled = false;

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
    const disabled = forceDisabled || !activeHeroId || !hasPhrases || playing;

    phraseBtn.disabled = disabled;
    phraseBtn.classList.toggle('toggle-off', disabled && !playing);
    phraseBtn.classList.toggle('is-playing', playing);
    phraseBtn.title = forceDisabled
        ? 'Select a hero, faction, or NPC first'
        : !activeHeroId
            ? 'Select a hero to play phrases'
            : !hasPhrases
                ? 'No voicelines for this hero yet'
                : playing
                    ? 'Playing phrase…'
                    : 'Play a random voiceline';
    phraseBtn.setAttribute('aria-label', phraseBtn.title);
}

/**
 * @param {{ forceDisabled?: boolean }} [opts]
 */
export function syncHeroBiographyPhraseButtonAvailability(opts = {}) {
    if (typeof opts.forceDisabled === 'boolean') {
        forceDisabled = opts.forceDisabled;
    }
    updatePhraseButtonState();
}

/**
 * @param {HTMLElement} mountParent — dock right flank (or legacy controls row).
 */
export function initHeroBiographyPhraseButton(mountParent) {
    if (!mountParent) return;

    if (phraseBtn?.isConnected) {
        if (phraseBtn.parentElement !== mountParent) {
            mountParent.appendChild(phraseBtn);
        }
        updatePhraseButtonState();
        return;
    }

    phraseBtn = document.createElement('button');
    phraseBtn.type = 'button';
    phraseBtn.id = 'intelDockPhraseBtn';
    phraseBtn.className = 'globe-control-btn dock-trap-flank__btn intel-dock-flank-btn';
    phraseBtn.setAttribute('aria-label', 'Play random phrase');
    phraseBtn.disabled = true;
    phraseBtn.classList.add('toggle-off');

    const iconWrap = document.createElement('span');
    iconWrap.id = 'intelDockPhraseIcon';
    iconWrap.setAttribute('aria-hidden', 'true');
    const icon = document.createElement('img');
    icon.src = HERO_BIOGRAPHY_PHRASE_ICON_PATH;
    icon.alt = '';
    icon.decoding = 'async';
    iconWrap.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'globe-control-btn__label';
    label.textContent = 'Phrase';

    phraseBtn.append(iconWrap, label);

    phraseBtn.addEventListener('click', () => {
        if (forceDisabled || !activeHeroId || !activePhraseFiles.length || isHeroBiographyPhrasePlaying()) {
            return;
        }

        updatePhraseButtonState();

        void playRandomHeroBiographyPhrase(activeHeroId, activePhraseFiles).then((started) => {
            if (started && phraseBtn && window.flashButton) {
                window.flashButton(phraseBtn, 'flash-green');
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

    mountParent.appendChild(phraseBtn);
    updatePhraseButtonState();
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
    forceDisabled = false;
}
