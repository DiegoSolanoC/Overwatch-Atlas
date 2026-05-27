import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const wv = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'features', 'Interactive-Worldview');

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (ent.name.endsWith('.js')) files.push(p);
  }
  return files;
}

const REPLACEMENTS = [
  ['interface-shared/GeometryUtils', 'worldview-shared-assets/utils/GeometryUtils'],
  ['interface-shared/TransportPaletteColors', 'worldview-shared-assets/utils/TransportPaletteColors'],
  ['interface-shared/Constants', 'worldview-shared-assets/utils/Constants'],
  ['interface-shared/EarthLightsData', 'worldview-shared-assets/utils/EarthLightsData'],
  ['interface-shared/EarthLandMask', 'worldview-shared-assets/utils/EarthLandMask'],
  ['from "../views/', 'from "../worldview-globe-3d/views/'],
  ["from '../views/", "from '../worldview-globe-3d/views/"],
  ['from "../map/', 'from "../worldview-map-2d/'],
  ["from '../map/", "from '../worldview-map-2d/"],
  ['from "../transport/', 'from "../worldview-transport/'],
  ["from '../transport/", "from '../worldview-transport/"],
  ['from "../worldview-mode-entry/entry/', 'from "./entry/'],
  ["from '../worldview-mode-entry/entry/", "from './entry/"],
  ['from "../../debug/', 'from "../../worldview-shared-assets/debug/'],
  ['from "../../../constants/', 'from "../../../worldview-shared-assets/constants/'],
  ['from "../../constants/', 'from "../../worldview-shared-assets/constants/'],
  ['from "../constants/', 'from "../worldview-shared-assets/constants/'],
];

let n = 0;
for (const file of walk(wv)) {
  let text = fs.readFileSync(file, 'utf8');
  const before = text;
  for (const [a, b] of REPLACEMENTS) text = text.split(a).join(b);
  if (text !== before) {
    fs.writeFileSync(file, text);
    n++;
  }
}
console.log(`Fixed ${n} worldview files`);
