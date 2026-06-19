/**
 * Dialogue Theater listing view — conversation previews with add / save / import / export.
 */

import { showSaveSuccessFeedback } from '../../system-interface/interface-left-panel/coordinator/flashSaveSuccess.js';
import { triggerHomeExit } from '../../universal-features/atlas-header/triggerHomeExit.js';
import { dialogueTheaterDataService } from '../data/DialogueTheaterDataService.js';
import { sceneImageUrl } from '../data/loadDialogueTheaterAssets.js';
import {
    closeDialogueTheaterInfoPanel,
    openDialogueTheaterInfoPanel,
    setDialogueTheaterInfoPanelListRefresh,
} from '../dialogue-theater-info-panel/DialogueTheaterInfoPanel.js';

const HOST_ID = 'dialogueTheaterListHost';
const SAVE_BTN_ID = 'dialogueTheaterSaveBtn';

/** @type {(() => void)|null} */
let onListChange = null;

/** @param {string} value */
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} row
 */
function buildConversationThumb(row) {
    const name = row.name || 'Untitled conversation';
    const sceneSrc = row.scene ? sceneImageUrl(row.scene) : null;
    const imageHtml = sceneSrc
        ? `<div class="event-item-preview-image"><img class="event-item-preview-image__photo" src="${sceneSrc}" alt="" loading="lazy" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';" /></div>`
        : `<div class="event-item-preview-image" style="display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.35);font-size:12px;background:rgba(8,18,32,0.92);width:100%;height:100%;">No scene</div>`;

    const thumbBlock = document.createElement('div');
    thumbBlock.className = 'event-item__thumb-block';
    thumbBlock.setAttribute('role', 'button');
    thumbBlock.tabIndex = 0;
    thumbBlock.title = `Open ${name}`;
    thumbBlock.innerHTML = `
        <div class="event-item__thumb-shell">
            <div class="event-item__thumb-visual">
                <div class="event-item__thumb-media">${imageHtml}</div>
                <div class="event-item__thumb-titlebar">
                    <div class="event-item-heading">
                        <h3 class="event-item-title">${escapeHtml(name)}</h3>
                    </div>
                </div>
            </div>
            <div class="event-item__thumb-chrome"></div>
        </div>
    `;

    const openPanel = () => {
        void openDialogueTheaterInfoPanel(row.id);
    };
    thumbBlock.addEventListener('click', openPanel);
    thumbBlock.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPanel();
        }
    });

    return thumbBlock;
}

/**
 * @param {HTMLElement} root
 */
function syncSaveButtonState(root) {
    const saveBtn = root.querySelector(`#${SAVE_BTN_ID}`);
    if (!(saveBtn instanceof HTMLButtonElement)) return;
    const hasUnsaved = dialogueTheaterDataService.isDirty;
    saveBtn.classList.toggle('save-btn--unsaved', hasUnsaved);
    saveBtn.setAttribute(
        'title',
        hasUnsaved ? 'You have unsaved conversation changes' : 'Save conversations to disk',
    );
}

/**
 * @param {HTMLElement} root
 */
function renderList(root) {
    const listEl = root.querySelector('#dialogueTheaterList');
    const countEl = root.querySelector('#dialogueTheaterListCount');
    if (!listEl) return;

    const rows = dialogueTheaterDataService.conversations;
    if (countEl) {
        countEl.textContent =
            rows.length === 1 ? '1 conversation' : `${rows.length} conversations`;
    }

    listEl.innerHTML = '';

    if (rows.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'dialogue-theater-list__empty';
        empty.textContent = 'No conversations yet. Use + Add to create one.';
        listEl.appendChild(empty);
        syncSaveButtonState(root);
        return;
    }

    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const item = document.createElement('article');
        item.className = 'event-item dialogue-theater-conversation-item';
        item.dataset.conversationId = row.id;
        item.setAttribute('role', 'listitem');
        if (dialogueTheaterDataService.isConversationUnsaved(row.id)) {
            item.classList.add('unsaved');
        }

        item.appendChild(buildConversationThumb(row));

        const body = document.createElement('div');
        body.className = 'event-item__body dialogue-theater-conversation-item__body';

        const actions = document.createElement('div');
        actions.className = 'event-item-actions';

        const actionsRow = document.createElement('div');
        actionsRow.className = 'event-item-actions-row';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'event-item-btn edit-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            void openDialogueTheaterInfoPanel(row.id, { startEditing: true });
        });
        actionsRow.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'event-item-btn delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!window.confirm(`Remove "${row.name || 'Untitled conversation'}"?`)) return;
            dialogueTheaterDataService.removeConversation(row.id);
            closeDialogueTheaterInfoPanel();
            onListChange?.();
        });
        actionsRow.appendChild(deleteBtn);

        const playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.className = 'event-item-btn play-btn';
        playBtn.textContent = 'Play';
        playBtn.disabled = true;
        playBtn.title = 'Coming soon';
        playBtn.setAttribute('aria-disabled', 'true');
        actionsRow.appendChild(playBtn);

        actions.appendChild(actionsRow);
        body.appendChild(actions);
        item.appendChild(body);
        listEl.appendChild(item);
    }

    syncSaveButtonState(root);
}

