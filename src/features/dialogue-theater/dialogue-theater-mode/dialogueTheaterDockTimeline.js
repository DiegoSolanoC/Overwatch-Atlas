/**
 * Dialogue Theater dock strip — filtered conversations/chatters as pagination thumbs.
 *
 * Default (Dialogues mode, no text/pair search): keep the story timeline in the dock.
 * Switch the dock to theater entries when:
 *   - Hero Chatters mode is active, or
 *   - Dialogues mode + title/line search and/or character A/B pair search
 * Status / era-pair / tag filters alone do not take over the dock.
 *
 * Events stay lightweight (id/name only); scene + character renders hydrate lazily
 * for the visible page so filter refreshes stay cheap.
 */

import { sceneImageUrl, loadDialogueTheaterAssets } from '../data/loadDialogueTheaterAssets.js';
import { dialogueTheaterDataService } from '../data/DialogueTheaterDataService.js';
import {
    getConversationIdleRenderPair,
    usesSoloSpeakerPreview,
} from '../dialogue-theater-stage/dialogueTheaterRenderHelpers.js';
import { getDialogueTheaterEntryMode } from './DialogueTheaterEntryToggle.js';
import { openDialogueTheaterInfoPanel } from '../dialogue-theater-info-panel/DialogueTheaterInfoPanel.js';
import { refreshDockTimelinePagination } from '../../system-interface/interface-bottom-dock/refreshDockTimelinePagination.js';

export const DIALOGUE_THEATER_DOCK_KIND = 'dialogue-theater';

/** @typedef {'' | 'active' | 'removed'} DialogueTheaterDockStatusFilter */
/** @typedef {'' | 'Overwatch' | 'Classic'} DialogueTheaterDockEraPairFilter */

/** @type {DialogueTheaterDockStatusFilter} */
let dockStatusFilter = '';

/** @type {DialogueTheaterDockEraPairFilter} */
let dockEraPairFilter = '';

/** @type {string} */
let dockFilterOptionId = 'theater-all';

const ERAS_ICON_BASE = 'src/assets/images/Icons/Eras%20Icons/';

/**
 * Theater dock Eras menu — All / Overwatch / Classic / Active / Removed.
 * @type {readonly {
 *   id: string,
 *   label: string,
 *   iconPath: string,
 *   labelColor: string,
 *   status: DialogueTheaterDockStatusFilter,
 *   eraPair: DialogueTheaterDockEraPairFilter,
 * }[]}
 */
export const DIALOGUE_THEATER_DOCK_STATUS_OPTIONS = Object.freeze([
    {
        id: 'theater-all',
        label: 'All Entries',
        iconPath: `${ERAS_ICON_BASE}The%20Complete%20Timeline.png`,
        labelColor: '#f0f0f0',
        status: '',
        eraPair: '',
    },
    {
        id: 'theater-overwatch',
        label: 'Overwatch',
        iconPath: `${ERAS_ICON_BASE}The%20Golden%20Age.png`,
        labelColor: '#ff9800',
        status: '',
        eraPair: 'Overwatch',
    },
    {
        id: 'theater-classic',
        label: 'Classic',
        iconPath: `${ERAS_ICON_BASE}Classic.png`,
        labelColor: '#42a5f5',
        status: '',
        eraPair: 'Classic',
    },
    {
        id: 'theater-active',
        label: 'Active',
        iconPath: `${ERAS_ICON_BASE}Active.png`,
        labelColor: '#4caf50',
        status: 'active',
        eraPair: '',
    },
    {
        id: 'theater-removed',
        label: 'Removed',
        iconPath: `${ERAS_ICON_BASE}Removed.png`,
        labelColor: '#e53935',
        status: 'removed',
        eraPair: '',
    },
]);


/** @type {import('../data/loadDialogueTheaterAssets.js').DialogueTheaterAssets|null} */
let dockAssets = null;

/** @type {object[]|null} */
let cachedDockEvents = null;

/** @type {ReturnType<typeof setTimeout>|null} */
let dockRefreshTimer = null;

/**
 * @typedef {{
 *   image: string,
 *   imagePath: string,
 *   _dialogueTheaterScene: string,
 *   _dialogueTheaterLeft: string,
 *   _dialogueTheaterRight: string,
 *   _dialogueTheaterSolo: boolean,
 * }} DialogueTheaterDockVisuals
 */

