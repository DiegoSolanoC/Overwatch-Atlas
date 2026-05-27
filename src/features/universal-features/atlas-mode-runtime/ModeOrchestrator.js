/**
 * ModeOrchestrator ¥ runtime owner of the app's mode lifecycle.
 *
 * Holds the loaded-component flag bag and the load/unload pairs for every
 * component, and exposes `runXComponents` / `killXComponents` for each mode
 * (Worldview, Codex/Glossary, Data Archive/Biography) plus `runMenuComponents`
 * / `restoreMainMenu` for the menu shell. The actual mode bodies live in
 * their owning features:
 *
 *   - Worldview run/kill ? `Interactive-Worldview/worldview-mode-entry/WorldviewModeLifecycle.js`
 *   - Worldview asset load ? `Interactive-Worldview/worldview-mode-entry/WorldviewAssetLoader.js`
 *   - Data Archive mode entry: `Data-Archive/archive-mode/ArchiveModeMount.js`
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
import { createLoadProgressTracker } from './loadProgressTracker.js';
import { setCurrentMode } from './mode-lifecycle/CurrentModeStatus.js';
import { restoreMainMenu as restoreMainMenuImpl } from '../atlas-main-menu/restoreMainMenu.js';
import { runMenuComponents as runMenuComponentsImpl } from '../atlas-main-menu/runMenuComponents.js';
import {
    createDataArchivePanel,
    openDataArchiveEventsView as openDataArchiveEventsViewImpl,
    exitDataArchive
} from '../../Data-Archive/archive-mode/ArchiveModeMount.js';
import {
    runUniversalFeatures as runUniversalFeaturesImpl,
    killUniversalFeatures as killUniversalFeaturesImpl
} from './universalFeaturesLifecycle.js';
import { enterMode, exitMode } from './modeLifecycleCeremony.js';
import { runGlobeMode, killGlobeMode } from '../../Interactive-Worldview/worldview-mode-entry/WorldviewModeLifecycle.js';
import {
    mountHeroBiographyMode,
    unmountHeroBiographyMode,
} from '../../hero-biography/hero-biography-mode/HeroBiographyModeMount.js';
import {
    mountStoryTimelineMode,
    unmountStoryTimelineMode,
} from '../../story-timeline/story-timeline-mode/StoryTimelineModeMount.js';
import {
    mountDialogueTheaterMode,
    unmountDialogueTheaterMode,
} from '../../dialogue-theater/dialogue-theater-mode/DialogueTheaterModeMount.js';
import {
    mountOfficialResourcesMode,
    unmountOfficialResourcesMode,
} from '../../official-resources/official-resources-mode/OfficialResourcesModeMount.js';

/**
 * Stages for the Data Archive entry. Declared up-front so the bar can
 * fill from 0 ? 100% by stage label, the same as Worldview and Codex.
 */
