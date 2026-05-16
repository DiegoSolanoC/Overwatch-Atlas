/**
 * Fix session state refs missed by split migrateState (spread `...var` blocked the lookbehind).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FEAT = path.join(__dirname, '../src/features/connection-codex');

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

function walk(dir, out = []) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory() && ent.name !== 'node_modules') walk(p, out);
        else if (ent.isFile() && ent.name.endsWith('.js') && !ent.name.includes('canvasSession')) out.push(p);
    }
    return out;
}

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const before = content;
    for (const v of STATE_VARS) {
        content = content.replace(new RegExp(`\\.\\.\\.${v}\\b`, 'g'), `...s.${v}`);
        content = content.replace(new RegExp(`(?<!s\\.)\\b${v}\\b`, 'g'), `s.${v}`);
    }
    content = content.replace(/api\.debugLogNodeInfo\([^)]*\);\s*\n\s*/g, '');
    content = content.replace(/s\.s\./g, 's.');
    if (content !== before) {
        fs.writeFileSync(filePath, content);
        console.log('fixed', path.relative(FEAT, filePath));
    }
}

for (const f of walk(FEAT)) {
    if (f.includes('codex-mode\\mode-entry') || f.includes('codex-mode/mode-entry')) continue;
    if (f.includes('CodexModeService')) continue;
    if (f.includes('CodexViewportWorldBounds')) continue;
    if (f.includes('codex-bio-sync')) continue;
    if (f.includes('codex-core\\codexCanvasHost') || f.includes('codex-core/codexCanvasHost')) continue;
    if (!f.includes('codex-edges') && !f.includes('codex-camera') && !f.includes('codex-data')
        && !f.includes('codex-nodes') && !f.includes('codex-toolbar') && !f.includes('codex-input')
        && !f.includes('codex-mode\\shell') && !f.includes('codex-mode/shell')) continue;
    fixFile(f);
}

console.log('done');