/** @type {Map<string, DialogueTheaterDockVisuals>} */
const visualCache = new Map();


/**
 * Theater mode UI is mounted (list host present). Globe chrome stays hidden.
 * @returns {boolean}
 */
export function isDialogueTheaterModeMounted() {
    return (
        document.body.classList.contains('dialogue-theater-mode-active')
        && !!document.getElementById('dialogueTheaterListHost')
    );
}

/**
 * True when the dock should show theater entries instead of the story timeline.
 * @returns {boolean}
 */
export function isDialogueTheaterDockActive() {
    if (!isDialogueTheaterModeMounted()) return false;
    const probe =
        typeof window !== 'undefined'
            ? window.__isDialogueTheaterDockEntryStripActive
            : null;
    if (typeof probe === 'function') return !!probe();
    // List not wired yet — chatters mode alone is enough.
    return getDialogueTheaterEntryMode() === 'chatters';
}

/**
 * @returns {DialogueTheaterDockStatusFilter}
 */
export function getDialogueTheaterDockStatusFilter() {
    return dockStatusFilter;
}

/**
 * @returns {DialogueTheaterDockEraPairFilter}
 */
export function getDialogueTheaterDockEraPairFilter() {
    return dockEraPairFilter;
}

/**
 * @param {string | null | undefined} optionId
 */
export function getDialogueTheaterDockStatusOption(optionId) {
    const id = String(optionId || '').trim();
    if (id === 'theater-both') {
        return DIALOGUE_THEATER_DOCK_STATUS_OPTIONS[0];
    }
    return (
        DIALOGUE_THEATER_DOCK_STATUS_OPTIONS.find((o) => o.id === id)
        || DIALOGUE_THEATER_DOCK_STATUS_OPTIONS[0]
    );
}

/**
 * @param {DialogueTheaterDockStatusFilter} status
 */
export function setDialogueTheaterDockStatusFilter(status) {
    const next = status === 'active' || status === 'removed' ? status : '';
    const optionId =
        next === 'active' ? 'theater-active'
            : next === 'removed' ? 'theater-removed'
                : 'theater-all';
    setDialogueTheaterDockStatusFromOptionId(optionId);
}

/**
 * @param {string} optionId
 */
export function setDialogueTheaterDockStatusFromOptionId(optionId) {
    const opt = getDialogueTheaterDockStatusOption(optionId);
    const nextId = opt.id;
    const nextStatus = opt.status;
    const nextEra = opt.eraPair;
    if (
        nextId === dockFilterOptionId
        && nextStatus === dockStatusFilter
        && nextEra === dockEraPairFilter
    ) {
        return;
    }
    dockFilterOptionId = nextId;
    dockStatusFilter = nextStatus;
    dockEraPairFilter = nextEra;
    invalidateDialogueTheaterDockEventsCache();
}

/**
 * Active Eras-menu option id for the current theater dock filter.
 * @returns {string}
 */
export function getDialogueTheaterDockStatusOptionId() {
    return dockFilterOptionId || 'theater-all';
}

/**
 * @param {unknown} event
 * @returns {boolean}
 */
export function isDialogueTheaterDockEvent(event) {
    return !!(event && typeof event === 'object' && event._atlasDockKind === DIALOGUE_THEATER_DOCK_KIND);
}

/**
 * @param {unknown} event
 * @returns {string}
 */
export function getDialogueTheaterConversationIdFromDockEvent(event) {
    if (!isDialogueTheaterDockEvent(event)) return '';
    return String(event._dialogueTheaterConversationId || event.id || '').trim();
}

/**
 * Lightweight stub — no scene/render resolution (that happens per visible thumb).
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} row
 * @param {number} index
 */
function conversationToDockEventStub(row, index) {
    const name = String(row?.name || 'Untitled').trim() || 'Untitled';
    const kindLabel = getDialogueTheaterEntryMode() === 'chatters' ? 'Chatter' : 'Dialogue';
    return {
        id: row.id,
        name,
        image: '',
        imagePath: '',
        description: `${kindLabel} · ${name}`,
        eraName: '',
        _atlasDockKind: DIALOGUE_THEATER_DOCK_KIND,
        _dialogueTheaterConversationId: row.id,
        _dialogueTheaterIndex: index,
        _dialogueTheaterStatus: row.status,
        _dialogueTheaterVisualReady: false,
        _dialogueTheaterScene: '',
        _dialogueTheaterLeft: '',
        _dialogueTheaterRight: '',
        _dialogueTheaterSolo: false,
    };
}

