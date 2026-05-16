/**
 * Split CodexCanvasService.js into responsibility modules + codex-core host.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src/features/connection-codex/services/CodexCanvasService.js');
const FEAT = path.join(ROOT, 'src/features/connection-codex');

const SKIP_FUNCS = new Set(['syncCodexEdgesFromBioArchiveConnections']);

const MODULE_MAP = {
    'codex-edges/canvas/CodexEdgeStore.js': new Set([
        'findEdge', 'hasCodexConnectionBetween', 'markCodexEdgeUnsaved', 'markIncidentCodexEdgesUnsaved',
        'removeCodexEdgeDirected', 'reverseCodexDirectedEdge', 'reverseCodexEdgeForSelectedPair', 'addDirectedCodexEdge',
        'removeEdgesTouchingNodeId', 'removeEdgesTouchingNodeIds', 'removeJunctionAndBridgeEdges',
        'removeEdgesForDeletedNodesWithJunctionBridging', 'edgeIsCordPendingDelete', 'edgeCordAppearance',
        'edgeCordIsActivelyUpdating', 'edgeCordShowsYellow', 'clearPendingCodexDeleteState', 'codexHasPendingDeleteVisuals',
        'clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded', 'buildPolylineForEdge', 'samplePacketTailNodeIds',
        'tryBuildPacketWorldPoints', 'appendCodexEdgeNodeMask', 'codexEffectivePacketStrokeRange',
        'appendCodexJunctionElbowParallelograms', 'collectCodexDirectedChainEdgeKeys', 'codexEdgeHoverChainSetsEqual',
        'setCodexEdgeHoverVisual', 'clearAllCodexEdgeHoverVisual', 'onCodexEdgeSvgPointerOver', 'onCodexEdgeSvgPointerOut',
        'codexSvgPointerDownCapture', 'codexEscapeEdgeIdForSelector', 'openStoryArchiveFromCodexEdgeHit'
    ]),
    'codex-edges/junction/CodexJunctionOps.js': new Set([
        'junctionTopLeftBetweenNodeElements', 'insertCodexBreakBetweenSelectedPair', 'mergeCodexJunctionPairKeepPrimary',
        'mergeCodexSelectedJunctionPair', 'pickJunctionReadyToSpliceAmongDeleteSet'
    ]),
    'codex-camera/coords/CodexWorldCoords.js': new Set([
        'getCodexBodyLayoutPerViewportPx', 'clientToWorldCodex', 'getCodexVisibleWorldBoundsExpanded',
        'clampCodexNodeTopLeftToWorld', 'getNodeCenterWorldPx', 'ensureCodexNodeCoordLabel', 'syncCodexNodeCoordLabels',
        'applyOctilinearSnapOnDragRelease', 'applyWorldCenterToNodeTopLeft'
    ]),
    'codex-camera/transform/CodexViewTransform.js': new Set([
        'applyCodexWorldTransformStyle', 'applyCodexViewTransform', 'applyCodexZoomWithAnchor', 'codexZoomByFactorAt',
        'getCodexViewCenterClient', 'codexZoomInFromUi', 'codexZoomOutFromUi', 'codexResetView',
        'centerCodexViewOnWorldCenter', 'centerCodexViewOnNodes'
    ]),
    'codex-camera/gestures/CodexViewGestures.js': new Set([
        'codexWheelShouldDeferToScroll', 'detachCodexViewGestures', 'attachCodexViewGestures',
        'cancelBackgroundPanPointerPending', 'armCodexBackgroundPanPendingFromEvent', 'onBackgroundPanMoveMaybe',
        'onBackgroundPanUpMaybe', 'beginActualBackgroundPan', 'onHitLayerBackgroundPanPointerDown'
    ]),
    'codex-data/save/CodexLayoutSave.js': new Set(['isCodexFileApiAvailable', 'serializeCodexState', 'saveCodexLayout']),
    'codex-data/load/CodexLayoutLoad.js': new Set([
        'placeLoadedCodexNodeRecord', 'placeCodexNodeRecordsInChunks', 'yieldCodexBrowserPaint',
        'yieldBetweenCodexLoadChunks', 'loadCodexState'
    ]),
    'codex-data/import-export/CodexLayoutImportExport.js': new Set([
        'stripCodexBoardForFullReplace', 'importCodexLayoutFromJsonText', 'exportCodexLayoutJsonDownload'
    ]),
    'codex-nodes/filters/CodexNodeFilters.js': new Set([
        'codexNodeMatchesFilters', 'applyCodexFilterState', 'applyCodexEventThumbnailFilterHover',
        'clearCodexEventThumbnailFilterHover'
    ]),
    'codex-nodes/selection/CodexNodeSelection.js': new Set([
        'markCodexLayoutDirty', 'markNodeVisualUnsaved', 'selectCodexNode', 'selectCodexNodesPair', 'selectAllCodexNodes',
        'pruneStaleCodexSelection', 'getSelectedCodexNodesInRoot', 'stripCodexSelectionFromDom',
        'stripCodexBDescendantGlowFromDom', 'getCodexStrictOutgoingDescendantIds', 'refreshCodexBDescendantGlowForSelection',
        'applyCodexSelectionToDom', 'selectDragGroupForNode', 'clampCodexGroupDragDelta', 'clearAllCodexBoard',
        'deleteCodexToolbarSelectedNodes', 'unregisterCodexNodeRenderTracking', 'codexNodeElById', 'codexNodeIsJunctionWaypoint',
        'codexNodeKindById', 'handleNetworkNodeActivate'
    ]),
    'codex-nodes/placement/CodexNodePlacement.js': new Set([
        'findCodexDuplicatePortraitNodeId', 'applyNodeScale', 'createCodexNodeElement', 'placeCodexNode',
        'bindCodexNodeInteraction', 'maybeOpenStoryArchiveFromCodexNodeEl', 'codexNodeElSupportsStoryArchiveLink',
        'codexBioLinkSpecFromNodeEl'
    ]),
    'codex-nodes/cull/CodexNodeDomCull.js': new Set(['syncCodexNodeOffscreenContentVisibility', 'syncCodexNodeDomCullFromView']),
    'codex-toolbar/CodexToolbar.js': new Set([
        'updateCodexToolbar', 'getCodexToolbarEndpointPreviewState', 'applyCodexToolbarInteractionMode',
        'nudgeSelectedNodeScale', 'getUniformCodexScaleForNodes', 'formatCodexScaleForInput', 'setSelectedNodesAbsoluteScale',
        'bindCodexToolbarScaleInput', 'ensureCodexToolbarSelectAllRow', 'ensureCodexToolbarDeleteSelectedButton',
        'ensureCodexToolbarScaleInput', 'ensureCodexToolbarSelectionPreviewRow', 'loadCodexVisualPrefs', 'persistCodexVisualPrefs',
        'loadCodexDebugUiPref', 'loadCodexModePref', 'persistCodexDebugUiPref', 'persistCodexModePref', 'syncCodexDebugUiClass',
        'syncCodexModeClass', 'ensureCodexToolbarDebugToggle', 'ensureCodexToolbarModeToggle', 'codexVisualPanelQueryHost',
        'readCodexVisualPrefsFromToolbar', 'syncCodexVisualToolbarFromPrefs', 'ensureCodexVisualPrefsPanel', 'ensureCodexToolbar',
        'ensureCodexToolbarBioSyncButton', 'ensureCodexToolbarImportExportRow'
    ]),
    'codex-nodes/picker/CodexNodePicker.js': new Set([
        'openPickerAtRootPoint', 'normalizeFactions', 'getHeroFactionLists', 'removeListOnly', 'removePicker',
        'substringMatchScore', 'buildMatches', 'appendSuggestionRow', 'syncSuggestionList', 'normalizeCodexHeroNameForMatch',
        'codexHeroNamesLooselyEqual', 'findHeroArchiveIndexByCodexName', 'openHeroArchiveEntryFromCodexHeroName'
    ]),
    'codex-mode/shell/CodexCanvasShell.js': new Set([
        'ensureCodexWorld', 'ensureCodexBorderOverlay', 'ensureCodexModeToggle', 'ensureEdgesLayer', 'ensureHitLayer'
    ]),
    'codex-input/pointer/CodexPointerInput.js': new Set([
        'cancelPointerPending', 'onPointerMoveMaybeDrag', 'onPointerUpMaybeSelect', 'beginActualNodeDrag'
    ])
};

const HOST_FUNCS = new Set(['initCodexCanvas', 'destroyCodexCanvas']);

const STATE_VARS = [
    'hitLayerEl', 'onCodexContextMenuCapture', 'pickerEl', 'listEl', 'onDocPointerDown', 'onDocKeydown',
    'nodeZ', 'pendingNodePos', 'codexAllNodes', 'codexRenderedNodeIds', 'codexNodeElements', 'codexSkipEdgeRedraw',
    'codexSkipAllEdgeRedraws', 'codexVisualPrefs', 'codexInteractionMode', 'codexMode', 'networkLinkSourceId',
    'codexEdges', 'codexEdgesSvgEl', 'codexEdgeHoverChainKeySet', 'cordPendingDeletePairKey', 'codexBulkNodeDeleteArmedAt',
    'codexSelectedNodeEls', 'codexPrimarySelectedNodeEl', 'pointerPending', 'codexLayoutDirty', 'codexActiveDragNodeIds',
    'codexWorldEl', 'codexViewPanX', 'codexViewPanY', 'codexViewZoom', 'codexPinchState', 'onCodexWheelHandler',
    'onCodexTouchStartHandler', 'onCodexTouchMoveHandler', 'onCodexTouchEndHandler', 'backgroundPanPointerPending',
    'backgroundPanPointerId', 'codexToolbarEl', 'codexVisualPanelEl', 'codexDebugUiVisible', 'onWindowResizeRedraw',
    'onCodexGlobalKeydown', 'codexViewModeInitialRenderDone', 'codexZoomDebounceTimer',
    'cordDoubleRightLastTs', 'codexNodeDeleteLastRightTs', 'codexUnsavedEdgeKeys'
];

function migrateState(code) {
    let out = code;
    for (const v of STATE_VARS) {
        out = out.replace(new RegExp(`\\.\\.\\.${v}\\b`, 'g'), `...s.${v}`);
        out = out.replace(new RegExp(`(?<!s\\.)\\b${v}\\b`, 'g'), `s.${v}`);
    }
    out = out.replace(/(?<=\{\s*\n?\s*)root(?=\s*,)/g, 'root: s.root');
    out = out.replace(/s\.s\./g, 's.');
    return out;
}

function parseTopLevelFunctions(lines) {
    const re = /^(export )?(async )?function (\w+)/;
    const fns = [];
    for (let i = 0; i < lines.length; i += 1) {
        const m = lines[i].match(re);
        if (!m) continue;
        const name = m[3];
        if (SKIP_FUNCS.has(name)) continue;
        let depth = 0;
        let started = false;
        let end = i;
        for (let j = i; j < lines.length; j += 1) {
            for (const ch of lines[j]) {
                if (ch === '{') { depth += 1; started = true; }
                else if (ch === '}') depth -= 1;
            }
            if (started && depth === 0) { end = j; break; }
        }
        fns.push({ name, start: i, end, isExport: Boolean(m[1]), isAsync: Boolean(m[2]) });
        i = end;
    }
    return fns;
}

function upPrefix(relPath) {
    const depth = relPath.split('/').length - 1;
    return '../'.repeat(Math.max(1, depth));
}

function crossModuleApiCalls(code, localNames, allNames) {
    let out = code;
    const external = [...allNames].filter((n) => !localNames.has(n)).sort((a, b) => b.length - a.length);
    for (const name of external) {
        out = out.replace(new RegExp(`\\b${name}\\s*\\(`, 'g'), `api.${name}(`);
    }
    return out;
}

let raw = fs.readFileSync(SRC, 'utf8');
// Pre-cleanups
raw = raw.replace(/\nconst CODEX_PERFORMANCE_DEBUG = false;\n/, '\n');
raw = raw.replace(/\bconst s = getCodexBodyLayoutPerViewportPx\(\)/g, 'const layoutScale = getCodexBodyLayoutPerViewportPx()');
raw = raw.replace(/function debugLogNodeInfo\([\s\S]*?\n}\n\n/, '');
raw = raw.replace(/\/\/ FilterService invokes[\s\S]*?exposeApplyCodexFilterState\(applyCodexFilterState\);\n}\n\n/, '');
raw = raw.replace(/    debugLogNodeInfo\(el\);\n\n/, '');
raw = raw.replace(/async function syncCodexEdgesFromBioArchiveConnections\(\) \{[\s\S]*?\n\}\n\n/, '');
raw = raw.replace(/    CODEX_USE_SIMPLIFIED_DOM,\n/, '');
raw = raw.replace(/    CODEX_NODE_ALPHA_PATH,\n/, '');
// legacy DOM branch -> simplified only
raw = raw.replace(
    /    if \(CODEX_USE_SIMPLIFIED_DOM\) \{\n([\s\S]*?)        el\.appendChild\(frame\);\n    \} else \{[\s\S]*?        el\.appendChild\(inner\);\n    \}\n/,
    (m, inner) => inner.replace(/^        /gm, '    ')
);
// filter debug logs
raw = raw.replace(/    console\.log\(`\[Codex Filter\][^`]*`[^;]*;\n/g, '');
raw = raw.replace(/    console\.log\(`\[Codex Filter\] Active filters:[^;]*;\n/g, '');
raw = raw.replace(/            matchCount\+\+;\n/g, '');
raw = raw.replace(/            filteredCount\+\+;\n/g, '');
raw = raw.replace(/    console\.log\(`\[Codex Filter\] Result:[^;]*;\n/g, '');

const lines = raw.split('\n');
const importEnd = lines.findIndex((l) => l.startsWith('let root ='));
const importBlock = lines.slice(5, importEnd).filter((l) => !l.startsWith('export { previewBio')).join('\n');

fs.mkdirSync(path.join(FEAT, 'codex-core'), { recursive: true });
fs.writeFileSync(path.join(FEAT, 'codex-core/codexCanvasSharedImports.js'), `/** Shared imports for Codex canvas slices. */\n${importBlock}\n`);

const fns = parseTopLevelFunctions(lines);
const fnByName = Object.fromEntries(fns.map((f) => [f.name, f]));
const allFuncNames = new Set(fns.map((f) => f.name));

const assigned = new Set();
for (const s of Object.values(MODULE_MAP)) for (const n of s) assigned.add(n);
for (const f of fns) {
    if (!assigned.has(f.name) && !HOST_FUNCS.has(f.name) && f.name !== 'debugLogNodeInfo') {
        if (!MODULE_MAP['codex-core/CodexCanvasMisc.js']) MODULE_MAP['codex-core/CodexCanvasMisc.js'] = new Set();
        MODULE_MAP['codex-core/CodexCanvasMisc.js'].add(f.name);
    }
}

const FILTER_MODULE_EXTRA_IMPORTS = `import {
    exposeApplyCodexFilterState,
    getFactionMatchHelpers,
    getStandaloneActiveFiltersSet,
    getStoryFilterPlacesSync
} from '../../codex-integration/bridge/CodexAppBridge.js';
import { redrawCodexEdges } from '../../codex-render/redraw/CodexEdgeRedraw.js';
`;
const FILTER_HOOK = `
if (typeof window !== 'undefined') {
    exposeApplyCodexFilterState(applyCodexFilterState);
}
`;

const sliceImports = [];

for (const [relPath, names] of Object.entries(MODULE_MAP)) {
    const outPath = path.join(FEAT, relPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const up = upPrefix(relPath);
    const localNames = new Set(names);
    const chunks = [];
    for (const name of names) {
        const fn = fnByName[name];
        if (!fn) { console.warn('missing', name); continue; }
        let body = lines.slice(fn.start, fn.end + 1).join('\n').replace(/^export /, '');
        body = migrateState(body);
        body = crossModuleApiCalls(body, localNames, allFuncNames);
        chunks.push(body);
    }
    if (relPath.includes('CodexNodeFilters')) chunks.push(FILTER_HOOK);
    const exportNames = [...names].filter((n) => fnByName[n]);
    const registrations = exportNames.map((n) => `api.${n} = ${n};`).join('\n');
    const extraExports = exportNames.includes('saveCodexLayout') ? '\nexport { saveCodexLayout };' : '';
    const content = `/** ${path.basename(relPath, '.js')} — Codex canvas slice. */
