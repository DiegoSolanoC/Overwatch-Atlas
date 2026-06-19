/**
 * Dialogue Theater — left info panel (#eventSlide) for editing conversation entries.
 */

import { dismissAllPanelsExcept } from '../../system-interface/interface-shared/dismissAllPanelsExcept.js';
import { isEventSlideEditDevHost } from '../../system-interface/interface-info-display/isEventSlideEditDevHost.js';
import { updateStatus } from '../../universal-features/atlas-mode-runtime/statusFeed.js';
import { dialogueTheaterDataService } from '../data/DialogueTheaterDataService.js';
import {
    collectDialogueTheaterEditPanel,
    mountDialogueTheaterPanel,
    unmountDialogueTheaterPanel,
    wireDialogueTheaterDeleteEntry,
} from './DialogueTheaterEditPanel.js';
import {
    hideDialogueTheaterStage,
    showDialogueTheaterStage,
} from '../dialogue-theater-stage/dialogueTheaterStageOverlay.js';

/** @type {string|null} */
let activeConversationId = null;

/** @type {boolean} */
let isEditing = false;

/** @type {(() => void)|null} */
let onListRefresh = null;

/** @type {import('../data/DialogueTheaterDataService.js').DialogueConversation|null} */
let editSnapshot = null;

/**
 * @param {() => void} fn
 */
export function setDialogueTheaterInfoPanelListRefresh(fn) {
    onListRefresh = fn;
}

/**
 * @param {HTMLElement | null | undefined} el
 * @returns {string}
 */
function readPlainText(el) {
    if (!el) return '';
    return String(el.innerText ?? el.textContent ?? '').replace(/\r\n/g, '\n').trim();
}

function getEditBtn() {
    return document.getElementById('eventSlideEditBtn');
}

function getSaveBtn() {
    return document.getElementById('eventSlideSaveBtn');
}

function getScrollable() {
    return document.getElementById('eventSlideScrollable');
}

function isDialogueTheaterPanelOpen() {
    return document.getElementById('eventSlide')?.classList.contains('event-slide--dialogue-theater');
}

async function refreshPanelContent(mode) {
    if (!activeConversationId) return;
    const row = dialogueTheaterDataService.getConversationById(activeConversationId);
    const scrollable = getScrollable();
    if (!row || !scrollable) return;
    unmountDialogueTheaterPanel();
    const host = await mountDialogueTheaterPanel(scrollable, row, mode);
    if (mode === 'view') {
        await showDialogueTheaterStage(row);
    } else {
        hideDialogueTheaterStage();
    }
    if (mode === 'edit') {
        wireDialogueTheaterDeleteEntry(() => {
            const name = row.name || 'Untitled conversation';
            if (!window.confirm(`Delete conversation "${name}"? This cannot be undone.`)) return;
            dialogueTheaterDataService.removeConversation(activeConversationId);
            closeDialogueTheaterInfoPanel();
            onListRefresh?.();
            updateStatus('Conversation deleted.', 'success');
        }, host);
    }
}

function cancelDialogueTheaterEdit() {
    const eventSlide = document.getElementById('eventSlide');
    const titleEl = document.getElementById('eventSlideTitle');
    const editBtn = getEditBtn();
    const saveBtn = getSaveBtn();

    isEditing = false;
    eventSlide?.classList.remove('event-slide--inline-editing');

    if (titleEl && editSnapshot) {
        titleEl.contentEditable = 'false';
        titleEl.textContent = editSnapshot.name;
    }

    if (editBtn) {
        editBtn.style.display = isEventSlideEditDevHost() ? '' : 'none';
        editBtn.textContent = 'Edit';
    }
    if (saveBtn) {
        saveBtn.style.display = 'none';
    }

    editSnapshot = null;
    void refreshPanelContent('view');
}

/**
 * @param {boolean} [focusTitle=false]
 */
