/** CodexToolbarScale — Codex toolbar slice. */
import { api } from '../../codex-core/codexCanvasApi.js';
import { s } from '../../codex-core/canvasSession.js';
import { CODEX_SCALE_MAX, CODEX_SCALE_MIN } from '../../codex-nodes/placement/CodexNodePortraitMetrics.js';
import { redrawCodexEdges } from '../../codex-render/redraw/CodexEdgeRedraw.js';

function nudgeSelectedNodeScale(factor) {
    const nodes = api.getSelectedCodexNodesInRoot();
    if (!nodes.length) return;
    nodes.forEach((nodeEl) => {
        const cur = parseFloat(nodeEl.dataset.codexScale) || 1;
        api.applyNodeScale(nodeEl, cur * factor, true);
        api.markNodeVisualUnsaved(nodeEl);
        api.markIncidentCodexEdgesUnsaved(nodeEl.dataset.codexNodeId);
    });
    api.markCodexLayoutDirty();
    redrawCodexEdges();
}

function getUniformCodexScaleForNodes(nodes) {
    if (!nodes.length) return null;
    const s0 = parseFloat(nodes[0].dataset.codexScale) || 1;
    for (let i = 1; i < nodes.length; i++) {
        const si = parseFloat(nodes[i].dataset.codexScale) || 1;
        if (Math.abs(si - s0) > 1e-4) return null;
    }
    return s0;
}

function formatCodexScaleForInput(s) {
    const n = Number(s);
    if (!Number.isFinite(n)) return '';
    const r = Math.round(n * 1000) / 1000;
    return String(r);
}

function setSelectedNodesAbsoluteScale(raw) {
    const nodeScale = Math.max(CODEX_SCALE_MIN, Math.min(CODEX_SCALE_MAX, Number(raw) || 1));
    const nodes = api.getSelectedCodexNodesInRoot();
    if (!nodes.length) return;
    nodes.forEach((nodeEl) => {
        api.applyNodeScale(nodeEl, nodeScale, true);
        api.markNodeVisualUnsaved(nodeEl);
        api.markIncidentCodexEdgesUnsaved(nodeEl.dataset.codexNodeId);
    });
    api.markCodexLayoutDirty();
    redrawCodexEdges();
}

function bindCodexToolbarScaleInput(input) {
    input.type = 'number';
    input.className = 'codex-toolbar__scale-input';
    input.step = '0.05';
    input.min = String(CODEX_SCALE_MIN);
    input.max = String(CODEX_SCALE_MAX);
    input.setAttribute('aria-label', 'Selected node scale');
    input.title = `Node scale ${CODEX_SCALE_MIN}–${CODEX_SCALE_MAX}. Same value for all selected nodes; empty if sizes differ.`;
    input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            input.blur();
        }
    });
    input.addEventListener('change', () => {
        if (!s.codexToolbarEl || input.disabled) return;
        const v = String(input.value || '').trim();
        if (v === '') {
            api.updateCodexToolbar();
            return;
        }
        setSelectedNodesAbsoluteScale(v);
        api.updateCodexToolbar();
    });
}

function ensureCodexToolbarScaleInput(bar) {
    const row = bar?.querySelector('.codex-toolbar__shrink')?.parentElement;
    if (!row || row.querySelector('.codex-toolbar__scale-input')) return;
    const input = document.createElement('input');
    bindCodexToolbarScaleInput(input);
    const grow = row.querySelector('.codex-toolbar__grow');
    if (grow) {
        row.insertBefore(input, grow);
    } else {
        row.appendChild(input);
    }
}

api.nudgeSelectedNodeScale = nudgeSelectedNodeScale;
api.getUniformCodexScaleForNodes = getUniformCodexScaleForNodes;
api.formatCodexScaleForInput = formatCodexScaleForInput;
api.setSelectedNodesAbsoluteScale = setSelectedNodesAbsoluteScale;
api.bindCodexToolbarScaleInput = bindCodexToolbarScaleInput;
api.ensureCodexToolbarScaleInput = ensureCodexToolbarScaleInput;
