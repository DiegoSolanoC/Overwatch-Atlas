/** CodexToolbarSelectionPreview — Codex toolbar slice. */
import { api } from '../../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../../codex-canvas/core/canvasSession.js';

function ensureCodexToolbarSelectionPreviewRow(bar) {
    if (!bar) return;
    let rowPreview = bar.querySelector('.codex-toolbar__row--selection-preview');
    const netHint = bar.querySelector('.codex-toolbar__network-hint');
    if (!rowPreview) {
        rowPreview = document.createElement('div');
        rowPreview.className = 'codex-toolbar__row codex-toolbar__row--selection-preview';
        rowPreview.style.display = 'none';
        if (netHint) {
            bar.insertBefore(rowPreview, netHint);
        } else {
            bar.appendChild(rowPreview);
        }
    }
    const dualPre = rowPreview.querySelector('.codex-toolbar__endpoint-preview-dual');
    if (dualPre) {
        if (!dualPre.querySelector('.codex-toolbar__insert-break')) {
            const rev = dualPre.querySelector('.codex-toolbar__edge-reverse');
            if (rev) {
                const btnIns = document.createElement('button');
                btnIns.type = 'button';
                btnIns.className = 'codex-toolbar__insert-break';
                btnIns.textContent = '+';
                btnIns.setAttribute('aria-label', 'Insert break node between A and B');
                btnIns.title =
                    'Insert break (waypoint): A → break → B — replaces the current link if one exists, or creates links in selection order (first → second).';
                btnIns.disabled = true;
                btnIns.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    api.insertCodexBreakBetweenSelectedPair();
                });
                rev.insertAdjacentElement('afterend', btnIns);
            }
        }
        if (!dualPre.querySelector('.codex-toolbar__merge-junctions')) {
            const ins = dualPre.querySelector('.codex-toolbar__insert-break');
            if (ins) {
                const btnM = document.createElement('button');
                btnM.type = 'button';
                btnM.className = 'codex-toolbar__merge-junctions';
                btnM.textContent = 'Merge';
                btnM.title =
                    'Merge two break nodes into one at the primary selection position (Dev mode, two junctions).';
                btnM.disabled = true;
                btnM.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    api.mergeCodexSelectedJunctionPair();
                });
                ins.insertAdjacentElement('afterend', btnM);
            }
        }
        return;
    }

    while (rowPreview.firstChild) rowPreview.removeChild(rowPreview.firstChild);

    const single = document.createElement('div');
    single.className = 'codex-toolbar__endpoint-preview-single';
    const singleThumb = document.createElement('div');
    singleThumb.className = 'codex-toolbar__selection-preview-thumb';
    const imgSingle = document.createElement('img');
    imgSingle.className = 'codex-toolbar__selection-preview-img';
    imgSingle.draggable = false;
    imgSingle.alt = '';
    singleThumb.appendChild(imgSingle);
    single.appendChild(singleThumb);

    const dual = document.createElement('div');
    dual.className = 'codex-toolbar__endpoint-preview-dual';
    const wrapA = document.createElement('div');
    wrapA.className = 'codex-toolbar__selection-preview codex-toolbar__selection-preview--from';
    const lblA = document.createElement('span');
    lblA.className = 'codex-toolbar__endpoint-label';
    lblA.textContent = 'A';
    const thumbA = document.createElement('div');
    thumbA.className = 'codex-toolbar__selection-preview-thumb';
    const imgA = document.createElement('img');
    imgA.className = 'codex-toolbar__selection-preview-img';
    imgA.draggable = false;
    imgA.alt = '';
    thumbA.appendChild(imgA);
    wrapA.appendChild(lblA);
    wrapA.appendChild(thumbA);

    const btnRev = document.createElement('button');
    btnRev.type = 'button';
    btnRev.className = 'codex-toolbar__edge-reverse';
    btnRev.textContent = '⇄';
    btnRev.title = 'Reverse link direction (swap A and B; packets flow A → B)';
    btnRev.setAttribute('aria-label', 'Reverse link direction');
    btnRev.disabled = true;
    btnRev.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        api.reverseCodexEdgeForSelectedPair();
    });

    const btnInsertBreak = document.createElement('button');
    btnInsertBreak.type = 'button';
    btnInsertBreak.className = 'codex-toolbar__insert-break';
    btnInsertBreak.textContent = '+';
    btnInsertBreak.setAttribute('aria-label', 'Insert break node between A and B');
    btnInsertBreak.title =
        'Insert break (waypoint): A → break → B — replaces the current link if one exists, or creates links in selection order (first → second).';
    btnInsertBreak.disabled = true;
    btnInsertBreak.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        api.insertCodexBreakBetweenSelectedPair();
    });

    const btnMergeJunctions = document.createElement('button');
    btnMergeJunctions.type = 'button';
    btnMergeJunctions.className = 'codex-toolbar__merge-junctions';
    btnMergeJunctions.textContent = 'Merge';
    btnMergeJunctions.title =
        'Merge two break nodes into one at the primary selection position (Dev mode, two junctions).';
    btnMergeJunctions.disabled = true;
    btnMergeJunctions.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        api.mergeCodexSelectedJunctionPair();
    });

    const wrapB = document.createElement('div');
    wrapB.className = 'codex-toolbar__selection-preview codex-toolbar__selection-preview--to';
    const lblB = document.createElement('span');
    lblB.className = 'codex-toolbar__endpoint-label';
    lblB.textContent = 'B';
    const thumbB = document.createElement('div');
    thumbB.className = 'codex-toolbar__selection-preview-thumb';
    const imgB = document.createElement('img');
    imgB.className = 'codex-toolbar__selection-preview-img';
    imgB.draggable = false;
    imgB.alt = '';
    thumbB.appendChild(imgB);
    wrapB.appendChild(lblB);
    wrapB.appendChild(thumbB);

    dual.appendChild(wrapA);
    dual.appendChild(btnRev);
    dual.appendChild(btnInsertBreak);
    dual.appendChild(btnMergeJunctions);
    dual.appendChild(wrapB);
    rowPreview.appendChild(single);
    rowPreview.appendChild(dual);
}

api.ensureCodexToolbarSelectionPreviewRow = ensureCodexToolbarSelectionPreviewRow;