/**
 * @param {HTMLElement} root
 */
function wireToolbar(root) {
    const addBtn = root.querySelector('#dialogueTheaterAddBtn');
    const saveBtn = root.querySelector(`#${SAVE_BTN_ID}`);
    const exportBtn = root.querySelector('#dialogueTheaterExportBtn');
    const importBtn = root.querySelector('#dialogueTheaterImportBtn');
    const importInput = root.querySelector('#dialogueTheaterImportFile');

    addBtn?.addEventListener('click', () => {
        const row = dialogueTheaterDataService.addBlankConversation();
        onListChange?.();
        void openDialogueTheaterInfoPanel(row.id, { startEditing: true });
    });

    saveBtn?.addEventListener('click', () => {
        dialogueTheaterDataService.save();
        showSaveSuccessFeedback(SAVE_BTN_ID);
        onListChange?.();
    });

    exportBtn?.addEventListener('click', () => {
        dialogueTheaterDataService.exportConversations();
    });

    importBtn?.addEventListener('click', () => {
        importInput?.click();
    });

    importInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            await dialogueTheaterDataService.importConversations(file);
            closeDialogueTheaterInfoPanel();
            onListChange?.();
        } catch (_) {
            /* status already updated in service */
        }
        e.target.value = '';
    });
}

/**
 * @param {HTMLElement} container
 */
export async function mountDialogueTheaterListView(container) {
    container.innerHTML = '';
    container.id = HOST_ID;
    container.className =
        'story-viewer-container story-viewer-container--timeline-mode dialogue-theater-list-host active';
    container.setAttribute('role', 'main');
    container.setAttribute('aria-label', 'Dialogue Theater');

    container.innerHTML = `
        <div class="dialogue-theater-panel-embedded">
            <div class="events-manage-content">
                <div class="events-manage-header events-manage-header--story-empty dialogue-theater-list__header">
                    <div class="events-manage-title-section">
                        <div class="events-manage-title-row">
                            <h2 class="events-manage-title">Dialogue Theater</h2>
                        </div>
                        <p id="dialogueTheaterListCount" class="events-manage-count">0 conversations</p>
                    </div>
                </div>
                <div id="dialogueTheaterList" class="events-list dialogue-theater-list__grid" role="list"></div>
                <div id="dialogueTheaterBottomBar" class="story-archive-bottom-bar dialogue-theater-list__bottom-bar">
                    <div class="events-manage-actions">
                        <button type="button" id="dialogueTheaterAddBtn" class="events-manage-action-btn story-viewer-action-btn">+ Add</button>
                        <button type="button" id="${SAVE_BTN_ID}" class="events-manage-action-btn save-btn story-viewer-action-btn">💾 Save</button>
                        <button type="button" id="dialogueTheaterExportBtn" class="events-manage-action-btn export-btn story-viewer-action-btn">📥 Export</button>
                        <button type="button" id="dialogueTheaterImportBtn" class="events-manage-action-btn import-btn story-viewer-action-btn">📤 Import</button>
                        <input type="file" id="dialogueTheaterImportFile" accept="application/json,.json" aria-hidden="true" tabindex="-1" class="dialogue-theater-list__import-input" />
                    </div>
                </div>
            </div>
        </div>
    `;

    onListChange = () => renderList(container);
    setDialogueTheaterInfoPanelListRefresh(onListChange);
    wireToolbar(container);

    await dialogueTheaterDataService.load();
    renderList(container);

    const onEscape = (e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        triggerHomeExit();
    };
    document.addEventListener('keydown', onEscape);
    container._dialogueTheaterEscape = onEscape;
}

/**
 * @param {HTMLElement|null} container
 */
export function unmountDialogueTheaterListView(container) {
    if (container?._dialogueTheaterEscape) {
        document.removeEventListener('keydown', container._dialogueTheaterEscape);
    }
    closeDialogueTheaterInfoPanel();
    setDialogueTheaterInfoPanelListRefresh(null);
    onListChange = null;
    container?.remove();
}

export function getDialogueTheaterListHostId() {
    return HOST_ID;
}