async function enterDialogueTheaterEditMode(focusTitle = true) {
    if (!isEventSlideEditDevHost()) {
        updateStatus('Editing is not available on this host.', 'warning');
        return;
    }
    if (!activeConversationId) return;

    const row = dialogueTheaterDataService.getConversationById(activeConversationId);
    if (!row) return;

    const eventSlide = document.getElementById('eventSlide');
    const titleEl = document.getElementById('eventSlideTitle');
    const editBtn = getEditBtn();
    const saveBtn = getSaveBtn();

    isEditing = true;
    editSnapshot = JSON.parse(JSON.stringify(row));
    eventSlide?.classList.add('event-slide--inline-editing');

    if (titleEl) {
        titleEl.textContent = row.name;
        titleEl.contentEditable = 'true';
        titleEl.setAttribute('spellcheck', 'true');
        if (focusTitle) {
            requestAnimationFrame(() => {
                titleEl.focus();
                const sel = window.getSelection?.();
                const range = document.createRange?.();
                if (sel && range && titleEl.firstChild) {
                    range.selectNodeContents(titleEl);
                    range.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            });
        }
    }

    if (editBtn) editBtn.style.display = 'none';
    if (saveBtn) saveBtn.style.display = '';

    await refreshPanelContent('edit');
}

async function saveDialogueTheaterEdit() {
    if (!activeConversationId || !isEditing) return;

    const titleEl = document.getElementById('eventSlideTitle');
    const nextName = readPlainText(titleEl) || 'Untitled conversation';
    const host = document.getElementById('dialogueTheaterEditHost');
    const patch = host ? collectDialogueTheaterEditPanel(host) : {};

    dialogueTheaterDataService.updateConversation(activeConversationId, {
        name: nextName,
        ...patch,
    });

    if (titleEl) {
        titleEl.textContent = nextName;
    }

    isEditing = false;
    editSnapshot = null;
    document.getElementById('eventSlide')?.classList.remove('event-slide--inline-editing');

    const editBtn = getEditBtn();
    const saveBtn = getSaveBtn();
    if (editBtn) {
        editBtn.style.display = isEventSlideEditDevHost() ? '' : 'none';
        editBtn.textContent = 'Edit';
    }
    if (saveBtn) saveBtn.style.display = 'none';
    if (titleEl) titleEl.contentEditable = 'false';

    await refreshPanelContent('view');
    onListRefresh?.();
    updateStatus('Conversation updated — use Save in the list to persist.', 'success');
}

function wirePanelButtons() {
    const editBtn = getEditBtn();
    const saveBtn = getSaveBtn();
    const closeBtn = document.getElementById('eventSlideClose');

    if (editBtn?.parentNode && saveBtn?.parentNode) {
        const newEditBtn = editBtn.cloneNode(true);
        const newSaveBtn = saveBtn.cloneNode(true);
        editBtn.parentNode.replaceChild(newEditBtn, editBtn);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

        newEditBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isEditing) {
                cancelDialogueTheaterEdit();
            } else {
                void enterDialogueTheaterEditMode(true);
            }
        };

        newSaveBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            void saveDialogueTheaterEdit();
        };
    }

    if (closeBtn) {
        closeBtn.onclick = () => {
            closeDialogueTheaterInfoPanel();
        };
    }
}

async function prepareEventSlideForConversation(row) {
    window.standaloneEventSlide?.cancelEdit?.();
    window.standaloneEventSlide?.hideImageOverlay?.();

    const eventSlide = document.getElementById('eventSlide');
    const titleEl = document.getElementById('eventSlideTitle');
    const textEl = document.getElementById('eventSlideText');
    const editBtn = getEditBtn();
    const saveBtn = getSaveBtn();
    const scrollable = getScrollable();

    dismissAllPanelsExcept('eventSlide');

    if (titleEl) {
        titleEl.contentEditable = 'false';
        titleEl.textContent = row.name;
    }
    if (textEl) {
        textEl.textContent = '';
        textEl.style.display = 'none';
    }

    const loc = document.getElementById('eventSlideLocation');
    const meta = document.getElementById('eventSlideTimelineMeta');
    if (loc) loc.style.display = 'none';
    if (meta) meta.style.display = 'none';

    if (editBtn) {
        editBtn.style.display = isEventSlideEditDevHost() ? '' : 'none';
        editBtn.textContent = 'Edit';
    }
    if (saveBtn) {
        saveBtn.style.display = 'none';
    }

    isEditing = false;
    editSnapshot = null;
    unmountDialogueTheaterPanel();

    if (scrollable) {
        await mountDialogueTheaterPanel(scrollable, row, 'view');
        await showDialogueTheaterStage(row);
    }

    eventSlide?.classList.add('event-slide--dialogue-theater');
    eventSlide?.classList.remove('event-slide--inline-editing');
    eventSlide?.classList.add('open');

    if (window.SoundEffectsManager?.play) {
        window.SoundEffectsManager.play('eventClick');
    }
}

/**
 * @param {string} conversationId
 * @param {{ startEditing?: boolean }} [options]
 */
export async function openDialogueTheaterInfoPanel(conversationId, options = {}) {
    const row = dialogueTheaterDataService.getConversationById(conversationId);
    if (!row) {
        updateStatus('Conversation not found.', 'warning');
        return;
    }

    activeConversationId = conversationId;
    wirePanelButtons();
    await prepareEventSlideForConversation(row);

    if (options.startEditing) {
        await enterDialogueTheaterEditMode(true);
    }
}

export function closeDialogueTheaterInfoPanel() {
    if (!isDialogueTheaterPanelOpen()) return;

    isEditing = false;
    editSnapshot = null;
    unmountDialogueTheaterPanel();

    const eventSlide = document.getElementById('eventSlide');
    const titleEl = document.getElementById('eventSlideTitle');
    const textEl = document.getElementById('eventSlideText');
    const editBtn = getEditBtn();
    const saveBtn = getSaveBtn();

    eventSlide?.classList.remove('open', 'event-slide--dialogue-theater', 'event-slide--inline-editing');
    if (titleEl) titleEl.contentEditable = 'false';
    if (textEl) textEl.style.display = '';
    if (editBtn) editBtn.style.display = '';
    if (saveBtn) saveBtn.style.display = 'none';

    activeConversationId = null;
    hideDialogueTheaterStage();
    window.standaloneEventSlide?.hideImageOverlay?.();

    if (window.SoundEffectsManager?.play) {
        window.SoundEffectsManager.play('eventClick');
    }
}

export function isDialogueTheaterInfoPanelActive() {
    return isDialogueTheaterPanelOpen();
}

export function getActiveDialogueTheaterConversationId() {
    return activeConversationId;
}
