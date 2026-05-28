/**
 * ModeOrchestrator ¥ runtime owner of the app's mode lifecycle.
 *
 * Holds the loaded-component flag bag and the load/unload pairs for every
 * component, and exposes `runXComponents` / `killXComponents` for each mode
 * (World, Codex, Data Workshop, Story, Gallery, …) plus `runMenuComponents`
 * / `restoreMainMenu` for the menu shell. The actual mode bodies live in
 * their owning features:
 *
 *   - Worldview run/kill ? `world/worldview-mode-entry/WorldviewModeLifecycle.js`
 *   - Worldview asset load ? `world/worldview-mode-entry/WorldviewAssetLoader.js`
 *   - Data Archive mode entry: `data-workshop/archive-mode/ArchiveModeMount.js`
 *   - Linear-mode ceremony ? `runtime/modeLifecycleCeremony.js`
 *   - Universal Features  ? `runtime/universalFeaturesLifecycle.js`
 *
 * This class is a thin coordinator: it owns the shared state and forwards
 * to those modules. Originally lived in `component-loader.js` (now
 * `LoadingOrchestrator.js`, which only does boot wiring) and used to be
 * ~1,600 lines because it held all of those bodies inline. The "Component"
 * name was a hangover from that era; it actually orchestrates *modes*.
 */

import { isDataWorkshopLocalDev } from '../atlas-main-menu/dataWorkshopLocalDev.js';
import { ATLAS_MODE, MODE_LABEL } from './atlasModes.js';
import { updateStatus } from './statusFeed.js';
import { runStagedLinearModeLoad } from './linearModeStagedEntry.js';
import { restoreMainMenu as restoreMainMenuImpl } from '../atlas-main-menu/restoreMainMenu.js';
import { runMenuComponents as runMenuComponentsImpl } from '../atlas-main-menu/runMenuComponents.js';
import {
    createDataArchivePanel,
    openDataArchiveEventsView as openDataArchiveEventsViewImpl,
    exitDataArchive
} from '../../data-workshop/archive-mode/ArchiveModeMount.js';
import {
    runUniversalFeatures as runUniversalFeaturesImpl,
    killUniversalFeatures as killUniversalFeaturesImpl
} from './universalFeaturesLifecycle.js';
import { enterMode, exitMode } from './modeLifecycleCeremony.js';
import { runGlobeMode, killGlobeMode } from '../../world/worldview-mode-entry/WorldviewModeLifecycle.js';
import {
    mountGalleryMode,
    unmountGalleryMode,
} from '../../gallery/gallery-mode/GalleryModeMount.js';
import {
    mountStoryMode,
    unmountStoryMode,
} from '../../story/story-mode/StoryModeMount.js';
import {
    mountDialogueTheaterMode,
    unmountDialogueTheaterMode,
} from '../../dialogue-theater/dialogue-theater-mode/DialogueTheaterModeMount.js';
import {
    mountOfficialArchiveMode,
    unmountOfficialArchiveMode,
} from '../../official-archive/official-archive-mode/OfficialArchiveModeMount.js';

