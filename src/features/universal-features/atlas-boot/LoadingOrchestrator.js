/**
 * LoadingOrchestrator - the app's central boot-time wiring file.
 *
 * It does four things in order:
 *   1. Imports every load/unload pair from its sibling `*Loaders.js` file.
 *   2. Constructs the `ModeOrchestrator` with those pairs.
 *   3. Builds bound run/kill/restore delegation handles (arrow wrappers
 *      preserve `this` when these are passed as callbacks).
 *   4. Publishes the public API on `window` so non-module scripts and
 *      cross-feature code can trigger mode lifecycle.
 *
 * No actual loading logic lives here - see the sibling `*Loaders.js` files
 * for that. This file is the *registry* that binds them to the runtime,
 * which is why it pairs with (but is distinct from) `ModeOrchestrator`:
 *   - `LoadingOrchestrator` (this file) - boot-time wiring + window globals
 *   - `ModeOrchestrator` (a class)      - the runtime that owns lifecycle
 *
 * Renamed from `component-loader.js`, which was a holdover from when this
 * file was the monolithic loader; today it does not load anything itself.
 */

import { ModeOrchestrator } from '../atlas-mode-runtime/ModeOrchestrator.js?v=100';

// Side-effect imports: each module attaches handlers / globals on import.
import '../../system-interface/interface-platform-input/installPlatformGlobals.js'; // populate window.Navigation*Helpers aliases
import '../../world/worldview-controls-ui/runtime/WorldviewInlineLoad.js';                       // inline globe-container loader API
import '../../world/worldview-mode-entry/entry/WorldviewMapLaunchChoice.js';                            // 3D globe / 2D map chooser hub

import { loadPalette, unloadPalette } from './loaders/PaletteLoaders.js';
import { loadMusic, unloadMusic } from './loaders/MusicLoaders.js';
import { loadMenu, unloadMenu } from './loaders/MenuLoaders.js';
import { loadGlobeBase, unloadGlobeBase } from './loaders/GlobeBaseLoaders.js';
import { loadToggles, unloadToggles } from './loaders/TogglesLoaders.js';
import { loadControls, unloadControls } from './loaders/ControlsLoaders.js';
import { loadEvents, unloadEvents } from './loaders/EventsLoaders.js?v=100';
import { loadHeaderModeButtons } from '../atlas-header/HeaderModeButtons.js';
import { appModeSwitch } from '../atlas-mode-runtime/mode-lifecycle/ModeSwitcher.js';

// === Shared component state ============================================

const loadedComponents = {
    palette: false,
    music: false,
    menu: false,
    globeBase: false,
    transport: false,
    controls: false,
    events: false,
    codex: false,
    dataWorkshop: false,
    gallery: false,
    story: false,
    dialogueTheater: false,
    officialArchive: false,
};

if (typeof window !== 'undefined') {
    window.loadedComponents = loadedComponents;
}

// === Loader/unloader bindings ==========================================
// Each loader takes `loadedComponents` as a parameter; we partial-apply
// here so the orchestrator gets a clean no-arg call signature. GlobeBase
// also receives sibling unloaders so it can cascade-unload dependents
// (transport toggles, controls, and events) when the user exits Worldview.

const globeBaseUnloaders = { unloadToggles, unloadControls, unloadEvents };

const unloaders = {
    palette: () => unloadPalette(loadedComponents),
    music: () => unloadMusic(loadedComponents),
    menu: () => unloadMenu(loadedComponents),
    globeBase: (options) => unloadGlobeBase(loadedComponents, globeBaseUnloaders, options),
    transport: () => unloadToggles(loadedComponents),
    controls: () => unloadControls(loadedComponents),
    events: () => unloadEvents(loadedComponents)
};

// `headerNav` has no matching unloader by design: the universal header
// chrome (Worldview / Codex / Data Archive / Home buttons) is mounted
// once at boot and persists across mode switches. Removing and re-mounting
// on every transition would add complexity for zero UX benefit.
const loaders = {
    palette: () => loadPalette(loadedComponents),
    music: () => loadMusic(loadedComponents),
    headerNav: loadHeaderModeButtons,
    menu: () => loadMenu(loadedComponents),
    globeBase: () => loadGlobeBase(loadedComponents, globeBaseUnloaders),
    transport: () => loadToggles(loadedComponents),
    controls: () => loadControls(loadedComponents),
    events: () => loadEvents(loadedComponents)
};

// === Orchestrator + delegations =========================================
// The arrow wrappers below preserve `this` when these handles are passed as
// callbacks via `window`.

const modeOrchestrator = new ModeOrchestrator(loadedComponents, loaders, unloaders);