/**
 * Resolve scene + character renders for one dock event (cached by conversation id).
 * @param {object} event
 * @returns {object}
 */
export function hydrateDialogueTheaterDockEventVisuals(event) {
    if (!isDialogueTheaterDockEvent(event)) return event;
    if (event._dialogueTheaterVisualReady) return event;

    const id = getDialogueTheaterConversationIdFromDockEvent(event);
    if (!id) {
        event._dialogueTheaterVisualReady = true;
        return event;
    }

    const cached = visualCache.get(id);
    if (cached) {
        Object.assign(event, cached);
        event._dialogueTheaterVisualReady = true;
        return event;
    }

    const row = dialogueTheaterDataService.getConversationById(id);
    let scene = '';
    let left = '';
    let right = '';
    let solo = false;
    if (row) {
        if (row.scene) {
            try {
                scene = sceneImageUrl(row.scene) || '';
            } catch {
                scene = '';
            }
        }
        const pair = getConversationIdleRenderPair(row, dockAssets?.renders || {});
        left = pair.left || '';
        right = pair.right || '';
        solo = usesSoloSpeakerPreview(row);
    }

    const image = scene || left || right || '';
    /** @type {DialogueTheaterDockVisuals} */
    const payload = {
        image,
        imagePath: image,
        _dialogueTheaterScene: scene,
        _dialogueTheaterLeft: left,
        _dialogueTheaterRight: right,
        _dialogueTheaterSolo: solo,
    };
    visualCache.set(id, payload);
    Object.assign(event, payload);
    event._dialogueTheaterVisualReady = true;
    return event;
}

/**
 * @param {HTMLImageElement|null|undefined} img
 * @param {string} src
 */
function setTheaterLayerImgSrc(img, src) {
    if (!(img instanceof HTMLImageElement)) return;
    const next = String(src || '').trim();
    if (!next) {
        img.removeAttribute('src');
        img.hidden = true;
        return;
    }
    img.hidden = false;
    if (img.getAttribute('src') !== next) {
        img.src = next;
    }
}

/**
 * Paint scene + left/right character renders into a dock thumb wrap (list-card layout).
 * @param {HTMLElement|null|undefined} imgWrap
 * @param {object} event
 * @returns {boolean} true when theater media was applied
 */
export function applyDialogueTheaterDockThumbMedia(imgWrap, event) {
    if (!(imgWrap instanceof HTMLElement) || !isDialogueTheaterDockEvent(event)) return false;
    hydrateDialogueTheaterDockEventVisuals(event);

    imgWrap.classList.add('event-number-btn__img-wrap--theater');
    imgWrap.classList.toggle(
        'event-number-btn__img-wrap--theater-solo',
        !!event._dialogueTheaterSolo,
    );

    let layer = imgWrap.querySelector('.event-number-btn__theater-layer');
    if (!(layer instanceof HTMLElement)) {
        layer = document.createElement('div');
        layer.className = 'event-number-btn__theater-layer';
        layer.setAttribute('aria-hidden', 'true');
        layer.innerHTML = `
            <div class="event-number-btn__theater-gradient"></div>
            <img class="event-number-btn__theater-render event-number-btn__theater-render--left" alt="" decoding="async" loading="lazy" draggable="false" hidden />
            <img class="event-number-btn__theater-render event-number-btn__theater-render--right" alt="" decoding="async" loading="lazy" draggable="false" hidden />
        `;
        imgWrap.appendChild(layer);
    }

    const leftImg = layer.querySelector('.event-number-btn__theater-render--left');
    const rightImg = layer.querySelector('.event-number-btn__theater-render--right');
    setTheaterLayerImgSrc(
        leftImg instanceof HTMLImageElement ? leftImg : null,
        event._dialogueTheaterLeft || '',
    );
    setTheaterLayerImgSrc(
        rightImg instanceof HTMLImageElement ? rightImg : null,
        event._dialogueTheaterRight || '',
    );
    return true;
}

