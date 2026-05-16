/** CodexToolbarCore — Codex toolbar slice. */
import { api } from '../codex-core/codexCanvasApi.js';
import { s } from '../codex-core/canvasSession.js';
import { CODEX_JUNCTION_PREVIEW_DATA_URI } from '../codex-core/canvasConstants.js';

function updateCodexToolbar() {
    if (!s.codexToolbarEl) return;
    const saveBtn = s.codexToolbarEl.querySelector('.codex-toolbar__save');
    const hint = s.codexToolbarEl.querySelector('.codex-toolbar__hint');
    const shrinkBtn = s.codexToolbarEl.querySelector('.codex-toolbar__shrink');
    const growBtn = s.codexToolbarEl.querySelector('.codex-toolbar__grow');
    const btnDrag = s.codexToolbarEl.querySelector('.codex-toolbar__mode-drag');
    const btnNet = s.codexToolbarEl.querySelector('.codex-toolbar__mode-network');
    const netHint = s.codexToolbarEl.querySelector('.codex-toolbar__network-hint');
    const selectAllBtn = s.codexToolbarEl.querySelector('.codex-toolbar__select-all');
    const deleteSelBtn = s.codexToolbarEl.querySelector('.codex-toolbar__delete-selected');

    if (saveBtn) {
        saveBtn.disabled = !s.codexLayoutDirty;
        saveBtn.title = s.codexLayoutDirty
            ? 'Save Codex (browser cache + data/codex-labels.json on dev server). Load always uses that JSON first; GitHub Pages uses data/codex-labels.json from the site.'
            : 'No unsaved Codex changes';
    }
    if (hint) hint.style.display = s.codexLayoutDirty ? 'inline' : 'none';

    const selectedNodes = api.getSelectedCodexNodesInRoot();
    const hasSel = selectedNodes.length > 0;
    if (shrinkBtn) {
        shrinkBtn.disabled = !hasSel;
        shrinkBtn.title = hasSel
            ? (selectedNodes.length > 1
                ? 'Shrink selected nodes (size). Header +/− zooms the board.'
                : 'Shrink selected node (size). Header +/− zooms the board.')
            : 'Select a node — or use Select all. Header +/− zooms the board.';
    }
    if (growBtn) {
        growBtn.disabled = !hasSel;
        growBtn.title = hasSel
            ? (selectedNodes.length > 1
                ? 'Grow selected nodes (size). Header +/− zooms the board.'
                : 'Grow selected node (size). Header +/− zooms the board.')
            : 'Select a node — or use Select all. Header +/− zooms the board.';
    }

    if (selectAllBtn && s.root) {
        const totalNodes = s.root.querySelectorAll('.codex-node').length;
        selectAllBtn.disabled = totalNodes === 0;
        selectAllBtn.title = totalNodes === 0
            ? 'No nodes on the board'
            : `Select all ${totalNodes} nodes. Use toolbar − / + to change node size; header + / − zooms the whole board.`;
    }

    if (deleteSelBtn) {
        const dev = s.codexMode === 'dev';
        deleteSelBtn.disabled = !dev || !hasSel;
        deleteSelBtn.title = !dev
            ? 'Switch to Dev mode to delete nodes from the board.'
            : !hasSel
                ? 'Select one or more nodes, then delete them from the board.'
                : selectedNodes.length > 1
                    ? `Delete ${selectedNodes.length} selected nodes (and their links).`
                    : 'Delete the selected node (and its links).';
    }

    const clearAllBtn = s.codexToolbarEl.querySelector('.codex-toolbar__clear-all');
    if (clearAllBtn) {
        const dev = s.codexMode === 'dev';
        const totalNodesAll = s.codexAllNodes.length;
        const totalEdgesAll = s.codexEdges.length;
        const empty = totalNodesAll === 0 && totalEdgesAll === 0;
        clearAllBtn.disabled = !dev || empty;
        clearAllBtn.title = !dev
            ? 'Switch to Dev mode to clear the board.'
            : empty
                ? 'Codex is already empty.'
                : `Remove all ${totalNodesAll} node${totalNodesAll === 1 ? '' : 's'} and ${totalEdgesAll} link${totalEdgesAll === 1 ? '' : 's'} from the board. Save Codex to persist.`;
    }

    const scaleInput = s.codexToolbarEl.querySelector('.codex-toolbar__scale-input');
    if (scaleInput) {
        const inputActive = document.activeElement === scaleInput;
        scaleInput.disabled = !hasSel;
        if (!inputActive) {
            if (!hasSel) {
                scaleInput.value = '';
                scaleInput.placeholder = '';
            } else {
                const uniform = api.getUniformCodexScaleForNodes(selectedNodes);
                if (uniform != null) {
                    scaleInput.value = api.formatCodexScaleForInput(uniform);
                    scaleInput.placeholder = '';
                } else {
                    scaleInput.value = '';
                    scaleInput.placeholder = '—';
                }
            }
        } else if (!hasSel) {
            scaleInput.disabled = true;
        }
    }

    api.ensureCodexToolbarSelectionPreviewRow(s.codexToolbarEl);
    const previewRow = s.codexToolbarEl.querySelector('.codex-toolbar__row--selection-preview');
    const singleWrap = previewRow?.querySelector('.codex-toolbar__endpoint-preview-single');
    const dualWrap = previewRow?.querySelector('.codex-toolbar__endpoint-preview-dual');
    const previewImgSingle = singleWrap?.querySelector('.codex-toolbar__selection-preview-img');
    const wrapA = dualWrap?.querySelector('.codex-toolbar__selection-preview--from');
    const wrapB = dualWrap?.querySelector('.codex-toolbar__selection-preview--to');
    const previewImgA = wrapA?.querySelector('.codex-toolbar__selection-preview-img');
    const previewImgB = wrapB?.querySelector('.codex-toolbar__selection-preview-img');
    const btnEdgeReverse = dualWrap?.querySelector('.codex-toolbar__edge-reverse');
    const btnInsertBreak = dualWrap?.querySelector('.codex-toolbar__insert-break');
    const btnMergeJunctions = dualWrap?.querySelector('.codex-toolbar__merge-junctions');

    function fillCodexToolbarPreviewImg(img, nodeEl) {
        if (!img) return;
        if (!nodeEl) {
            img.removeAttribute('src');
            img.alt = '';
            return;
        }
        if (nodeEl.classList.contains('codex-node--junction')) {
            img.src = CODEX_JUNCTION_PREVIEW_DATA_URI;
            img.alt = 'Junction';
            return;
        }
        const portrait = nodeEl.querySelector('.codex-node__img');
        const src = portrait?.getAttribute('src') || portrait?.src || '';
        if (src) {
            img.src = src;
            img.alt = portrait?.getAttribute('alt') || '';
        } else {
            img.removeAttribute('src');
            img.alt = '';
        }
    }

    if (previewRow && previewImgSingle && dualWrap && wrapA && wrapB && previewImgA && previewImgB) {
        const st = getCodexToolbarEndpointPreviewState();
        if (st.kind === 'none') {
            previewImgSingle.removeAttribute('src');
            previewRow.style.display = 'none';
        } else if (st.kind === 'single') {
            singleWrap.style.display = '';
            dualWrap.style.display = 'none';
            const isJunction = st.fromEl.classList.contains('codex-node--junction');
            const portrait = st.fromEl.querySelector('.codex-node__img');
            const src = portrait?.getAttribute('src') || portrait?.src || '';
            if (isJunction || src) {
                fillCodexToolbarPreviewImg(previewImgSingle, st.fromEl);
                previewRow.style.display = '';
            } else {
                previewImgSingle.removeAttribute('src');
                previewRow.style.display = 'none';
            }
        } else {
            singleWrap.style.display = 'none';
            dualWrap.style.display = 'flex';
            wrapB.classList.remove('codex-toolbar__selection-preview--empty');
            if (st.kind === 'edge') {
                fillCodexToolbarPreviewImg(previewImgA, st.fromEl);
                fillCodexToolbarPreviewImg(previewImgB, st.toEl);
                if (btnEdgeReverse) {
                    btnEdgeReverse.disabled = false;
                    btnEdgeReverse.title =
                        'Reverse link direction (swap A and B; packets flow A → B)';
                }
                if (btnInsertBreak) {
                    btnInsertBreak.disabled = s.codexMode !== 'dev';
                    btnInsertBreak.title =
                        s.codexMode === 'dev'
                            ? 'Insert break (waypoint): replace A → B with A → break → B (same direction).'
                            : 'Switch to Dev Mode to insert a break between these nodes.';
                }
                if (btnMergeJunctions) {
                    const bothJ =
                        !!st.fromEl?.classList.contains('codex-node--junction')
                        && !!st.toEl?.classList.contains('codex-node--junction');
                    btnMergeJunctions.disabled = !(s.codexMode === 'dev' && bothJ);
                    btnMergeJunctions.title =
                        s.codexMode !== 'dev'
                            ? 'Switch to Dev mode to merge break nodes.'
                            : bothJ
                                ? 'Merge both break nodes into one at the primary selection (first picked / highlighted A).'
                                : 'Select two break (junction) nodes to merge.';
                }
            } else if (st.kind === 'pair-no-edge' || st.kind === 'cord-pending') {
                fillCodexToolbarPreviewImg(previewImgA, st.fromEl);
                fillCodexToolbarPreviewImg(previewImgB, st.toEl);
                if (btnEdgeReverse) {
                    btnEdgeReverse.disabled = true;
                    btnEdgeReverse.title =
                        st.kind === 'cord-pending'
                            ? 'Finish or cancel the link first — direction is set when the cord exists'
                            : 'No link between these nodes — reverse applies to an existing link';
                }
                if (btnInsertBreak) {
                    if (st.kind === 'cord-pending') {
                        btnInsertBreak.disabled = true;
                        btnInsertBreak.title =
                            'Finish or cancel the link first — then you can insert a break on the new cord.';
                    } else {
                        btnInsertBreak.disabled = s.codexMode !== 'dev';
                        btnInsertBreak.title =
                            s.codexMode === 'dev'
                                ? 'Insert break (waypoint): create A → break → B using selection order (first → second).'
                                : 'Switch to Dev Mode to insert a break between these nodes.';
                    }
                }
                if (btnMergeJunctions) {
                    const bothJ =
                        !!st.fromEl?.classList.contains('codex-node--junction')
                        && !!st.toEl?.classList.contains('codex-node--junction');
                    btnMergeJunctions.disabled = !(s.codexMode === 'dev' && bothJ);
                    btnMergeJunctions.title =
                        s.codexMode !== 'dev'
                            ? 'Switch to Dev mode to merge break nodes.'
                            : bothJ
                                ? 'Merge both break nodes into one at the primary selection (first picked / highlighted A).'
                                : 'Select two break (junction) nodes to merge.';
                }
            } else if (st.kind === 'pending') {
                fillCodexToolbarPreviewImg(previewImgA, st.fromEl);
                fillCodexToolbarPreviewImg(previewImgB, null);
                wrapB.classList.add('codex-toolbar__selection-preview--empty');
                if (btnEdgeReverse) {
                    btnEdgeReverse.disabled = true;
                    btnEdgeReverse.title =
                        'Pick the second node — then you can reverse direction on the new link';
                }
                if (btnInsertBreak) {
                    btnInsertBreak.disabled = true;
                    btnInsertBreak.title = 'Select two nodes to insert a break between them.';
                }
                if (btnMergeJunctions) {
                    btnMergeJunctions.disabled = true;
                    btnMergeJunctions.title = 'Select two break (junction) nodes to merge.';
                }
            }
            previewRow.style.display = '';
        }
    }

    if (btnDrag) {
        btnDrag.classList.toggle('codex-toolbar__mode-btn--active', s.codexInteractionMode === 'drag');
    }
    if (btnNet) {
        btnNet.classList.toggle('codex-toolbar__mode-btn--active', s.codexInteractionMode === 'network');
    }
    if (netHint) {
        netHint.style.display = s.codexInteractionMode === 'network' ? 'block' : 'none';
        if (s.codexInteractionMode === 'network') {
            const line = s.networkLinkSourceId
                ? 'Tap another node to connect. Tap the same node again to cancel.'
                : 'Tap a node to start a link.';
            netHint.textContent = `${line} Caps Lock toggles drag / network.`;
        }
    }

    api.ensureCodexToolbarDebugToggle(s.codexToolbarEl);
    api.ensureCodexVisualPrefsPanel();
    api.syncCodexVisualToolbarFromPrefs();
    api.syncCodexDebugUiClass();
    api.refreshCodexBDescendantGlowForSelection();
}

