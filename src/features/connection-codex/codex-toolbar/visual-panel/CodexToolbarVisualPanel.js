/** CodexToolbarVisualPanel — Codex toolbar slice. */
import { api } from '../../codex-core/codexCanvasApi.js';
import { s } from '../../codex-core/canvasSession.js';
import {
    CODEX_VISUAL_DEFAULTS,
    normalizeCodexVisualPrefs
} from '../../codex-camera/viewport/CodexCanvasTuning.js';
import { redrawCodexEdges } from '../../codex-render/redraw/CodexEdgeRedraw.js';

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

function ensureCodexVisualPrefsPanel() {
    if (!s.root) return;
    s.root.querySelectorAll('.codex-toolbar__visual-details').forEach((el) => el.remove());

    const onVisualInput = () => {
        readCodexVisualPrefsFromToolbar();
        api.persistCodexVisualPrefs();
        redrawCodexEdges();
    };

    function mkRow(labelText, controlWrap) {
        const row = document.createElement('div');
        row.className = 'codex-visual-panel__row';
        const lab = document.createElement('span');
        lab.className = 'codex-visual-panel__label';
        lab.textContent = labelText;
        row.appendChild(lab);
        row.appendChild(controlWrap);
        return row;
    }

    function mkRange(key, min, max, step) {
        const wrap = document.createElement('div');
        wrap.className = 'codex-visual-panel__inputwrap';
        const r = document.createElement('input');
        r.type = 'range';
        r.className = 'codex-visual-panel__range';
        r.min = String(min);
        r.max = String(max);
        r.step = String(step);
        r.dataset.codexVpref = key;
        r.addEventListener('input', onVisualInput);
        const val = document.createElement('span');
        val.className = 'codex-visual-panel__val';
        wrap.appendChild(r);
        wrap.appendChild(val);
        return mkRow(
            key === 'cordThickness' ? 'Thickness (px)'
                : key === 'cordBlur' ? 'Blur (σ)'
                    : key === 'cordMorph' ? 'Spread (dilate)'
                        : key === 'cordGlowLayers' ? 'Glow layers'
                            : key === 'packetThicknessMult' ? 'Thickness × cord'
                                : key === 'packetBlurMult' ? 'Blur × cord'
                                    : key === 'packetMorphMult' ? 'Spread × cord'
                                        : key === 'packetGlowLayers' ? 'Glow layers'
                                            : key === 'packetOpacity' ? 'Opacity'
                                                : key,
            wrap
        );
    }

    function mkColorRow(labelText, key) {
        const wrap = document.createElement('div');
        wrap.className = 'codex-visual-panel__inputwrap';
        const c = document.createElement('input');
        c.type = 'color';
        c.className = 'codex-visual-panel__color';
        c.dataset.codexVpref = key;
        c.addEventListener('input', onVisualInput);
        wrap.appendChild(c);
        return mkRow(labelText, wrap);
    }

    function section(title) {
        const h = document.createElement('div');
        h.className = 'codex-visual-panel__section';
        h.textContent = title;
        return h;
    }

    if (s.codexVisualPanelEl && s.root.contains(s.codexVisualPanelEl)) {
        syncCodexVisualToolbarFromPrefs();
        return;
    }

    const existing = s.root.querySelector('.codex-visual-panel');
    if (existing) {
        s.codexVisualPanelEl = existing;
        syncCodexVisualToolbarFromPrefs();
        return;
    }

    const panel = document.createElement('aside');
    panel.className = 'codex-visual-panel';
    panel.setAttribute('aria-label', 'Cord and packet appearance');

    const det = document.createElement('details');
    det.className = 'codex-visual-panel__details';
    det.open = true;
    const sum = document.createElement('summary');
    sum.className = 'codex-visual-panel__summary';
    sum.textContent = 'Cord & packet look (saved in this browser)';
    det.appendChild(sum);

    const body = document.createElement('div');
    body.className = 'codex-visual-panel__body';

    body.appendChild(section('Cords — normal links'));
    body.appendChild(mkColorRow('Color', 'cordColor'));
    body.appendChild(mkRange('cordThickness', 0.5, 12, 0.05));
    body.appendChild(mkRange('cordBlur', 0, 14, 0.25));
    body.appendChild(mkRange('cordMorph', 0, 4, 0.05));
    body.appendChild(mkRange('cordGlowLayers', 1, 6, 1));

    body.appendChild(section('Packets'));
    body.appendChild(mkColorRow('Idle color', 'packetColorIdle'));
    body.appendChild(mkColorRow('Active (drag) color', 'packetColorActive'));
    body.appendChild(mkRange('packetThicknessMult', 0.4, 3, 0.05));
    body.appendChild(mkRange('packetBlurMult', 0.25, 3, 0.05));
    body.appendChild(mkRange('packetMorphMult', 0.4, 3, 0.05));
    body.appendChild(mkRange('packetGlowLayers', 1, 6, 1));
    body.appendChild(mkRange('packetOpacity', 0.15, 1, 0.05));

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'codex-visual-panel__reset';
    btn.textContent = 'Reset look to defaults';
    btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        s.codexVisualPrefs = { ...CODEX_VISUAL_DEFAULTS };
        api.persistCodexVisualPrefs();
        syncCodexVisualToolbarFromPrefs();
        redrawCodexEdges();
    });
    body.appendChild(btn);

    det.appendChild(body);
    panel.appendChild(det);
    s.root.appendChild(panel);
    s.codexVisualPanelEl = panel;
    syncCodexVisualToolbarFromPrefs();
}

api.codexVisualPanelQueryHost = codexVisualPanelQueryHost;
api.readCodexVisualPrefsFromToolbar = readCodexVisualPrefsFromToolbar;
api.syncCodexVisualToolbarFromPrefs = syncCodexVisualToolbarFromPrefs;
api.ensureCodexVisualPrefsPanel = ensureCodexVisualPrefsPanel;
