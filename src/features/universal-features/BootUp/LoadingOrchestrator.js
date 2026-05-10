/**
 * LoadingOrchestrator  the app's central boot-time wiring file.
 *
 * It does four things in order:
 *   1. Imports every load/unload pair from its sibling `*Loaders.js` file.
 *   2. Constructs the `ModeOrchestrator` with those pairs.
 *   3. Builds bound run/kill/restore delegation handles (arrow wrappers
 *      preserve `this` when these are passed as callbacks).
 *   4. Publishes the public API on `window` so non-module scripts and
 *      cross-feature code can trigger mode lifecycle.
 *
 * No actual loading logic lives here  see the sibling `*Loaders.js` files
 * for that. This file is the *registry* that binds them to the runtime,
 * which is why it pairs with (but is distinct from) `ModeOrchestrator`:
 *   - `LoadingOrchestrator` (this file)  boot-time wiring + window globals
 *   - `ModeOrchestrator` (a class)       the runtime that owns lifecycle
 *
 * Renamed from `component-loader.js`, which was a holdover from when this
 * file was the monolithic loader; today it does not load anything itself.
 */

import { ModeOrchestrator } from '../runtime/ModeOrchestrator.js';

// Side-effect imports: each module attaches handlers / globals on import.
import '../../system-interface/managers/helpers/loadBrowserNavigationHelpers.js'; // browser back/forward integration
import '../../Interactive-Worldview/services/GlobeInlineLoadHelpers.js';                       // inline globe-container loader API
import '../../Interactive-Worldview/entry/GlobeMapLaunchChoice.js';                            // 3D globe / 2D map chooser hub

import { loadPalette, unloadPalette } from './loaders/PaletteLoaders.js';
import { loadMusic, unloadMusic } from './loaders/MusicLoaders.js';
import { loadMenu, unloadMenu } from './loaders/MenuLoaders.js';
import { loadGlobeBase, unloadGlobeBase } from './loaders/GlobeBaseLoaders.js';
import { loadToggles, unloadToggles } from './loaders/TogglesLoaders.js';
import { loadControls, unloadControls } from './loaders/ControlsLoaders.js';
import { loadEvents, unloadEvents } from './loaders/EventsLoaders.js';
import { loadHeaderModeButtons } from './header/HeaderModeButtons.js';
import { appModeSwitch } from '../ComponentSetUp/ModeSwitcher.js';

// === Shared component state ============================================

const loadedComponents = {
    palette: false,
    music: false,
    menu: false,
    globeBase: false,
    transport: false,
    controls: false,
    events: false,
    glossary: false,
    biography: false
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

const runMenuComponents = () => modeOrchestrator.runMenuComponents();
const runUniversalFeatures = (options = {}) => modeOrchestrator.runUniversalFeatures(options);
const runGlobeComponents = (isAutoLoad = false) => modeOrchestrator.runGlobeComponents(isAutoLoad);
const killMenuComponents = () => modeOrchestrator.killMenuComponents();
const killUniversalFeatures = () => modeOrchestrator.killUniversalFeatures();
const restoreMainMenu = () => modeOrchestrator.restoreMainMenu();
const killGlobeComponents = () => modeOrchestrator.killGlobeComponents();
const runGlossaryComponents = (isAutoLoad = false) => modeOrchestrator.runGlossaryComponents(isAutoLoad);
const killGlossaryComponents = () => modeOrchestrator.killGlossaryComponents();
const runBiographyComponents = (isAutoLoad = false) => modeOrchestrator.runBiographyComponents(isAutoLoad);
const killBiographyComponents = () => modeOrchestrator.killBiographyComponents();

// === Public API on window ==============================================

window.modeOrchestrator = modeOrchestrator;
window.restoreMainMenu = restoreMainMenu;
window.runUniversalFeatures = runUniversalFeatures;
window.runMenuComponents = runMenuComponents;
window.runGlobeComponents = runGlobeComponents;
window.killGlobeComponents = killGlobeComponents;
window.killMenuComponents = killMenuComponents;
window.runGlossaryComponents = runGlossaryComponents;
window.killGlossaryComponents = killGlossaryComponents;
window.runBiographyComponents = runBiographyComponents;
window.killBiographyComponents = killBiographyComponents;
window.unloadGlobeBase = unloaders.globeBase;
window.appModeSwitch = appModeSwitch;

