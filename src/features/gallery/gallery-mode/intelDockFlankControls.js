/**
 * Intel dock trap flanks — Back (left) + Phrase (right), World-style parallelogram chips.
 * Grayed out on the Heroes/Factions/NPCs selection screen; usable once an entity is open.
 */

import { showIntelHeroesSelect, isIntelHeroesSelectVisible } from './intelHeroesSelect.js';
import {
    destroyHeroBiographyPhraseButton,
    initHeroBiographyPhraseButton,
    syncHeroBiographyPhraseButtonAvailability,
} from './heroBiographyPhraseButton.js';

const BACK_ICON_SRC = 'src/assets/images/Icons/Utility%20Icons/Back%20Arrow.png';

/** @type {HTMLButtonElement | null} */
let backBtn = null;

/**
 * @param {object} opts
 * @param {string} opts.id
 * @param {string} opts.label
 * @param {string} opts.title
 * @param {string} opts.iconPath
 * @param {string} opts.iconSpanId
 * @returns {HTMLButtonElement}
 */
function buildFlankButton({ id, label, title, iconPath, iconSpanId }) {
    const existing = document.getElementById(id);
    if (existing instanceof HTMLButtonElement) return existing;

    const btn = document.createElement('button');
    btn.id = id;
    btn.type = 'button';
    btn.className = 'globe-control-btn dock-trap-flank__btn intel-dock-flank-btn';
    btn.title = title;
    btn.setAttribute('aria-label', title);

    const iconWrap = document.createElement('span');
    iconWrap.id = iconSpanId;
    iconWrap.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img');
    img.src = iconPath;
    img.alt = '';
    img.decoding = 'async';
    iconWrap.appendChild(img);

    const labelEl = document.createElement('span');
    labelEl.className = 'globe-control-btn__label';
    labelEl.textContent = label;

    btn.append(iconWrap, labelEl);
    return btn;
}

function ensureBackButton() {
    if (backBtn?.isConnected) return backBtn;
    backBtn = buildFlankButton({
        id: 'intelDockBackBtn',
        label: 'Back',
        title: 'Back to Heroes / Factions / NPCs',
        iconPath: BACK_ICON_SRC,
        iconSpanId: 'intelDockBackIcon',
    });
    backBtn.addEventListener('click', () => {
        if (backBtn?.disabled) return;
        showIntelHeroesSelect();
    });
    return backBtn;
}

/**
 * Place Back left / Phrase right on the dock trap flanks (World chip language).
 */
export function mountIntelDockFlankControls() {
    const left = document.getElementById('dockTrapFlankLeft');
    const right = document.getElementById('dockTrapFlankRight');
    if (!left || !right) return;

    const back = ensureBackButton();
    if (back.parentElement !== left) left.appendChild(back);

    initHeroBiographyPhraseButton(right);
    syncIntelDockFlankControls();
}

export function unmountIntelDockFlankControls() {
    destroyHeroBiographyPhraseButton();
    backBtn?.remove();
    backBtn = null;
}

/**
 * Selection screen → both grayed; entity view → Back on, Phrase follows phrase availability.
 */
export function syncIntelDockFlankControls() {
    const onSelectScreen = isIntelHeroesSelectVisible();
    const back = backBtn || document.getElementById('intelDockBackBtn');
    if (back instanceof HTMLButtonElement) {
        back.disabled = onSelectScreen;
        back.classList.toggle('toggle-off', onSelectScreen);
        back.title = onSelectScreen
            ? 'Select a hero, faction, or NPC first'
            : 'Back to Heroes / Factions / NPCs';
        back.setAttribute('aria-label', back.title);
    }
    syncHeroBiographyPhraseButtonAvailability({ forceDisabled: onSelectScreen });
}