/**
 * ModeOrchestrator class
 * Orchestrates entry into / exit out of each app mode plus Universal Features.
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
            killWorldComponents: this.killWorldComponents.bind(this),
            killCodexComponents: this.killCodexComponents.bind(this),
            killDataWorkshopComponents: this.killDataWorkshopComponents.bind(this),
            killGalleryComponents: this.killGalleryComponents.bind(this),
            killStoryComponents: this.killStoryComponents.bind(this),
            killDialogueTheaterComponents: this.killDialogueTheaterComponents.bind(this),
            killOfficialArchiveComponents: this.killOfficialArchiveComponents.bind(this),
            /** @deprecated Use killWorldComponents */
            killGlobeComponents: this.killWorldComponents.bind(this),
            /** @deprecated Use killCodexComponents */
            killGlossaryComponents: this.killCodexComponents.bind(this),
            /** @deprecated Use killDataWorkshopComponents */
            killBiographyComponents: this.killDataWorkshopComponents.bind(this),
            /** @deprecated Use killGalleryComponents */
            killHeroBiographyComponents: this.killGalleryComponents.bind(this),
            /** @deprecated Use killStoryComponents */
            killStoryTimelineComponents: this.killStoryComponents.bind(this),
            /** @deprecated Use killOfficialArchiveComponents */
            killOfficialResourcesComponents: this.killOfficialArchiveComponents.bind(this),
        };
    }

    /**
     * Open Data Workshop on the given source. External callers
     * (`EventManager`, keyboard shortcuts) use this to jump straight into a
     * specific archive without going through the full mode-entry ceremony.
     *
     * @param {'story'|'heroes'|'factions'|'npcs'|'locations'} [archiveSource]
     */
    async openDataArchiveEventsView(archiveSource = 'story') {
        if (archiveSource === 'story') {
            await this.runStoryComponents();
            return;
        }
        await openDataArchiveEventsViewImpl(archiveSource, {
            onCancel: () => this.killDataWorkshopComponents(true),
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

    /** Enter World mode (3D globe / 2D map). */
    async runWorldComponents(isAutoLoad = false) {
        await runGlobeMode(this._worldModeContext(), isAutoLoad);
    }

    /** @deprecated Use {@link runWorldComponents} */
    async runGlobeComponents(isAutoLoad = false) {
        return this.runWorldComponents(isAutoLoad);
    }

    async runCodexComponents(isAutoLoad = false) {
        await enterMode(this._modeContext(), {
            mode: ATLAS_MODE.CODEX,
            runBtnId: 'runGlossaryBtn',
            startMessage: `>> Starting ${MODE_LABEL[ATLAS_MODE.CODEX]}...`,
            successMessage: `OK - ${MODE_LABEL[ATLAS_MODE.CODEX]} ready`,
            errorPrefix: `Error in ${MODE_LABEL[ATLAS_MODE.CODEX]} load`,
            isAutoLoad,
        }, async () => {
            if (window.CodexModeService && typeof window.CodexModeService.enterCodexMode === 'function') {
                await window.CodexModeService.enterCodexMode();
            } else {
                updateStatus('ERR - CodexModeService not available', 'error');
            }
        });
    }

    /** @deprecated Use {@link runCodexComponents} */
    async runGlossaryComponents(isAutoLoad = false) {
        return this.runCodexComponents(isAutoLoad);
    }

    /** Data Workshop — heroes / factions / NPCs / locations. Localhost only. Story uses {@link runStoryComponents}. */
    async runDataWorkshopComponents(isAutoLoad = false) {
        if (!isDataWorkshopLocalDev()) {
            updateStatus('Data Workshop is only available in local development', 'warning');
            return;
        }
        await enterMode(this._modeContext(), {
            mode: ATLAS_MODE.DATA_WORKSHOP,
            runBtnId: 'runBiographyBtn',
            startMessage: `>> Starting ${MODE_LABEL[ATLAS_MODE.DATA_WORKSHOP]}...`,
            successMessage: `OK - ${MODE_LABEL[ATLAS_MODE.DATA_WORKSHOP]} loaded!`,
            errorPrefix: `Error in ${MODE_LABEL[ATLAS_MODE.DATA_WORKSHOP]} load`,
            isAutoLoad,
        }, async () => {
            await runStagedLinearModeLoad({
                modeLabel: MODE_LABEL[ATLAS_MODE.DATA_WORKSHOP],
                mountStageId: 'categoryHub',
                mountStageLabel: 'building category hub',
                startMessage: `>> Starting ${MODE_LABEL[ATLAS_MODE.DATA_WORKSHOP]}...`,
                finishMessage: `OK - ${MODE_LABEL[ATLAS_MODE.DATA_WORKSHOP]} ready`,
                mountFn: async () => {
                    await createDataArchivePanel({
                        onCancel: () => this.killDataWorkshopComponents(true),
                    });
                },
            });
        });
    }

    /** @deprecated Use {@link runDataWorkshopComponents} */
    async runBiographyComponents(isAutoLoad = false) {
        return this.runDataWorkshopComponents(isAutoLoad);
    }

    async runGalleryComponents(isAutoLoad = false) {
        await enterMode(this._modeContext(), {
            mode: ATLAS_MODE.GALLERY,
            runBtnId: 'runHeroBiographyBtn',
            startMessage: `>> Starting ${MODE_LABEL[ATLAS_MODE.GALLERY]}...`,
            successMessage: `OK - ${MODE_LABEL[ATLAS_MODE.GALLERY]} ready`,
            errorPrefix: `Error in ${MODE_LABEL[ATLAS_MODE.GALLERY]} load`,
            isAutoLoad,
        }, async () => {
            await runStagedLinearModeLoad({
                modeLabel: MODE_LABEL[ATLAS_MODE.GALLERY],
                mountStageId: 'loadContent',
                mountStageLabel: 'loading hero filters and layout',
                startMessage: `>> Starting ${MODE_LABEL[ATLAS_MODE.GALLERY]}...`,
                finishMessage: `OK - ${MODE_LABEL[ATLAS_MODE.GALLERY]} ready`,
                mountFn: () => mountGalleryMode(),
            });
        });
    }

    /** @deprecated Use {@link runGalleryComponents} */
    async runHeroBiographyComponents(isAutoLoad = false) {
        return this.runGalleryComponents(isAutoLoad);
    }

    async openStoryView() {
        await this.runStoryComponents();
    }

    /** @deprecated Use {@link openStoryView} */
    async openStoryTimelineView() {
        return this.openStoryView();
    }

    /** Story mode — main chronology Event Manager. */
    async runStoryComponents(isAutoLoad = false) {
        await enterMode(this._modeContext(), {
            mode: ATLAS_MODE.STORY,
            runBtnId: 'runStoryTimelineBtn',
            startMessage: `>> Starting ${MODE_LABEL[ATLAS_MODE.STORY]}...`,
            successMessage: `OK - ${MODE_LABEL[ATLAS_MODE.STORY]} ready`,
            errorPrefix: `Error in ${MODE_LABEL[ATLAS_MODE.STORY]} load`,
            isAutoLoad,
        }, async () => {
            await runStagedLinearModeLoad({
                modeLabel: MODE_LABEL[ATLAS_MODE.STORY],
                mountStageId: 'embedTimeline',
                mountStageLabel: 'loading story timeline',
                startMessage: `>> Starting ${MODE_LABEL[ATLAS_MODE.STORY]}...`,
                finishMessage: `OK - ${MODE_LABEL[ATLAS_MODE.STORY]} ready`,
                mountFn: async () => {
                    await mountStoryMode({
                        onCancel: () => this.killStoryComponents(true),
                    });
                },
            });
        });
    }

    /** @deprecated Use {@link runStoryComponents} */
    async runStoryTimelineComponents(isAutoLoad = false) {
        return this.runStoryComponents(isAutoLoad);
    }

    async runDialogueTheaterComponents(isAutoLoad = false) {
        await enterMode(this._modeContext(), {
            mode: ATLAS_MODE.DIALOGUE_THEATER,
            runBtnId: 'runDialogueTheaterBtn',
            startMessage: `>> Starting ${MODE_LABEL[ATLAS_MODE.DIALOGUE_THEATER]}...`,
            successMessage: `OK - ${MODE_LABEL[ATLAS_MODE.DIALOGUE_THEATER]} ready`,
            errorPrefix: `Error in ${MODE_LABEL[ATLAS_MODE.DIALOGUE_THEATER]} load`,
            isAutoLoad,
        }, async () => {
            await runStagedLinearModeLoad({
                modeLabel: MODE_LABEL[ATLAS_MODE.DIALOGUE_THEATER],
                mountStageId: 'mountShell',
                mountStageLabel: 'mounting Dialogue Theater shell',
                startMessage: `>> Starting ${MODE_LABEL[ATLAS_MODE.DIALOGUE_THEATER]}...`,
                finishMessage: `OK - ${MODE_LABEL[ATLAS_MODE.DIALOGUE_THEATER]} ready`,
                mountFn: () => mountDialogueTheaterMode(),
            });
        });
    }

    async runOfficialArchiveComponents(isAutoLoad = false) {
        await enterMode(this._modeContext(), {
            mode: ATLAS_MODE.OFFICIAL_ARCHIVE,
            runBtnId: 'runOfficialResourcesBtn',
            startMessage: `>> Starting ${MODE_LABEL[ATLAS_MODE.OFFICIAL_ARCHIVE]}...`,
            successMessage: `OK - ${MODE_LABEL[ATLAS_MODE.OFFICIAL_ARCHIVE]} ready`,
            errorPrefix: `Error in ${MODE_LABEL[ATLAS_MODE.OFFICIAL_ARCHIVE]} load`,
            isAutoLoad,
        }, async () => {
            await runStagedLinearModeLoad({
                modeLabel: MODE_LABEL[ATLAS_MODE.OFFICIAL_ARCHIVE],
                mountStageId: 'mountShell',
                mountStageLabel: 'mounting Official Archive shell',
                startMessage: `>> Starting ${MODE_LABEL[ATLAS_MODE.OFFICIAL_ARCHIVE]}...`,
                finishMessage: `OK - ${MODE_LABEL[ATLAS_MODE.OFFICIAL_ARCHIVE]} ready`,
                mountFn: () => mountOfficialArchiveMode(),
            });
        });
    }

    /** @deprecated Use {@link runOfficialArchiveComponents} */
    async runOfficialResourcesComponents(isAutoLoad = false) {
        return this.runOfficialArchiveComponents(isAutoLoad);
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

    async killWorldComponents() {
        await killGlobeMode(this._worldModeContext());
    }

    /** @deprecated Use {@link killWorldComponents} */
    async killGlobeComponents() {
        return this.killWorldComponents();
    }

    _worldModeContext() {
        return {
            loadedComponents: this.loadedComponents,
            loaders: this.loaders,
            unloaders: this.unloaders,
            killers: this._killers,
            restoreMainMenu: (preserveNewsTicker) => this.restoreMainMenu(preserveNewsTicker),
        };
    }

    /** @deprecated Use {@link _worldModeContext} */
    _globeModeContext() {
        return this._worldModeContext();
    }

    async killCodexComponents() {
        await exitMode(this._modeContext(), {
            mode: ATLAS_MODE.CODEX,
            startMessage: `Exiting ${MODE_LABEL[ATLAS_MODE.CODEX]}...`,
            successMessage: `OK - ${MODE_LABEL[ATLAS_MODE.CODEX]} exited!`,
        }, async () => {
            if (window.unloadGlobeBase && typeof window.unloadGlobeBase === 'function') {
                try {
                    await window.unloadGlobeBase({ preserveEventsUi: false });
                } catch (err) {
                    console.warn('Error unloading globe base during Codex kill:', err);
                }
            }
            if (window.CodexModeService && typeof window.CodexModeService.clearCodexShellForGlobeInit === 'function') {
                window.CodexModeService.clearCodexShellForGlobeInit();
            }
        });
    }

    /** @deprecated Use {@link killCodexComponents} */
    async killGlossaryComponents() {
        return this.killCodexComponents();
    }

    async killDataWorkshopComponents(restoreMenu = true) {
        await exitMode(this._modeContext(), {
            mode: ATLAS_MODE.DATA_WORKSHOP,
            startMessage: `Exiting ${MODE_LABEL[ATLAS_MODE.DATA_WORKSHOP]}...`,
            successMessage: `OK - ${MODE_LABEL[ATLAS_MODE.DATA_WORKSHOP]} exited!`,
            restoreMenu,
        }, async () => {
            await exitDataArchive({ restoreMenu });
        });
    }

    /** @deprecated Use {@link killDataWorkshopComponents} */
    async killBiographyComponents(restoreMenu = true) {
        return this.killDataWorkshopComponents(restoreMenu);
    }

    async killGalleryComponents(restoreMenu = true) {
        await exitMode(this._modeContext(), {
            mode: ATLAS_MODE.GALLERY,
            startMessage: `Exiting ${MODE_LABEL[ATLAS_MODE.GALLERY]}...`,
            successMessage: `OK - ${MODE_LABEL[ATLAS_MODE.GALLERY]} exited!`,
            restoreMenu,
        }, async () => {
            await unmountGalleryMode();
        });
    }

    /** @deprecated Use {@link killGalleryComponents} */
    async killHeroBiographyComponents(restoreMenu = true) {
        return this.killGalleryComponents(restoreMenu);
    }

    async killStoryComponents(restoreMenu = true) {
        await exitMode(this._modeContext(), {
            mode: ATLAS_MODE.STORY,
            startMessage: `Exiting ${MODE_LABEL[ATLAS_MODE.STORY]}...`,
            successMessage: `OK - ${MODE_LABEL[ATLAS_MODE.STORY]} exited!`,
            restoreMenu,
        }, async () => {
            await unmountStoryMode({ restoreMenu });
        });
    }

    /** @deprecated Use {@link killStoryComponents} */
    async killStoryTimelineComponents(restoreMenu = true) {
        return this.killStoryComponents(restoreMenu);
    }

    async killDialogueTheaterComponents(restoreMenu = true) {
        await exitMode(this._modeContext(), {
            mode: ATLAS_MODE.DIALOGUE_THEATER,
            startMessage: `Exiting ${MODE_LABEL[ATLAS_MODE.DIALOGUE_THEATER]}...`,
            successMessage: `OK - ${MODE_LABEL[ATLAS_MODE.DIALOGUE_THEATER]} exited!`,
            restoreMenu,
        }, async () => {
            await unmountDialogueTheaterMode();
        });
    }

    async killOfficialArchiveComponents(restoreMenu = true) {
        await exitMode(this._modeContext(), {
            mode: ATLAS_MODE.OFFICIAL_ARCHIVE,
            startMessage: `Exiting ${MODE_LABEL[ATLAS_MODE.OFFICIAL_ARCHIVE]}...`,
            successMessage: `OK - ${MODE_LABEL[ATLAS_MODE.OFFICIAL_ARCHIVE]} exited!`,
            restoreMenu,
        }, async () => {
            await unmountOfficialArchiveMode();
        });
    }

    /** @deprecated Use {@link killOfficialArchiveComponents} */
    async killOfficialResourcesComponents(restoreMenu = true) {
        return this.killOfficialArchiveComponents(restoreMenu);
    }
}
