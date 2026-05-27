/** CodexToolbarPrefs — Codex toolbar slice. */
import { api } from '../../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../../codex-canvas/core/canvasSession.js';
import {
    CODEX_DEBUG_UI_PREF_KEY,
    CODEX_DEBUG_UI_PREF_KEY_LEGACY,
    CODEX_MODE_PREF_KEY
} from '../../../codex-canvas/core/canvasConstants.js';
import {
    CODEX_VISUAL_DEFAULTS,
    CODEX_VISUAL_PREFS_KEY,
    normalizeCodexVisualPrefs
} from '../../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import { redrawCodexEdges } from '../../../codex-node-drawing/redraw/CodexEdgeRedraw.js';

function loadCodexVisualPrefs() {
    try {
        const raw = JSON.parse(localStorage.getItem(CODEX_VISUAL_PREFS_KEY) || 'null');
        s.codexVisualPrefs = normalizeCodexVisualPrefs(raw);
    } catch (_) {
        s.codexVisualPrefs = { ...CODEX_VISUAL_DEFAULTS };
    }
}

function persistCodexVisualPrefs() {
    try {
        localStorage.setItem(CODEX_VISUAL_PREFS_KEY, JSON.stringify(s.codexVisualPrefs));
    } catch (_) {
        /* ignore */
    }
}

function loadCodexDebugUiPref() {
    try {
        let raw = localStorage.getItem(CODEX_DEBUG_UI_PREF_KEY);
        if (raw == null) raw = localStorage.getItem(CODEX_DEBUG_UI_PREF_KEY_LEGACY);
        if (raw === '0') s.codexDebugUiVisible = false;
        else if (raw === '1') s.codexDebugUiVisible = true;
    } catch (_) {
        /* keep default */
    }
}

function loadCodexModePref() {
    try {
        const raw = localStorage.getItem(CODEX_MODE_PREF_KEY);
        if (raw === 'dev' || raw === 'view') {
            s.codexMode = raw;
        }
    } catch (_) {
        /* keep default (view) */
    }
}

function persistCodexDebugUiPref() {
    try {
        localStorage.setItem(CODEX_DEBUG_UI_PREF_KEY, s.codexDebugUiVisible ? '1' : '0');
    } catch (_) {
        /* ignore */
    }
}

function persistCodexModePref() {
    try {
        localStorage.setItem(CODEX_MODE_PREF_KEY, s.codexMode);
    } catch (_) {
        /* ignore */
    }
}

function syncCodexDebugUiClass() {
    if (!s.root) return;
    s.root.classList.toggle('codex--debug-ui-hidden', !s.codexDebugUiVisible);
}

function syncCodexModeClass() {
    if (!s.root) return;
    const oldMode = s.codexMode;
    s.root.classList.toggle('codex--view-mode', s.codexMode === 'view');
    s.root.classList.toggle('codex--dev-mode', s.codexMode === 'dev');

    if (s.codexMode !== 'view') {
        api.clearAllCodexEdgeHoverVisual();
    }

    console.log('[Codex Mode] Switching from ' + oldMode + ' to ' + s.codexMode);
    
    // Reset View Mode initial render flag when switching to View Mode
    // This allows the first natural redraw (when nodes are loaded) to execute
    if (s.codexMode === 'view') {
        s.codexViewModeInitialRenderDone = false;
        console.log('[Codex Mode] Reset View Mode initial render flag');
        // Trigger redraw to render edges in View Mode
        redrawCodexEdges();
    }
}

function ensureCodexToolbarDebugToggle(bar) {
    if (!bar) return;
    let row = bar.querySelector('.codex-toolbar__row--junction-pref');
    if (!row) {
        row = document.createElement('div');
        row.className = 'codex-toolbar__row codex-toolbar__row--junction-pref';
        const lbl = document.createElement('label');
        lbl.className = 'codex-toolbar__junction-pref-label';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'codex-toolbar__junction-toggle';
        cb.title =
            'Uncheck to hide waypoints, Break in the picker, cord angle labels, and node coordinates (layout unchanged)';
        cb.addEventListener('change', () => {
            s.codexDebugUiVisible = !!cb.checked;
            persistCodexDebugUiPref();
            syncCodexDebugUiClass();
            redrawCodexEdges();
        });
        lbl.appendChild(cb);
        const span = document.createElement('span');
        span.textContent = 'Show Debugging';
        lbl.appendChild(span);
        row.appendChild(lbl);
        const scaleRow = bar.querySelector('.codex-toolbar__row--scale');
        if (scaleRow) bar.insertBefore(row, scaleRow);
        else bar.appendChild(row);
    }
    const cb = row.querySelector('.codex-toolbar__junction-toggle');
    if (cb) cb.checked = s.codexDebugUiVisible;
}

function ensureCodexToolbarModeToggle(bar) {
    if (!bar) return;
    let row = bar.querySelector('.codex-toolbar__row--mode-toggle');
    if (!row) {
        row = document.createElement('div');
        row.className = 'codex-toolbar__row codex-toolbar__row--mode-toggle';
        const lbl = document.createElement('label');
        lbl.className = 'codex-toolbar__mode-toggle-label';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'codex-toolbar__mode-toggle';
        cb.title = 'Check to enable Dev Mode (edit nodes, cords, layout). Uncheck for View Mode (read-only, pan/zoom only).';
        cb.addEventListener('change', () => {
            s.codexMode = cb.checked ? 'dev' : 'view';
            persistCodexModePref();
            syncCodexModeClass();
            api.updateCodexToolbar();
        });
        lbl.appendChild(cb);
        const span = document.createElement('span');
        span.textContent = 'Dev Mode';
        lbl.appendChild(span);
        row.appendChild(lbl);
        const firstRow = bar.querySelector('.codex-toolbar__row');
        if (firstRow) bar.insertBefore(row, firstRow);
        else bar.appendChild(row);
    }
    const cb = row.querySelector('.codex-toolbar__mode-toggle');
    if (cb) cb.checked = s.codexMode === 'dev';
}

api.loadCodexVisualPrefs = loadCodexVisualPrefs;
api.persistCodexVisualPrefs = persistCodexVisualPrefs;
api.loadCodexDebugUiPref = loadCodexDebugUiPref;
api.loadCodexModePref = loadCodexModePref;
api.persistCodexDebugUiPref = persistCodexDebugUiPref;
api.persistCodexModePref = persistCodexModePref;
api.syncCodexDebugUiClass = syncCodexDebugUiClass;
api.syncCodexModeClass = syncCodexModeClass;
api.ensureCodexToolbarDebugToggle = ensureCodexToolbarDebugToggle;
api.ensureCodexToolbarModeToggle = ensureCodexToolbarModeToggle;
