/**
 * Dialogue Theater listing view — conversation previews with add / save / import / export.
 * Layout mirrors the embedded Story / Data Archive event list panel one-to-one.
 */

import { showSaveSuccessFeedback } from '../../system-interface/interface-left-panel/coordinator/flashSaveSuccess.js';
import { triggerHomeExit } from '../../universal-features/atlas-header/triggerHomeExit.js';
import { dialogueTheaterDataService } from '../data/DialogueTheaterDataService.js?v=105';
import { loadDialogueTheaterAssets } from '../data/loadDialogueTheaterAssets.js';
import { getEventListSpinnerGifSrc } from '../../universal-features/atlas-ui/loadingGifAssets.js';
import { buildDialogueTheaterListThumbMediaHtml } from './buildDialogueTheaterListThumb.js';
import {
    closeDialogueTheaterInfoPanel,
    openDialogueTheaterInfoPanel,
    setDialogueTheaterInfoPanelListRefresh,
} from '../dialogue-theater-info-panel/DialogueTheaterInfoPanel.js?v=107';
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
    conversationMatchesHeroFilters,
    getHeroFiltersFromStandaloneActiveFilters,
    isDialogueTheaterHeroFilterActive,
} from './dialogueTheaterHeroFilter.js';
import {
    conversationMatchesCharacterPair,
    isDialogueTheaterPairSearchActive,
} from './dialogueTheaterPairSearch.js';
import { getActiveDialogueTheaterCharacterFilters } from './dialogueTheaterActiveCharacterFilters.js';
import { wireDialogueTheaterPairSearch } from './wireDialogueTheaterPairSearch.js';
import { conversationMatchesListSearch } from './dialogueTheaterListSearch.js';
import {
    floatArchiveFileActions,
    unfloatArchiveFileActions,
} from '../../data-workshop/archive-support/archiveFileActionsFloat.js?v=2';
import {
    collectDialogueTheaterStackableFilterOptions,
    conversationMatchesEraFilter,
    conversationMatchesEraPairFilter,
    conversationMatchesStatusFilter,
    getConversationTags,
    labelForDialogueTheaterStatus,
    normalizeDialogueTheaterStatus,
} from './dialogueTheaterEraFilter.js';
import {
    entryTypeForMode,
    getDialogueTheaterEntryMode,
    mountDialogueTheaterEntryToggle,
    unmountDialogueTheaterEntryToggle,
} from '../dialogue-theater-mode/DialogueTheaterEntryToggle.js';

const HOST_ID = 'dialogueTheaterListHost';
const SAVE_BTN_ID = 'dialogueTheaterSaveBtn';

/** @type {(() => void)|null} */
let onListChange = null;

/** @type {string} */
let searchQuery = '';

/** Stackable tag filter (Multi Path / Map Specific / Skin Specific). */
/** @type {string} */
let eraFilter = '';

/** @type {string} */
let statusFilter = '';

/** @type {string} */
let eraPairFilter = '';

/** @type {boolean} */
let incompleteFirst = false;

/** @type {{ getPairA: () => string, getPairB: () => string, refreshSpeakerOptions?: () => void }|null} */
let pairSearchControls = null;

/** @returns {string[]} */
function manifestHeroesForPairSearch() {
    const fs = typeof window !== 'undefined' ? window.FilterService : null;
    return Array.isArray(fs?.heroes) ? fs.heroes : [];
}

/** @type {import('../data/loadDialogueTheaterAssets.js').DialogueTheaterAssets|null} */
let listThumbAssets = null;

/** @type {Map<string, string[]>|null} */
let duplicateLookupCache = null;

/** @type {boolean} */
let forceFullListRebuild = false;

/** @type {boolean} */
let renderListScheduled = false;

/** @type {HTMLElement|null} */
let renderListRoot = null;

