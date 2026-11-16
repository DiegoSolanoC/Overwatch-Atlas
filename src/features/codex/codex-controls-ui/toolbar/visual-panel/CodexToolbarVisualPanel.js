/** CodexToolbarVisualPanel — Codex toolbar slice. */
import { api } from '../../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../../codex-canvas/core/canvasSession.js';
import {
    CODEX_VISUAL_DEFAULTS,
    normalizeCodexVisualPrefs
} from '../../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';

function codexVisualPanelQueryHost() {
    return s.codexVisualPanelEl && s.root && s.root.contains(s.codexVisualPanelEl)
        ? s.codexVisualPanelEl
        : s.root?.querySelector('.codex-visual-panel');
}

function readCodexVisualPrefsFromToolbar() {
    const host = codexVisualPanelQueryHost();
    if (!host) return;
    const next = { ...s.codexVisualPrefs };
    host.querySelectorAll('input[data-codex-vpref]').forEach((el) => {
        const key = el.dataset.codexVpref;
        if (!key || !(key in CODEX_VISUAL_DEFAULTS)) return;
        if (el.type === 'color') next[key] = el.value;
        else if (el.type === 'range') {
            const num = parseFloat(el.value);
            if (Number.isFinite(num)) next[key] = num;
        }
    });
    s.codexVisualPrefs = normalizeCodexVisualPrefs(next);
}

function syncCodexVisualToolbarFromPrefs() {
    const host = codexVisualPanelQueryHost();
    if (!host) return;
    host.querySelectorAll('input[data-codex-vpref]').forEach((el) => {
        const key = el.dataset.codexVpref;
        if (!key || !(key in s.codexVisualPrefs)) return;
        const v = s.codexVisualPrefs[key];
        if (el.type === 'color') el.value = v;
        else el.value = String(v);
        const wrap = el.parentElement;
        const valEl = wrap && wrap.querySelector('.codex-visual-panel__val');
        if (valEl) {
            valEl.textContent = typeof v === 'number'
                ? (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100))
                : String(v);
        }
    });
}

function hideCodexVisualPrefsPanel() {
    s.root?.querySelectorAll('.codex-visual-panel').forEach((el) => el.remove());
    s.root?.querySelectorAll('.codex-toolbar__visual-details').forEach((el) => el.remove());
    s.codexVisualPanelEl = null;
}

/** Retired UI — prefs still load/save; cord & packet look uses saved defaults. */
function ensureCodexVisualPrefsPanel() {
    if (!s.root) return;
    hideCodexVisualPrefsPanel();
}

api.codexVisualPanelQueryHost = codexVisualPanelQueryHost;
api.readCodexVisualPrefsFromToolbar = readCodexVisualPrefsFromToolbar;
api.syncCodexVisualToolbarFromPrefs = syncCodexVisualToolbarFromPrefs;
api.ensureCodexVisualPrefsPanel = ensureCodexVisualPrefsPanel;
