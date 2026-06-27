/**
 * Dialogue Theater — left info panel (#eventSlide) for editing conversation entries.
 */

import { dismissAllPanelsExcept } from '../../system-interface/interface-shared/dismissAllPanelsExcept.js';
import { isEventSlideEditDevHost } from '../../system-interface/interface-info-display/isEventSlideEditDevHost.js';
import { updateStatus } from '../../universal-features/atlas-mode-runtime/statusFeed.js';
import { dialogueTheaterDataService } from '../data/DialogueTheaterDataService.js';
import {
    autoStartDialogueTheaterViewPlayAll,
    collectDialogueTheaterEditPanel,
    isDialogueTheaterViewPlaybackActive,
    mountDialogueTheaterPanel,
    refreshDialogueTheaterEditStageFromHost,
    stopDialogueTheaterViewPlayback,
    unmountDialogueTheaterPanel,
    updateDialogueTheaterViewPathSelection,
    wireDialogueTheaterDeleteEntry,
} from './DialogueTheaterEditPanel.js';
import { hasConversationVariationPaths } from '../data/dialogueTheaterPathHelpers.js';
import { isBeforeTheCrisisConversation } from './beforeTheCrisisPathConfig.js';
import { isFavoriteAnimalConversation } from './dialogueTheaterGroupedPathPicker.js';
import { isPeriodicTableConversation } from './periodicTablePathConfig.js';
import { pickRandomPeriodicTablePathId } from './dialogueTheaterPeriodicTablePicker.js';
import { usesStandardRandomRoutePlay, pickRandomConversationPathId } from './dialogueTheaterRandomRoutePlay.js';
import {
    hideDialogueTheaterImageOverlay,
    showDialogueTheaterImageOverlay,
} from '../dialogue-theater-stage/dialogueTheaterImageOverlayBridge.js';
import { readPersistedGlobalImageToggleState } from '../../system-interface/interface-load-unload/mountGlobalImageToggle.js';
import {
    updateEventSlideFactionTypeDisplay,
    updateEventSlideNpcCategoryDisplay,
    updateEventSlideHeroBirthdayDisplay,
    updateEventSlideHeroRoleDisplay,
} from '../../system-interface/interface-info-display/eventSlideMetaDisplays.js';

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

/**
 * @param {{ preserveStage?: boolean }} [options]
 */
async function syncDialogueTheaterStageOverlayFromGlobalToggle(options = {}) {
    if (readPersistedGlobalImageToggleState()) {
        await showDialogueTheaterImageOverlay(window.standaloneEventSlide, options);
    } else {
        hideDialogueTheaterImageOverlay();
    }
}

/** Drop story / bio / timeline sections left over from a prior #eventSlide entry. */
function clearStaleEventSlideSections() {
    const hideEl = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = 'none';
        el.setAttribute('hidden', 'hidden');
    };
    const clearInner = (id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    };

    hideEl('eventRelevantLocationsSection');
    hideEl('eventBioConnectionsSection');
    hideEl('eventStoryFilterPlacesSection');
    hideEl('eventSourcesSection');
    hideEl('eventFiltersSection');

    clearInner('eventSlideRelevantLocations');
    clearInner('eventSlideBioConnections');
    clearInner('eventSourcesList');
    clearInner('eventFiltersList');

    window.LocationFlagHelpers?.clearBioConnectionsSlideDom?.();
    window.LocationFlagHelpers?.clearStoryFilterPlacesSlideDom?.();

    updateEventSlideFactionTypeDisplay(null, 0);
    updateEventSlideNpcCategoryDisplay(null, 0);
    updateEventSlideHeroRoleDisplay(null, 0);
    updateEventSlideHeroBirthdayDisplay(null, 0);

    const heroLocEdit = document.getElementById('eventSlideHeroLocationsEdit');
    if (heroLocEdit) {
        heroLocEdit.setAttribute('hidden', '');
        heroLocEdit.style.display = 'none';
    }

    const variantToggles = document.getElementById('eventVariantToggles');
    if (variantToggles) variantToggles.innerHTML = '';
}

async function onConversationPathChange(pathId, options = {}) {
    const autoPlay = options.autoPlay !== false;
    if (!activeConversationId) return;
    stopDialogueTheaterViewPlayback();
    dialogueTheaterDataService.updateConversation(activeConversationId, { selectedPathId: pathId });
    await dialogueTheaterDataService.save({ silent: true });
    const row = dialogueTheaterDataService.getConversationById(activeConversationId);
    if (!row) return;

    const host = document.getElementById('dialogueTheaterEditHost');
    if (host && hasConversationVariationPaths(row)) {
        updateDialogueTheaterViewPathSelection(host, row, pathId);
        await refreshDialogueTheaterStage(row);
        if (autoPlay) {
            void autoStartDialogueTheaterViewPlayAll(row);
        }
        return;
    }

    const scrollable = getScrollable();
    if (!scrollable) return;

    unmountDialogueTheaterPanel();
    await mountDialogueTheaterPanel(scrollable, row, 'view', {
        onPathChange: onConversationPathChange,
    });
    await refreshDialogueTheaterStage(row);
    void autoStartDialogueTheaterViewPlayAll(row);
}

