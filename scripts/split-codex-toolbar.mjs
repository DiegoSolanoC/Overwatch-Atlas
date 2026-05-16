/**
 * Split CodexToolbar.js into responsibility modules under codex-toolbar/.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLBAR_DIR = path.join(__dirname, '../src/features/connection-codex/codex-toolbar');
const SRC = path.join(TOOLBAR_DIR, 'CodexToolbar.js');

const MODULE_MAP = {
    'prefs/CodexToolbarPrefs.js': new Set([
        'loadCodexVisualPrefs', 'persistCodexVisualPrefs', 'loadCodexDebugUiPref', 'loadCodexModePref',
        'persistCodexDebugUiPref', 'persistCodexModePref', 'syncCodexDebugUiClass', 'syncCodexModeClass',
        'ensureCodexToolbarDebugToggle', 'ensureCodexToolbarModeToggle'
    ]),
    'scale/CodexToolbarScale.js': new Set([
        'nudgeSelectedNodeScale', 'getUniformCodexScaleForNodes', 'formatCodexScaleForInput',
        'setSelectedNodesAbsoluteScale', 'bindCodexToolbarScaleInput', 'ensureCodexToolbarScaleInput'
    ]),
    'visual-panel/CodexToolbarVisualPanel.js': new Set([
        'codexVisualPanelQueryHost', 'readCodexVisualPrefsFromToolbar', 'syncCodexVisualToolbarFromPrefs',
        'ensureCodexVisualPrefsPanel'
    ]),
    'rows/CodexToolbarRows.js': new Set([
        'ensureCodexToolbarSelectAllRow', 'ensureCodexToolbarDeleteSelectedButton',
        'ensureCodexToolbarBioSyncButton', 'ensureCodexToolbarImportExportRow'
    ]),
    'preview/CodexToolbarSelectionPreview.js': new Set([
        'ensureCodexToolbarSelectionPreviewRow'
    ]),
    'CodexToolbarCore.js': new Set([
        'updateCodexToolbar', 'getCodexToolbarEndpointPreviewState', 'applyCodexToolbarInteractionMode',
        'ensureCodexToolbar'
    ])
};

const IMPORTS_BY_MODULE = {
    'prefs/CodexToolbarPrefs.js': `import {
    CODEX_DEBUG_UI_PREF_KEY,
    CODEX_DEBUG_UI_PREF_KEY_LEGACY,
    CODEX_MODE_PREF_KEY
} from '../../codex-core/canvasConstants.js';
import {
    CODEX_VISUAL_DEFAULTS,
    CODEX_VISUAL_PREFS_KEY,
    normalizeCodexVisualPrefs
} from '../../codex-camera/viewport/CodexCanvasTuning.js';
import { redrawCodexEdges } from '../../codex-render/redraw/CodexEdgeRedraw.js';
`,
    'scale/CodexToolbarScale.js': `import { CODEX_SCALE_MAX, CODEX_SCALE_MIN } from '../../codex-nodes/placement/CodexNodePortraitMetrics.js';
import { redrawCodexEdges } from '../../codex-render/redraw/CodexEdgeRedraw.js';
`,
    'visual-panel/CodexToolbarVisualPanel.js': `import {
    CODEX_VISUAL_DEFAULTS,
    normalizeCodexVisualPrefs
} from '../../codex-camera/viewport/CodexCanvasTuning.js';
import { redrawCodexEdges } from '../../codex-render/redraw/CodexEdgeRedraw.js';
`,
    'rows/CodexToolbarRows.js': `import { previewBioCodexArchiveLinkDiff } from '../../codex-bio-sync/preview/CodexCanvasBioSyncPreview.js';
import { updateAppStatus } from '../../codex-integration/bridge/CodexAppBridge.js';
import { hexToRgba } from '../../codex-render/svg/CodexPresentationUtils.js';
`,
    'preview/CodexToolbarSelectionPreview.js': '',
    'CodexToolbarCore.js': `import { CODEX_JUNCTION_PREVIEW_DATA_URI } from '../codex-core/canvasConstants.js';
`
};

const ALL_EXPORTED = new Set();
for (const names of Object.values(MODULE_MAP)) {
    for (const n of names) ALL_EXPORTED.add(n);
}

function parseFunctions(lines) {
    const re = /^function (\w+)/;
    const fns = [];
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(re);
        if (!m) continue;
        const name = m[1];
        let depth = 0;
        let started = false;
        let end = i;
        for (let j = i; j < lines.length; j++) {
            for (const ch of lines[j]) {
                if (ch === '{') { depth++; started = true; }
                else if (ch === '}') depth--;
            }
            if (started && depth === 0) { end = j; break; }
        }
        fns.push({ name, start: i, end, body: lines.slice(i, end + 1).join('\n') });
        i = end;
    }
    return fns;
}

function crossModuleCalls(code, localNames) {
    let out = code;
    const external = [...ALL_EXPORTED].filter((n) => !localNames.has(n)).sort((a, b) => b.length - a.length);
    for (const name of external) {
        out = out.replace(new RegExp(`\\b${name}\\s*\\(`, 'g'), `api.${name}(`);
    }
    return out;
}

function fixKnownBugs(code) {
    return code.replace(
        /api\.applyNodeScale\(nodeEl, s, true\)/g,
        'api.applyNodeScale(nodeEl, nodeScale, true)'
    );
}

const raw = fs.readFileSync(SRC, 'utf8');
const lines = raw.split(/\r?\n/);
const fns = parseFunctions(lines);
const fnByName = Object.fromEntries(fns.map((f) => [f.name, f]));

const sliceImports = [];

for (const [relPath, names] of Object.entries(MODULE_MAP)) {
    const outPath = path.join(TOOLBAR_DIR, relPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const localNames = new Set(names);
    const chunks = [];
    for (const name of names) {
        const fn = fnByName[name];
        if (!fn) {
            console.warn('missing', name);
            continue;
        }
        let body = fn.body;
        body = crossModuleCalls(body, localNames);
        body = fixKnownBugs(body);
        chunks.push(body);
    }
    const registrations = [...names].filter((n) => fnByName[n]).map((n) => `api.${n} = ${n};`).join('\n');
    const up = relPath.includes('/')
        ? '../'.repeat(relPath.split('/').length)
        : '../';
    const content = `/** ${path.basename(relPath, '.js')} — Codex toolbar slice. */
import { api } from '${up}codex-core/codexCanvasApi.js';
import { s } from '${up}codex-core/canvasSession.js';
${IMPORTS_BY_MODULE[relPath] || ''}
${chunks.join('\n\n')}

${registrations}
`;
    fs.writeFileSync(outPath, content);
    sliceImports.push(`import './${relPath.replace(/\\/g, '/')}';`);
    console.log('wrote', relPath, [...names].length);
}

const entry = `/** Codex toolbar — registers all toolbar slices on the canvas API. */
${sliceImports.join('\n')}
`;
fs.writeFileSync(path.join(TOOLBAR_DIR, 'CodexToolbar.js'), entry);
console.log('wrote CodexToolbar.js entry');
