/**
 * Dialogue Theater entry-mode toggle — Dialogues ↔ Hero Chatters.
 * Mounts on `#dockGlobeRailLeft` like Story List/Timeline and other mode toggles.
 */

import { createHeaderHubButton } from '../../universal-features/atlas-header/HeaderHubButton.js';
import {
    DIALOGUE_THEATER_ENTRY_CHATTER,
    DIALOGUE_THEATER_ENTRY_DIALOGUE,
} from '../data/dialogueTheaterEntryType.js';

const ENTRY_MODE_KEY = 'dialogueTheaterEntryMode';
const DOCK_PARENT_ID = 'dockGlobeRailLeft';
const TOGGLE_ID = 'dialogueTheaterEntryToggle';

const ICON_DIALOGUES = 'src/assets/images/Icons/Mode%20Icons/Dialogue%20Theater.png';
const ICON_CHATTERS = 'src/assets/images/Icons/Mode%20Icons/Concept%20Gallery.png';

/** @typedef {'dialogues'|'chatters'} DialogueTheaterEntryMode */

/** @type {(() => void) | null} */
let toggleTeardown = null;

/** @type {(() => void) | null} */
let onModeChange = null;

/**
 * @returns {DialogueTheaterEntryMode}
 */
export function getDialogueTheaterEntryMode() {
    try {
        const stored = localStorage.getItem(ENTRY_MODE_KEY);
        if (stored === 'chatters') return 'chatters';
    } catch (_) { /* ignore */ }
    return 'dialogues';
}

/**
 * @param {DialogueTheaterEntryMode} mode
 */
function persistDialogueTheaterEntryMode(mode) {
    try {
        localStorage.setItem(ENTRY_MODE_KEY, mode);
    } catch (_) { /* ignore */ }
}

/**
 * @param {DialogueTheaterEntryMode} mode
 * @returns {import('../data/dialogueTheaterEntryType.js').DialogueTheaterEntryType}
 */
export function entryTypeForMode(mode) {
    return mode === 'chatters'
        ? DIALOGUE_THEATER_ENTRY_CHATTER
        : DIALOGUE_THEATER_ENTRY_DIALOGUE;
}

/**
 * @param {DialogueTheaterEntryMode} mode
 */
function syncDialogueTheaterEntryToggleUi(mode) {
    const btn = document.getElementById(TOGGLE_ID);
    if (!btn) return;

    const showingChatters = mode === 'chatters';
    const label = btn.querySelector('.globe-control-btn__label');
    const img = btn.querySelector('[id$="Icon"] img');

    // Label / icon show the mode you switch *to* (same pattern as Story List/Timeline).
    if (label) label.textContent = showingChatters ? 'Dialogues' : 'Chatters';
    btn.title = showingChatters ? 'Switch to Dialogues' : 'Switch to Hero Chatters';

    if (img) {
        img.src = showingChatters ? ICON_DIALOGUES : ICON_CHATTERS;
        img.alt = showingChatters ? 'Dialogues' : 'Chatters';
    }
}

function toggleDialogueTheaterEntryMode() {
    const next = getDialogueTheaterEntryMode() === 'dialogues' ? 'chatters' : 'dialogues';
    persistDialogueTheaterEntryMode(next);
    syncDialogueTheaterEntryToggleUi(next);

    const btn = document.getElementById(TOGGLE_ID);
    if (btn && window.flashButton) {
        window.flashButton(btn, 'flash-orange');
    }
    if (window.SoundEffectsManager) {
        window.SoundEffectsManager.play('switchMap');
    }

    onModeChange?.();
}

/**
 * @param {{ onChange?: () => void }} [options]
 */
export function mountDialogueTheaterEntryToggle(options = {}) {
    unmountDialogueTheaterEntryToggle();
    onModeChange = typeof options.onChange === 'function' ? options.onChange : null;

    const dockParent = document.getElementById(DOCK_PARENT_ID);
    if (!dockParent) return;

    let btn = document.getElementById(TOGGLE_ID);
    if (!btn) {
        btn = createHeaderHubButton({
            id: TOGGLE_ID,
            className: 'dock-globe-rail__btn dialogue-theater-entry-toggle',
            title: 'Switch to Hero Chatters',
            label: 'Chatters',
            iconPath: ICON_CHATTERS,
            iconAlt: 'Chatters',
            parentId: DOCK_PARENT_ID,
            baseClass: 'globe-control-btn',
            iconSpanId: 'dialogueTheaterEntryToggleIcon',
            headerOrder: 10,
            mobileParentId: DOCK_PARENT_ID,
            mobileClassName: 'dock-globe-rail__btn dialogue-theater-entry-toggle',
        });
    } else if (!dockParent.contains(btn)) {
        dockParent.appendChild(btn);
    }

    if (btn) {
        btn.style.setProperty('display', 'flex', 'important');
    }

    const ac = new AbortController();
    btn?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleDialogueTheaterEntryMode();
    }, { signal: ac.signal });

    toggleTeardown = () => {
        ac.abort();
        toggleTeardown = null;
    };

    syncDialogueTheaterEntryToggleUi(getDialogueTheaterEntryMode());
}

export function unmountDialogueTheaterEntryToggle() {
    if (typeof toggleTeardown === 'function') {
        try {
            toggleTeardown();
        } catch (_) { /* ignore */ }
    }
    onModeChange = null;
    document.getElementById(TOGGLE_ID)?.remove();
}
