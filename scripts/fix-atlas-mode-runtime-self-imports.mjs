import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const rt = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'features', 'universal-features', 'atlas-mode-runtime');

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (ent.name.endsWith('.js')) files.push(p);
  }
  return files;
}

const pairs = [
  ["from '../atlas-mode-runtime/loadingOverlayState.js'", "from './loadingOverlayState.js'"],
  ["from '../atlas-mode-runtime/statusFeed.js'", "from './statusFeed.js'"],
  ["from '../atlas-mode-runtime/mode-lifecycle/", "from './mode-lifecycle/"],
];

let n = 0;
for (const file of walk(rt)) {
  let text = fs.readFileSync(file, 'utf8');
  const before = text;
  for (const [a, b] of pairs) text = text.split(a).join(b);
  if (text !== before) {
    fs.writeFileSync(file, text);
    n++;
  }
}
console.log(`Fixed ${n} atlas-mode-runtime self-imports`);