const runMenuComponents = (options = {}) => modeOrchestrator.runMenuComponents(options);
const runUniversalFeatures = (options = {}) => modeOrchestrator.runUniversalFeatures(options);
const runWorldComponents = (isAutoLoad = false) => modeOrchestrator.runWorldComponents(isAutoLoad);
const killMenuComponents = () => modeOrchestrator.killMenuComponents();
const killUniversalFeatures = () => modeOrchestrator.killUniversalFeatures();
const restoreMainMenu = () => modeOrchestrator.restoreMainMenu();
const killWorldComponents = () => modeOrchestrator.killWorldComponents();
const runCodexComponents = (isAutoLoad = false) => modeOrchestrator.runCodexComponents(isAutoLoad);
const killCodexComponents = () => modeOrchestrator.killCodexComponents();
const runDataWorkshopComponents = (isAutoLoad = false) => modeOrchestrator.runDataWorkshopComponents(isAutoLoad);
const killDataWorkshopComponents = () => modeOrchestrator.killDataWorkshopComponents();
const runGalleryComponents = (isAutoLoad = false) => modeOrchestrator.runGalleryComponents(isAutoLoad);
const killGalleryComponents = () => modeOrchestrator.killGalleryComponents();
const runStoryComponents = (isAutoLoad = false) => modeOrchestrator.runStoryComponents(isAutoLoad);
const killStoryComponents = () => modeOrchestrator.killStoryComponents();
const runDialogueTheaterComponents = (isAutoLoad = false) => modeOrchestrator.runDialogueTheaterComponents(isAutoLoad);
const killDialogueTheaterComponents = () => modeOrchestrator.killDialogueTheaterComponents();
const runOfficialArchiveComponents = (isAutoLoad = false) =>
    modeOrchestrator.runOfficialArchiveComponents(isAutoLoad);
const killOfficialArchiveComponents = () => modeOrchestrator.killOfficialArchiveComponents();

/** @deprecated Legacy window aliases — prefer canonical names above. */
const runGlobeComponents = runWorldComponents;
const killGlobeComponents = killWorldComponents;
const runGlossaryComponents = runCodexComponents;
const killGlossaryComponents = killCodexComponents;
const runBiographyComponents = runDataWorkshopComponents;
const killBiographyComponents = killDataWorkshopComponents;
const runHeroBiographyComponents = runGalleryComponents;
const killHeroBiographyComponents = killGalleryComponents;
const runStoryTimelineComponents = runStoryComponents;
const killStoryTimelineComponents = killStoryComponents;
const runOfficialResourcesComponents = runOfficialArchiveComponents;
const killOfficialResourcesComponents = killOfficialArchiveComponents;

// === Public API on window ==============================================

window.modeOrchestrator = modeOrchestrator;
window.restoreMainMenu = restoreMainMenu;
window.runUniversalFeatures = runUniversalFeatures;
window.runMenuComponents = runMenuComponents;
window.runWorldComponents = runWorldComponents;
window.killWorldComponents = killWorldComponents;
window.runCodexComponents = runCodexComponents;
window.killCodexComponents = killCodexComponents;
window.runDataWorkshopComponents = runDataWorkshopComponents;
window.killDataWorkshopComponents = killDataWorkshopComponents;
window.runGalleryComponents = runGalleryComponents;
window.killGalleryComponents = killGalleryComponents;
window.runStoryComponents = runStoryComponents;
window.killStoryComponents = killStoryComponents;
window.runDialogueTheaterComponents = runDialogueTheaterComponents;
window.killDialogueTheaterComponents = killDialogueTheaterComponents;
window.runOfficialArchiveComponents = runOfficialArchiveComponents;
window.killOfficialArchiveComponents = killOfficialArchiveComponents;
window.runGlobeComponents = runGlobeComponents;
window.killGlobeComponents = killGlobeComponents;
window.killMenuComponents = killMenuComponents;
window.runGlossaryComponents = runGlossaryComponents;
window.killGlossaryComponents = killGlossaryComponents;
window.runBiographyComponents = runBiographyComponents;
window.killBiographyComponents = killBiographyComponents;
window.runHeroBiographyComponents = runHeroBiographyComponents;
window.killHeroBiographyComponents = killHeroBiographyComponents;
window.runStoryTimelineComponents = runStoryTimelineComponents;
window.killStoryTimelineComponents = killStoryTimelineComponents;
window.runOfficialResourcesComponents = runOfficialResourcesComponents;
window.killOfficialResourcesComponents = killOfficialResourcesComponents;
window.unloadGlobeBase = unloaders.globeBase;
window.appModeSwitch = appModeSwitch;

