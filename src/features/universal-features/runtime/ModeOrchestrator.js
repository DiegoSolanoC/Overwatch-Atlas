/**
 * ModeOrchestrator — runtime owner of the app's mode lifecycle.
 *
 * Holds the loaded-component flag bag and the load/unload pairs for every
 * component, and exposes `runXComponents` / `killXComponents` for each mode
 * (Worldview, Codex/Glossary, Data Archive/Biography) plus `runMenuComponents`
 * / `restoreMainMenu` for the menu shell. The actual mode bodies live in
 * their owning features:
 *
 *   - Worldview run/kill ? `Interactive-Worldview/application/globeModeLifecycle.js`
 *   - Worldview asset load ? `Interactive-Worldview/application/loadGlobeAssets.js`
 *   - Data Archive shell  ? `data-archive/integration/DataArchiveShell.js`
 *   - Linear-mode ceremony ? `runtime/modeLifecycleCeremony.js`
 *   - Universal Features  ? `runtime/universalFeaturesLifecycle.js`
 *
 * This class is a thin coordinator: it owns the shared state and forwards
 * to those modules. Originally lived in `component-loader.js` (now
 * `LoadingOrchestrator.js`, which only does boot wiring) and used to be
 * ~1,600 lines because it held all of those bodies inline. The "Component"
 * name was a hangover from that era; it actually orchestrates *modes*.
 */

import { updateStatus } from './statusFeed.js';
import { setCurrentMode } from '../ComponentSetUp/mode-lifecycle/CurrentModeStatus.js';
import { restoreMainMenu as restoreMainMenuImpl } from '../MainMenu/restoreMainMenu.js';
import { runMenuComponents as runMenuComponentsImpl } from '../MainMenu/runMenuComponents.js';
import {
    createDataArchivePanel,
    openDataArchiveEventsView as openDataArchiveEventsViewImpl,
    exitDataArchive
} from '../../data-archive/integration/DataArchiveShell.js';
import {
    runUniversalFeatures as runUniversalFeaturesImpl,
    killUniversalFeatures as killUniversalFeaturesImpl
} from './universalFeaturesLifecycle.js';
import { enterMode, exitMode } from './modeLifecycleCeremony.js';
import { runGlobeMode, killGlobeMode } from '../../Interactive-Worldview/application/globeModeLifecycle.js';

/**
 * ModeOrchestrator class
 * Orchestrates entry into / exit out of each app mode (Worldview, Codex,
 * Data Archive, Menu) plus the always-on Universal Features chain.
 */
export class ModeOrchestrator {
    constructor(loadedComponents, loaders, unloaders) {
        this.loadedComponents = loadedComponents;
        this.loaders = loaders; // Object with load functions: { palette: loadPalette, music: loadMusic, ... }
        this.unloaders = unloaders; // Object with unload functions: { palette: unloadPalette, music: unloadMusic, ... }
        /**
         * Bound kill functions for `killOtherModes`. Built once so each
         * `runXComponents()` doesn't have to re-bind them on every call. Safe
         * to include all three: `killOtherModes` returns early when the
         * persisted mode already equals the target, so the self-killer is
         * never invoked.
         */
        this._killers = {
            killGlobeComponents: this.killGlobeComponents.bind(this),
            killGlossaryComponents: this.killGlossaryComponents.bind(this),
            killBiographyComponents: this.killBiographyComponents.bind(this)
        };
    }

    /**
     * Open Data Archive on the given source. External callers
     * (`EventManager`, keyboard shortcuts) use this to jump straight into a
     * specific archive without going through the full mode-entry ceremony.
     *
     * @param {'story'|'heroes'|'factions'|'npcs'|'locations'} [archiveSource]
     */
    async openDataArchiveEventsView(archiveSource = 'story') {
        await openDataArchiveEventsViewImpl(archiveSource, {
            onCancel: () => this.killBiographyComponents(true)
        });
    }


    /**
     * Run Menu Components
     * @param {object} [options]
     * @param {boolean} [options.keepOverlay=false] - Forwarded to `runMenuComponentsImpl`
     *   so the boot path can keep the loading overlay up across the
     *   Universal ? Menu ? Event System chain.
     */
    async runMenuComponents(options = {}) {
        await runMenuComponentsImpl({
            loadedComponents: this.loadedComponents,
            loadMenu: this.loaders.menu
        }, options);
    }

    /**
     * Run all Universal Features sequentially.
     * @see runUniversalFeatures in `./universalFeaturesLifecycle.js`
     */
    async runUniversalFeatures(options = {}) {
        await runUniversalFeaturesImpl(this._universalFeaturesContext(), options);
    }

    /**
     * Enter Worldview mode.
     * @see runGlobeMode in `Interactive-Worldview/application/globeModeLifecycle.js`
     */
    async runGlobeComponents(isAutoLoad = false) {
        await runGlobeMode(this._globeModeContext(), isAutoLoad);
    }

