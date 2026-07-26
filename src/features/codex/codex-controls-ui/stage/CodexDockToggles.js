/**
 * Codex dock toggles — linking, packets, debug info (breaks & angles).
 * Chrome matches gallery Select Hero / world Map & Rotation toggles.
 */

import { createHeaderHubButton } from '../../../universal-features/atlas-header/HeaderHubButton.js';
import { loadSoundEffect } from '../../../universal-features/atlas-sound-effects/loadSoundEffects.js';
import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { playSoundEffect } from '../../codex-canvas/bridge/CodexAppBridge.js';
import { applyCodexCordPacketAnimPref } from '../../codex-node-drawing/packets/CodexCordPacketAnimation.js';
import { redrawCodexEdges } from '../../codex-node-drawing/redraw/CodexEdgeRedraw.js';

const CODEX_ROOT_ID = 'codex-view-root';
const DOCK_PARENT_ID = 'dockGlobeRailLeft';

const LINKING_TOGGLE_ID = 'codexLinkFiltersToggle';
const LINKING_ICON_ID = 'codexLinkFiltersIcon';
const PACKETS_TOGGLE_ID = 'codexTogglePackets';
const PACKETS_ICON_ID = 'codexTogglePacketsIcon';
const INFO_TOGGLE_ID = 'codexToggleInfo';
const INFO_ICON_ID = 'codexToggleInfoIcon';
const MODE_TOGGLE_ID = 'codexToggleViewDev';
const MODE_ICON_ID = 'codexToggleViewDevIcon';

const MODE_ICON =
    'src/assets/images/Icons/Mode%20Icons/Connection%20Codex.png';
const LINKING_ICON =
    'src/assets/images/Icons/Filter%20Icons/Confirm%20Filter%20Icon.png';
const PACKETS_ICON =
    'src/assets/images/Icons/Mode%20Icons/Data%20Archive.png';
const INFO_ICON =
    'src/assets/images/Icons/Mode%20Icons/Connection%20Codex.png';

/** @type {HTMLButtonElement | null} */
let linkingToggleBtn = null;
/** @type {HTMLButtonElement | null} */
let packetsToggleBtn = null;
/** @type {HTMLButtonElement | null} */
let infoToggleBtn = null;
/** @type {HTMLButtonElement | null} */
let modeToggleBtn = null;

let linkFiltersEnabled = false;

function flashCodexOnOffToggle(btn, enabled) {
    if (!btn || !window.flashButton) return;
    window.flashButton(btn, enabled ? 'flash-green' : 'flash-red');
}

function flashCodexModeToggle(btn) {
    if (!btn || !window.flashButton) return;
    window.flashButton(btn, 'flash-orange');
}

/**
 * @returns {boolean}
 */
export function isCodexLinkFiltersEnabled() {
    return linkFiltersEnabled;
}

function refreshCodexFilterCanvas() {
    api.applyCodexFilterState?.();
}

function syncToggleOffClass(btn, enabled) {
    if (!btn) return;
    if (enabled) btn.classList.remove('toggle-off');
    else btn.classList.add('toggle-off');
}

export function setCodexLinkFiltersEnabled(enabled) {
    linkFiltersEnabled = !!enabled;
    syncToggleOffClass(linkingToggleBtn, linkFiltersEnabled);
    refreshCodexFilterCanvas();
}

/**
 * @returns {boolean}
 */
