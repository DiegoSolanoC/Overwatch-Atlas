/**
 * Fix connection-codex imports after codex-* slices moved to siblings of codex-canvas/.
 * - core/ + bridge/ live under codex-canvas/
 * - codexCanvasHost side-effect imports used one "../" too few
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const codexRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'features',
  'connection-codex'
);

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (ent.name.endsWith('.js')) files.push(p);
  }
  return files;
}

function depthFromCodexRoot(file) {
  const rel = path.relative(codexRoot, path.dirname(file));
  if (!rel || rel === '.') return 0;
  return rel.split(path.sep).length;
}

function existsImport(fromDir, spec) {
  const base = path.normalize(path.join(fromDir, spec));
  return (
    fs.existsSync(base) ||
    fs.existsSync(`${base}.js`) ||
    fs.existsSync(path.join(base, 'index.js'))
  );
}

function prefixToCodexRoot(depth) {
  return depth <= 0 ? './' : '../'.repeat(depth);
}

function fixFile(file) {
  const dir = path.dirname(file);
  const depth = depthFromCodexRoot(file);
  const rel = path.relative(codexRoot, file).replace(/\\/g, '/');
  let text = fs.readFileSync(file, 'utf8');
  const before = text;

  // codex-canvas/core/codexCanvasHost.js — side-effect imports
  if (rel === 'codex-canvas/core/codexCanvasHost.js') {
    text = text.replaceAll("import '../codex-", "import '../../codex-");
    text = text.replace(
      "import '../codex-canvas/mode/shell/CodexCanvasShell.js'",
      "import '../mode/shell/CodexCanvasShell.js'"
    );
  }

  // codex-canvas/core/codexCanvasSharedImports.js
  if (rel === 'codex-canvas/core/codexCanvasSharedImports.js') {
    text = text.replaceAll('from "./bridge/', 'from "../bridge/');
    text = text.replaceAll("from './bridge/", "from '../bridge/");
  }

  const importRe = /from\s+(['"])(\.\.?\/[^'"]+)\1/g;
  text = text.replace(importRe, (match, quote, spec) => {
    if (existsImport(dir, spec)) return match;

    // ./core/ or ./bridge/ (toolbar assumed at depth 2)
    if (spec.startsWith('./core/')) {
      const fixed = `${prefixToCodexRoot(depth)}codex-canvas/core/${spec.slice('./core/'.length)}`;
      if (existsImport(dir, fixed)) return `from ${quote}${fixed}${quote}`;
    }
    if (spec.startsWith('./bridge/')) {
      const fixed = `${prefixToCodexRoot(depth)}codex-canvas/bridge/${spec.slice('./bridge/'.length)}`;
      if (existsImport(dir, fixed)) return `from ${quote}${fixed}${quote}`;
    }

    // ../../core/ → {up}codex-canvas/core/
    const coreM = spec.match(/^((?:\.\.\/)+)core\/(.+)$/);
    if (coreM) {
      const fixed = `${prefixToCodexRoot(depth)}codex-canvas/core/${coreM[2]}`;
      if (existsImport(dir, fixed)) return `from ${quote}${fixed}${quote}`;
    }

    const bridgeM = spec.match(/^((?:\.\.\/)+)bridge\/(.+)$/);
    if (bridgeM) {
      const fixed = `${prefixToCodexRoot(depth)}codex-canvas/bridge/${bridgeM[2]}`;
      if (existsImport(dir, fixed)) return `from ${quote}${fixed}${quote}`;
    }

    // Under codex-controls-ui (depth >= 3): ../../codex-* → ../../../codex-*
    if (rel.startsWith('codex-controls-ui/') && depth >= 3 && spec.startsWith('../../codex-')) {
      const fixed = `../${spec}`;
      if (existsImport(dir, fixed)) return `from ${quote}${fixed}${quote}`;
    }

    return match;
  });

  if (text !== before) {
    fs.writeFileSync(file, text);
    return true;
  }
  return false;
}

let n = 0;
for (const file of walk(codexRoot)) {
  if (fixFile(file)) n++;
}
console.log(`Fixed ${n} connection-codex files`);
