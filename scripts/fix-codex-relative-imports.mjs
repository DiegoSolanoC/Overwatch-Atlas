/**
 * Fix codex-canvas internal imports after folder consolidation.
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

const REPLACEMENTS = [
  // CodexModeService depth
  ["from '../../../universal-features/", "from '../../../../universal-features/"],
  // Entry at codex-canvas root
  ["from '../codex-canvas/core/", "from './core/"],
  ["from '../codex-canvas/bridge/", "from './bridge/"],
  // mode/shell (depth: codex-canvas/mode/shell)
  ["from '../../codex-canvas/core/", "from '../../core/"],
  ["from '../../codex-canvas/bridge/", "from '../../bridge/"],
  ["from '../../codex-data/", "from '../../../codex-data/"],
  // core/ (depth: codex-canvas/core) — sibling slices live under connection-codex
  ["from '../codex-controls-ui/", "from '../../codex-controls-ui/"],
  ["from '../codex-data/", "from '../../codex-data/"],
  ["from '../codex-edge-cords/", "from '../../codex-edge-cords/"],
  ["from '../codex-node-drawing/", "from '../../codex-node-drawing/"],
  ["from '../codex-nodes/", "from '../../codex-nodes/"],
  ["from '../codex-bio-archive-sync/", "from '../../codex-bio-archive-sync/"],
  ["from '../codex-canvas/bridge/", "from '../bridge/"],
  // mode-entry
  ["from '../../CodexCanvasEntry.js'", "from '../../CodexCanvasEntry.js'"], // keep
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (ent.name.endsWith('.js')) files.push(p);
  }
  return files;
}

let n = 0;
for (const file of walk(codexRoot)) {
  let text = fs.readFileSync(file, 'utf8');
  const before = text;
  for (const [from, to] of REPLACEMENTS) {
    text = text.split(from).join(to);
  }
  if (text !== before) {
    fs.writeFileSync(file, text);
    n++;
  }
}
console.log(`Fixed ${n} codex files`);
