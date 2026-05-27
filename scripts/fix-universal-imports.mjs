import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const uf = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'features', 'universal-features');
const RT = '../atlas-mode-runtime';
const HDR = '../atlas-header';
const ML = '../atlas-mode-runtime/mode-lifecycle';

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (ent.name.endsWith('.js')) files.push(p);
  }
  return files;
}

const pairs = [
  ["from './header/", `from '${HDR}/`],
  ["from '../header/", `from '${HDR}/`],
  ["from './mode-lifecycle/", `from '${ML}/`],
  ["from '../mode-lifecycle/", `from '${ML}/`],
  ["from './loadingOverlayState.js'", `from '${RT}/loadingOverlayState.js'`],
  ["from '../loadingOverlayState.js'", `from '${RT}/loadingOverlayState.js'`],
  ["from './statusFeed.js'", `from '${RT}/statusFeed.js'`],
  ["from '../statusFeed.js'", `from '${RT}/statusFeed.js'`],
  ["from \"./loadingOverlayState.js\"", `from \"${RT}/loadingOverlayState.js\"`],
  ["from \"../loadingOverlayState.js\"", `from \"${RT}/loadingOverlayState.js\"`],
  ["from \"./statusFeed.js\"", `from \"${RT}/statusFeed.js\"`],
  ["from \"../statusFeed.js\"", `from \"${RT}/statusFeed.js\"`],
  ["from './mode-lifecycle/", `from '${ML}/`],
  ["from \"./mode-lifecycle/", `from \"${ML}/`],
  ['worldview-controls-ui/runtime/MusicStateService', 'services/MusicStateService'],
  ['worldview-controls-ui/runtime/MusicShuffleService', 'services/MusicShuffleService'],
  ['worldview-controls-ui/runtime/MusicVolumeService', 'services/MusicVolumeService'],
  ['worldview-controls-ui/runtime/MusicProgressService', 'services/MusicProgressService'],
  ['worldview-controls-ui/runtime/MusicPlaybackService', 'services/MusicPlaybackService'],
  ['worldview-controls-ui/runtime/MusicFileService', 'services/MusicFileService'],
  ['worldview-controls-ui/runtime/MusicIconService', 'services/MusicIconService'],
  ['worldview-controls-ui/runtime/MusicControlService', 'services/MusicControlService'],
  ['atlas-shared-ui/ExitButton.js', 'atlas-shared-ui/AtlasExitButton.js'],
];

let n = 0;
for (const file of walk(uf)) {
  const rel = path.relative(uf, file).replace(/\\/g, '/');
  let text = fs.readFileSync(file, 'utf8');
  const before = text;

  for (const [a, b] of pairs) {
    text = text.split(a).join(b);
  }

  // atlas-shared-ui/* and atlas-main-menu/* need ../../atlas-mode-runtime when they had ../statusFeed
  if (rel.startsWith('atlas-shared-ui/') || rel.startsWith('atlas-main-menu/')) {
    text = text.replaceAll(`from '${RT}/statusFeed.js'`, "from '../../atlas-mode-runtime/statusFeed.js'");
    text = text.replaceAll(`from '${RT}/loadingOverlayState.js'`, "from '../../atlas-mode-runtime/loadingOverlayState.js'");
    text = text.replaceAll(`from "${RT}/loadingOverlayState.js"`, 'from "../../atlas-mode-runtime/loadingOverlayState.js"');
    text = text.replaceAll(`from "${RT}/statusFeed.js"`, 'from "../../atlas-mode-runtime/statusFeed.js"');
    text = text.replaceAll(`from '${ML}/`, "from '../../atlas-mode-runtime/mode-lifecycle/");
    text = text.replaceAll(`from "${ML}/`, 'from "../../atlas-mode-runtime/mode-lifecycle/');
  }

  // atlas-boot and loaders: ../atlas-mode-runtime is correct for statusFeed
  if (rel.startsWith('atlas-boot/')) {
    // already ../atlas-mode-runtime from ../statusFeed replacement
  }

  // atlas-header: single level up to universal-features
  if (rel.startsWith('atlas-header/')) {
    text = text.replaceAll(`from '${RT}/`, "from '../atlas-mode-runtime/");
    text = text.replaceAll(`from "${RT}/`, 'from "../atlas-mode-runtime/');
  }

  // atlas-sound-effects, atlas-music one level
  if (rel.startsWith('atlas-sound-effects/') || rel.startsWith('atlas-music/')) {
    text = text.replaceAll(`from '${RT}/`, "from '../atlas-mode-runtime/");
  }

  if (text !== before) {
    fs.writeFileSync(file, text);
    n++;
  }
}
console.log(`Fixed ${n} universal-features files`);