function getCodexToolbarEndpointPreviewState() {
    if (!s.root) return { kind: 'none' };
    const selected = api.getSelectedCodexNodesInRoot();

    if (s.codexInteractionMode === 'network' && s.networkLinkSourceId) {
        const srcEl =
            selected.find((n) => n.dataset.codexNodeId === s.networkLinkSourceId)
            || s.codexNodeElements.get(s.networkLinkSourceId); // Use Map for O(1) lookup
        if (srcEl && s.root.contains(srcEl)) {
            const srcInSel = selected.some((n) => n.dataset.codexNodeId === s.networkLinkSourceId);
            if (selected.length === 2 && srcInSel) {
                const other = selected.find((n) => n.dataset.codexNodeId !== s.networkLinkSourceId);
                if (other) {
                    const ida = s.networkLinkSourceId;
                    const idb = other.dataset.codexNodeId;
                    const e = api.findEdge(ida, idb) || api.findEdge(idb, ida);
                    if (e) {
                        // Use Map for O(1) lookups instead of querySelector (performance optimization)
                        const fromEl = s.codexNodeElements.get(e.fromId);
                        const toEl = s.codexNodeElements.get(e.toId);
                        return { kind: 'edge', fromEl, toEl, edge: e };
                    }
                    return { kind: 'cord-pending', fromEl: srcEl, toEl: other };
                }
            }
            return { kind: 'pending', fromEl: srcEl, toEl: null };
        }
    }

    if (selected.length === 2) {
        const ida = selected[0].dataset.codexNodeId;
        const idb = selected[1].dataset.codexNodeId;
        const e = api.findEdge(ida, idb) || api.findEdge(idb, ida);
        if (e) {
            // Use Map for O(1) lookups instead of querySelector (performance optimization)
            const fromEl = s.codexNodeElements.get(e.fromId);
            const toEl = s.codexNodeElements.get(e.toId);
            return { kind: 'edge', fromEl, toEl, edge: e };
        }
        return { kind: 'pair-no-edge', fromEl: selected[0], toEl: selected[1] };
    }
    if (selected.length === 1) {
        return { kind: 'single', fromEl: selected[0] };
    }
    return { kind: 'none' };
}

