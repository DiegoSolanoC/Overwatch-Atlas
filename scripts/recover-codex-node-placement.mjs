import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const monolithPath = path.join(ROOT, 'src/features/connection-codex/services/CodexCanvasService.js');
const outPath = path.join(ROOT, 'src/features/connection-codex/codex-nodes/placement/CodexNodePlacement.js');
const brokenPath = outPath;

const STATE_VARS = [
    'hitLayerEl', 'pickerEl', 'listEl', 'nodeZ', 'pendingNodePos', 'codexAllNodes', 'codexRenderedNodeIds',
    'codexNodeElements', 'codexInteractionMode', 'codexMode', 'networkLinkSourceId', 'codexEdges',
    'codexWorldEl', 'codexViewPanX', 'codexViewPanY', 'codexViewZoom', 'pointerPending', 'codexLayoutDirty',
    'codexActiveDragNodeIds', 'codexUnsavedEdgeKeys', 'codexSelectedNodeEls', 'codexPrimarySelectedNodeEl',
    'codexBulkNodeDeleteArmedAt', 'codexNodeDeleteLastRightTs', 'root'
];

function extractFn(lines, name) {
    const re = new RegExp(`^function ${name}\\b`);
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) { start = i; break; }
    }
    if (start < 0) throw new Error(`function ${name} not found`);
    let depth = 0;
    let started = false;
    let end = start;
    for (let j = start; j < lines.length; j++) {
        for (const ch of lines[j]) {
            if (ch === '{') { depth++; started = true; }
            else if (ch === '}') depth--;
        }
        if (started && depth === 0) { end = j; break; }
    }
    return lines.slice(start, end + 1).join('\n');
}

