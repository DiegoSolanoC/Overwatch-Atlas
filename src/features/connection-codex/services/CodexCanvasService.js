/** Codex canvas — public entry (implementation under codex-core/ + codex-* slices). */
import {
    initCodexCanvas,
    destroyCodexCanvas,
    saveCodexLayout,
    previewBioCodexArchiveLinkDiff,
    syncCodexEdgesFromBioArchiveConnections
} from '../codex-core/codexCanvasHost.js';
import { api } from '../codex-core/codexCanvasApi.js';
import { s } from '../codex-core/canvasSession.js';

export {
    initCodexCanvas,
    destroyCodexCanvas,
    saveCodexLayout,
    previewBioCodexArchiveLinkDiff,
    syncCodexEdgesFromBioArchiveConnections
};

if (typeof window !== 'undefined') {
    window.CodexCanvasService = {
        initCodexCanvas,
        destroyCodexCanvas,
        saveCodexLayout,
        getCodexLayoutDirty: () => s.codexLayoutDirty,
        zoomIn: () => api.codexZoomInFromUi(),
        zoomOut: () => api.codexZoomOutFromUi(),
        resetView: () => api.codexResetView(),
        selectAll: () => api.selectAllCodexNodes(),
        applyCodexEventThumbnailFilterHover: (...args) => api.applyCodexEventThumbnailFilterHover(...args),
        clearCodexEventThumbnailFilterHover: () => api.clearCodexEventThumbnailFilterHover(),
        exportCodexJson: () => api.exportCodexLayoutJsonDownload(),
        importCodexJsonText: (...args) => api.importCodexLayoutFromJsonText(...args),
        syncCodexEdgesFromBioArchiveConnections,
        previewBioCodexArchiveLinkDiff
    };
}
