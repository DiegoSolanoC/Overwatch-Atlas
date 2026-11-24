/**
 * Codex dock toggles — View/Edit (top inverse trap), packets + info (Edit only).
 * Linking moved to Filters panel AND match mode (see filtersMatchMode.js).
 */

import { createHeaderHubButton } from '../../../universal-features/atlas-header/HeaderHubButton.js';
import { loadSoundEffect } from '../../../universal-features/atlas-sound-effects/loadSoundEffects.js';
import {
    FILTERS_MATCH_MODE_AND,
    FILTERS_MATCH_MODE_OR,
    getFiltersMatchMode,
    isFiltersMatchModeAnd,
    setFiltersMatchMode,
} from '../../../system-interface/interface-filter-menu/state/filtersMatchMode.js';
import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { playSoundEffect } from '../../codex-canvas/bridge/CodexAppBridge.js';
import { applyCodexCordPacketAnimPref } from '../../codex-node-drawing/packets/CodexCordPacketAnimation.js';
import { redrawCodexEdges } from '../../codex-node-drawing/redraw/CodexEdgeRedraw.js';

const CODEX_ROOT_ID = 'codex-view-root';
const DOCK_PARENT_ID = 'dockGlobeRailLeft';

/** Retired — Linking lives on Filters AND/OR. Kept for cleanup of stale DOM. */
const LINKING_TOGGLE_ID = 'codexLinkFiltersToggle';
const PACKETS_TOGGLE_ID = 'codexTogglePackets';
const PACKETS_ICON_ID = 'codexTogglePacketsIcon';
const INFO_TOGGLE_ID = 'codexToggleInfo';
const INFO_ICON_ID = 'codexToggleInfoIcon';
const MODE_TOGGLE_ID = 'codexToggleViewDev';
const MODE_ICON_ID = 'codexToggleViewDevIcon';

/** @type {HTMLButtonElement | null} */
let packetsToggleBtn = null;
/** @type {HTMLButtonElement | null} */
let infoToggleBtn = null;
/** @type {HTMLButtonElement | null} */
let modeToggleBtn = null;

function flashCodexOnOffToggle(btn, enabled) {
    if (!btn || !window.flashButton) return;
    window.flashButton(btn, enabled ? 'flash-green' : 'flash-red');
}

function flashCodexModeToggle(btn) {
    if (!btn || !window.flashButton) return;
    window.flashButton(btn, 'flash-orange');
}

/**
 * Linking is Filters AND mode — shortest paths between confirmed filter chips.
 * @returns {boolean}
 */
export function isCodexLinkFiltersEnabled() {
    return isFiltersMatchModeAnd();
}

function syncToggleOffClass(btn, enabled) {
    if (!btn) return;
    if (enabled) btn.classList.remove('toggle-off');
    else btn.classList.add('toggle-off');
}

/**
 * Compat: maps onto Filters match mode (AND = linking on).
 * @param {boolean} enabled
 */
export function setCodexLinkFiltersEnabled(enabled) {
    setFiltersMatchMode(enabled ? FILTERS_MATCH_MODE_AND : FILTERS_MATCH_MODE_OR, {
        apply: true,
    });
}

/**
 * @returns {boolean}
 */
export function toggleCodexLinkFilters() {
    setCodexLinkFiltersEnabled(getFiltersMatchMode() !== FILTERS_MATCH_MODE_AND);
    return isCodexLinkFiltersEnabled();
}

/**
 * @param {boolean} enabled
 * @param {{ persist?: boolean, redraw?: boolean, flash?: boolean }} [opts]
 */
export function setCodexPacketsEnabled(enabled, opts = {}) {
    // Appearance-only: RAF packet loop is enough. Never force a full edge rebuild here —
    // that freezes ~1.2k-node boards on every dock toggle.
    const { persist = true, flash = false } = opts;
    s.codexPacketAnimEnabled = !!enabled;
    if (persist) api.persistCodexPacketAnimPref?.();
    applyCodexCordPacketAnimPref();
    syncToggleOffClass(packetsToggleBtn, s.codexPacketAnimEnabled);
    api.syncCodexStageControlInputs?.();
    if (flash) flashCodexOnOffToggle(packetsToggleBtn, s.codexPacketAnimEnabled);
}

/**
 * @param {boolean} enabled
 * @param {{ persist?: boolean, redraw?: boolean, flash?: boolean }} [opts]
 */
export function setCodexInfoEnabled(enabled, opts = {}) {
    // Debug labels are CSS-class driven (`syncCodexDebugUiClass`); no edge rebuild needed.
    const { persist = true, flash = false } = opts;
    s.codexDebugUiVisible = !!enabled;
    if (persist) api.persistCodexDebugUiPref?.();
    api.syncCodexDebugUiClass?.();
    syncToggleOffClass(infoToggleBtn, s.codexDebugUiVisible);
    api.syncCodexStageControlInputs?.();
    if (flash) flashCodexOnOffToggle(infoToggleBtn, s.codexDebugUiVisible);
}