/**
 * @param {HTMLElement|null|undefined} imgWrap
 */
export function clearDialogueTheaterDockThumbMedia(imgWrap) {
    if (!(imgWrap instanceof HTMLElement)) return;
    imgWrap.classList.remove(
        'event-number-btn__img-wrap--theater',
        'event-number-btn__img-wrap--theater-solo',
    );
    imgWrap.querySelector('.event-number-btn__theater-layer')?.remove();
}

export function invalidateDialogueTheaterDockEventsCache() {
    cachedDockEvents = null;
}

export async function ensureDialogueTheaterDockAssets() {
    try {
        const next = await loadDialogueTheaterAssets();
        const prevCount = dockAssets ? Object.keys(dockAssets.renders || {}).length : 0;
        const nextCount = Object.keys(next?.renders || {}).length;
        dockAssets = next;
        // Drop stale empty visual cache once renders become available.
        if (nextCount > prevCount || !prevCount) {
            visualCache.clear();
            invalidateDialogueTheaterDockEventsCache();
        }
    } catch {
        if (!dockAssets) {
            dockAssets = { scenes: [], voicelines: [], renders: {} };
        }
    }
    return dockAssets;
}

/**
 * @returns {object[]}
 */
export function getDialogueTheaterDockEvents() {
    if (!isDialogueTheaterDockActive()) return [];
    if (cachedDockEvents) return cachedDockEvents;

    const getter =
        typeof window !== 'undefined'
            ? window.__getDialogueTheaterFilteredConversationsForDock
            : null;
    if (typeof getter !== 'function') {
        cachedDockEvents = [];
        return cachedDockEvents;
    }
    const rows = getter({});
    cachedDockEvents = (Array.isArray(rows) ? rows : []).map((row, index) =>
        conversationToDockEventStub(row, index),
    );
    return cachedDockEvents;
}

/**
 * @param {object} event
 * @returns {boolean}
 */
export function openDialogueTheaterFromDockEvent(event) {
    const id = getDialogueTheaterConversationIdFromDockEvent(event);
    if (!id) return false;
    void openDialogueTheaterInfoPanel(id);
    return true;
}

function notifyDialogueTheaterDockModeChanged() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
        new CustomEvent('atlas-dialogue-theater-dock-mode', {
            detail: {
                active: isDialogueTheaterDockActive(),
                mounted: isDialogueTheaterModeMounted(),
            },
        }),
    );
}

function runDialogueTheaterDockPaginationRefresh() {
    // Must run while theater is mounted even when the strip falls back to the
    // story timeline (cleared search / left chatters) so the dock restores.
    if (!isDialogueTheaterModeMounted()) return;
    invalidateDialogueTheaterDockEventsCache();
    const needsAssets = isDialogueTheaterDockActive();
    const finish = () => {
        invalidateDialogueTheaterDockEventsCache();
        refreshDockTimelinePagination();
        notifyDialogueTheaterDockModeChanged();
    };
    if (needsAssets) {
        void ensureDialogueTheaterDockAssets().finally(finish);
    } else {
        finish();
    }
}

export function refreshDialogueTheaterDockPagination() {
    if (dockRefreshTimer != null) {
        clearTimeout(dockRefreshTimer);
        dockRefreshTimer = null;
    }
    runDialogueTheaterDockPaginationRefresh();
}

/**
 * Debounced refresh for list filter typing / mode toggles.
 * @param {number} [delayMs=120]
 */
export function scheduleDialogueTheaterDockPaginationRefresh(delayMs = 120) {
    if (!isDialogueTheaterModeMounted()) return;
    if (dockRefreshTimer != null) clearTimeout(dockRefreshTimer);
    dockRefreshTimer = setTimeout(() => {
        dockRefreshTimer = null;
        runDialogueTheaterDockPaginationRefresh();
    }, delayMs);
}

export function clearDialogueTheaterDockState() {
    if (dockRefreshTimer != null) {
        clearTimeout(dockRefreshTimer);
        dockRefreshTimer = null;
    }
    dockStatusFilter = '';
    dockEraPairFilter = '';
    dockFilterOptionId = 'theater-all';
    dockAssets = null;
    visualCache.clear();
    invalidateDialogueTheaterDockEventsCache();
}
