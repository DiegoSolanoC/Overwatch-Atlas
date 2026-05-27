/**
 * Dev-server bio ↔ Codex link diff preview overlay (`POST /api/codex/bio-sync-preview`).
 */

import { CODEX_SAVE_VERSION } from '../../codex-data/persistence/CodexLayoutConstants.js';
import { serializeCodexLayoutSnapshot } from '../../codex-data/persistence/CodexLayoutSerialization.js';
import {
    resolveCodexRepoApiUrl,
    updateAppStatus,
    isCodexPersistToRepoAvailable
} from '../../codex-canvas/bridge/CodexAppBridge.js';
import { escapeHtml } from '../../codex-node-drawing/svg/CodexPresentationUtils.js';

const CODEX_BIO_SYNC_PREVIEW_MAX_LINES = 45;

/** @type {CodexBioPreviewRuntime|null} */
let _rt = null;

/**
 * @typedef {object} CodexBioPreviewRuntime
 * @property {() => HTMLElement|null} getRoot
 * @property {() => { nodes: object[], edges: object[] }} getSerializedSnapshot
 */

export function registerCodexBioPreviewRuntime(rt) {
    _rt = rt;
}

export function unregisterCodexBioPreviewRuntime() {
    removeCodexBioSyncPreviewPanel();
    _rt = null;
}

export function removeCodexBioSyncPreviewPanel() {
    document.querySelectorAll('.codex-bio-sync-preview-overlay').forEach((el) => el.remove());
}

/**
 * Compare entity↔entity Codex links vs story-archive `showInCodex` rows (dev server POST).
 */
export async function previewBioCodexArchiveLinkDiff() {
    if (!isCodexPersistToRepoAvailable()) {
        updateAppStatus(
            'Archive link check needs the local dev server (POST /api/codex/bio-sync-preview).',
            'warning'
        );
        return;
    }
    if (!_rt) return;
    const root = _rt.getRoot();
    if (!root) return;
    const { nodes, edges } = _rt.getSerializedSnapshot();
    const payload = { v: CODEX_SAVE_VERSION, nodes, edges };
    const url = resolveCodexRepoApiUrl('api/codex/bio-sync-preview');
    try {
        updateAppStatus('Comparing Codex links to archive data…', 'success');
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        removeCodexBioSyncPreviewPanel();
        const overlay = document.createElement('div');
        overlay.className = 'codex-bio-sync-preview-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        const card = document.createElement('div');
        card.className = 'codex-bio-sync-preview-card';
        const nCodex = Number(data.pairsInCodexCount) || 0;
        const nArch = Number(data.pairsInArchivesShowInCodexCount) || 0;
        const onlyA = Array.isArray(data.onlyInArchives) ? data.onlyInArchives : [];
        const onlyC = Array.isArray(data.onlyInCodex) ? data.onlyInCodex : [];
        const fmtList = (arr, cap) => {
            const slice = arr.slice(0, cap);
            const more = arr.length > cap ? `\n… +${arr.length - cap} more` : '';
            return slice.length ? `${slice.map((s) => `• ${s}`).join('\n')}${more}` : '(none)';
        };
        card.innerHTML = `
            <h3 class="codex-bio-sync-preview__title">Codex ↔ archives (<code>showInCodex</code>)</h3>
            <p class="codex-bio-sync-preview__summary">
                <strong>${nCodex}</strong> entity link pair(s) on the board ·
                <strong>${nArch}</strong> in JSON with <code>showInCodex</code>
            </p>
            <p class="codex-bio-sync-preview__hint">
                Saving the Codex updates archives: new links are written; board-only removals drop stale <code>showInCodex</code> rows.
            </p>
            <div class="codex-bio-sync-preview__col">
                <h4>Only in archives <span class="codex-bio-sync-preview__badge">${onlyA.length}</span></h4>
                <pre class="codex-bio-sync-preview__pre">${escapeHtml(fmtList(onlyA, CODEX_BIO_SYNC_PREVIEW_MAX_LINES))}</pre>
            </div>
            <div class="codex-bio-sync-preview__col">
                <h4>Only on Codex <span class="codex-bio-sync-preview__badge">${onlyC.length}</span></h4>
                <pre class="codex-bio-sync-preview__pre">${escapeHtml(fmtList(onlyC, CODEX_BIO_SYNC_PREVIEW_MAX_LINES))}</pre>
            </div>
            <div class="codex-bio-sync-preview__actions">
                <button type="button" class="codex-bio-sync-preview__close">Close</button>
            </div>
        `;
        overlay.appendChild(card);
        const host = root.closest('.codex-view-root') || root.parentElement || document.body;
        host.appendChild(overlay);
        const close = () => {
            removeCodexBioSyncPreviewPanel();
        };
        card.querySelector('.codex-bio-sync-preview__close')?.addEventListener('click', close);
        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) close();
        });
        const esc = (ev) => {
            if (ev.key === 'Escape') {
                close();
                document.removeEventListener('keydown', esc);
            }
        };
        document.addEventListener('keydown', esc);
        const mismatch = onlyA.length + onlyC.length;
        updateAppStatus(
            mismatch
                ? `Archive link diff: ${onlyA.length} only in files, ${onlyC.length} only on board.`
                : 'Codex entity links match archive showInCodex rows.',
            mismatch ? 'warning' : 'success'
        );
    } catch (e) {
        console.warn('CodexCanvasService: bio-sync-preview failed', e);
        updateAppStatus(`Archive link check failed: ${e?.message || e}`, 'warning');
    }
}
