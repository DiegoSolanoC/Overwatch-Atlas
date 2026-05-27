/** CodexToolbarRows — Codex toolbar slice. */
import { api } from '../../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../../codex-canvas/core/canvasSession.js';
import { previewBioCodexArchiveLinkDiff } from '../../../codex-bio-archive-sync/preview/CodexCanvasBioSyncPreview.js';
import { updateAppStatus } from '../../../codex-canvas/bridge/CodexAppBridge.js';
import { hexToRgba } from '../../../codex-node-drawing/svg/CodexPresentationUtils.js';

function ensureCodexToolbarSelectAllRow(bar) {
    if (!bar || bar.querySelector('.codex-toolbar__select-all')) return;
    const row = document.createElement('div');
    row.className = 'codex-toolbar__row codex-toolbar__row--select-all';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'codex-toolbar__select-all';
    btn.textContent = 'Select all';
    btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        api.selectAllCodexNodes();
    });
    row.appendChild(btn);
    const netHint = bar.querySelector('.codex-toolbar__network-hint');
    if (netHint) {
        bar.insertBefore(row, netHint);
    } else {
        const rowScale = bar.querySelector('.codex-toolbar__row--scale');
        if (rowScale) bar.insertBefore(row, rowScale);
        else bar.appendChild(row);
    }
}

function ensureCodexToolbarDeleteSelectedButton(bar) {
    if (!bar) return;
    const row = bar.querySelector('.codex-toolbar__row--select-all');
    if (!row || row.querySelector('.codex-toolbar__delete-selected')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'codex-toolbar__delete-selected';
    btn.textContent = 'Delete selected';
    btn.title = 'Remove selected nodes from the board (Dev mode).';
    btn.disabled = true;
    btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        api.deleteCodexToolbarSelectedNodes();
    });
    row.appendChild(btn);
}

function ensureCodexToolbarBioSyncButton(bar) {
    if (!bar) return;
    const row = bar.querySelector('.codex-toolbar__row--import-export');
    if (!row || row.querySelector('.codex-toolbar__bio-sync-preview')) return;
    const exportBtn = row.querySelector('.codex-toolbar__export-json');
    const bioBtn = document.createElement('button');
    bioBtn.type = 'button';
    bioBtn.className = 'codex-toolbar__import-export-btn codex-toolbar__bio-sync-preview';
    bioBtn.textContent = 'Check vs archives';
    bioBtn.title =
        'Compare entity-to-entity Codex links with story-archive rows marked show in Codex. Save Codex to apply changes to JSON.';
    bioBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        void previewBioCodexArchiveLinkDiff();
    });
    if (exportBtn) {
        row.insertBefore(bioBtn, exportBtn);
    } else {
        row.appendChild(bioBtn);
    }
}