function applyCodexToolbarInteractionMode(mode) {
    if (mode === 'network') {
        s.codexInteractionMode = 'network';
        s.networkLinkSourceId = null;
        api.selectCodexNode(null); /* updates toolbar */
    } else {
        s.codexInteractionMode = 'drag';
        s.networkLinkSourceId = null;
        updateCodexToolbar();
    }
}

function ensureCodexToolbar() {
    if (!s.root) return;
    let bar = s.root.querySelector('.codex-toolbar');
    if (bar) {
        const shrinkLegacy = bar.querySelector('.codex-toolbar__shrink');
        if (shrinkLegacy) {
            const sr = shrinkLegacy.closest('.codex-toolbar__row');
            if (sr && !sr.classList.contains('codex-toolbar__row--scale')) {
                sr.classList.add('codex-toolbar__row--scale');
            }
        }
    }
    if (!bar) {
        bar = document.createElement('div');
        bar.className = 'codex-toolbar';

        const rowModes = document.createElement('div');
        rowModes.className = 'codex-toolbar__row';
        const btnDrag = document.createElement('button');
        btnDrag.type = 'button';
        btnDrag.className = 'codex-toolbar__mode-btn codex-toolbar__mode-drag';
        btnDrag.textContent = 'Drag mode';
        btnDrag.title = 'Move nodes by dragging. Caps Lock toggles network mode.';
        const btnNet = document.createElement('button');
        btnNet.type = 'button';
        btnNet.className = 'codex-toolbar__mode-btn codex-toolbar__mode-network';
        btnNet.textContent = 'Network mode';
        btnNet.title = 'Connect nodes: tap one, then another. Caps Lock toggles drag mode. Shift+click adds to selection in drag mode.';
        btnDrag.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            applyCodexToolbarInteractionMode('drag');
        });
        btnNet.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            applyCodexToolbarInteractionMode('network');
        });
        rowModes.appendChild(btnDrag);
        rowModes.appendChild(btnNet);

        const netHint = document.createElement('div');
        netHint.className = 'codex-toolbar__network-hint';
        netHint.style.display = 'none';

        const rowScale = document.createElement('div');
        rowScale.className = 'codex-toolbar__row codex-toolbar__row--scale';
        const shrink = document.createElement('button');
        shrink.type = 'button';
        shrink.className = 'codex-toolbar__scale-btn codex-toolbar__shrink';
        shrink.textContent = '−';
        shrink.title = 'Shrink selected node size (portrait hex). Header +/− zooms the whole board.';
        const grow = document.createElement('button');
        grow.type = 'button';
        grow.className = 'codex-toolbar__scale-btn codex-toolbar__grow';
        grow.textContent = '+';
        grow.title = 'Grow selected node size (portrait hex). Header +/− zooms the whole board.';
        shrink.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            api.nudgeSelectedNodeScale(1 / 1.12);
        });
        grow.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            api.nudgeSelectedNodeScale(1.12);
        });
        const scaleInput = document.createElement('input');
        api.bindCodexToolbarScaleInput(scaleInput);
        rowScale.appendChild(shrink);
        rowScale.appendChild(scaleInput);
        rowScale.appendChild(grow);

        const rowSave = document.createElement('div');
        rowSave.className = 'codex-toolbar__row codex-toolbar__row--footer';
        const hint = document.createElement('span');
        hint.className = 'codex-toolbar__hint';
        hint.textContent = 'Unsaved changes';
        hint.style.display = 'none';
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'codex-toolbar__save';
        saveBtn.textContent = 'Save Codex';
        saveBtn.disabled = true;
        saveBtn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            api.saveCodexLayout();
        });
        rowSave.appendChild(hint);
        rowSave.appendChild(saveBtn);

        bar.appendChild(rowModes);
        bar.appendChild(netHint);
        bar.appendChild(rowScale);
        bar.appendChild(rowSave);
        s.root.appendChild(bar);
    }
    s.codexToolbarEl = bar;
    api.ensureCodexToolbarSelectAllRow(bar);
    api.ensureCodexToolbarDeleteSelectedButton(bar);
    api.ensureCodexToolbarSelectionPreviewRow(bar);
    api.ensureCodexToolbarScaleInput(bar);
    api.ensureCodexToolbarImportExportRow(bar);
    api.ensureCodexToolbarBioSyncButton(bar);
    api.ensureCodexVisualPrefsPanel();
    updateCodexToolbar();
}

api.updateCodexToolbar = updateCodexToolbar;
api.getCodexToolbarEndpointPreviewState = getCodexToolbarEndpointPreviewState;
api.applyCodexToolbarInteractionMode = applyCodexToolbarInteractionMode;
api.ensureCodexToolbar = ensureCodexToolbar;
