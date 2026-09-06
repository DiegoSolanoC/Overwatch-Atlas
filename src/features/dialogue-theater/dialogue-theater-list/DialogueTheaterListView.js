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
} from '../dialogue-theater-info-panel/DialogueTheaterInfoPanel.js?v=108';
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
    conversationMatchesResolvedCharacterPair,
    clearPairSearchCaches,
    isDialogueTheaterPairSearchActive,
    resolveExactRosterHero,
} from './dialogueTheaterPairSearch.js';
import { getActiveDialogueTheaterCharacterFilters } from './dialogueTheaterActiveCharacterFilters.js';
import { wireDialogueTheaterPairSearch } from './wireDialogueTheaterPairSearch.js';
import { conversationMatchesListSearch, buildConversationSearchHaystack } from './dialogueTheaterListSearch.js';
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
import { waitForLoadingOverlayInactive } from '../../universal-features/atlas-mode-runtime/loadingOverlayState.js';

const HOST_ID = 'dialogueTheaterListHost';
const SAVE_BTN_ID = 'dialogueTheaterSaveBtn';

/** @type {(() => void)|null} */
let onListChange = null;

/** @type {string} */
let searchQuery = '';

/** Stackable tag filter (Multi Path / Map Specific / Skin Specific / Event Specific). */
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

/** @type {Map<string, Map<string, string[]>>} */
const duplicateLookupCacheByMode = new Map();

/** @type {Map<string, Map<string, boolean>>} */
const unfinishedCacheByMode = new Map();

/** @type {Map<string, Map<string, { lower: string, fold: string, stripped: string, normalized: string }>>} */
const searchHaystackCacheByMode = new Map();

/** @type {import('../data/DialogueTheaterDataService.js').DialogueConversation[]|null} */
let modeConversationsCache = null;

/** @type {string} */
let modeConversationsCacheKey = '';

/**
 * Keep built list cards across filter changes so returning to Overwatch (~1k)
 * reuses DOM instead of rebuilding thumbs/images.
 * Separate pools per entry mode so Dialogues ↔ Chatters does not remount ~1k cards.
 * @type {Map<string, Map<string, HTMLElement>>}
 */
const listItemPoolsByMode = new Map();

/** @type {Map<string, string>} */
const lastRenderedIdsKeyByMode = new Map();

/** @type {string} */
let listItemPoolMode = '';

/** @type {Map<string, HTMLElement>} */
let listItemPool = new Map();

/** @type {string} */
let lastRenderedIdsKey = '';

/** @type {number} */
let progressiveRenderToken = 0;

/** Initial sync create budget when cold-building a large Overwatch set. */
const LIST_CREATE_CHUNK = 48;

/** Pause progressive appends while the pointer is over the list (grid reflow under cursor). */
let listPointerInside = false;

/** @type {boolean} */
let forceFullListRebuild = false;

/** @type {boolean} */
let renderListScheduled = false;

/** @type {HTMLElement|null} */
let renderListRoot = null;

/** @type {number} */
let searchDebounceTimer = 0;

/** @type {Set<string>|null} */
let voicelineSetCache = null;

function getVoicelineSet() {
    const list = listThumbAssets?.voicelines || [];
    if (!voicelineSetCache || voicelineSetCache.size !== list.length) {
        voicelineSetCache = new Set(list);
    }
    return voicelineSetCache;
}

/**
 * @param {string} mode
 * @returns {Map<string, HTMLElement>}
 */
function poolForMode(mode) {
    let pool = listItemPoolsByMode.get(mode);
    if (!pool) {
        pool = new Map();
        listItemPoolsByMode.set(mode, pool);
    }
    return pool;
}

function adoptPoolForCurrentMode() {
    const mode = getDialogueTheaterEntryMode();
    if (listItemPoolMode && listItemPoolMode !== mode) {
        lastRenderedIdsKeyByMode.set(listItemPoolMode, lastRenderedIdsKey);
    }
    listItemPoolMode = mode;
    listItemPool = poolForMode(mode);
    lastRenderedIdsKey = lastRenderedIdsKeyByMode.get(mode) || '';
}

