/**
 * Dialogue Theater listing view — conversation previews with add / save / import / export.
 * Layout mirrors the embedded Story / Data Archive event list panel one-to-one.
 */

import { showSaveSuccessFeedback } from '../../system-interface/interface-left-panel/coordinator/flashSaveSuccess.js';
import { triggerHomeExit } from '../../universal-features/atlas-header/triggerHomeExit.js';
import { dialogueTheaterDataService } from '../data/DialogueTheaterDataService.js';
import { loadDialogueTheaterAssets } from '../data/loadDialogueTheaterAssets.js';
import { getEventListSpinnerGifSrc } from '../../universal-features/atlas-ui/loadingGifAssets.js';
import { buildDialogueTheaterListThumbMediaHtml } from './buildDialogueTheaterListThumb.js';
import {
    closeDialogueTheaterInfoPanel,
    openDialogueTheaterInfoPanel,
    setDialogueTheaterInfoPanelListRefresh,
} from '../dialogue-theater-info-panel/DialogueTheaterInfoPanel.js';
import {
    setupDialogueTheaterCompactChrome,
    unwireDialogueTheaterToolbarCollapse,
    wireDialogueTheaterToolbarCollapse,
} from './wireDialogueTheaterListChrome.js';
import {
    buildConversationDuplicateLookup,
    compareConversationListOrder,
    conversationDuplicateSummary,
    conversationHasUnfinishedIssues,
    conversationUnfinishedSummary,
} from '../data/dialogueTheaterConversationValidation.js';
import {
    conversationPassesDialogueTheaterFilters,
    getHeroFiltersFromStandaloneActiveFilters,
    isDialogueTheaterHeroFilterActive,
} from './dialogueTheaterHeroFilter.js';
import {
    conversationMatchesCharacterPair,
    isDialogueTheaterPairSearchActive,
} from './dialogueTheaterPairSearch.js';
import { wireDialogueTheaterPairSearch } from './wireDialogueTheaterPairSearch.js';
import { conversationMatchesListSearch } from './dialogueTheaterListSearch.js';

const HOST_ID = 'dialogueTheaterListHost';
const SAVE_BTN_ID = 'dialogueTheaterSaveBtn';

/** @type {(() => void)|null} */
let onListChange = null;

/** @type {string} */
let searchQuery = '';

/** @type {{ getPairA: () => string, getPairB: () => string, refreshSpeakerOptions?: () => void }|null} */
let pairSearchControls = null;

/** @returns {string[]} */
function manifestHeroesForPairSearch() {
    const fs = typeof window !== 'undefined' ? window.FilterService : null;
    return Array.isArray(fs?.heroes) ? fs.heroes : [];
}

/**
 * @returns {import('../data/DialogueTheaterDataService.js').DialogueConversation[]}
 */
function getFilteredConversations() {
    let rows = dialogueTheaterDataService.conversations;

    const pairA = pairSearchControls?.getPairA?.() || '';
    const pairB = pairSearchControls?.getPairB?.() || '';
    const pairSearchActive = isDialogueTheaterPairSearchActive(pairA, pairB);

    if (pairSearchActive) {
        const manifestHeroes = manifestHeroesForPairSearch();
        rows = rows.filter((row) => conversationMatchesCharacterPair(row, pairA, pairB, manifestHeroes));
    } else {
        rows = rows.filter((row) =>
            conversationPassesDialogueTheaterFilters(row, window.standaloneActiveFilters),
        );
    }

    const q = searchQuery.trim();
    if (q) {
        rows = rows.filter((row) => conversationMatchesListSearch(row, q));
    }

    return [...rows].sort(compareConversationListOrder);
}

