/** Codex canvas — public entry (implementation under codex-core/ + codex-* slices). */
import {
    initCodexCanvas,
    destroyCodexCanvas,
    saveCodexLayout,
    previewBioCodexArchiveLinkDiff,
    syncCodexEdgesFromBioArchiveConnections
} from './core/codexCanvasHost.js';
import { api } from './core/codexCanvasApi.js';
import { s } from './core/canvasSession.js';
import { buildDirectCodexBioPairKeySet, pairKeyForBioArchiveConnection } from '../../system-interface/interface-shared/bio-archive/bioArchiveDirectCodexPairKeys.js';

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
        previewBioCodexArchiveLinkDiff,
        getCodexAllNodes: () => s.codexAllNodes,
        getCodexEdges: () => s.codexEdges,
        getBioArchiveCodexSnapshot() {
            const nodes = s.codexAllNodes;
            const edges = s.codexEdges;
            if (!Array.isArray(nodes) || nodes.length === 0) return null;
            const allowedShowInCodexPairKeys = buildDirectCodexBioPairKeySet(nodes, edges || []);
            return {
                nodes,
                edges: edges || [],
                allowedShowInCodexPairKeys,
                pairKeyFor(arch, subjectKind, subjectName, linkedKind, linkedName) {
                    return pairKeyForBioArchiveConnection(
                        arch,
                        subjectKind,
                        linkedKind,
                        subjectName,
                        linkedName,
                        nodes,
                    );
                },
            };
        },
    };
}