function toggleCodexPackets() {
    setCodexPacketsEnabled(!s.codexPacketAnimEnabled, { flash: true });
}

function toggleCodexInfo() {
    setCodexInfoEnabled(!s.codexDebugUiVisible, { flash: true });
}

function syncCodexEditOnlyToggleVisibility() {
    const isEdit = s.codexMode === 'dev';
    for (const btn of [packetsToggleBtn, infoToggleBtn]) {
        if (!btn) continue;
        btn.hidden = !isEdit;
        btn.setAttribute('aria-hidden', isEdit ? 'false' : 'true');
        btn.classList.toggle('codex-dock-toggle--edit-only-hidden', !isEdit);
    }
}

export function syncCodexModeToggleUi() {
    if (!modeToggleBtn) return;
    const isEdit = s.codexMode === 'dev';
    modeToggleBtn.classList.remove('toggle-off');
    const label = modeToggleBtn.querySelector('.globe-control-btn__label');
    if (label) {
        label.textContent = isEdit ? 'Edit' : 'View';
    }
    modeToggleBtn.title = isEdit
        ? 'Edit Mode — click for read-only View Mode'
        : 'View Mode — click for Edit Mode (layout tools)';
    syncCodexEditOnlyToggleVisibility();
}

function toggleCodexViewDevMode() {
    s.codexMode = s.codexMode === 'view' ? 'dev' : 'view';
    api.persistCodexModePref?.();
    api.syncCodexModeClass?.();
    syncCodexModeToggleUi();
    api.updateCodexToolbar?.();
    playSoundEffect('switchMap');
    flashCodexModeToggle(modeToggleBtn);
}

/**
 * Edit: packets off, info on. View: packets on, info off (toggles hidden in View).
 * @param {{ redraw?: boolean }} [opts]
 */
export function applyCodexModeDockToggles(opts = {}) {
    const { redraw = true } = opts;
    const isEdit = s.codexMode === 'dev';
    setCodexPacketsEnabled(!isEdit, { persist: false, redraw: false });
    setCodexInfoEnabled(isEdit, { persist: false, redraw: false });
    syncCodexModeToggleUi();
    if (redraw) {
        redrawCodexEdges({ force: true });
    }
}

/**
 * @param {HTMLButtonElement} btn
 * @param {() => void} handler
 * @param {string} teardownKey
 */
function wireDockToggle(btn, handler, teardownKey) {
    if (typeof btn[teardownKey] === 'function') {
        try {
            btn[teardownKey]();
        } catch (_) { /* ignore */ }
    }

    const ac = new AbortController();
    const signal = ac.signal;
    btn[teardownKey] = () => {
        ac.abort();
        btn[teardownKey] = null;
    };

    btn.addEventListener('mousedown', (event) => {
        event.stopPropagation();
    }, { signal });

    btn.addEventListener('mouseup', (event) => {
        event.stopPropagation();
    }, { signal });

    let touchStartTime = 0;
    btn.addEventListener('touchstart', (event) => {
        event.stopPropagation();
        touchStartTime = Date.now();
    }, { signal });

    btn.addEventListener('touchend', (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (Date.now() - touchStartTime < 300) handler(event);
    }, { signal });

    btn.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (window.SoundEffectsManager) {
            window.SoundEffectsManager.play('rotationToggle');
        }
        handler(event);
    }, { signal });
}

function mountDockToggle({
    id,
    iconId,
    className,
    title,
    label,
    iconPath,
    iconAlt,
    headerOrder,
    enabled,
    /** Primary mode toggle uses trap flank; settings chips use globe rail. */
    rail = 'globe',
    floatingClass = '',
}) {
    const dockParent = document.getElementById(DOCK_PARENT_ID);
    const parentId = dockParent ? DOCK_PARENT_ID : CODEX_ROOT_ID;
    const railClass = rail === 'trap' ? 'dock-trap-flank__btn' : 'dock-globe-rail__btn';
    const composed = `${railClass} codex-dock-toggle ${className}`.trim();

    const btn = createHeaderHubButton({
        id,
        className: composed,
        title,
        label,
        iconPath,
        iconAlt,
        parentId,
        baseClass: 'globe-control-btn',
        iconSpanId: iconId,
        headerOrder,
        mobileParentId: DOCK_PARENT_ID,
        mobileBaseClass: 'globe-control-btn',
        mobileClassName: composed,
    });

    if (!btn?.isConnected) return null;

    if (!dockParent && floatingClass) {
        btn.classList.add(floatingClass);
    }

    /* Visibility is CSS-owned so #eventSlide.open can hide these chips. */
    btn.style.removeProperty('display');
    syncToggleOffClass(btn, enabled);
    return btn;
}