export function toggleCodexLinkFilters() {
    setCodexLinkFiltersEnabled(!linkFiltersEnabled);
    flashCodexOnOffToggle(linkingToggleBtn, linkFiltersEnabled);
    return linkFiltersEnabled;
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

export function syncCodexModeToggleUi() {
    if (!modeToggleBtn) return;
    const isDev = s.codexMode === 'dev';
    modeToggleBtn.classList.remove('toggle-off');
    const label = modeToggleBtn.querySelector('.globe-control-btn__label');
    if (label) {
        label.textContent = isDev ? 'Dev Mode' : 'View Mode';
    }
    modeToggleBtn.title = isDev
        ? 'Dev Mode — click for read-only View Mode'
        : 'View Mode — click for Dev Mode (edit layout)';
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
 * Dev: packets off, info on. View: packets on, info off.
 * @param {{ redraw?: boolean }} [opts]
 */
export function applyCodexModeDockToggles(opts = {}) {
    const { redraw = true } = opts;
    const isDev = s.codexMode === 'dev';
    setCodexPacketsEnabled(!isDev, { persist: false, redraw: false });
    setCodexInfoEnabled(isDev, { persist: false, redraw: false });
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
}) {
    const dockParent = document.getElementById(DOCK_PARENT_ID);
    const parentId = dockParent ? DOCK_PARENT_ID : CODEX_ROOT_ID;

    const btn = createHeaderHubButton({
        id,
        className: `dock-globe-rail__btn codex-dock-toggle ${className}`,
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
        mobileClassName: `dock-globe-rail__btn codex-dock-toggle ${className}`,
    });

    if (!btn?.isConnected) return null;

    if (!dockParent) {
        btn.classList.add(`${className}--floating`);
    }

    btn.style.setProperty('display', 'flex', 'important');
    syncToggleOffClass(btn, enabled);
    return btn;
}

export function mountCodexDockToggles() {
    unmountCodexDockToggles();

    linkFiltersEnabled = false;

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

    const isDev = s.codexMode === 'dev';
    modeToggleBtn = mountDockToggle({
        id: MODE_TOGGLE_ID,
        iconId: MODE_ICON_ID,
        className: 'codex-toggle-view-dev',
        title: isDev
            ? 'Dev Mode — click for read-only View Mode'
            : 'View Mode — click for Dev Mode (edit layout)',
        label: isDev ? 'Dev Mode' : 'View Mode',
        iconPath: MODE_ICON,
        iconAlt: 'View or Dev mode',
        headerOrder: 11,
        enabled: true,
    });

    linkingToggleBtn = mountDockToggle({
        id: LINKING_TOGGLE_ID,
        iconId: LINKING_ICON_ID,
        className: 'codex-toggle-linking',
        title: 'Toggle Linking — shortest paths between all confirmed filter chips',
        label: 'Toggle Linking',
        iconPath: LINKING_ICON,
        iconAlt: 'Toggle linking',
        headerOrder: 12,
        enabled: false,
    });

    packetsToggleBtn = mountDockToggle({
        id: PACKETS_TOGGLE_ID,
        iconId: PACKETS_ICON_ID,
        className: 'codex-toggle-packets',
        title: 'Toggle Packets — animate lights along cords',
        label: 'Toggle Packets',
        iconPath: PACKETS_ICON,
        iconAlt: 'Toggle packets',
        headerOrder: 13,
        enabled: s.codexPacketAnimEnabled,
    });

    infoToggleBtn = mountDockToggle({
        id: INFO_TOGGLE_ID,
        iconId: INFO_ICON_ID,
        className: 'codex-toggle-info',
        title: 'Toggle Info — break nodes, cord angle labels, and node coordinates',
        label: 'Toggle Info',
        iconPath: INFO_ICON,
        iconAlt: 'Toggle info',
        headerOrder: 14,
        enabled: s.codexDebugUiVisible,
    });

    if (modeToggleBtn) {
        wireDockToggle(modeToggleBtn, () => toggleCodexViewDevMode(), '_codexModeToggleTeardown');
    }
    if (linkingToggleBtn) {
        wireDockToggle(linkingToggleBtn, () => toggleCodexLinkFilters(), '_codexLinkingToggleTeardown');
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
    linkingToggleBtn = null;
    packetsToggleBtn = null;
    infoToggleBtn = null;
    linkFiltersEnabled = false;
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