import { api } from '${up}codex-core/codexCanvasApi.js';
import { s } from '${up}codex-core/canvasSession.js';
import { capOpts, DOUBLE_RIGHT_MS, CODEX_JUNCTION_PREVIEW_DATA_URI, MAX_SUGGEST, CODEX_DEBUG_UI_PREF_KEY_LEGACY, CODEX_MODE_PREF_KEY } from '${up}codex-core/canvasConstants.js';
${relPath.includes('CodexLayoutSave') ? `import { syncCodexEdgesFromBioArchiveConnections } from '${up}codex-bio-sync/reconcile/CodexBioArchiveEdgeSync.js';\n` : ''}${relPath.includes('CodexNodeFilters') ? FILTER_MODULE_EXTRA_IMPORTS : ''}

${chunks.join('\n\n')}

${registrations}
${extraExports}
`;
    fs.writeFileSync(outPath, content);
    sliceImports.push(`import '../${relPath.replace(/\\/g, '/')}';`);
    console.log('wrote', relPath, exportNames.length);
}

const initFn = fnByName.initCodexCanvas;
const destroyFn = fnByName.destroyCodexCanvas;
let hostBody = migrateState(lines.slice(initFn.start, destroyFn.end + 1).join('\n'));
hostBody = crossModuleApiCalls(hostBody, new Set([...HOST_FUNCS]), allFuncNames);
hostBody = hostBody.replace(/\bapi\.api\./g, 'api.');
hostBody = hostBody.replace(/getPerfDebug: \(\) => CODEX_PERFORMANCE_DEBUG/g, 'getPerfDebug: () => false');
hostBody = hostBody.replace(/(\s+)api\.placeLoadedCodexNodeRecord,/g, '$1placeLoadedCodexNodeRecord: api.placeLoadedCodexNodeRecord,');
hostBody = hostBody.replace(/(\s+)api\.(findEdge|removeCodexEdgeDirected|clearPendingCodexDeleteState|buildPolylineForEdge)/g, (m, sp, fn) => `${sp}${fn}: api.${fn}`);

const hostFile = `/** Codex canvas host — mount lifecycle and runtime registration. */
import { api } from './codexCanvasApi.js';
import { s, resetCanvasSession } from './canvasSession.js';
import { codexEdgePolyIntersectsRect, codexUnionBoundsFromEdgePolys } from '../codex-camera/viewport/CodexViewportWorldBounds.js';
import { cordSegmentDegreesLabel, cordSegmentWithinOctilinearToleranceDegrees } from '../codex-edges/geometry/CodexCordOctilinearGeometry.js';
import {
    codexStopCordAnimRafOnly,
    ensureCodexCordAnimationLoop,
    syncCodexCordPacketState
} from '../codex-render/packets/CodexCordPacketAnimation.js';
import {
    appendCordFilteredLineGroup,
    appendEdgeGlowFilter,
    appendSoftPacketGlowFilter
} from '../codex-render/svg/CodexCordSvgElements.js';
${sliceImports.join('\n')}
import { registerCodexVirtualScrollRuntime, unregisterCodexVirtualScrollRuntime, clearCodexVirtualScroll } from '../codex-render/virtual-scroll/CodexVirtualScroll.js';
import { registerCodexBioPreviewRuntime, unregisterCodexBioPreviewRuntime, previewBioCodexArchiveLinkDiff } from '../codex-bio-sync/preview/CodexCanvasBioSyncPreview.js';
import { registerCodexBioArchiveEdgeSyncRuntime, syncCodexEdgesFromBioArchiveConnections, unregisterCodexBioArchiveEdgeSyncRuntime } from '../codex-bio-sync/reconcile/CodexBioArchiveEdgeSync.js';
import { registerCodexEdgeRedrawRuntime, unregisterCodexEdgeRedrawRuntime, redrawCodexEdges, scheduleRedrawCodexEdges, clearCodexEdgeRedrawSchedule } from '../codex-render/redraw/CodexEdgeRedraw.js';
import { registerCodexCordPacketRuntime, unregisterCodexCordPacketRuntime, stopCordAnimAndClearCordPacketState } from '../codex-render/packets/CodexCordPacketAnimation.js';
import { disconnectCodexImageObserver } from '../codex-render/lazy-images/CodexImageLazyLoad.js';
import { terminateCodexJsonParseWorker } from '../codex-data/load/CodexJsonParseWorker.js';
import { serializeCodexLayoutSnapshot } from '../codex-data/persistence/CodexLayoutSerialization.js';
import { CODEX_ZOOM_INITIAL } from '../codex-camera/viewport/CodexCanvasTuning.js';
import { DOUBLE_RIGHT_MS } from './canvasConstants.js';

${hostBody}

export { previewBioCodexArchiveLinkDiff };
export { saveCodexLayout } from '../codex-data/save/CodexLayoutSave.js';
export { syncCodexEdgesFromBioArchiveConnections };
`;
fs.writeFileSync(path.join(FEAT, 'codex-core/codexCanvasHost.js'), hostFile);

const serviceFixed = `/** Codex canvas — public entry (implementation under codex-core/ + codex-* slices). */
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
`;
fs.writeFileSync(SRC, serviceFixed);

const indexPath = path.join(FEAT, 'index.js');
let index = fs.readFileSync(indexPath, 'utf8');
if (!index.includes('syncCodexEdgesFromBioArchiveConnections')) {
    index = index.replace(
        /export \{ parseMigrateAndDedupeCodexSource \}[^\n]+\n/,
        (m) => m + "export { syncCodexEdgesFromBioArchiveConnections } from './codex-bio-sync/reconcile/CodexBioArchiveEdgeSync.js';\n"
    );
    fs.writeFileSync(indexPath, index);
}
console.log('split complete');
