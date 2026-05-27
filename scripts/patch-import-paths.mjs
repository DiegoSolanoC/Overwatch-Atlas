/**
 * One-off import path patches after feature-folder standardization.
 * Run: node scripts/patch-import-paths.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(root, 'src');

/** @type {[string, string][]} longest-first recommended */
const REPLACEMENTS = [
  // connection-codex
  ['connection-codex/codex-integration/bridge/', 'connection-codex/codex-canvas/bridge/'],
  ['connection-codex/services/CodexCanvasService.js', 'connection-codex/codex-canvas/CodexCanvasEntry.js'],
  ['connection-codex/services/CodexCanvasService', 'connection-codex/codex-canvas/CodexCanvasEntry'],
  ['../codex-integration/bridge/', '../codex-canvas/bridge/'],
  ['../../codex-integration/bridge/', '../../codex-canvas/bridge/'],
  ['../../../codex-integration/bridge/', '../../../codex-canvas/bridge/'],
  ['../services/CodexCanvasService.js', '../CodexCanvasEntry.js'],
  ['../../services/CodexCanvasService.js', '../../codex-canvas/CodexCanvasEntry.js'],
  ['../../../services/CodexCanvasService.js', '../../../codex-canvas/CodexCanvasEntry.js'],
  ['connection-codex/codex-bio-sync/', 'connection-codex/codex-bio-archive-sync/'],
  ['../codex-bio-sync/', '../codex-bio-archive-sync/'],
  ['../../codex-bio-sync/', '../../codex-bio-archive-sync/'],
  ['../../../codex-bio-sync/', '../../../codex-bio-archive-sync/'],
  ['connection-codex/codex-core/', 'connection-codex/codex-canvas/core/'],
  ['connection-codex/codex-mode/', 'connection-codex/codex-canvas/mode/'],
  ['connection-codex/codex-render/', 'connection-codex/codex-node-drawing/'],
  ['connection-codex/codex-edges/', 'connection-codex/codex-edge-cords/'],
  ['connection-codex/codex-toolbar/', 'connection-codex/codex-controls-ui/toolbar/'],
  ['connection-codex/codex-camera/', 'connection-codex/codex-controls-ui/camera/'],
  ['connection-codex/codex-input/', 'connection-codex/codex-controls-ui/input/'],
  ['../codex-core/', '../codex-canvas/core/'],
  ['../../codex-core/', '../../codex-canvas/core/'],
  ['../../../codex-core/', '../../../codex-canvas/core/'],
  ['../../../../codex-core/', '../../../../codex-canvas/core/'],
  ['../codex-mode/', '../codex-canvas/mode/'],
  ['../../codex-mode/', '../../codex-canvas/mode/'],
  ['../../../codex-mode/', '../../../codex-canvas/mode/'],
  ['../codex-render/', '../codex-node-drawing/'],
  ['../../codex-render/', '../../codex-node-drawing/'],
  ['../../../codex-render/', '../../../codex-node-drawing/'],
  ['../../../../codex-render/', '../../../../codex-node-drawing/'],
  ['../codex-edges/', '../codex-edge-cords/'],
  ['../../codex-edges/', '../../codex-edge-cords/'],
  ['../../../codex-edges/', '../../../codex-edge-cords/'],
  ['../../../../codex-edges/', '../../../../codex-edge-cords/'],
  ['../codex-toolbar/', '../codex-controls-ui/toolbar/'],
  ['../../codex-toolbar/', '../../codex-controls-ui/toolbar/'],
  ['../../../codex-toolbar/', '../../../codex-controls-ui/toolbar/'],
  ['../codex-camera/', '../codex-controls-ui/camera/'],
  ['../../codex-camera/', '../../codex-controls-ui/camera/'],
  ['../../../codex-camera/', '../../../codex-controls-ui/camera/'],
  ['../../../../codex-camera/', '../../../../codex-controls-ui/camera/'],
  ['../codex-input/', '../codex-controls-ui/input/'],
  ['../../codex-input/', '../../codex-controls-ui/input/'],
  ['../../../codex-input/', '../../../codex-controls-ui/input/'],
  // universal-features
  ['universal-features/Audio/Music/', 'universal-features/atlas-music/'],
  ['universal-features/Audio/SoundEffects/', 'universal-features/atlas-sound-effects/'],
  ['universal-features/MainMenu/', 'universal-features/atlas-main-menu/'],
  ['universal-features/Palette/', 'universal-features/atlas-palette/'],
  ['universal-features/BootUp/header/', 'universal-features/atlas-header/'],
  ['universal-features/BootUp/', 'universal-features/atlas-boot/'],
  ['universal-features/runtime/', 'universal-features/atlas-mode-runtime/'],
  ['universal-features/ComponentSetUp/mode-lifecycle/', 'universal-features/atlas-mode-runtime/mode-lifecycle/'],
  ['universal-features/ComponentSetUp/', 'universal-features/atlas-shared-ui/'],
  ['universal-features/atlas-header/header/', 'universal-features/atlas-header/'],
  ['../atlas-header/header/', '../atlas-header/'],
  ['../../atlas-header/header/', '../../atlas-header/'],
  ['../Audio/Music/', '../atlas-music/'],
  ['../../Audio/Music/', '../../atlas-music/'],
  ['../../../Audio/Music/', '../../../atlas-music/'],
  ['../Audio/SoundEffects/', '../atlas-sound-effects/'],
  ['../../Audio/SoundEffects/', '../../atlas-sound-effects/'],
  ['../MainMenu/', '../atlas-main-menu/'],
  ['../../MainMenu/', '../../atlas-main-menu/'],
  ['../Palette/', '../atlas-palette/'],
  ['../../Palette/', '../../atlas-palette/'],
  ['../BootUp/header/', '../atlas-header/'],
  ['../../BootUp/header/', '../../atlas-header/'],
  ['../BootUp/', '../atlas-boot/'],
  ['../../BootUp/', '../../atlas-boot/'],
  ['../../../BootUp/', '../../../atlas-boot/'],
  ['../runtime/', '../atlas-mode-runtime/'],
  ['../../runtime/', '../../atlas-mode-runtime/'],
  ['../../../runtime/', '../../../atlas-mode-runtime/'],
  ['../ComponentSetUp/mode-lifecycle/', '../atlas-mode-runtime/mode-lifecycle/'],
  ['../../ComponentSetUp/mode-lifecycle/', '../../atlas-mode-runtime/mode-lifecycle/'],
  ['../ComponentSetUp/', '../atlas-shared-ui/'],
  ['../../ComponentSetUp/', '../../atlas-shared-ui/'],
  // system-interface → interface-*
  ['system-interface/filters/', 'system-interface/interface-filter-menu/'],
  ['system-interface/markers/', 'system-interface/interface-globe-markers/'],
  ['system-interface/dock/', 'system-interface/interface-bottom-dock/'],
  ['system-interface/info-panel/', 'system-interface/interface-info-display/'],
  ['system-interface/platform/', 'system-interface/interface-platform-input/'],
  ['system-interface/utils/', 'system-interface/interface-shared/'],
  ['system-interface/coordinator/', 'system-interface/interface-left-panel/coordinator/'],
  ['system-interface/integration/', 'system-interface/interface-load-unload/integration/'],
  ['system-interface/event-system/', 'system-interface/interface-left-panel/event-system/'],
  ['system-interface/load-out/standalone-slide/', 'system-interface/interface-event-slide/standalone-slide/'],
  ['system-interface/load-out/', 'system-interface/interface-load-unload/'],
  ['../filters/', '../interface-filter-menu/'],
  ['../../filters/', '../../interface-filter-menu/'],
  ['../../../filters/', '../../../interface-filter-menu/'],
  ['../markers/', '../interface-globe-markers/'],
  ['../../markers/', '../../interface-globe-markers/'],
  ['../dock/', '../interface-bottom-dock/'],
  ['../../dock/', '../../interface-bottom-dock/'],
  ['../info-panel/', '../interface-info-display/'],
  ['../platform/', '../interface-platform-input/'],
  ['../../platform/', '../../interface-platform-input/'],
  ['../utils/', '../interface-shared/'],
  ['../../utils/', '../../interface-shared/'],
  ['../../../utils/', '../../../interface-shared/'],
  ['../coordinator/', '../interface-left-panel/coordinator/'],
  ['../../coordinator/', '../../interface-left-panel/coordinator/'],
  ['../integration/', '../interface-load-unload/integration/'],
  ['../event-system/', '../interface-left-panel/event-system/'],
  ['../../event-system/', '../../interface-left-panel/event-system/'],
  ['../../../event-system/', '../../../interface-left-panel/event-system/'],
  ['../load-out/standalone-slide/', '../interface-event-slide/standalone-slide/'],
  ['../../load-out/standalone-slide/', '../../interface-event-slide/standalone-slide/'],
  ['../load-out/', '../interface-load-unload/'],
  ['../../load-out/', '../../interface-load-unload/'],
  // Move dock pagination to interface-pagination
  ['interface-bottom-dock/pagination/', 'interface-pagination/dock/'],
  // Interactive-Worldview
  ['Interactive-Worldview/application/', 'Interactive-Worldview/worldview-mode-entry/'],
  ['Interactive-Worldview/entry/', 'Interactive-Worldview/worldview-mode-entry/entry/'],
  ['Interactive-Worldview/presentation/map/', 'Interactive-Worldview/worldview-map-2d/'],
  ['Interactive-Worldview/presentation/transport/', 'Interactive-Worldview/worldview-transport/'],
  ['Interactive-Worldview/presentation/controllers/', 'Interactive-Worldview/worldview-controls-ui/controllers/'],
  ['Interactive-Worldview/presentation/views/', 'Interactive-Worldview/worldview-globe-3d/views/'],
  ['Interactive-Worldview/services/GlobeSyncService.js', 'Interactive-Worldview/worldview-event-sync/WorldviewGlobeSync.js'],
  ['Interactive-Worldview/services/GlobeSyncService', 'Interactive-Worldview/worldview-event-sync/GlobeSyncService'],
  ['Interactive-Worldview/services/', 'Interactive-Worldview/worldview-controls-ui/runtime/'],
  ['Interactive-Worldview/presentation/', 'Interactive-Worldview/worldview-globe-3d/'],
  ['Interactive-Worldview/domain/', 'Interactive-Worldview/worldview-domain-state/'],
  ['Interactive-Worldview/constants/', 'Interactive-Worldview/worldview-shared-assets/constants/'],
  ['Interactive-Worldview/data/', 'Interactive-Worldview/worldview-shared-assets/data/'],
  ['Interactive-Worldview/utils/', 'Interactive-Worldview/worldview-shared-assets/utils/'],
  ['Interactive-Worldview/debug/', 'Interactive-Worldview/worldview-shared-assets/debug/'],
  ['../application/', '../worldview-mode-entry/'],
  ['../../application/', '../../worldview-mode-entry/'],
  ['../entry/', '../worldview-mode-entry/entry/'],
  ['../presentation/map/', '../worldview-map-2d/'],
  ['../presentation/transport/', '../worldview-transport/'],
  ['../presentation/controllers/', '../worldview-controls-ui/controllers/'],
  ['../presentation/views/', '../worldview-globe-3d/views/'],
  ['../services/GlobeSyncService', '../worldview-event-sync/GlobeSyncService'],
  ['../services/', '../worldview-controls-ui/runtime/'],
  ['../domain/', '../worldview-domain-state/'],
  // Data-Archive (for any stragglers outside feature)
  ['Data-Archive/archive-mode/dataArchiveMode', 'Data-Archive/archive-mode/ArchiveModeMount'],
  ['Data-Archive/archive-ordering/', 'Data-Archive/archive-category-shared/'],
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules') continue;
      walk(p, files);
    } else if (/\.(js|mjs|html|css)$/.test(ent.name)) {
      files.push(p);
    }
  }
  return files;
}

let changed = 0;
for (const file of walk(srcRoot).concat(path.join(root, 'index.html'))) {
  if (!fs.existsSync(file)) continue;
  let text = fs.readFileSync(file, 'utf8');
  const before = text;
  for (const [from, to] of REPLACEMENTS) {
    text = text.split(from).join(to);
  }
  if (text !== before) {
    fs.writeFileSync(file, text);
    changed += 1;
  }
}
console.log(`Patched ${changed} files`);