function invalidateListCaches(options = {}) {
    duplicateLookupCache = null;
    if (options.fullRebuild) forceFullListRebuild = true;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @returns {Map<string, string[]>}
 */
function getDuplicateLookup(conversations) {
    if (!duplicateLookupCache) {
        duplicateLookupCache = buildConversationDuplicateLookup(conversations);
    }
    return duplicateLookupCache;
}

/**
 * @param {HTMLElement} root
 */
function scheduleRenderList(root) {
    renderListRoot = root;
    if (renderListScheduled) return;
    renderListScheduled = true;
    requestAnimationFrame(() => {
        renderListScheduled = false;
        const host = renderListRoot;
        renderListRoot = null;
        if (host instanceof HTMLElement) renderList(host);
    });
}

/**
 * @returns {import('../data/DialogueTheaterDataService.js').DialogueConversation[]}
 */
function getModeConversations() {
    return dialogueTheaterDataService.getConversationsByEntryType(
        entryTypeForMode(getDialogueTheaterEntryMode()),
    );
}

/**
 * @returns {import('../data/DialogueTheaterDataService.js').DialogueConversation[]}
 */
function getFilteredConversations() {
    let rows = getModeConversations();

    const pairA = pairSearchControls?.getPairA?.() || '';
    const pairB = pairSearchControls?.getPairB?.() || '';
    const pairSearchActive = isDialogueTheaterPairSearchActive(pairA, pairB);

    if (pairSearchActive) {
        const manifestHeroes = manifestHeroesForPairSearch();
        rows = rows.filter((row) => conversationMatchesCharacterPair(row, pairA, pairB, manifestHeroes));
    } else {
        const heroFilters = getHeroFiltersFromStandaloneActiveFilters(window.standaloneActiveFilters);
        if (heroFilters.length) {
            rows = rows.filter((row) => conversationMatchesHeroFilters(row, heroFilters));
        }
    }

    const q = searchQuery.trim();
    if (q) {
        rows = rows.filter((row) => conversationMatchesListSearch(row, q));
    }

    if (statusFilter.trim()) {
        rows = rows.filter((row) => conversationMatchesStatusFilter(row, statusFilter));
    }
    if (eraPairFilter.trim()) {
        rows = rows.filter((row) => conversationMatchesEraPairFilter(row, eraPairFilter));
    }
    if (eraFilter.trim()) {
        rows = rows.filter((row) => conversationMatchesEraFilter(row, eraFilter));
    }

    const sorted = [...rows].sort(compareConversationListOrder);
    if (!incompleteFirst) return sorted;

    const voicelines = listThumbAssets?.voicelines || [];
    const duplicates =
        duplicateLookupCache ||
        buildConversationDuplicateLookup(getModeConversations());
    duplicateLookupCache = duplicates;

    return sorted.sort((a, b) => {
        const aUnfinished = conversationHasUnfinishedIssues(a, voicelines, duplicates) ? 0 : 1;
        const bUnfinished = conversationHasUnfinishedIssues(b, voicelines, duplicates) ? 0 : 1;
        if (aUnfinished !== bUnfinished) return aUnfinished - bUnfinished;
        return 0;
    });
}

/** @returns {{ singular: string, plural: string }} */
function entryNouns() {
    return getDialogueTheaterEntryMode() === 'chatters'
        ? { singular: 'chatter', plural: 'chatters' }
        : { singular: 'conversation', plural: 'conversations' };
}

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
    const displayTags = getConversationTags(row).filter((tag) => tag !== 'Overwatch');
    const status = normalizeDialogueTheaterStatus(row.status);
    const statusLabel = status === 'removed' ? labelForDialogueTheaterStatus(status) : '';
    const eraLabel = [...(statusLabel ? [statusLabel] : []), ...displayTags].join(' · ');
    const voicelines = listThumbAssets?.voicelines || [];
    const isUnfinished = conversationHasUnfinishedIssues(row, voicelines, duplicateLookup);
    const unfinishedSummary = isUnfinished
        ? conversationUnfinishedSummary(row, voicelines, duplicateLookup, conversations)
        : '';
    const duplicateSummary = conversationDuplicateSummary(row.id, duplicateLookup, conversations);
    const tooltipParts = [name];
    if (eraLabel) tooltipParts.push(eraLabel);
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
                        ${eraLabel ? `<p class="event-item-era dialogue-theater-list__era-tag">${escapeHtml(eraLabel)}</p>` : ''}
                    </div>
                </div>
            </div>
            <div class="event-item__thumb-chrome"></div>
        </div>
    `;

    const openPanel = () => {
        void openDialogueTheaterInfoPanel(row.id, {
            characterFilters: getActiveDialogueTheaterCharacterFilters(pairSearchControls),
        });
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
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} row
 * @param {Map<string, string[]>} duplicateLookup
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @returns {HTMLElement}
 */
function buildConversationListItem(row, duplicateLookup, conversations) {
    const item = document.createElement('article');
    item.className = 'event-item';
    item.dataset.conversationId = row.id;
    item.setAttribute('role', 'listitem');
    syncConversationListItemState(item, row, duplicateLookup);
    item.appendChild(buildConversationThumb(row, duplicateLookup, conversations));
    return item;
}

/**
 * @param {HTMLElement} item
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} row
 * @param {Map<string, string[]>} duplicateLookup
 */
function syncConversationListItemState(item, row, duplicateLookup) {
    item.classList.toggle('unsaved', dialogueTheaterDataService.isConversationUnsaved(row.id));
    const voicelines = listThumbAssets?.voicelines || [];
    item.classList.toggle(
        'event-item--unfinished',
        conversationHasUnfinishedIssues(row, voicelines, duplicateLookup),
    );
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
 * @param {number} [visibleCount]
 */
function updateListCount(root, visibleCount) {
    const total = getModeConversations().length;
    const visible = visibleCount ?? getFilteredConversations().length;
    const q = searchQuery.trim();
    const pairA = pairSearchControls?.getPairA?.() || '';
    const pairB = pairSearchControls?.getPairB?.() || '';
    const pairSearchActive = isDialogueTheaterPairSearchActive(pairA, pairB);
    const heroFilterActive =
        !pairSearchActive && isDialogueTheaterHeroFilterActive(window.standaloneActiveFilters);
    const eraActive = Boolean(eraFilter.trim() || statusFilter.trim() || eraPairFilter.trim());
    const filtering = Boolean(q || pairSearchActive || heroFilterActive || eraActive);
    const { singular, plural } = entryNouns();

    const countEl = root.querySelector('#dialogueTheaterListCount');
    if (countEl) {
        if (filtering) {
            countEl.textContent =
                visible === 1
                    ? `1 of ${total} ${plural}`
                    : `${visible} of ${total} ${plural}`;
        } else {
            countEl.textContent = total === 1 ? `1 ${singular}` : `${total} ${plural}`;
        }
    }

    const searchCountEl = root.querySelector('#dialogueTheaterSearchResultCount');
    if (searchCountEl) {
        searchCountEl.textContent = filtering ? `${visible}/${total}` : String(total);
        searchCountEl.title = filtering
            ? `${visible} of ${total} ${plural} match`
            : `${total} ${plural} in document`;
    }

    const titleEl = root.querySelector('.events-manage-title');
    if (titleEl) {
        titleEl.textContent =
            getDialogueTheaterEntryMode() === 'chatters' ? 'Hero Chatters' : 'Dialogue Theater';
    }
}

/**
 * @param {HTMLElement} root
 */
function renderList(root) {
    const listEl = root.querySelector('#dialogueTheaterList');
    if (!listEl) return;

    const rows = getFilteredConversations();
    const allConversations = getModeConversations();
    const duplicateLookup = getDuplicateLookup(allConversations);
    updateListCount(root, rows.length);

    const useIncremental = !forceFullListRebuild;
    forceFullListRebuild = false;

    if (rows.length === 0) {
        listEl.innerHTML = '';
        const empty = document.createElement('p');
        empty.className = 'dialogue-theater-list__empty';
        const q = searchQuery.trim();
        const pairA = pairSearchControls?.getPairA?.() || '';
        const pairB = pairSearchControls?.getPairB?.() || '';
        const pairSearchActive = isDialogueTheaterPairSearchActive(pairA, pairB);
        const heroFilters = getHeroFiltersFromStandaloneActiveFilters(window.standaloneActiveFilters);
        const { plural } = entryNouns();
        if (pairSearchActive) {
            const both = pairA.trim() && pairB.trim();
            empty.textContent = both
                ? `No ${plural} found between ${pairA.trim()} and ${pairB.trim()}.`
                : `No ${plural} include that character.`;
        } else if (heroFilters.length && !q) {
            empty.textContent = `No ${plural} include the selected heroes.`;
        } else if (q) {
            empty.textContent = `No ${plural} match your search.`;
        } else {
            empty.textContent =
                getDialogueTheaterEntryMode() === 'chatters'
                    ? 'No chatters yet.'
                    : 'No conversations yet. Use + Add to create one.';
        }
        listEl.appendChild(empty);
        syncSaveButtonState(root);
        return;
    }

    listEl.querySelector('.dialogue-theater-list__empty')?.remove();

    if (!useIncremental) {
        listEl.innerHTML = '';
        const fragment = document.createDocumentFragment();
        for (const row of rows) {
            fragment.appendChild(buildConversationListItem(row, duplicateLookup, allConversations));
        }
        listEl.appendChild(fragment);
        syncSaveButtonState(root);
        return;
    }

    /** @type {Map<string, HTMLElement>} */
    const existingById = new Map();
    listEl.querySelectorAll('.event-item[data-conversation-id]').forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const id = node.dataset.conversationId || '';
        if (id) existingById.set(id, node);
    });

    const visibleIds = new Set(rows.map((row) => row.id));
    for (const [id, element] of existingById) {
        if (!visibleIds.has(id)) {
            element.remove();
            existingById.delete(id);
        }
    }

    const fragment = document.createDocumentFragment();
    for (const row of rows) {
        let item = existingById.get(row.id);
        if (!item) {
            item = buildConversationListItem(row, duplicateLookup, allConversations);
        } else {
            syncConversationListItemState(item, row, duplicateLookup);
        }
        fragment.appendChild(item);
    }
    listEl.appendChild(fragment);

    syncSaveButtonState(root);
}

/**
 * @param {HTMLElement} root
 */
function wireSearch(root) {
    const searchInput = root.querySelector('#dialogueTheaterSearchInput');
    searchInput?.addEventListener('input', () => {
        searchQuery = searchInput instanceof HTMLInputElement ? searchInput.value : '';
        scheduleRenderList(root);
    });

    const eraSelect = root.querySelector('#dialogueTheaterEraFilter');
    eraSelect?.addEventListener('change', () => {
        eraFilter = eraSelect instanceof HTMLSelectElement ? eraSelect.value : '';
        scheduleRenderList(root);
    });

    const statusSelect = root.querySelector('#dialogueTheaterStatusFilter');
    statusSelect?.addEventListener('change', () => {
        statusFilter = statusSelect instanceof HTMLSelectElement ? statusSelect.value : '';
        scheduleRenderList(root);
    });

    const eraPairSelect = root.querySelector('#dialogueTheaterEraPairFilter');
    eraPairSelect?.addEventListener('change', () => {
        eraPairFilter = eraPairSelect instanceof HTMLSelectElement ? eraPairSelect.value : '';
        scheduleRenderList(root);
    });

    const incompleteBtn = root.querySelector('#dialogueTheaterIncompleteFirstBtn');
    if (incompleteBtn instanceof HTMLButtonElement) {
        const storageKey = 'dialogueTheaterIncompleteFirst';
        try {
            incompleteFirst = localStorage.getItem(storageKey) === '1';
        } catch (_) {
            incompleteFirst = false;
        }
        incompleteBtn.setAttribute('aria-pressed', incompleteFirst ? 'true' : 'false');
        incompleteBtn.classList.toggle('is-active', incompleteFirst);

        incompleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            incompleteFirst = !incompleteFirst;
            incompleteBtn.setAttribute('aria-pressed', incompleteFirst ? 'true' : 'false');
            incompleteBtn.classList.toggle('is-active', incompleteFirst);
            try {
                localStorage.setItem(storageKey, incompleteFirst ? '1' : '0');
            } catch (_) {}
            scheduleRenderList(root);
        });
    }
}

/**
 * Keep status / era / tag filter dropdowns in sync.
 * @param {HTMLElement} root
 */
function refreshEraFilterOptions(root) {
    const tagSelect = root.querySelector('#dialogueTheaterEraFilter');
    if (tagSelect instanceof HTMLSelectElement) {
        const previous = eraFilter || tagSelect.value || '';
        const tags = collectDialogueTheaterStackableFilterOptions(getModeConversations());
        const options = [
            `<option value="">All extras</option>`,
            `<option value="__untagged__">No extras</option>`,
            ...tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`),
        ];
        tagSelect.innerHTML = options.join('');
        if (previous && [...tagSelect.options].some((opt) => opt.value === previous)) {
            tagSelect.value = previous;
            eraFilter = previous;
        } else {
            tagSelect.value = '';
            eraFilter = '';
        }
    }

    const statusSelect = root.querySelector('#dialogueTheaterStatusFilter');
    if (statusSelect instanceof HTMLSelectElement) {
        const previous = statusFilter || statusSelect.value || '';
        if (previous && [...statusSelect.options].some((opt) => opt.value === previous)) {
            statusSelect.value = previous;
            statusFilter = previous;
        } else {
            statusSelect.value = '';
            statusFilter = '';
        }
    }

    const eraSelect = root.querySelector('#dialogueTheaterEraPairFilter');
    if (eraSelect instanceof HTMLSelectElement) {
        const previous = eraPairFilter || eraSelect.value || '';
        if (previous && [...eraSelect.options].some((opt) => opt.value === previous)) {
            eraSelect.value = previous;
            eraPairFilter = previous;
        } else {
            eraSelect.value = '';
            eraPairFilter = '';
        }
    }
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
        const row =
            getDialogueTheaterEntryMode() === 'chatters'
                ? dialogueTheaterDataService.addBlankChatter('Unknown')
                : dialogueTheaterDataService.addBlankConversation();
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
                                <div class="dialogue-theater-pair-search-col__input-wrap">
                                    <input type="text" id="dialogueTheaterPairSearchA" class="events-search-input dialogue-theater-pair-search-col__input" placeholder="Character A..." autocomplete="off" spellcheck="false" />
                                </div>
                            </div>
                            <div class="dialogue-theater-pair-search-col dialogue-theater-pair-search-col--title">
                                <label for="dialogueTheaterSearchInput" class="events-search-label dialogue-theater-pair-search-col__search-label">Search:</label>
                                <div class="dialogue-theater-pair-search-col__icon dialogue-theater-pair-search-col__icon--count" aria-hidden="true">
                                    <span id="dialogueTheaterSearchResultCount" class="events-search-result-count" aria-live="polite">0</span>
                                </div>
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
                                <div class="dialogue-theater-pair-search-col__input-wrap">
                                    <input type="text" id="dialogueTheaterPairSearchB" class="events-search-input dialogue-theater-pair-search-col__input" placeholder="Character B..." autocomplete="off" spellcheck="false" />
                                </div>
                            </div>
                        </div>
                        <div class="events-manage-search-row events-manage-search-row--secondary dialogue-theater-era-filter-row">
                            <div class="dialogue-theater-era-filter-col">
                                <label for="dialogueTheaterStatusFilter" class="events-search-label">Status:</label>
                                <select id="dialogueTheaterStatusFilter" class="events-search-input dialogue-theater-era-filter__select" aria-label="Filter by status">
                                    <option value="">All</option>
                                    <option value="active">Active</option>
                                    <option value="removed">Removed</option>
                                </select>
                            </div>
                            <div class="dialogue-theater-era-filter-col">
                                <label for="dialogueTheaterEraFilter" class="events-search-label">Tags:</label>
                                <div class="dialogue-theater-era-filter__controls">
                                    <select id="dialogueTheaterEraFilter" class="events-search-input dialogue-theater-era-filter__select" aria-label="Filter by extra tags">
                                        <option value="">All extras</option>
                                        <option value="__untagged__">No extras</option>
                                    </select>
                                    <button
                                        type="button"
                                        id="dialogueTheaterIncompleteFirstBtn"
                                        class="dialogue-theater-incomplete-first-btn"
                                        aria-pressed="false"
                                        title="Show unfinished (red border) conversations first"
                                    >Incomplete first</button>
                                </div>
                            </div>
                            <div class="dialogue-theater-era-filter-col">
                                <label for="dialogueTheaterEraPairFilter" class="events-search-label">Era:</label>
                                <select id="dialogueTheaterEraPairFilter" class="events-search-input dialogue-theater-era-filter__select" aria-label="Filter by era">
                                    <option value="">All</option>
                                    <option value="Overwatch">Overwatch</option>
                                    <option value="Classic">Classic</option>
                                </select>
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
    eraFilter = '';
    statusFilter = '';
    eraPairFilter = '';
    pairSearchControls = null;
    invalidateListCaches({ fullRebuild: true });
    onListChange = () => {
        invalidateListCaches({ fullRebuild: true });
        pairSearchControls?.refreshSpeakerOptions?.();
        refreshEraFilterOptions(container);
        scheduleRenderList(container);
    };
    setDialogueTheaterInfoPanelListRefresh(onListChange);
    wireToolbar(container);
    wireSearch(container);

    await dialogueTheaterDataService.load();
    listThumbAssets = await loadDialogueTheaterAssets();
    refreshEraFilterOptions(container);
    pairSearchControls = await wireDialogueTheaterPairSearch(container, {
        getConversations: () => getModeConversations(),
        onChange: () => scheduleRenderList(container),
    });
    mountDialogueTheaterEntryToggle({
        onChange: () => {
            closeDialogueTheaterInfoPanel();
            invalidateListCaches({ fullRebuild: true });
            refreshEraFilterOptions(container);
            pairSearchControls?.refreshSpeakerOptions?.();
            scheduleRenderList(container);
        },
    });
    renderList(container);

    const theaterActions = container.querySelector('#dialogueTheaterBottomBar .events-manage-actions')
        || document.querySelector('#dockGlobeRailRight > .events-manage-actions');
    if (theaterActions instanceof HTMLElement) {
        floatArchiveFileActions(theaterActions, 'theater');
    }

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
    unmountDialogueTheaterEntryToggle();
    unfloatArchiveFileActions('theater');

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
    eraFilter = '';
    statusFilter = '';
    eraPairFilter = '';
    incompleteFirst = false;
    pairSearchControls = null;
    listThumbAssets = null;
    invalidateListCaches();
    renderListScheduled = false;
    renderListRoot = null;
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
    const host = document.getElementById(HOST_ID);
    if (host instanceof HTMLElement) scheduleRenderList(host);
}
