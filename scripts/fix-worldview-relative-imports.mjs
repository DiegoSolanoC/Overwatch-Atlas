/**
 * Fix Interactive-Worldview imports after worldview-* folder consolidation.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const wvRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'features',
  'Interactive-Worldview'
);

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (ent.name.endsWith('.js')) files.push(p);
  }
  return files;
}

function depthFromRoot(file) {
  const rel = path.relative(wvRoot, path.dirname(file));
  if (!rel || rel === '.') return 0;
  return rel.split(path.sep).length;
}

function existsImport(fromDir, spec) {
  const base = path.normalize(path.join(fromDir, spec.split('?')[0]));
  return (
    fs.existsSync(base) ||
    fs.existsSync(`${base}.js`) ||
    fs.existsSync(path.join(base, 'index.js'))
  );
}

const REPLACEMENTS = [
  ['from "../../constants/', 'from "../../worldview-shared-assets/constants/'],
  ['from "../../../constants/', 'from "../../../worldview-shared-assets/constants/'],
  ["from '../../constants/", "from '../../worldview-shared-assets/constants/"],
  ["from '../../../constants/", "from '../../../worldview-shared-assets/constants/"],
  ['from "../../debug/', 'from "../../worldview-shared-assets/debug/'],
  ["from '../../debug/", "from '../../worldview-shared-assets/debug/"],
  ["import('../../debug/", "import('../../worldview-shared-assets/debug/"],
];

let n = 0;
for (const file of walk(wvRoot)) {
  const dir = path.dirname(file);
  const rel = path.relative(wvRoot, file).replace(/\\/g, '/');
  let text = fs.readFileSync(file, 'utf8');
  const before = text;

  for (const [a, b] of REPLACEMENTS) {
    text = text.split(a).join(b);
  }

  // worldview-controls-ui/controllers/* — sibling slices need ../../ not ../
  if (rel.startsWith('worldview-controls-ui/controllers/')) {
    text = text
      .replaceAll("from '../worldview-globe-3d/", "from '../../worldview-globe-3d/")
      .replaceAll("from '../worldview-map-2d/", "from '../../worldview-map-2d/")
      .replaceAll("from '../worldview-transport/", "from '../../worldview-transport/");
  }

  // worldview-transport/* — shared-assets is one level up, not two
  if (rel.startsWith('worldview-transport/')) {
    text = text.replaceAll(
      "from '../../worldview-shared-assets/",
      "from '../worldview-shared-assets/"
    );
  }

  // worldview-shared-assets/debug/*
  if (rel.startsWith('worldview-shared-assets/debug/')) {
    text = text.replaceAll(
      "from '../worldview-globe-3d/",
      "from '../../worldview-globe-3d/"
    );
  }

  if (text !== before) {
    fs.writeFileSync(file, text);
    n++;
  }
}

console.log(`Fixed ${n} Interactive-Worldview files`);