async function refreshPanelContent(mode) {
    if (!activeConversationId) return;
    const row = dialogueTheaterDataService.getConversationById(activeConversationId);
    const scrollable = getScrollable();
    if (!row || !scrollable) return;
    const playbackActive = isDialogueTheaterViewPlaybackActive();
    unmountDialogueTheaterPanel({ preservePlayback: playbackActive });
    const host = await mountDialogueTheaterPanel(scrollable, row, mode, {
        onPathChange: mode === 'view' ? onConversationPathChange : undefined,
    });
    await syncDialogueTheaterStageOverlayFromGlobalToggle({
        preserveStage: playbackActive,
    });
    if (mode === 'edit' && !playbackActive) {
        await refreshDialogueTheaterEditStageFromHost(host, row);
    }
    if (mode === 'edit') {
        wireDialogueTheaterDeleteEntry(() => {
            const name = row.name || 'Untitled conversation';
            if (!window.confirm(`Delete conversation "${name}"? This cannot be undone.`)) return;
            dialogueTheaterDataService.removeConversation(activeConversationId);
            void dialogueTheaterDataService.save().then(() => {
                closeDialogueTheaterInfoPanel();
                onListRefresh?.();
                updateStatus('Conversation deleted.', 'success');
            });
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

    await dialogueTheaterDataService.save();

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

    clearStaleEventSlideSections();

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
        await mountDialogueTheaterPanel(scrollable, row, 'view', {
            onPathChange: onConversationPathChange,
        });
    }

    eventSlide?.classList.add('event-slide--dialogue-theater');
    eventSlide?.setAttribute('data-dialogue-theater-conversation-id', row.id);
    eventSlide?.classList.remove('event-slide--inline-editing');
    eventSlide?.classList.add('open');

    if (scrollable) {
        await syncDialogueTheaterStageOverlayFromGlobalToggle();
    }

    if (window.SoundEffectsManager?.play) {
        window.SoundEffectsManager.play('eventClick');
    }
}

/**
 * @param {string} conversationId
 * @param {{ startEditing?: boolean }} [options]
 */
export async function openDialogueTheaterInfoPanel(conversationId, options = {}) {
    let row = dialogueTheaterDataService.getConversationById(conversationId);
    if (!row) {
        updateStatus('Conversation not found.', 'warning');
        return;
    }

    activeConversationId = conversationId;
    wirePanelButtons();

    if (!options.startEditing && usesStandardRandomRoutePlay(row)) {
        const pathId = pickRandomConversationPathId(row);
        dialogueTheaterDataService.updateConversation(conversationId, { selectedPathId: pathId });
        await dialogueTheaterDataService.save({ silent: true });
        row = dialogueTheaterDataService.getConversationById(conversationId) || row;
    }

    if (!options.startEditing && isPeriodicTableConversation(row)) {
        const pathId = pickRandomPeriodicTablePathId(row);
        dialogueTheaterDataService.updateConversation(conversationId, { selectedPathId: pathId });
        await dialogueTheaterDataService.save({ silent: true });
        row = dialogueTheaterDataService.getConversationById(conversationId) || row;
    }

    await prepareEventSlideForConversation(row);

    if (options.startEditing) {
        await enterDialogueTheaterEditMode(true);
    } else {
        void autoStartDialogueTheaterViewPlayAll(row, {
            masterPlay: isFavoriteAnimalConversation(row) || isBeforeTheCrisisConversation(row),
            randomRoutePlay: usesStandardRandomRoutePlay(row),
            periodicTablePlay: isPeriodicTableConversation(row),
        });
    }
}

export function teardownDialogueTheaterEventSlide() {
    if (!isDialogueTheaterPanelOpen()) return;

    isEditing = false;
    editSnapshot = null;
    activeConversationId = null;
    unmountDialogueTheaterPanel();
    hideDialogueTheaterImageOverlay();

    const eventSlide = document.getElementById('eventSlide');
    const textEl = document.getElementById('eventSlideText');
    eventSlide?.classList.remove('event-slide--dialogue-theater', 'event-slide--inline-editing');
    eventSlide?.removeAttribute('data-dialogue-theater-conversation-id');
    if (textEl) textEl.style.display = '';
}

export function closeDialogueTheaterInfoPanel() {
    if (!isDialogueTheaterPanelOpen()) return;

    stopDialogueTheaterViewPlayback();

    isEditing = false;
    editSnapshot = null;
    unmountDialogueTheaterPanel();

    const eventSlide = document.getElementById('eventSlide');
    const titleEl = document.getElementById('eventSlideTitle');
    const textEl = document.getElementById('eventSlideText');
    const editBtn = getEditBtn();
    const saveBtn = getSaveBtn();

    eventSlide?.classList.remove('open', 'event-slide--dialogue-theater', 'event-slide--inline-editing');
    eventSlide?.removeAttribute('data-dialogue-theater-conversation-id');
    if (titleEl) titleEl.contentEditable = 'false';
    if (textEl) textEl.style.display = '';
    if (editBtn) editBtn.style.display = '';
    if (saveBtn) saveBtn.style.display = 'none';

    activeConversationId = null;
    hideDialogueTheaterImageOverlay();
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
