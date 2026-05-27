import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const uf = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'features', 'universal-features');

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (ent.name.endsWith('.js')) files.push(p);
  }
  return files;
}

const REPLACEMENTS = [
  // Inside atlas-mode-runtime: self-references
  ["from '../atlas-mode-runtime/mode-lifecycle/", "from './mode-lifecycle/"],
  ["from '../atlas-mode-runtime/loadingOverlayState.js'", "from './loadingOverlayState.js'"],
  ["from '../atlas-mode-runtime/statusFeed.js'", "from './statusFeed.js'"],
  ["from '../../atlas-mode-runtime/loadingOverlayState.js'", "from '../loadingOverlayState.js'"],
  ["from '../../atlas-mode-runtime/statusFeed.js'", "from '../statusFeed.js'"],
  // atlas-header is one level deep
  ["from '../../atlas-mode-runtime/", "from '../atlas-mode-runtime/"],
];

let n = 0;
for (const file of walk(uf)) {
  let text = fs.readFileSync(file, 'utf8');
  const before = text;
  for (const [a, b] of REPLACEMENTS) text = text.split(a).join(b);
  if (text !== before) {
    fs.writeFileSync(file, text);
    n++;
  }
}
console.log(`Fixed ${n} universal-features files`);
