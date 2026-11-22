/**
 * Mode-dependent copy under the Filters toolbar — tells users how live chip
 * selection behaves in the mode they’re currently in.
 */

import {
    ATLAS_MODE,
    MODE_LABEL,
    normalizeAtlasMode,
} from '../../universal-features/atlas-mode-runtime/atlasModes.js';
import { getCurrentModeOrMenu } from '../../universal-features/atlas-mode-runtime/mode-lifecycle/CurrentModeStatus.js';

const APP_MODE_CHANGE_EVENT = 'appmodechange';

const DEFAULT_DISCLAIMER =
    'Select what you want to filter from the data. Filters apply as soon as you pick a chip; functionality may vary with each mode.';

/** @type {Readonly<Partial<Record<string, string>>>} */
const DISCLAIMER_BY_MODE = Object.freeze({
    [ATLAS_MODE.WORLD]:
        'Locks down and obscures map points that have been filtered out.',
    [ATLAS_MODE.CODEX]:
        'Highlights the filtered nodes and their respective connections.',
    [ATLAS_MODE.STORY]:
        'Shows only events involving the filtered selection.',
    [ATLAS_MODE.INTEL]:
        'Heroes, factions, and NPCs are single-select for biography + curated dock. Countries stay multi-select and further filter that dock.',
    [ATLAS_MODE.DIALOGUE_THEATER]:
        'Shows only voice files from the filtered selection.',
    [ATLAS_MODE.OFFICIAL_ARCHIVE]:
        'Mode not implemented yet — no unique filter functionality as of now.',
    [ATLAS_MODE.GALLERY]:
        'Mode not implemented yet — no unique filter functionality as of now.',
});

/**
 * Theater only uses hero chips meaningfully — other tabs fall back to Default copy.
 * @param {string | null | undefined} filterType
 * @returns {boolean}
 */
function theaterUsesDefaultDisclaimer(filterType) {
    const t = String(filterType || '').toLowerCase();
    return t === 'factions' || t === 'npcs' || t === 'countries';
}

/**
 * @returns {string}
 */
function readCurrentFilterType() {
    try {
        return window.FilterService?.currentFilterType || 'heroes';
    } catch (_) {
        return 'heroes';
    }
}

/**
 * @param {string | null | undefined} mode
 * @param {string | null | undefined} [filterType]
 * @returns {{ modeId: string, label: string, body: string }}
 */
export function resolveFiltersModeDisclaimer(mode, filterType) {
    const modeId = normalizeAtlasMode(mode);
    const type = filterType != null ? filterType : readCurrentFilterType();

    if (modeId === ATLAS_MODE.DIALOGUE_THEATER && theaterUsesDefaultDisclaimer(type)) {
        return {
            modeId,
            label: 'Default',
            body: DEFAULT_DISCLAIMER,
        };
    }

    if (DISCLAIMER_BY_MODE[modeId]) {
        return {
            modeId,
            label: MODE_LABEL[modeId] || modeId,
            body: DISCLAIMER_BY_MODE[modeId],
        };
    }
    return {
        modeId,
        label: 'Default',
        body: DEFAULT_DISCLAIMER,
    };
}

/**
 * @param {string | null | undefined} mode
 * @param {string | null | undefined} [filterType]
 * @returns {string}
 */
export function getFiltersModeDisclaimerText(mode, filterType) {
    const { label, body } = resolveFiltersModeDisclaimer(mode, filterType);
    return `${label}: ${body}`;
}

/**
 * @param {HTMLElement | null} [el]
 * @param {string | null | undefined} [mode]
 * @param {string | null | undefined} [filterType]
 */
export function syncFiltersModeDisclaimer(el, mode, filterType) {
    const target =
        el
        || (typeof document !== 'undefined'
            ? document.getElementById('filtersModeDisclaimer')
            : null);
    if (!target) return;

    const resolvedMode = mode != null ? normalizeAtlasMode(mode) : getCurrentModeOrMenu();
    const { modeId, label, body } = resolveFiltersModeDisclaimer(resolvedMode, filterType);

    target.replaceChildren();
    const modeEl = document.createElement('span');
    modeEl.className = 'filters-mode-disclaimer__mode';
    modeEl.textContent = label;

    const bodyEl = document.createElement('span');
    bodyEl.className = 'filters-mode-disclaimer__body';
    bodyEl.textContent = `: ${body}`;

    target.append(modeEl, bodyEl);
    target.dataset.mode = modeId;
}

/** @type {boolean} */
let modeChangeListenerBound = false;

/**
 * Keep the disclaimer live while the Filters panel stays open across mode switches.
 */
export function wireFiltersModeDisclaimerLiveUpdates() {
    if (typeof window === 'undefined' || modeChangeListenerBound) return;
    modeChangeListenerBound = true;

    window.addEventListener(APP_MODE_CHANGE_EVENT, (event) => {
        const detailMode = event?.detail?.mode;
        syncFiltersModeDisclaimer(null, detailMode);
    });
}