function ensureCodexToolbarImportExportRow(bar) {
    if (!bar || bar.querySelector('.codex-toolbar__row--import-export')) return;
    const row = document.createElement('div');
    row.className = 'codex-toolbar__row codex-toolbar__row--import-export';

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'codex-toolbar__import-export-btn codex-toolbar__export-json';
    exportBtn.textContent = 'Export JSON';
    exportBtn.title = 'Download nodes and links as JSON (backup or share). Same format as data/codex-labels.json.';
    exportBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        api.exportCodexLayoutJsonDownload();
    });

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    fileInput.className = 'codex-toolbar__import-json-input';
    fileInput.setAttribute('aria-hidden', 'true');
    fileInput.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none;';

    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className = 'codex-toolbar__import-export-btn codex-toolbar__import-json';
    importBtn.textContent = 'Import JSON';
    importBtn.title = 'Load nodes and links from a JSON file (replaces the current board).';
    importBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        fileInput.click();
    });

    const clearAllBtn = document.createElement('button');
    clearAllBtn.type = 'button';
    clearAllBtn.className = 'codex-toolbar__import-export-btn codex-toolbar__clear-all';
    clearAllBtn.textContent = 'Clear all';
    clearAllBtn.title =
        'Remove every node and link from the board. Save Codex afterwards to persist the empty board to data/codex-labels.json.';
    clearAllBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        api.clearAllCodexBoard();
    });

    // Add background color picker for selected node
    const colorLabel = document.createElement('label');
    colorLabel.className = 'codex-toolbar__bg-color-label';
    colorLabel.textContent = 'Node bg:';
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'codex-toolbar__bg-color-input';
    colorInput.setAttribute('data-codex-bg-color-picker', 'true');
    colorInput.value = '#ffffff';
    colorInput.title = 'Background color for selected node';
    
    // Add text input for manual hex entry
    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'codex-toolbar__bg-color-hex';
    hexInput.setAttribute('data-codex-bg-hex-input', 'true');
    hexInput.value = '#ffffff';
    hexInput.placeholder = '#ffffff';
    hexInput.maxLength = 7;
    hexInput.title = 'Paste hex color directly (e.g., #ff0000)';
    
    // Sync color picker to text input
    colorInput.addEventListener('input', (ev) => {
        const hexColor = ev.target.value;
        hexInput.value = hexColor;
        const selectedNode = s.codexPrimarySelectedNodeEl;
        if (selectedNode) {
            selectedNode.dataset.codexBgColor = hexColor;
            const bgEl = selectedNode.querySelector('.codex-node__bg');
            if (bgEl) {
                bgEl.style.background = hexToRgba(hexColor, 0.5);
            }
            // Sync to node object in s.codexAllNodes for save persistence
            const nodeId = selectedNode.dataset.codexNodeId;
            const nodeObj = s.codexAllNodes.find(n => n.id === nodeId);
            if (nodeObj) {
                nodeObj.bgColor = hexColor;
            }
            api.markCodexLayoutDirty();
            api.markNodeVisualUnsaved(selectedNode);
            api.updateCodexToolbar();
        }
    });
    
    // Sync text input to color picker
    hexInput.addEventListener('input', (ev) => {
        let hexColor = ev.target.value.trim();
        // Add # if missing
        if (hexColor && !hexColor.startsWith('#')) {
            hexColor = '#' + hexColor;
        }
        // Validate hex format
        if (/^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
            colorInput.value = hexColor;
            const selectedNode = s.codexPrimarySelectedNodeEl;
            if (selectedNode) {
                selectedNode.dataset.codexBgColor = hexColor;
                const bgEl = selectedNode.querySelector('.codex-node__bg');
                if (bgEl) {
                    bgEl.style.background = hexToRgba(hexColor, 0.5);
                }
                // Sync to node object in s.codexAllNodes for save persistence
                const nodeId = selectedNode.dataset.codexNodeId;
                const nodeObj = s.codexAllNodes.find(n => n.id === nodeId);
                if (nodeObj) {
                    nodeObj.bgColor = hexColor;
                }
                api.markCodexLayoutDirty();
                api.markNodeVisualUnsaved(selectedNode);
                api.updateCodexToolbar();
            }
        }
    });

    fileInput.addEventListener('change', () => {
        const f = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
            const text = typeof reader.result === 'string' ? reader.result : '';
            api.importCodexLayoutFromJsonText(text).catch((e) => {
                console.warn('Codex import failed', e);
                updateAppStatus('Codex import failed', 'error');
            });
        };
        reader.readAsText(f);
    });

    row.appendChild(exportBtn);
    row.appendChild(fileInput);
    row.appendChild(importBtn);
    row.appendChild(clearAllBtn);

    // Wrap color label + picker + hex input so the import/export row can wrap them
    // onto their own line under the four text buttons (CSS: flex-basis: 100%).
    const colorGroup = document.createElement('div');
    colorGroup.className = 'codex-toolbar__bg-color-group';
    colorGroup.appendChild(colorLabel);
    colorGroup.appendChild(colorInput);
    colorGroup.appendChild(hexInput);
    row.appendChild(colorGroup);

    const footer = bar.querySelector('.codex-toolbar__row--footer');
    if (footer) {
        bar.insertBefore(row, footer);
    } else {
        bar.appendChild(row);
    }
}

api.ensureCodexToolbarSelectAllRow = ensureCodexToolbarSelectAllRow;
api.ensureCodexToolbarDeleteSelectedButton = ensureCodexToolbarDeleteSelectedButton;
api.ensureCodexToolbarBioSyncButton = ensureCodexToolbarBioSyncButton;
api.ensureCodexToolbarImportExportRow = ensureCodexToolbarImportExportRow;