export function mountCodexDockToggles() {
    unmountCodexDockToggles();

    loadSoundEffect(
        'rotationToggle',
        'src/assets/audio/sfx/Rotation Toggle.mp3',
    );

    [
        MODE_TOGGLE_ID,
        LINKING_TOGGLE_ID,
        PACKETS_TOGGLE_ID,
        INFO_TOGGLE_ID,
    ].forEach((id) => document.getElementById(id)?.remove());

    document.querySelector('.codex-mode-toggle-btn')?.remove();

    const isEdit = s.codexMode === 'dev';
    /* Primary mode toggle — text-only inverse-trap (same family as Map / Story). */
    modeToggleBtn = mountDockToggle({
        id: MODE_TOGGLE_ID,
        iconId: MODE_ICON_ID,
        className: 'mode-primary-toggle atlas-dev-text-chip codex-toggle-view-dev',
        title: isEdit
            ? 'Edit Mode — click for read-only View Mode'
            : 'View Mode — click for Edit Mode (layout tools)',
        label: isEdit ? 'Edit' : 'View',
        iconPath: null,
        iconAlt: '',
        headerOrder: 10,
        enabled: true,
        rail: 'trap',
        floatingClass: 'codex-toggle-view-dev--floating',
    });

    packetsToggleBtn = mountDockToggle({
        id: PACKETS_TOGGLE_ID,
        iconId: PACKETS_ICON_ID,
        className: 'atlas-dev-text-chip codex-toggle-packets',
        title: 'Toggle Packets — animate lights along cords',
        label: 'Packets',
        iconPath: null,
        iconAlt: '',
        headerOrder: 13,
        enabled: s.codexPacketAnimEnabled,
        floatingClass: 'codex-toggle-packets--floating',
    });

    infoToggleBtn = mountDockToggle({
        id: INFO_TOGGLE_ID,
        iconId: INFO_ICON_ID,
        className: 'atlas-dev-text-chip codex-toggle-info',
        title: 'Toggle Info — break nodes, cord angle labels, and node coordinates',
        label: 'Info',
        iconPath: null,
        iconAlt: '',
        headerOrder: 14,
        enabled: s.codexDebugUiVisible,
        floatingClass: 'codex-toggle-info--floating',
    });

    if (modeToggleBtn) {
        wireDockToggle(modeToggleBtn, () => toggleCodexViewDevMode(), '_codexModeToggleTeardown');
    }
    if (packetsToggleBtn) {
        wireDockToggle(packetsToggleBtn, () => toggleCodexPackets(), '_codexPacketsToggleTeardown');
    }
    if (infoToggleBtn) {
        wireDockToggle(infoToggleBtn, () => toggleCodexInfo(), '_codexInfoToggleTeardown');
    }

    applyCodexModeDockToggles({ redraw: false });
}

export function unmountCodexDockToggles() {
    for (const id of [MODE_TOGGLE_ID, LINKING_TOGGLE_ID, PACKETS_TOGGLE_ID, INFO_TOGGLE_ID]) {
        const btn = document.getElementById(id);
        if (!btn) continue;
        for (const key of [
            '_codexModeToggleTeardown',
            '_codexLinkingToggleTeardown',
            '_codexPacketsToggleTeardown',
            '_codexInfoToggleTeardown',
        ]) {
            if (typeof btn[key] === 'function') {
                try {
                    btn[key]();
                } catch (_) { /* ignore */ }
            }
        }
        btn.remove();
    }
    modeToggleBtn = null;
    packetsToggleBtn = null;
    infoToggleBtn = null;
}

/** @deprecated Use {@link mountCodexDockToggles} */
export function mountCodexLinkFiltersToggle() {
    mountCodexDockToggles();
}

/** @deprecated Use {@link unmountCodexDockToggles} */
export function unmountCodexLinkFiltersToggle() {
    unmountCodexDockToggles();
}

if (typeof window !== 'undefined') {
    window.CodexLinkFiltersToggle = {
        mount: mountCodexDockToggles,
        unmount: unmountCodexDockToggles,
        isEnabled: isCodexLinkFiltersEnabled,
        setEnabled: setCodexLinkFiltersEnabled,
        toggle: toggleCodexLinkFilters,
    };
    window.CodexDockToggles = {
        mount: mountCodexDockToggles,
        unmount: unmountCodexDockToggles,
        isLinkingEnabled: isCodexLinkFiltersEnabled,
        setLinkingEnabled: setCodexLinkFiltersEnabled,
        toggleLinking: toggleCodexLinkFilters,
    };
}
