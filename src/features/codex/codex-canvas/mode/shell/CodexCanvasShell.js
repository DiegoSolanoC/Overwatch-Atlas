/** CodexCanvasShell — Codex canvas slice. */
import { api } from '../../core/codexCanvasApi.js';
import { s } from '../../core/canvasSession.js';
import { CODEX_WORLD_H, CODEX_WORLD_W } from '../../../codex-data/persistence/CodexLayoutConstants.js';


function ensureCodexWorld() {
    if (!s.root) return null;
    let w = s.root.querySelector('.codex-world');
    if (!w) {
        w = document.createElement('div');
        w.className = 'codex-world';
        s.root.insertBefore(w, s.root.firstChild);
    }
    s.codexWorldEl = w;
    w.style.width = `${CODEX_WORLD_W}px`;
    w.style.height = `${CODEX_WORLD_H}px`;
    api.applyCodexWorldTransformStyle();
    return w;
}

function ensureCodexBorderOverlay() {
    if (!s.root) return null;
    let border = s.root.querySelector('.codex-border-overlay');
    if (!border) {
        border = document.createElement('img');
        border.className = 'codex-border-overlay';
        border.src = 'src/assets/images/Misc/UI/Border.png';
        border.alt = '';
        border.style.position = 'absolute';
        border.style.top = '0';
        border.style.left = '0';
        border.style.width = '100%';
        border.style.height = '100%';
        border.style.pointerEvents = 'none';
        border.style.zIndex = '1';
        s.root.appendChild(border);
    }
    return border;
}

/** Legacy top-right mode button — retired; dock rail owns View/Dev toggle. */
function ensureCodexModeToggle() {
    s.root?.querySelector('.codex-mode-toggle-btn')?.remove();
    return null;
}

function ensureEdgesLayer() {
    if (!s.root || !s.hitLayerEl) return null;
    const scope = s.codexWorldEl || s.root;
    let svg = scope.querySelector('.codex-edges-layer');
    if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('codex-edges-layer');
        svg.setAttribute('aria-hidden', 'true');
        s.hitLayerEl.insertAdjacentElement('afterend', svg);
    }
    s.codexEdgesSvgEl = svg;
    return svg;
}

function ensureHitLayer() {
    if (!s.root) return null;
    const parent = s.codexWorldEl || s.root;
    let hit = parent.querySelector('.codex-hit-layer');
    if (!hit) {
        hit = document.createElement('div');
        hit.className = 'codex-hit-layer';
        hit.setAttribute('aria-hidden', 'true');
        parent.insertBefore(hit, parent.firstChild);
    }
    s.hitLayerEl = hit;
    return s.hitLayerEl;
}

api.ensureCodexWorld = ensureCodexWorld;
api.ensureCodexBorderOverlay = ensureCodexBorderOverlay;
api.ensureCodexModeToggle = ensureCodexModeToggle;
api.ensureEdgesLayer = ensureEdgesLayer;
api.ensureHitLayer = ensureHitLayer;