function clearListItemPool() {
    listItemPoolsByMode.clear();
    lastRenderedIdsKeyByMode.clear();
    listItemPool = new Map();
    listItemPoolMode = '';
    lastRenderedIdsKey = '';
    progressiveRenderToken += 1;
}

function invalidateListCaches(options = {}) {
    if (options.soft) {
        // Mode toggle: keep per-mode pools + validation caches; only drop mode list slice.
        modeConversationsCache = null;
        modeConversationsCacheKey = '';
        return;
    }
    duplicateLookupCacheByMode.clear();
    unfinishedCacheByMode.clear();
    searchHaystackCacheByMode.clear();
    modeConversationsCache = null;
    modeConversationsCacheKey = '';
    voicelineSetCache = null;
    clearPairSearchCaches();
    if (options.fullRebuild) {
        forceFullListRebuild = true;
        clearListItemPool();
    }
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @returns {Map<string, string[]>}
 */
function getDuplicateLookup(conversations) {
    const mode = getDialogueTheaterEntryMode();
    const cached = duplicateLookupCacheByMode.get(mode);
    if (cached) return cached;
    // Chatter hubs can have thousands of lines — fingerprint sort freezes the UI.
    // Duplicate chrome is for dialogue pairs; skip in chatter mode.
    const map =
        mode === 'chatters'
            ? new Map()
            : buildConversationDuplicateLookup(conversations);
    duplicateLookupCacheByMode.set(mode, map);
    return map;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @returns {Map<string, boolean>}
 */
function getUnfinishedCache(conversations) {
    const mode = getDialogueTheaterEntryMode();
    const cached = unfinishedCacheByMode.get(mode);
    if (cached) return cached;
    const voiceSet = getVoicelineSet();
    const duplicates = getDuplicateLookup(conversations);
    /** @type {Map<string, boolean>} */
    const map = new Map();
    for (const row of conversations) {
        map.set(row.id, conversationHasUnfinishedIssues(row, voiceSet, duplicates));
    }
    unfinishedCacheByMode.set(mode, map);
    return map;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @returns {Map<string, { lower: string, fold: string, stripped: string, normalized: string }>}
 */
function getSearchHaystackCache(conversations) {
    const mode = getDialogueTheaterEntryMode();
    const cached = searchHaystackCacheByMode.get(mode);
    if (cached) return cached;
    /** @type {Map<string, { lower: string, fold: string, stripped: string, normalized: string }>} */
    const map = new Map();
    for (const row of conversations) {
        map.set(row.id, buildConversationSearchHaystack(row));
    }
    searchHaystackCacheByMode.set(mode, map);
    return map;
}

/**
 * @returns {import('../data/DialogueTheaterDataService.js').DialogueConversation[]}
 */
function getModeConversations() {
    const mode = getDialogueTheaterEntryMode();
    if (modeConversationsCache && modeConversationsCacheKey === mode) {
        // Mid-load rAF can cache [] before conversations.json finishes — refresh if data arrived.
        if (modeConversationsCache.length === 0) {
            const live = dialogueTheaterDataService.getConversationsByEntryType(
                entryTypeForMode(mode),
            );
            if (live.length > 0) modeConversationsCache = live;
        }
        return modeConversationsCache;
    }
    modeConversationsCacheKey = mode;
    modeConversationsCache = dialogueTheaterDataService.getConversationsByEntryType(
        entryTypeForMode(mode),
    );
    return modeConversationsCache;
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
function getFilteredConversations() {
    let rows = getModeConversations();

    const pairA = pairSearchControls?.getPairA?.() || '';
    const pairB = pairSearchControls?.getPairB?.() || '';
    const manifestHeroes = manifestHeroesForPairSearch();
    const resolvedPairA = resolveExactRosterHero(pairA, manifestHeroes);
    const resolvedPairB = resolveExactRosterHero(pairB, manifestHeroes);
    const pairSearchActive = Boolean(resolvedPairA || resolvedPairB);

    if (pairSearchActive) {
        const keyCache = new Map();
        rows = rows.filter((row) =>
            conversationMatchesResolvedCharacterPair(
                row,
                resolvedPairA,
                resolvedPairB,
                manifestHeroes,
                keyCache,
            ),
        );
    } else {
        const heroFilters = getHeroFiltersFromStandaloneActiveFilters(window.standaloneActiveFilters);
        if (heroFilters.length) {
            rows = rows.filter((row) => conversationMatchesHeroFilters(row, heroFilters));
        }
    }

    const q = searchQuery.trim();
    // Haystacks join every subtitle — only build when the user is actually searching.
    if (q) {
        const haystacks = getSearchHaystackCache(getModeConversations());
        rows = rows.filter((row) =>
            conversationMatchesListSearch(row, q, haystacks.get(row.id) || null),
        );
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

    const unfinished = getUnfinishedCache(getModeConversations());

    return sorted.sort((a, b) => {
        const aUnfinished = unfinished.get(a.id) ? 0 : 1;
        const bUnfinished = unfinished.get(b.id) ? 0 : 1;
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
function buildConversationThumb(row, duplicateLookup, conversations, unfinished = null) {
    const name = row.name || 'Untitled conversation';
    const displayTags = getConversationTags(row).filter((tag) => tag !== 'Overwatch');
    const status = normalizeDialogueTheaterStatus(row.status);
    const statusLabel = status === 'removed' ? labelForDialogueTheaterStatus(status) : '';
    const eraLabel = [...(statusLabel ? [statusLabel] : []), ...displayTags].join(' · ');
    const voiceSet = getVoicelineSet();
    const isUnfinished = unfinished
        ? Boolean(unfinished.get(row.id))
        : conversationHasUnfinishedIssues(row, voiceSet, duplicateLookup);
    const unfinishedSummary = isUnfinished
        ? getDialogueTheaterEntryMode() === 'chatters'
            ? 'Unfinished: needs review'
            : conversationUnfinishedSummary(row, voiceSet, duplicateLookup, conversations)
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
 * @param {HTMLElement} item
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} row
 * @param {Map<string, string[]>} duplicateLookup
 * @param {Map<string, boolean>} [unfinished]
 */
function syncConversationListItemState(item, row, duplicateLookup, unfinished = null) {
    item.classList.toggle('unsaved', dialogueTheaterDataService.isConversationUnsaved(row.id));
    const isUnfinished = unfinished
        ? Boolean(unfinished.get(row.id))
        : conversationHasUnfinishedIssues(row, getVoicelineSet(), duplicateLookup);
    item.classList.toggle('event-item--unfinished', isUnfinished);
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} row
 * @param {Map<string, string[]>} duplicateLookup
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @param {Map<string, boolean>} unfinished
 * @returns {HTMLElement}
 */
function buildConversationListItem(row, duplicateLookup, conversations, unfinished) {
    const item = document.createElement('article');
    item.className = 'event-item';
    item.dataset.conversationId = row.id;
    item.setAttribute('role', 'listitem');
    syncConversationListItemState(item, row, duplicateLookup, unfinished);
    item.appendChild(buildConversationThumb(row, duplicateLookup, conversations, unfinished));
    return item;
}

/**
 * @param {HTMLElement} listEl
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation[]} rows
 * @param {Map<string, string[]>} duplicateLookup
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation[]} allConversations
 * @param {Map<string, boolean>} unfinished
 * @param {number} startIndex
 * @param {number} token
 */
function progressiveAppendMissingItems(
    listEl,
    rows,
    duplicateLookup,
    allConversations,
    unfinished,
    startIndex,
    token,
) {
    if (token !== progressiveRenderToken) return;

    const scheduleNext = (nextIndex) => {
        const schedule = typeof requestIdleCallback === 'function'
            ? (cb) => requestIdleCallback(cb, { timeout: 64 })
            : (cb) => setTimeout(cb, 16);
        schedule(() => {
            void waitForLoadingOverlayInactive().then(() => {
                if (token !== progressiveRenderToken) return;
                progressiveAppendMissingItems(
                    listEl,
                    rows,
                    duplicateLookup,
                    allConversations,
                    unfinished,
                    nextIndex,
                    token,
                );
            });
        });
    };

    // Don't insert cards under an active hover — auto-fill grid reflow makes thumbs
    // bounce on/off and steal clicks until the fill finishes.
    if (listPointerInside) {
        scheduleNext(startIndex);
        return;
    }

    let index = startIndex;
    let created = 0;
    while (index < rows.length && created < LIST_CREATE_CHUNK) {
        const row = rows[index];
        index += 1;
        let item = listItemPool.get(row.id);
        if (item?.parentElement === listEl) continue;
        if (!item) {
            item = buildConversationListItem(row, duplicateLookup, allConversations, unfinished);
            listItemPool.set(row.id, item);
        }
        created += 1;
        syncConversationListItemState(item, row, duplicateLookup, unfinished);
        const prev = index > 1 ? listItemPool.get(rows[index - 2].id) : null;
        if (prev?.parentElement === listEl) {
            prev.after(item);
        } else {
            listEl.appendChild(item);
        }
    }

    if (index < rows.length && token === progressiveRenderToken) {
        scheduleNext(index);
    }
}

/**
 * @param {HTMLElement} root
 */
function renderList(root) {
    const listEl = root.querySelector('#dialogueTheaterList');
    if (!listEl) return;

    if (!listEl.dataset.progressivePauseWired) {
        listEl.dataset.progressivePauseWired = '1';
        listEl.addEventListener('pointerenter', () => {
            listPointerInside = true;
        });
        listEl.addEventListener('pointerleave', () => {
            listPointerInside = false;
        });
    }

    const mode = getDialogueTheaterEntryMode();
    adoptPoolForCurrentMode();

    const rows = getFilteredConversations();
    const allConversations = getModeConversations();
    const duplicateLookup = getDuplicateLookup(allConversations);
    const unfinished = getUnfinishedCache(allConversations);
    updateListCount(root, rows.length);

    const useIncremental = !forceFullListRebuild;
    forceFullListRebuild = false;
    progressiveRenderToken += 1;
    const renderToken = progressiveRenderToken;

    if (rows.length === 0) {
        listEl.replaceChildren();
        const empty = document.createElement('p');
        empty.className = 'dialogue-theater-list__empty';
        const q = searchQuery.trim();
        const pairA = pairSearchControls?.getPairA?.() || '';
        const pairB = pairSearchControls?.getPairB?.() || '';
        const pairSearchActive = isDialogueTheaterPairSearchActive(
            pairA,
            pairB,
            manifestHeroesForPairSearch(),
        );
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
        lastRenderedIdsKey = '';
        lastRenderedIdsKeyByMode.set(mode, '');
        syncSaveButtonState(root);
        return;
    }

    listEl.querySelector('.dialogue-theater-list__empty')?.remove();

    const idsKey = rows.map((row) => row.id).join('\0');
    if (useIncremental && idsKey === lastRenderedIdsKey) {
        // Same visible set — never remount. Progressive fill may still be appending;
        // replaceChildren here was remounting thumbs mid-hover (bounce / dead clicks).
        // After mode switch the DOM still shows the *other* mode's cards even when this
        // mode's idsKey matches its cached key — only early-return when list shows our pool.
        const firstMounted = listEl.querySelector('.event-item');
        const showingCurrentPool =
            firstMounted instanceof HTMLElement &&
            listItemPool.get(firstMounted.dataset.conversationId || '') === firstMounted;
        if (showingCurrentPool || rows.length === 0) {
            for (const row of rows) {
                const item = listItemPool.get(row.id);
                if (item?.parentElement === listEl) {
                    syncConversationListItemState(item, row, duplicateLookup, unfinished);
                }
            }
            syncSaveButtonState(root);
            return;
        }
    }
    lastRenderedIdsKey = idsKey;
    lastRenderedIdsKeyByMode.set(mode, idsKey);

    /** @type {import('../data/DialogueTheaterDataService.js').DialogueConversation[]} */
    const missingRows = [];
    for (const row of rows) {
        if (!listItemPool.has(row.id)) missingRows.push(row);
    }

    // Always create in chunks — full rebuild clears the pool but should not freeze on ~1k cards.
    const syncCreateCount = LIST_CREATE_CHUNK;
    for (let i = 0; i < missingRows.length && i < syncCreateCount; i += 1) {
        const row = missingRows[i];
        const item = buildConversationListItem(row, duplicateLookup, allConversations, unfinished);
        listItemPool.set(row.id, item);
    }

    // Mount only a first chunk synchronously — swapping ~1k pooled cards via replaceChildren
    // freezes the main thread when toggling Dialogues ↔ Chatters.
    const fragment = document.createDocumentFragment();
    let mountedSync = 0;
    for (const row of rows) {
        if (mountedSync >= LIST_CREATE_CHUNK) break;
        const item = listItemPool.get(row.id);
        if (!item) continue;
        syncConversationListItemState(item, row, duplicateLookup, unfinished);
        fragment.appendChild(item);
        mountedSync += 1;
    }
    listEl.replaceChildren(fragment);

    const needsProgressive = rows.some((row) => {
        const item = listItemPool.get(row.id);
        return !item || item.parentElement !== listEl;
    });

    if (needsProgressive) {
        let progressiveStart = 0;
        for (let i = 0; i < rows.length; i += 1) {
            const item = listItemPool.get(rows[i].id);
            if (!item || item.parentElement !== listEl) {
                progressiveStart = i;
                break;
            }
        }

        requestAnimationFrame(() => {
            void waitForLoadingOverlayInactive().then(() => {
                if (renderToken !== progressiveRenderToken) return;
                progressiveAppendMissingItems(
                    listEl,
                    rows,
                    duplicateLookup,
                    allConversations,
                    unfinished,
                    progressiveStart,
                    renderToken,
                );
            });
        });
    }

    syncSaveButtonState(root);
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
    const pairSearchActive = isDialogueTheaterPairSearchActive(
        pairA,
        pairB,
        manifestHeroesForPairSearch(),
    );
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
function wireSearch(root) {
    const searchInput = root.querySelector('#dialogueTheaterSearchInput');
    searchInput?.addEventListener('input', () => {
        searchQuery = searchInput instanceof HTMLInputElement ? searchInput.value : '';
        window.clearTimeout(searchDebounceTimer);
        searchDebounceTimer = window.setTimeout(() => {
            scheduleRenderList(root);
        }, 120);
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

    // Float dock chrome early (Story/World pattern) so chatter toggle + file
    // actions are already visible when the loading overlay drops.
    mountDialogueTheaterEntryToggle({
        onChange: () => {
            closeDialogueTheaterInfoPanel();
            // Soft invalidate — keep per-mode card pools so switching does not remount ~1k thumbs.
            invalidateListCaches({ soft: true });
            refreshEraFilterOptions(container);
            pairSearchControls?.refreshSpeakerOptions?.();
            scheduleRenderList(container);
        },
    });
    const theaterActionsEarly = container.querySelector('#dialogueTheaterBottomBar .events-manage-actions');
    if (theaterActionsEarly instanceof HTMLElement) {
        floatArchiveFileActions(theaterActionsEarly, 'theater');
    }

    await dialogueTheaterDataService.load();
    // Drop any mid-load empty list cache / pending rAF from chrome mounted before data was ready.
    renderListScheduled = false;
    renderListRoot = null;
    invalidateListCaches({ fullRebuild: true });
    listThumbAssets = await loadDialogueTheaterAssets();
    refreshEraFilterOptions(container);
    pairSearchControls = await wireDialogueTheaterPairSearch(container, {
        getConversations: () => getModeConversations(),
        onChange: () => scheduleRenderList(container),
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
    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = 0;
    invalidateListCaches({ fullRebuild: true });
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