const DATA_ARCHIVE_STAGES = Object.freeze([
    { id: 'shellPrep', label: 'Preparing Data Archive shell' },
    { id: 'categoryHub', label: 'Building category hub' },
    { id: 'settle', label: 'Finalizing layout' }
]);

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
            killBiographyComponents: this.killBiographyComponents.bind(this),
            killHeroBiographyComponents: this.killHeroBiographyComponents.bind(this),
            killStoryTimelineComponents: this.killStoryTimelineComponents.bind(this),
            killDialogueTheaterComponents: this.killDialogueTheaterComponents.bind(this),
            killOfficialResourcesComponents: this.killOfficialResourcesComponents.bind(this),
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
     * @see runGlobeMode in `Interactive-Worldview/worldview-mode-entry/WorldviewModeLifecycle.js`
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
            // Status glyphs are kept ASCII here because this file's encoding strips emojis on save.
            startMessage: '>> Starting Codex...',
            successMessage: 'OK - Codex ready',
            errorPrefix: 'Error in Codex auto-load',
            isAutoLoad
        }, async () => {
            if (window.CodexModeService && typeof window.CodexModeService.enterCodexMode === 'function') {
                await window.CodexModeService.enterCodexMode();
            } else {
                updateStatus('ERR - CodexModeService not available', 'error');
            }
        });
    }

    /**
     * Enter Data Archive mode. Mounts the category-hub shell via
     * `Data-Archive/archive-mode/ArchiveModeMount.js` and lets the user pick a
     * category from there. The actual events panel is embedded by the shell
     * once the user selects a tile.
     */
    async runBiographyComponents(isAutoLoad = false) {
        await enterMode(this._modeContext(), {
            mode: 'biography',
            runBtnId: 'runBiographyBtn',
            startMessage: '>> Starting Data Archive...',
            successMessage: 'OK - Data Archive loaded!',
            errorPrefix: 'Error in Data Archive load',
            isAutoLoad
        }, async () => {
            const progress = createLoadProgressTracker({
                modeLabel: 'Data Archive',
                stages: DATA_ARCHIVE_STAGES
            });
            progress.start('>> Starting Data Archive...');

            progress.skipStage('shellPrep', '-> Data Archive: preparing shell...');

            await progress.runStage(
                'categoryHub',
                async () => {
                    await createDataArchivePanel({
                        onCancel: () => this.killBiographyComponents(true)
                    });
                },
                { beginMessage: '-> Data Archive: building category hub...' }
            );

            await progress.runStage(
                'settle',
                async ({ setProgress }) => {
                    /* Minimum 800ms settle gives the category hub a frame to
                     * paint before the overlay drops; stream sub-progress so
                     * the bar moves smoothly across the wait. */
                    const totalMs = 800;
                    const stepMs = 80;
                    const steps = Math.max(1, Math.round(totalMs / stepMs));
                    for (let i = 1; i <= steps; i += 1) {
                        await new Promise((r) => setTimeout(r, stepMs));
                        setProgress(i / steps);
                    }
                },
                { beginMessage: '-> Data Archive: finalizing layout...' }
            );

            progress.finish('OK - Data Archive ready');
        });
    }

    /** Placeholder mode — empty main space until Hero Biography is built out. */
    async runHeroBiographyComponents(isAutoLoad = false) {
        await enterMode(this._modeContext(), {
            mode: 'heroBiography',
            runBtnId: 'runHeroBiographyBtn',
            startMessage: '>> Starting Hero Biography...',
            successMessage: 'OK - Hero Biography ready',
            errorPrefix: 'Error in Hero Biography load',
            isAutoLoad,
        }, async () => {
            await mountHeroBiographyMode();
        });
    }

    /** Placeholder mode — empty main space until Story Timeline is built out. */
    async runStoryTimelineComponents(isAutoLoad = false) {
        await enterMode(this._modeContext(), {
            mode: 'storyTimeline',
            runBtnId: 'runStoryTimelineBtn',
            startMessage: '>> Starting Story Timeline...',
            successMessage: 'OK - Story Timeline ready',
            errorPrefix: 'Error in Story Timeline load',
            isAutoLoad,
        }, async () => {
            await mountStoryTimelineMode();
        });
    }

    /** Placeholder mode — empty main space until Dialogue Theater is built out. */
    async runDialogueTheaterComponents(isAutoLoad = false) {
        await enterMode(this._modeContext(), {
            mode: 'dialogueTheater',
            runBtnId: 'runDialogueTheaterBtn',
            startMessage: '>> Starting Dialogue Theater...',
            successMessage: 'OK - Dialogue Theater ready',
            errorPrefix: 'Error in Dialogue Theater load',
            isAutoLoad,
        }, async () => {
            await mountDialogueTheaterMode();
        });
    }

    /** Placeholder mode — empty main space until Official Resources is built out. */
    async runOfficialResourcesComponents(isAutoLoad = false) {
        await enterMode(this._modeContext(), {
            mode: 'officialResources',
            runBtnId: 'runOfficialResourcesBtn',
            startMessage: '>> Starting Official Resources...',
            successMessage: 'OK - Official Resources ready',
            errorPrefix: 'Error in Official Resources load',
            isAutoLoad,
        }, async () => {
            await mountOfficialResourcesMode();
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
        
        updateStatus('OK - All Menu Components killed!', 'success');
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
     * @see killGlobeMode in `Interactive-Worldview/worldview-mode-entry/WorldviewModeLifecycle.js`
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
            successMessage: 'OK - All Glossary Components killed!'
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
     * `Data-Archive/archive-mode/ArchiveModeMount.js` and either restores the
     * main menu or stays where the user is (when switching directly to
     * another mode).
     *
     * @param {boolean} [restoreMenu=true]
     */
    async killBiographyComponents(restoreMenu = true) {
        await exitMode(this._modeContext(), {
            mode: 'biography',
            startMessage: 'Exiting Data Archive...',
            successMessage: 'OK - Data Archive exited!',
            restoreMenu
        }, async () => {
            await exitDataArchive();
        });
    }

    async killHeroBiographyComponents(restoreMenu = true) {
        await exitMode(this._modeContext(), {
            mode: 'heroBiography',
            startMessage: 'Exiting Hero Biography...',
            successMessage: 'OK - Hero Biography exited!',
            restoreMenu,
        }, async () => {
            await unmountHeroBiographyMode();
        });
    }

    async killStoryTimelineComponents(restoreMenu = true) {
        await exitMode(this._modeContext(), {
            mode: 'storyTimeline',
            startMessage: 'Exiting Story Timeline...',
            successMessage: 'OK - Story Timeline exited!',
            restoreMenu,
        }, async () => {
            await unmountStoryTimelineMode();
        });
    }

    async killDialogueTheaterComponents(restoreMenu = true) {
        await exitMode(this._modeContext(), {
            mode: 'dialogueTheater',
            startMessage: 'Exiting Dialogue Theater...',
            successMessage: 'OK - Dialogue Theater exited!',
            restoreMenu,
        }, async () => {
            await unmountDialogueTheaterMode();
        });
    }

    async killOfficialResourcesComponents(restoreMenu = true) {
        await exitMode(this._modeContext(), {
            mode: 'officialResources',
            startMessage: 'Exiting Official Resources...',
            successMessage: 'OK - Official Resources exited!',
            restoreMenu,
        }, async () => {
            await unmountOfficialResourcesMode();
        });
    }
}