/** @type {import('../data/loadDialogueTheaterAssets.js').DialogueTheaterAssets|null} */
let listThumbAssets = null;

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
 * @param {Map<string, string[]>} duplicateLookup
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 */
function buildConversationThumb(row, duplicateLookup, conversations) {
    const name = row.name || 'Untitled conversation';
    const voicelines = listThumbAssets?.voicelines || [];
    const isUnfinished = conversationHasUnfinishedIssues(row, voicelines, duplicateLookup);
    const unfinishedSummary = isUnfinished
        ? conversationUnfinishedSummary(row, voicelines, duplicateLookup, conversations)
        : '';
    const duplicateSummary = conversationDuplicateSummary(row.id, duplicateLookup, conversations);
    const tooltipParts = [name];
    if (unfinishedSummary) tooltipParts.push(unfinishedSummary);
    if (duplicateSummary) tooltipParts.push(duplicateSummary);
    const imageHtml = buildDialogueTheaterListThumbMediaHtml(
        row,
        listThumbAssets,
        getEventListSpinnerGifSrc(),
    );

    const thumbBlock = document.createElement('div');
    thumbBlock.className = 'event-item__thumb-block';
    thumbBlock.setAttribute('role', 'button');
    thumbBlock.tabIndex = 0;
    thumbBlock.title = tooltipParts.join(' — ');
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
function updateListCount(root) {
    const countEl = root.querySelector('#dialogueTheaterListCount');
    if (!countEl) return;

    const total = dialogueTheaterDataService.conversations.length;
    const visible = getFilteredConversations().length;
    const q = searchQuery.trim();
    const pairA = pairSearchControls?.getPairA?.() || '';
    const pairB = pairSearchControls?.getPairB?.() || '';
    const pairSearchActive = isDialogueTheaterPairSearchActive(pairA, pairB);
    const heroFilterActive =
        !pairSearchActive && isDialogueTheaterHeroFilterActive(window.standaloneActiveFilters);

    if ((q || heroFilterActive || pairSearchActive) && visible !== total) {
        countEl.textContent =
            visible === 1
                ? `1 of ${total} conversations`
                : `${visible} of ${total} conversations`;
        return;
    }

    countEl.textContent = total === 1 ? '1 conversation' : `${total} conversations`;
}

/**
 * @param {HTMLElement} root
 */
function renderList(root) {
    const listEl = root.querySelector('#dialogueTheaterList');
    if (!listEl) return;

    const rows = getFilteredConversations();
    const allConversations = dialogueTheaterDataService.conversations;
    const duplicateLookup = buildConversationDuplicateLookup(allConversations);
    updateListCount(root);

    listEl.innerHTML = '';

    if (rows.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'dialogue-theater-list__empty';
        const q = searchQuery.trim();
        const pairA = pairSearchControls?.getPairA?.() || '';
        const pairB = pairSearchControls?.getPairB?.() || '';
        const pairSearchActive = isDialogueTheaterPairSearchActive(pairA, pairB);
        const heroFilters = getHeroFiltersFromStandaloneActiveFilters(window.standaloneActiveFilters);
        if (pairSearchActive) {
            const both = pairA.trim() && pairB.trim();
            empty.textContent = both
                ? `No conversations found between ${pairA.trim()} and ${pairB.trim()}.`
                : 'No conversations include that character.';
        } else if (heroFilters.length && !q) {
            empty.textContent = 'No conversations include the selected heroes.';
        } else if (q) {
            empty.textContent = 'No conversations match your search.';
        } else {
            empty.textContent = 'No conversations yet. Use + Add to create one.';
        }
        listEl.appendChild(empty);
        syncSaveButtonState(root);
        return;
    }

    for (const row of rows) {
        const item = document.createElement('article');
        item.className = 'event-item';
        item.dataset.conversationId = row.id;
        item.setAttribute('role', 'listitem');
        if (dialogueTheaterDataService.isConversationUnsaved(row.id)) {
            item.classList.add('unsaved');
        }
        const voicelines = listThumbAssets?.voicelines || [];
        item.classList.toggle(
            'event-item--unfinished',
            conversationHasUnfinishedIssues(row, voicelines, duplicateLookup),
        );

        item.appendChild(buildConversationThumb(row, duplicateLookup, allConversations));
        listEl.appendChild(item);
    }

    syncSaveButtonState(root);
}

/**
 * @param {HTMLElement} root
 */
function wireSearch(root) {
    const searchInput = root.querySelector('#dialogueTheaterSearchInput');
    searchInput?.addEventListener('input', () => {
        searchQuery = searchInput instanceof HTMLInputElement ? searchInput.value : '';
        renderList(root);
    });
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
        void dialogueTheaterDataService.save().then(() => {
            showSaveSuccessFeedback(SAVE_BTN_ID);
            onListChange?.();
        });
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
    container.className = 'story-viewer-container dialogue-theater-list-host active';
    container.setAttribute('role', 'main');
    container.setAttribute('aria-label', 'Dialogue Theater');

    container.innerHTML = `
        <div class="story-viewer-panel-embedded dialogue-theater-panel-embedded open">
            <div class="events-manage-content">
                <div class="events-manage-header">
                    <div class="events-manage-title-section">
                        <div class="events-manage-title-row">
                            <h2 class="events-manage-title">Dialogue Theater</h2>
                            <button type="button" id="dialogueTheaterToolbarToggleBtn" class="events-manage-toolbar-toggle-btn" aria-pressed="false" title="Hide or show search bar">Hide controls</button>
                        </div>
                        <p id="dialogueTheaterListCount" class="events-manage-count">0 conversations</p>
                    </div>
                </div>
                <div class="events-manage-controls" id="dialogueTheaterManageControls">
                    <h3 class="events-manage-controls-title">Search &amp; filters</h3>
                    <div class="events-manage-search" id="dialogueTheaterManageSearch">
                        <div class="events-manage-search-row events-manage-search-row--primary dialogue-theater-pair-search-row">
                            <div class="dialogue-theater-pair-search-col dialogue-theater-pair-search-col--hero">
                                <label for="dialogueTheaterPairSearchA" class="events-search-label">Character A:</label>
                                <div class="dialogue-theater-pair-search-col__icon" aria-hidden="true">
                                    <img id="dialogueTheaterPairSearchIconA" class="dialogue-theater-pair-search-col__icon-img" alt="" hidden />
                                </div>
                                <input type="text" id="dialogueTheaterPairSearchA" class="events-search-input dialogue-theater-pair-search-col__input" placeholder="Character A..." autocomplete="off" spellcheck="false" />
                            </div>
                            <div class="dialogue-theater-pair-search-col dialogue-theater-pair-search-col--title">
                                <label for="dialogueTheaterSearchInput" class="events-search-label">Search:</label>
                                <div class="dialogue-theater-pair-search-col__icon dialogue-theater-pair-search-col__icon--spacer" aria-hidden="true"></div>
                                <input
                                    type="text"
                                    id="dialogueTheaterSearchInput"
                                    class="events-search-input events-search-input--title dialogue-theater-pair-search-col__input"
                                    placeholder="By title or dialogue line..."
                                    autocomplete="off"
                                />
                            </div>
                            <div class="dialogue-theater-pair-search-col dialogue-theater-pair-search-col--hero">
                                <label for="dialogueTheaterPairSearchB" class="events-search-label">Character B:</label>
                                <div class="dialogue-theater-pair-search-col__icon" aria-hidden="true">
                                    <img id="dialogueTheaterPairSearchIconB" class="dialogue-theater-pair-search-col__icon-img" alt="" hidden />
                                </div>
                                <input type="text" id="dialogueTheaterPairSearchB" class="events-search-input dialogue-theater-pair-search-col__input" placeholder="Character B..." autocomplete="off" spellcheck="false" />
                            </div>
                        </div>
                    </div>
                </div>
                <div id="dialogueTheaterList" class="events-list" role="list"></div>
                <div id="dialogueTheaterBottomBar" class="story-archive-bottom-bar">
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

    const panel = container.querySelector('.dialogue-theater-panel-embedded');
    if (panel instanceof HTMLElement) {
        setupDialogueTheaterCompactChrome(panel);
        wireDialogueTheaterToolbarCollapse(panel);
    }

    searchQuery = '';
    pairSearchControls = null;
    onListChange = () => {
        pairSearchControls?.refreshSpeakerOptions?.();
        renderList(container);
    };
    setDialogueTheaterInfoPanelListRefresh(onListChange);
    wireToolbar(container);
    wireSearch(container);

    await dialogueTheaterDataService.load();
    listThumbAssets = await loadDialogueTheaterAssets();
    pairSearchControls = await wireDialogueTheaterPairSearch(container, {
        getConversations: () => dialogueTheaterDataService.conversations,
        onChange: () => renderList(container),
    });
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

    const panel = container?.querySelector('.dialogue-theater-panel-embedded');
    if (panel instanceof HTMLElement) {
        unwireDialogueTheaterToolbarCollapse(panel);
    }

    closeDialogueTheaterInfoPanel();
    setDialogueTheaterInfoPanelListRefresh(null);
    onListChange = null;
    searchQuery = '';
    pairSearchControls = null;
    listThumbAssets = null;
    container?.remove();
}

export function getDialogueTheaterListHostId() {
    return HOST_ID;
}

/**
 * @returns {boolean}
 */
export function isDialogueTheaterListActive() {
    const host = document.getElementById(HOST_ID);
    return !!host?.classList.contains('active');
}

/** Refresh list when globe filter chips change (hero-only in theater mode). */
export function syncDialogueTheaterListIfActive() {
    if (!isDialogueTheaterListActive()) return;
    onListChange?.();
}