function migrateState(code) {
    let out = code;
    for (const v of STATE_VARS) {
        out = out.replace(new RegExp(`\\.\\.\\.${v}\\b`, 'g'), `...s.${v}`);
        out = out.replace(new RegExp(`(?<!s\\.)\\b${v}\\b`, 'g'), `s.${v}`);
    }
    out = out.replace(/function applyNodeScale[\s\S]*?const s = Math\.max/, (m) =>
        m.replace('const s = Math.max', 'const nodeScale = Math.max'));
    out = out.replace(/el\.dataset\.codexScale = String\(s\);/, 'el.dataset.codexScale = String(nodeScale);');
    out = out.replace(/nodeObj\.scale = s;/, 'nodeObj.scale = nodeScale;');
    out = out.replace(/const px = basePx \* s;/, 'const px = basePx * nodeScale;');
    out = out.replace(/s\.s\./g, 's.');
    out = out.replace(/\b(redrawCodexEdges|observeCodexImage|generateNodeId|hexToRgba|codexCountryFlagSrc|normalizeCodexCountryKey|resolveCodexNodeScale|codexFrameVariantForId|codexHexRotationDegreesForId|bindCodexNodeInteraction|applyNodeScale)\s*\(/g, (m, fn) => {
        if (['bindCodexNodeInteraction', 'applyNodeScale'].includes(fn)) return `${fn}(`;
        return fn === 'redrawCodexEdges' || fn === 'observeCodexImage' ? `${fn}(` : `${fn}(`;
    });
    out = out.replace(/\bapplyNodeScale\(/g, 'applyNodeScale(');
    out = out.replace(/\bbindCodexNodeInteraction\(/g, 'bindCodexNodeInteraction(');
    out = out.replace(/\bclampCodexNodeTopLeftToWorld\(/g, 'api.clampCodexNodeTopLeftToWorld(');
    out = out.replace(/\bclientToWorldCodex\(/g, 'api.clientToWorldCodex(');
    out = out.replace(/\bgetCodexBodyLayoutPerViewportPx\(/g, 'api.getCodexBodyLayoutPerViewportPx(');
    out = out.replace(/\bonPointerMoveMaybeDrag\b/g, 'api.onPointerMoveMaybeDrag');
    out = out.replace(/\bonPointerUpMaybeSelect\b/g, 'api.onPointerUpMaybeSelect');
    out = out.replace(/\(e\.clientX - lr\.left\) \/ s - baseLeft/g, '(e.clientX - lr.left) / layoutScale - baseLeft');
    out = out.replace(/\(e\.clientY - lr\.top\) \/ s - baseTop/g, '(e.clientY - lr.top) / layoutScale - baseTop');
    return out;
}

function stripLegacyDom(createBody) {
    const marker = '    if (CODEX_USE_SIMPLIFIED_DOM) {';
    const elseMarker = '    } else {';
    const i = createBody.indexOf(marker);
    const e = createBody.indexOf(elseMarker);
    if (i < 0 || e < 0) return createBody;
    const tailStart = createBody.indexOf('    const portraitKind = kind ===');
    let simplified = createBody.slice(i + marker.length, e);
    simplified = simplified.replace(/^\n/, '');
    const tail = createBody.slice(tailStart);
    return simplified + '\n' + tail;
}

let monolith = fs.readFileSync(
    fs.existsSync(path.join(ROOT, 'src/features/connection-codex/services/CodexCanvasService.js')) &&
    fs.readFileSync(monolithPath, 'utf8').includes('function createCodexNodeElement')
        ? monolithPath
        : path.join(process.env.TEMP || '/tmp', 'codex-monolith.js'),
    'utf8'
);
if (!monolith.includes('function createCodexNodeElement')) {
    const { execSync } = await import('child_process');
    monolith = execSync('git show HEAD:src/features/connection-codex/services/CodexCanvasService.js', { cwd: ROOT, encoding: 'utf8' });
}
const lines = monolith.split(/\r?\n/);

let applyNodeScale = migrateState(extractFn(lines, 'applyNodeScale'));
applyNodeScale = applyNodeScale.replace(/} else {\s*\/\/ Legacy nested DOM[\s\S]*?}\s*}\s*\/\*/, '}');
applyNodeScale = applyNodeScale.replace(/\s*const inner = el\.querySelector[\s\S]*?}\s*}\s*\n\s*\*\//, '\n    /*');

let createCodexNodeElement = migrateState(extractFn(lines, 'createCodexNodeElement'));
createCodexNodeElement = stripLegacyDom(createCodexNodeElement);

const broken = fs.readFileSync(brokenPath, 'utf8');
const headerEnd = broken.indexOf('function applyNodeScale');
const tailStart = broken.indexOf('function placeCodexNode');
const tail = broken.slice(tailStart);
const header = broken.slice(0, broken.indexOf('function findCodexDuplicatePortraitNodeId'));

const imports = `/** CodexNodePlacement — Codex canvas slice. */
import { api } from '../../codex-core/codexCanvasApi.js';
import { s } from '../../codex-core/canvasSession.js';
import { CODEX_WORLD_H, CODEX_WORLD_W } from '../../codex-data/persistence/CodexLayoutConstants.js';
import { generateNodeId, heroNamesLooselyEqualCodex } from '../../codex-edges/topology/CodexGraphPrimitives.js';
import { applyLocationFlagBioHighlight, getEventManager, playSoundEffect, updateAppStatus } from '../../codex-integration/bridge/CodexAppBridge.js';
import { CODEX_FRAME_PATH, CODEX_IMG_BASE_PX, CODEX_JUNCTION_BASE_PX, CODEX_SCALE_MAX, CODEX_SCALE_MIN, codexCountryFlagSrc, normalizeCodexCountryKey, resolveCodexNodeScale } from './CodexNodePortraitMetrics.js';
import { codexFrameVariantForId, codexHexRotationDegreesForId } from './CodexNodeVisualHash.js';
import { observeCodexImage } from '../../codex-render/lazy-images/CodexImageLazyLoad.js';
import { redrawCodexEdges } from '../../codex-render/redraw/CodexEdgeRedraw.js';
import { hexToRgba } from '../../codex-render/svg/CodexPresentationUtils.js';
import { scheduleUpdateCodexVirtualScroll } from '../../codex-render/virtual-scroll/CodexVirtualScroll.js';
import { capOpts, DOUBLE_RIGHT_MS } from '../../codex-core/canvasConstants.js';

`;

const findDup = broken.slice(broken.indexOf('function findCodexDuplicatePortraitNodeId'), headerEnd > 0 ? headerEnd : broken.indexOf('function applyNodeScale'));
const findDupClean = findDup.includes('function applyNodeScale') ? extractFn(broken.split(/\r?\n/), 'findCodexDuplicatePortraitNodeId') : findDup;

let placeCodexNode = migrateState(extractFn(lines, 'placeCodexNode'));
placeCodexNode = placeCodexNode
    .replace(/\bmarkNodeVisualUnsaved\(/g, 'api.markNodeVisualUnsaved(')
    .replace(/\bmarkCodexLayoutDirty\(/g, 'api.markCodexLayoutDirty(')
    .replace(/\bselectCodexNode\(/g, 'api.selectCodexNode(')
    .replace(/\bfindCodexDuplicatePortraitNodeId\(/g, 'findCodexDuplicatePortraitNodeId(');

const apiRegs = `
api.findCodexDuplicatePortraitNodeId = findCodexDuplicatePortraitNodeId;
api.applyNodeScale = applyNodeScale;
api.createCodexNodeElement = createCodexNodeElement;
api.placeCodexNode = placeCodexNode;
api.bindCodexNodeInteraction = bindCodexNodeInteraction;
api.maybeOpenStoryArchiveFromCodexNodeEl = maybeOpenStoryArchiveFromCodexNodeEl;
api.codexNodeElSupportsStoryArchiveLink = codexNodeElSupportsStoryArchiveLink;
api.codexBioLinkSpecFromNodeEl = codexBioLinkSpecFromNodeEl;
`;

const tailFns = broken.slice(broken.indexOf('function bindCodexNodeInteraction'));
const tailClean = migrateState(tailFns.replace(/api\.findCodexDuplicatePortraitNodeId[\s\S]*$/, apiRegs.trim() + '\n'));

const out = `${imports}${findDupClean}\n\n${applyNodeScale}\n\n${createCodexNodeElement}\n\n${placeCodexNode}\n\n${tailClean}`;
fs.writeFileSync(outPath, out);
console.log('recovered', outPath, 'lines', out.split(/\n/).length);