    /**
     * Run all Glossary Components sequentially
     * Enters Codex mode (Concept Glossary)
     */
    async runGlossaryComponents(isAutoLoad = false) {
        await enterMode(this._modeContext(), {
            mode: 'glossary',
            runBtnId: 'runGlossaryBtn',
            startMessage: '?? Starting Glossary Components auto-load...',
            successMessage: '? Glossary Components auto-load complete!',
            errorPrefix: 'Error in Glossary Components auto-load',
            isAutoLoad
        }, async () => {
            if (window.CodexModeService && typeof window.CodexModeService.enterCodexMode === 'function') {
                await window.CodexModeService.enterCodexMode();
            } else {
                updateStatus('? CodexModeService not available', 'error');
            }
        });
    }

    /**
     * Enter Data Archive mode. Mounts the category-hub shell via
     * `data-archive/integration/DataArchiveShell` and lets the user pick a
     * category from there. The actual events panel is embedded by the shell
     * once the user selects a tile.
     */
    async runBiographyComponents(isAutoLoad = false) {
        await enterMode(this._modeContext(), {
            mode: 'biography',
            runBtnId: 'runBiographyBtn',
            startMessage: '?? Starting Data Archive...',
            successMessage: '? Data Archive loaded!',
            errorPrefix: 'Error in Data Archive load',
            isAutoLoad
        }, async () => {
            await createDataArchivePanel({
                onCancel: () => this.killBiographyComponents(true)
            });
            // Minimum loading time for visual consistency (800ms).
            await new Promise(r => setTimeout(r, 800));
        });
    }

    /**
     * Build the orchestrator-context object that the linear-mode ceremony
     * helpers (`enterMode` / `exitMode`) need.
     */
    _modeContext() {
        return {
            loadedComponents: this.loadedComponents,
            killers: this._killers,
            restoreMainMenu: () => this.restoreMainMenu()
        };
    }


    /**
     * Kill all Menu Components
     */
    async killMenuComponents() {
        updateStatus('Killing all Menu Components...', 'info');
        
        if (this.loadedComponents.menu) {
            await this.unloaders.menu();
        }
        
        updateStatus('? All Menu Components killed!', 'success');
    }

    /**
     * Tear down all Universal Features.
     * @see killUniversalFeatures in `./universalFeaturesLifecycle.js`
     */
    async killUniversalFeatures() {
        await killUniversalFeaturesImpl(this._universalFeaturesContext());
    }

    /** Build the context object that the Universal Features lifecycle needs. */
    _universalFeaturesContext() {
        return {
            loadedComponents: this.loadedComponents,
            loaders: this.loaders,
            unloaders: this.unloaders
        };
    }

    /**
     * Restore main menu (show test-container, hide globe)
     * Make it globally accessible
     * @param {boolean} preserveNewsTicker - If true, preserve the news ticker instead of clearing it
     */
    async restoreMainMenu(preserveNewsTicker = false) {
        await restoreMainMenuImpl(
            { loadedComponents: this.loadedComponents, loadMenu: this.loaders.menu },
            preserveNewsTicker
        );
    }

    /**
     * Exit Worldview mode.
     * @see killGlobeMode in `Interactive-Worldview/application/globeModeLifecycle.js`
     */
    async killGlobeComponents() {
        await killGlobeMode(this._globeModeContext());
    }

    /** Build the context object that the Globe mode lifecycle needs. */
    _globeModeContext() {
        return {
            loadedComponents: this.loadedComponents,
            loaders: this.loaders,
            unloaders: this.unloaders,
            killers: this._killers,
            restoreMainMenu: (preserveNewsTicker) => this.restoreMainMenu(preserveNewsTicker)
        };
    }

    /**
     * Kill all Glossary Components
     * Exits Codex mode and restores main menu
     */
    async killGlossaryComponents() {
        await exitMode(this._modeContext(), {
            mode: 'glossary',
            startMessage: 'Killing all Glossary Components...',
            successMessage: '? All Glossary Components killed!'
        }, async () => {
            if (window.unloadGlobeBase && typeof window.unloadGlobeBase === 'function') {
                try {
                    await window.unloadGlobeBase({ preserveEventsUi: false });
                } catch (err) {
                    console.warn('Error unloading globe base during glossary kill:', err);
                }
            }
            if (window.CodexModeService && typeof window.CodexModeService.clearCodexShellForGlobeInit === 'function') {
                window.CodexModeService.clearCodexShellForGlobeInit();
            }
        });
    }

    /**
     * Exit Data Archive mode. Tears down the embedded shell via
     * `data-archive/integration/DataArchiveShell` and either restores the
     * main menu or stays where the user is (when switching directly to
     * another mode).
     *
     * @param {boolean} [restoreMenu=true]
     */
    async killBiographyComponents(restoreMenu = true) {
        await exitMode(this._modeContext(), {
            mode: 'biography',
            startMessage: 'Exiting Data Archive...',
            successMessage: '? Data Archive exited!',
            restoreMenu
        }, async () => {
            await exitDataArchive();
        });
    }
}
