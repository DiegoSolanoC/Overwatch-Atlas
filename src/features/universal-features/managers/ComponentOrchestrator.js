/**
 * ComponentOrchestrator - Handles orchestration of component loading/unloading (run/kill operations)
 * Extracted from component-loader.js to improve maintainability
 */

import { applyStoryArchiveOverlapDevStyling } from '../../data-archive/presentation/applyStoryArchiveOverlapDevStyling.js';
import { buildStoryArchiveCategoryHub } from '../../data-archive/presentation/buildStoryArchiveCategoryHub.js';
import {
    mountStoryArchiveCategoryStrip,
    updateStoryArchiveCategoryStripActive
} from '../../data-archive/presentation/mountStoryArchiveCategoryStrip.js';
import { playStoryArchiveCategorySfx } from '../../data-archive/presentation/playStoryArchiveCategorySfx.js';
import { applyStoryArchiveGridSquishFromDefaults } from '../../data-archive/presentation/storyArchiveGridSquish.js';
import { showLoadingOverlay, hideLoadingOverlay, setRunOperation, getRunOperation } from './LoadingOverlayManager.js';
import { updateStatus, updateGlobeComponentsProgress, resetGlobeComponentsProgress } from './StatusManager.js';
import { setCurrentMode, clearCurrentMode } from '../ComponentSetUp/CurrentModeStatus.js';
import { runModeChangingProtocol } from '../ComponentSetUp/ModeChangingProtocol.js';
import { hideMenuContainer } from '../MainMenu/MenuContainer.js';
import { restoreMainMenu as restoreMainMenuImpl } from '../MainMenu/restoreMainMenu.js';
import { killOtherModes } from '../ComponentSetUp/ModeMutualExclusion.js';
import { runMenuComponents as runMenuComponentsImpl } from '../MainMenu/runMenuComponents.js';
import { mountGlobeMapChooserHub, teardownGlobeMapChooserHub, syncGlobeMapLaunchLabels } from '../../Interactive-Worldview/entry/GlobeMapLaunchChoice.js';

/**
 * ComponentOrchestrator class
 * Orchestrates loading and unloading of component groups
 */
export class ComponentOrchestrator {
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
        /** @type {HTMLElement|null} Event Manager × removed from DOM while Data Archive is open */
        this._storyArchiveDetachedClose = null;
        /** @type {((e: KeyboardEvent) => void) | null} Escape → exit Data Archive while category hub is visible */
        this._storyArchiveHubKeyHandler = null;
    }

    /** True when `#eventsManagePanel` is mounted inside `#storyViewerContainer` (events list view). */
    _storyArchiveEventsPanelMounted() {
        const c = document.getElementById('storyViewerContainer');
        const p = document.getElementById('eventsManagePanel');
        return !!(c && p && c.contains(p));
    }

    /** Shared setup when entering Data Archive (menu hidden, Event Manager rail hidden). */
    _prepareStoryArchiveShell() {
        const testContainer = document.querySelector('.test-container');
        if (testContainer) {
            testContainer.style.display = 'none';
        }
        const eventManagerBtn = document.getElementById('eventsManageToggle');
        if (eventManagerBtn) {
            eventManagerBtn.style.setProperty('display', 'none', 'important');
        }
        const eventsManagePanel = document.getElementById('eventsManagePanel');
        if (eventsManagePanel) {
            eventsManagePanel.classList.remove('open');
        }
    }

    /**
     * Data Archive category hub: Story timeline plus Heroes / Factions / NPCs / Locations (each loads its own JSON into the same Event Manager UI).
     * @returns {HTMLElement}
     */
    _buildStoryArchiveCategoryHub() {
        return buildStoryArchiveCategoryHub({
            playCategorySfx: () => this._playStoryArchiveCategorySfx(),
            onSelectArchive: (archive) => {
                void this._enterStoryArchiveEventsView(archive);
            },
            onCancel: () => {
                void this.killBiographyComponents(true);
            }
        });
    }

    _detachStoryArchiveHubDismissChrome() {
        if (this._storyArchiveHubKeyHandler) {
            document.removeEventListener('keydown', this._storyArchiveHubKeyHandler);
            this._storyArchiveHubKeyHandler = null;
        }
    }

    /** Escape exits Data Archive when the category hub is showing (parity with globe/map chooser). */
    _attachStoryArchiveHubDismissChrome() {
        this._detachStoryArchiveHubDismissChrome();
        this._storyArchiveHubKeyHandler = (e) => {
            if (e.key !== 'Escape') return;
            if (this._storyArchiveEventsPanelMounted()) return;
            e.preventDefault();
            void this.killBiographyComponents(true);
        };
        document.addEventListener('keydown', this._storyArchiveHubKeyHandler);
    }

    /** Play category-tile click sound, loading fallback path if needed. */
    _playStoryArchiveCategorySfx() {
        playStoryArchiveCategorySfx();
    }

    /**
     * From category hub → mount Event Manager panel (same UI; data from `archiveSource` JSON).
     * @param {'story'|'heroes'|'factions'|'npcs'|'locations'} archiveSource
     */
    async _enterStoryArchiveEventsView(archiveSource = 'story') {
        if (this._storyArchiveEventsPanelMounted()) {
            const eventsManagePanelMounted = document.getElementById('eventsManagePanel');
            try {
                if (window.eventManager?.switchStoryArchiveSource) {
                    await window.eventManager.switchStoryArchiveSource(archiveSource);
                } else if (window.eventManager) {
                    window.eventManager.dataService?.setArchiveSource?.(archiveSource);
                    await window.eventManager.loadEvents();
                    window.eventManager.renderEvents();
                }
            } catch (err) {
                console.error('[ComponentOrchestrator] Data Archive category switch failed:', err);
                updateStatus(`⚠ Could not load archive: ${err?.message || err}`, 'error');
                return;
            }
            if (eventsManagePanelMounted) {
                this._ensureStoryArchiveBackToCategoriesButton(eventsManagePanelMounted);
                this._updateStoryArchiveCategoryStripActive(archiveSource);
            }
            const labelMounted =
                archiveSource === 'story'
                    ? 'Story timeline'
                    : `${archiveSource.charAt(0).toUpperCase()}${archiveSource.slice(1)} archive`;
            updateStatus(`✓ ${labelMounted} open`, 'success');
            return;
        }

        const storyContainer = document.getElementById('storyViewerContainer');
        const eventsManagePanel = document.getElementById('eventsManagePanel');
        if (!storyContainer || !eventsManagePanel) {
            updateStatus('⚠ Data Archive or Event Manager panel not found', 'error');
            return;
        }

        this._detachStoryArchiveHubDismissChrome();
        document.getElementById('storyArchiveCategoryHub')?.remove();
        storyContainer.classList.remove('story-viewer-container--hub');

        if (!this._originalEventsPanelParent) {
            this._originalEventsPanelParent = eventsManagePanel.parentNode;
            this._originalEventsPanelClasses = eventsManagePanel.className;
        }

        eventsManagePanel.classList.remove('events-manage-panel');
        eventsManagePanel.classList.add('story-viewer-panel-embedded');
        eventsManagePanel.style.right = 'auto';
        eventsManagePanel.style.position = 'relative';
        eventsManagePanel.style.width = '100%';
        eventsManagePanel.style.height = '100%';
        eventsManagePanel.style.top = 'auto';
        eventsManagePanel.style.bottom = 'auto';

        storyContainer.appendChild(eventsManagePanel);

        const header = eventsManagePanel.querySelector('.events-manage-header');
        if (header) {
            header.classList.add('story-viewer-header');
        }

        const addBtn = document.getElementById('addEventBtn');
        const saveBtn = document.getElementById('saveEventsBtn');
        const exportBtn = document.getElementById('exportEventsBtn');
        if (addBtn) addBtn.classList.add('story-viewer-action-btn');
        if (saveBtn) saveBtn.classList.add('story-viewer-action-btn');
        if (exportBtn) exportBtn.classList.add('story-viewer-action-btn');

        eventsManagePanel.classList.add('open');

        this._setupStoryArchiveBottomBar(eventsManagePanel);
        this._setupStoryArchiveCompactChrome(eventsManagePanel);

        try {
            if (window.eventManager?.switchStoryArchiveSource) {
                await window.eventManager.switchStoryArchiveSource(archiveSource);
            } else if (window.eventManager) {
                window.eventManager.dataService?.setArchiveSource?.(archiveSource);
                await window.eventManager.loadEvents();
                window.eventManager.renderEvents();
            }
        } catch (err) {
            console.error('[ComponentOrchestrator] Data Archive load failed:', err);
            updateStatus(`⚠ Could not load archive: ${err?.message || err}`, 'error');
        }

        this._hideStoryArchiveEventManagerClose(eventsManagePanel);
        applyStoryArchiveGridSquishFromDefaults(eventsManagePanel);
        this._ensureStoryArchiveBackToCategoriesButton(eventsManagePanel);
        this._updateStoryArchiveCategoryStripActive(archiveSource);

        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setTimeout(() => {
                console.log('[ComponentOrchestrator] Data Archive (events view) DOM inspection:');
                console.log('[ComponentOrchestrator] eventsManagePanel:', eventsManagePanel);
                const eventItems = eventsManagePanel.querySelectorAll('.event-item');
                console.log('[ComponentOrchestrator] Event items found:', eventItems.length);
            }, 300);
        }

        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setTimeout(() => {
                applyStoryArchiveOverlapDevStyling(eventsManagePanel);

                if (!this._storyArchiveObserver) {
                    this._storyArchiveObserver = new MutationObserver(() => {
                        applyStoryArchiveOverlapDevStyling(eventsManagePanel);
                    });
                    this._storyArchiveObserver.observe(eventsManagePanel, {
                        childList: true,
                        subtree: true,
                    });
                }
            }, 400);
        }

        const label =
            archiveSource === 'story'
                ? 'Story timeline'
                : `${archiveSource.charAt(0).toUpperCase()}${archiveSource.slice(1)} archive`;
        updateStatus(`✓ ${label} open`, 'success');
    }

    /**
     * Search row: “Categories” back + five archive icon buttons (Data Archive embedded only).
     */
    _ensureStoryArchiveBackToCategoriesButton(eventsManagePanel) {
        mountStoryArchiveCategoryStrip(eventsManagePanel, {
            playCategorySfx: () => this._playStoryArchiveCategorySfx(),
            onBackToHub: () => {
                void this._returnToStoryArchiveCategoryHub();
            },
            onSelectArchive: (archive) => {
                void this._enterStoryArchiveEventsView(archive);
            }
        });
    }

    _updateStoryArchiveCategoryStripActive(archiveSource) {
        updateStoryArchiveCategoryStripActive(archiveSource);
    }

    _disconnectStoryArchiveOverlapObserver() {
        if (this._storyArchiveObserver) {
            try {
                this._storyArchiveObserver.disconnect();
            } catch (_) { /* ignore */ }
            this._storyArchiveObserver = null;
        }
    }

    /**
     * Move `#eventsManagePanel` out of `#storyViewerContainer` and restore Event Manager chrome.
     * Caller should re-append hub or exit Data Archive as appropriate.
     */
    _detachEventsManagePanelFromStoryArchive(eventsManagePanel) {
        document.getElementById('storyArchiveSearchCategoryStrip')?.remove();

        if (!eventsManagePanel || !this._originalEventsPanelParent) {
            return;
        }

        this._restoreStoryArchiveEventManagerClose();
        this._restoreStoryArchiveCompactChrome(eventsManagePanel);
        this._teardownStoryArchiveBottomBar(eventsManagePanel);

        eventsManagePanel.className = this._originalEventsPanelClasses || 'events-manage-panel';

        eventsManagePanel.style.right = '';
        eventsManagePanel.style.position = '';
        eventsManagePanel.style.width = '';
        eventsManagePanel.style.height = '';
        eventsManagePanel.style.top = '';
        eventsManagePanel.style.bottom = '';
        eventsManagePanel.style.removeProperty('--story-archive-list-inset-inline');
        eventsManagePanel.style.removeProperty('--story-archive-list-inset-inline-end');
        eventsManagePanel.style.removeProperty('--story-archive-list-gutter');
        eventsManagePanel.style.removeProperty('--story-archive-list-max-width');

        const title = eventsManagePanel.querySelector('.story-viewer-title');
        if (title) {
            title.textContent = 'Event Management';
            title.classList.remove('story-viewer-title');
            title.classList.add('events-manage-title');
        }

        const addBtn = document.getElementById('addEventBtn');
        const saveBtn = document.getElementById('saveEventsBtn');
        const exportBtn = document.getElementById('exportEventsBtn');
        if (addBtn) addBtn.classList.remove('story-viewer-action-btn');
        if (saveBtn) saveBtn.classList.remove('story-viewer-action-btn');
        if (exportBtn) exportBtn.classList.remove('story-viewer-action-btn');
        document.getElementById('eventsSearchClear')?.classList.remove('story-viewer-action-btn');
        document.getElementById('eventsShowAllCheckbox')?.closest('label.events-search-checkbox')?.classList.remove('story-viewer-bottom-bar-control');
        document.getElementById('eventsPerPageInput')?.closest('.events-per-page-group')?.classList.remove('story-viewer-bottom-bar-control');

        const header = eventsManagePanel.querySelector('.story-viewer-header');
        if (header) {
            header.classList.remove('story-viewer-header');
        }

        document.getElementById('storyArchiveLayoutControl')?.remove();
        document.getElementById('storyArchiveGridSquishBar')?.remove();

        eventsManagePanel.classList.remove('open');
        this._originalEventsPanelParent.appendChild(eventsManagePanel);
    }

    /** Hub again: detach list panel, restore main timeline in memory, show category tiles. */
    async _returnToStoryArchiveCategoryHub() {
        const storyContainer = document.getElementById('storyViewerContainer');
        const eventsManagePanel = document.getElementById('eventsManagePanel');
        if (!storyContainer || !eventsManagePanel || !this._storyArchiveEventsPanelMounted()) {
            return;
        }

        document.getElementById('storyArchiveCategoryHub')?.remove();
        this._disconnectStoryArchiveOverlapObserver();

        this._detachEventsManagePanelFromStoryArchive(eventsManagePanel);

        if (window.eventManager?.dataService?.setArchiveSource) {
            window.eventManager.dataService.setArchiveSource('story');
        }
        try {
            if (window.eventManager?.loadEvents) {
                await window.eventManager.loadEvents();
            }
        } catch (e) {
            console.warn('[ComponentOrchestrator] Restoring main timeline for category hub:', e);
        }
        if (window.eventManager?.renderEvents) {
            window.eventManager.renderEvents();
        }

        storyContainer.classList.add('story-viewer-container--hub');
        storyContainer.appendChild(this._buildStoryArchiveCategoryHub());
        this._attachStoryArchiveHubDismissChrome();
        updateStatus('✓ Data Archive — choose a category', 'success');
    }

    /**
     * Open Data Archive on the given source (replaces the legacy sliding {@link #eventsManagePanel} overlay).
     * @param {'story'|'heroes'|'factions'|'npcs'|'locations'} [archiveSource]
     */
    async openDataArchiveEventsView(archiveSource = 'story') {
        await this.createStoryViewerPanel();
        await this._enterStoryArchiveEventsView(archiveSource);
    }

    /**
     * Check if Event System Load Out is already active
     * Globe now relies on Event System for event-related features
     */
    isEventSystemLoadOutActive() {
        const testBtn = document.getElementById('testBtn');
        const isLoaded = testBtn?.dataset.loaded === 'true';
        const hasEventManager = window.eventManager?.events?.length > 0;
        const hasListeners = window.eventManager?.listenersSetup === true;
        const hasUI = !!document.getElementById('filtersPanel') || 
                       !!document.getElementById('paginationDock') ||
                       !!document.getElementById('filtersToggle');
        return isLoaded && hasEventManager && hasListeners && hasUI;
    }

    /**
     * Auto-load Event System if "Auto preload" checkbox is enabled
     * @returns {Promise<boolean>} - True if event system was loaded (or already loaded), false otherwise
     */
    async autoPreloadEventSystemIfEnabled() {
        const autoPreloadEnabled = localStorage.getItem('autoPreloadEventSystem') === 'true';
        
        if (!autoPreloadEnabled) {
            return true; // Continue without loading
        }
        
        // Check if already loaded
        if (this.isEventSystemLoadOutActive()) {
            return true; // Already loaded, continue
        }
        
        // Trigger event system load by clicking the testBtn
        const testBtn = document.getElementById('testBtn');
        if (testBtn) {
            console.log('[ComponentOrchestrator] Auto-preloading Event System...');
            
            // Show loading overlay FIRST to mask the event system loading
            showLoadingOverlay();
            updateStatus('→ Auto-loading Event System...', 'info');
            
            testBtn.click();
            
            // Wait for event system to be fully loaded
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max
            while (!this.isEventSystemLoadOutActive() && attempts < maxAttempts) {
                await new Promise(r => setTimeout(r, 100));
                attempts++;
            }
            
            if (this.isEventSystemLoadOutActive()) {
                console.log('[ComponentOrchestrator] Event System auto-loaded successfully');
                updateStatus('✓ Event System auto-loaded', 'success');
                await new Promise(r => setTimeout(r, 200)); // Small delay for stability
                // Don't hide loading overlay here - let the mode loader handle it
                return true;
            } else {
                console.warn('[ComponentOrchestrator] Event System auto-load timed out');
                updateStatus('⚠ Event System auto-load timed out', 'warning');
                hideLoadingOverlay();
                return false;
            }
        }
        
        return true;
    }

    /**
     * Play mode switch sound effect
     * @param {boolean} isAutoLoad - If true, don't play sound
     */
    playModeSwitchSound(isAutoLoad) {
        if (!isAutoLoad && window.SoundEffectsManager) {
            if (window.SoundEffectsManager.sounds && window.SoundEffectsManager.sounds['modeSwitch']) {
                window.SoundEffectsManager.play('modeSwitch');
            } else {
                // Load and play if not already loaded
                window.SoundEffectsManager.loadSound('modeSwitch', 'src/assets/audio/sfx/Mode Switch.mp3');
                setTimeout(() => {
                    window.SoundEffectsManager.play('modeSwitch');
                }, 100);
            }
        }
    }

    /**
     * Run Menu Components
     */
    async runMenuComponents() {
        await runMenuComponentsImpl({
            loadedComponents: this.loadedComponents,
            loadMenu: this.loaders.menu
        });
    }

    /**
     * Run all Universal Features sequentially
     * Loads: Music first (resume / buffer smooth), then Palette
     */
    async runUniversalFeatures(options = {}) {
        const runBtn = document.getElementById('runUniversalBtn');
        if (runBtn) {
            runBtn.disabled = true;
        }

        const keepOverlay = !!(options && options.keepOverlay);
        
        const isRunOperation = getRunOperation();
        // Note: isRunOperation and overlay should already be set by the button click handler
        // But if called directly (not from button), set them here
        if (!isRunOperation) {
            setRunOperation(true);
            showLoadingOverlay();
        }
        updateStatus('🚀 Starting Universal Features auto-load...', 'info');
        
        try {
            // Music first so saved track can buffer before heavier UI work
            if (!this.loadedComponents.music) {
                updateStatus('→ Loading Music...', 'info');
                await this.loaders.music();
                await new Promise(r => setTimeout(r, 120));
            } else {
                updateStatus('→ Music already loaded, skipping...', 'info');
            }

            if (!this.loadedComponents.palette) {
                updateStatus('⬛ Loading Palette...', 'info');
                await this.loaders.palette();
                await new Promise(r => setTimeout(r, 300));
            } else {
                updateStatus('⬛ Palette already loaded, skipping...', 'info');
            }

            // Always ensure header nav buttons exist (Interactive Worldview, Connection Codex, Data Archive, Home)
            // NOTE: Events and Filters buttons are now created by standalone Event System Load Out only
            if (this.loaders.headerNav) {
                this.loaders.headerNav();
            }
            
            updateStatus('✓ Universal Features auto-load complete!', 'success');
        } catch (error) {
            console.error('Error in Universal Features auto-load:', error);
            updateStatus(`✗ Error in Universal Features auto-load: ${error.message}`, 'error');
        } finally {
            // If we're in a boot chain (e.g., AppInitializer), keep the overlay up
            // so the user doesn't see a "menu flash" between Universal and Globe loads.
            if (!keepOverlay) {
                setRunOperation(false);
                hideLoadingOverlay();
            }
            if (runBtn) {
                runBtn.disabled = false;
            }
        }
    }

    /**
     * Enter Worldview mode and present the 3D Globe / 2D Map chooser hub.
     *
     * Mirrors `runBiographyComponents`: this method does mode entry, paints
     * the hub inside `main#content`, then EXITS — releasing the loading
     * overlay so the user can interact with the hub. It does NOT await the
     * user's pick; the hub buttons drive `_loadGlobeAssets(startOnMap)` (the
     * actual asset loader) on their own.
     *
     * `isAutoLoad === true` skips the hub entirely and uses the persisted
     * `mapGlobePreToggle` preference (used by header switches and other
     * automated flows where the user has already chosen).
     */
    async runGlobeComponents(isAutoLoad = false) {
        this.playModeSwitchSound(isAutoLoad);

        if (!isAutoLoad) {
            await this.autoPreloadEventSystemIfEnabled();
        }

        if (window.EventSlideManager?.instance?.hideEventSlide) {
            window.EventSlideManager.instance.hideEventSlide();
        }
        if (window.standaloneEventSlide?.hideEventSlide) {
            window.standaloneEventSlide.hideEventSlide();
        }

        await killOtherModes({
            targetMode: 'globe',
            loadedComponents: this.loadedComponents,
            killers: this._killers
        });

        setCurrentMode('globe');

        const runBtn = document.getElementById('runGlobeBtn');
        if (runBtn) {
            runBtn.disabled = true;
        }

        resetGlobeComponentsProgress();
        hideMenuContainer();

        if (isAutoLoad) {
            const startOnMap = localStorage.getItem('mapGlobePreToggle') === 'true';
            await this._loadGlobeAssets(startOnMap, { keepRunOperation: true });
            return;
        }

        // Manual entry — paint the hub, then EXIT (overlay drops, hub is interactive).
        const isRunOperation = getRunOperation();
        if (!isRunOperation) {
            setRunOperation(true);
            showLoadingOverlay();
        }

        try {
            mountGlobeMapChooserHub({
                onPick: (startOnMap) => {
                    void this._loadGlobeAssets(startOnMap);
                },
                onCancel: () => {
                    if (runBtn) runBtn.disabled = false;
                    clearCurrentMode();
                    void this.restoreMainMenu();
                }
            });
            updateStatus('✓ Worldview — choose a view', 'success');
        } catch (error) {
            console.error('Error mounting Worldview chooser:', error);
            updateStatus(`✗ Error in Worldview chooser: ${error.message}`, 'error');
        } finally {
            setRunOperation(false);
            hideLoadingOverlay();
        }
    }

    /**
     * Load globe assets (Globe Base → Transport → Controls), then wire markers
     * and dispatch the mode-change event. Called by `runGlobeComponents` (for
     * auto-load) and by the chooser hub's "Globe" / "Map" tile click handlers.
     *
     * @param {boolean} startOnMap - `true` opens timeline as 2D map, `false` as 3D globe.
     * @param {{ keepRunOperation?: boolean }} [opts] - When `true`, assume the
     *   caller already set `setRunOperation(true)` + showed the overlay (the
     *   auto-load path does this). Default `false`: this method manages the
     *   run-operation flag itself (the hub-button path).
     */
    async _loadGlobeAssets(startOnMap, opts = {}) {
        const keepRunOperation = !!opts.keepRunOperation;
        const runBtn = document.getElementById('runGlobeBtn');

        try { localStorage.setItem('mapGlobePreToggle', startOnMap ? 'true' : 'false'); } catch (_) {}
        syncGlobeMapLaunchLabels(startOnMap);

        teardownGlobeMapChooserHub();

        if (!keepRunOperation) {
            setRunOperation(true);
            showLoadingOverlay();
        }

        const globeContainer = document.getElementById('globe-container');
        if (globeContainer) {
            globeContainer.style.width = '100%';
            globeContainer.style.height = '100%';
            globeContainer.style.display = 'none';
            updateStatus('→ Preparing globe container...', 'info');
        }

        updateStatus('🚀 Starting Globe Components auto-load...', 'info');

        try {
            if (!this.loadedComponents.globeBase) {
                updateStatus('→ Loading Globe Base...', 'info');
                await this.loaders.globeBase();
                if (globeContainer) {
                    globeContainer.style.opacity = '1';
                    globeContainer.style.pointerEvents = 'auto';
                    globeContainer.style.display = 'block';
                    globeContainer.classList.add('loaded');
                }
                updateGlobeComponentsProgress(1);
                await new Promise(r => setTimeout(r, 300));
            } else {
                updateStatus('→ Globe Base already loaded, skipping...', 'info');
                if (globeContainer) {
                    globeContainer.style.opacity = '1';
                    globeContainer.style.pointerEvents = 'auto';
                    globeContainer.style.display = 'block';
                    globeContainer.classList.add('loaded');
                }
                updateGlobeComponentsProgress(1);
            }

            if (!this.loadedComponents.transport) {
                updateStatus('→ Loading Transport...', 'info');
                await this.loaders.transport();
                updateGlobeComponentsProgress(2);
                await new Promise(r => setTimeout(r, 300));
            } else {
                updateStatus('→ Transport already loaded, skipping...', 'info');
                updateGlobeComponentsProgress(2);
            }

            updateStatus('→ Loading Controls...', 'info');
            if (window.globeController?.sceneModel) {
                if (window.globeController.sceneModel.setMapViewEnabled) {
                    window.globeController.sceneModel.setMapViewEnabled(startOnMap);
                } else {
                    window.globeController.sceneModel.isMapView = startOnMap;
                }
            }
            if (window.globeController && typeof window.globeController.setMapViewEnabled === 'function') {
                window.globeController.setMapViewEnabled(startOnMap);
            }
            await this.loaders.controls();
            if (window.globeController?.uiView?.setupMapViewToggle) {
                window.globeController.uiView.setupMapViewToggle();
            }
            document.body.classList.add('rotate-subbar-open');
            const rotateSubBar = document.getElementById('headerRotateSubBar');
            if (rotateSubBar) {
                rotateSubBar.style.display = 'block';
                rotateSubBar.style.top = '0';
                rotateSubBar.style.left = '0';
            }
            updateGlobeComponentsProgress(3);
            await new Promise(r => setTimeout(r, 300));

            console.log(`[ComponentOrchestrator] Checking marker creation: eventSystemActive=${this.isEventSystemLoadOutActive()}, globeController=${!!window.globeController?.sceneModel}, markerManager=${!!window.globeEventMarkerManager}`);
            if (this.isEventSystemLoadOutActive() && window.globeController?.sceneModel && !window.globeEventMarkerManager) {
                console.log('[ComponentOrchestrator] Creating EventMarkerManager for Globe...');
                updateStatus('→ Event System detected, creating event markers...', 'info');
                const { EventMarkerManager } = await import('../../system-interface/presentation/markers/EventMarkerManager.js');
                window.globeEventMarkerManager = new EventMarkerManager(
                    window.globeController.sceneModel,
                    window.globeController.dataModel
                );
                console.log('[ComponentOrchestrator] EventMarkerManager created, adding markers...');
                await window.globeEventMarkerManager.addEventMarkers(true);
                console.log('[ComponentOrchestrator] Markers added successfully');
                updateStatus('✓ Event markers added to Globe', 'success');
            } else {
                console.log('[ComponentOrchestrator] Skipping marker creation');
            }

            runModeChangingProtocol('globe');
        } catch (error) {
            console.error('Error in Globe Components auto-load:', error);
            updateStatus(`✗ Error in Globe Components auto-load: ${error.message}`, 'error');
        } finally {
            setRunOperation(false);
            hideLoadingOverlay();
            if (runBtn) {
                runBtn.disabled = false;
            }
        }
    }

    /**
     * Run all Glossary Components sequentially
     * Enters Codex mode (Concept Glossary)
     */
    async runGlossaryComponents(isAutoLoad = false) {
        this.playModeSwitchSound(isAutoLoad);

        // Auto-load Event System if checkbox is enabled
        if (!isAutoLoad) {
            await this.autoPreloadEventSystemIfEnabled();
        }

        // Close event slide panel if open (both EventSlideManager and standalone event system)
        if (window.EventSlideManager?.instance?.hideEventSlide) {
            window.EventSlideManager.instance.hideEventSlide();
        }
        if (window.standaloneEventSlide?.hideEventSlide) {
            window.standaloneEventSlide.hideEventSlide();
        }

        await killOtherModes({
            targetMode: 'glossary',
            loadedComponents: this.loadedComponents,
            killers: this._killers
        });

        setCurrentMode('glossary');

        const runBtn = document.getElementById('runGlossaryBtn');
        if (runBtn) {
            runBtn.disabled = true;
        }

        const isRunOperation = getRunOperation();
        // Note: isRunOperation and overlay should already be set by the button click handler
        // But if called directly (not from button), set them here
        if (!isRunOperation) {
            setRunOperation(true);
            showLoadingOverlay();
        }
        updateStatus('🚀 Starting Glossary Components auto-load...', 'info');

        try {
            hideMenuContainer();

            // Enter Codex mode via CodexModeService
            if (window.CodexModeService && typeof window.CodexModeService.enterCodexMode === 'function') {
                await window.CodexModeService.enterCodexMode();
            } else {
                updateStatus('→ CodexModeService not available', 'error');
            }

            // Ensure header hub state updates
            runModeChangingProtocol('glossary');

            this.loadedComponents.glossary = true;
            updateStatus('✓ Glossary Components auto-load complete!', 'success');
        } catch (error) {
            console.error('Error in Glossary Components auto-load:', error);
            updateStatus(`✗ Error in Glossary Components auto-load: ${error.message}`, 'error');
        } finally {
            setRunOperation(false);
            hideLoadingOverlay();
            if (runBtn) {
                runBtn.disabled = false;
            }
        }
    }

    /**
     * Run all Biography Components sequentially
     * Data Archive mode - displays events in a centered panel
     */
    async runBiographyComponents(isAutoLoad = false) {
        this.playModeSwitchSound(isAutoLoad);

        // Auto-load Event System if checkbox is enabled
        if (!isAutoLoad) {
            await this.autoPreloadEventSystemIfEnabled();
        }

        // Close event slide panel if open (both EventSlideManager and standalone event system)
        if (window.EventSlideManager?.instance?.hideEventSlide) {
            window.EventSlideManager.instance.hideEventSlide();
        }
        if (window.standaloneEventSlide?.hideEventSlide) {
            window.standaloneEventSlide.hideEventSlide();
        }

        await killOtherModes({
            targetMode: 'biography',
            loadedComponents: this.loadedComponents,
            killers: this._killers
        });

        setCurrentMode('biography');
        
        const runBtn = document.getElementById('runBiographyBtn');
        if (runBtn) {
            runBtn.disabled = true;
        }
        
        const isRunOperation = getRunOperation();
        if (!isRunOperation) {
            setRunOperation(true);
            showLoadingOverlay();
        }
        updateStatus('🚀 Starting Data Archive...', 'info');
        
        try {
            hideMenuContainer();
            
            // Create and show the Data Archive panel
            await this.createStoryViewerPanel();
            
            // Minimum loading time for visual consistency (800ms)
            await new Promise(r => setTimeout(r, 800));

            // Ensure header hub state updates
            runModeChangingProtocol('biography');
            
            this.loadedComponents.biography = true;
            updateStatus('✓ Data Archive loaded!', 'success');
        } catch (error) {
            console.error('Error in Data Archive load:', error);
            updateStatus(`✗ Error in Data Archive load: ${error.message}`, 'error');
        } finally {
            setRunOperation(false);
            hideLoadingOverlay();
            if (runBtn) {
                runBtn.disabled = false;
            }
        }
    }

    /** Event Manager × — removed from DOM in Data Archive (never use getElementById: wrong node if duplicate ids). */
    _hideStoryArchiveEventManagerClose(eventsManagePanel) {
        if (!eventsManagePanel?.classList.contains('story-viewer-panel-embedded')) return;

        const findCloseInPanel = (panel) =>
            panel.querySelector(':scope > #eventsManageClose') ||
            panel.querySelector(':scope > .events-manage-close') ||
            panel.querySelector('#eventsManageClose') ||
            panel.querySelector('.events-manage-close');

        const detach = () => {
            const closeInPanel = findCloseInPanel(eventsManagePanel);
            if (!closeInPanel) return;

            const held = this._storyArchiveDetachedClose;
            if (held && held !== closeInPanel) {
                this._storyArchiveDetachedClose = null;
            }
            this._storyArchiveDetachedClose = closeInPanel;
            closeInPanel.remove();
        };

        detach();
        requestAnimationFrame(detach);
    }

    /** Put Event Manager × back before `.events-manage-content`. */
    _restoreStoryArchiveEventManagerClose() {
        const close = this._storyArchiveDetachedClose;
        if (!close) return;
        const panel = document.getElementById('eventsManagePanel');
        const content = panel?.querySelector('.events-manage-content');
        if (panel && content) {
            panel.insertBefore(close, content);
        }
        ['display', 'visibility', 'opacity', 'pointer-events'].forEach((prop) => {
            close.style.removeProperty(prop);
        });
        this._storyArchiveDetachedClose = null;
    }

    /**
     * One bottom row: Add/Save/Export (left) + pagination (center) + Show all / Per page / Clear (right).
     */
    _setupStoryArchiveBottomBar(eventsManagePanel) {
        if (!eventsManagePanel?.classList.contains('story-viewer-panel-embedded')) return;

        let bottomBar = document.getElementById('storyArchiveBottomBar');
        if (!bottomBar) {
            const manageContent = eventsManagePanel.querySelector('.events-manage-content');
            const list = document.getElementById('eventsList');
            if (!manageContent || !list) return;

            bottomBar = document.createElement('div');
            bottomBar.id = 'storyArchiveBottomBar';
            bottomBar.className = 'story-archive-bottom-bar';

            const actions = eventsManagePanel.querySelector('.events-manage-actions');
            if (actions) bottomBar.appendChild(actions);

            const pag = document.getElementById('eventsPagination');
            if (pag) bottomBar.appendChild(pag);

            manageContent.insertBefore(bottomBar, list.nextSibling);
        }

        this._populateStoryArchiveRightToolbar(eventsManagePanel, bottomBar);
    }

    /**
     * Move Show all + Per page into one right-side unit in Data Archive.
     */
    _populateStoryArchiveRightToolbar(eventsManagePanel, bottomBar) {
        if (!bottomBar) return;

        const secondary = eventsManagePanel.querySelector('.events-manage-search-row--secondary');
        if (!secondary) return;

        const showAllLabel = document.getElementById('eventsShowAllCheckbox')?.closest('label.events-search-checkbox');
        const perPage = document.getElementById('eventsPerPageInput')?.closest('.events-per-page-group');
        let wrap = document.getElementById('storyArchiveRightToolbar');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.id = 'storyArchiveRightToolbar';
            wrap.className = 'story-archive-right-toolbar';
        }

        if (showAllLabel || perPage) {
            let unit = wrap.querySelector('.story-archive-page-unit');
            if (!unit) {
                unit = document.createElement('div');
                unit.className = 'story-archive-page-unit story-viewer-bottom-bar-control';
            }
            if (showAllLabel) unit.appendChild(showAllLabel);
            if (perPage) unit.appendChild(perPage);
            wrap.appendChild(unit);
        }

        if (wrap.childNodes.length === 0) {
            return;
        }

        bottomBar.appendChild(wrap);
    }

    /**
     * Data Archive: hide header (title + count). Only “Show controls” moves above Search & filters.
     */
    _setupStoryArchiveCompactChrome(eventsManagePanel) {
        if (!eventsManagePanel?.classList.contains('story-viewer-panel-embedded')) return;
        const header = eventsManagePanel.querySelector('.events-manage-header');
        const controls = document.getElementById('eventsManageControls');
        const btn = document.getElementById('eventsManageToolbarToggleBtn');
        if (!header || !controls || !btn) return;

        const strayTitle = Array.from(controls.children).find((el) =>
            el.classList?.contains('events-manage-title-section')
        );
        if (strayTitle && !header.contains(strayTitle)) {
            header.insertBefore(strayTitle, header.firstChild);
        }

        if (!controls.contains(btn)) {
            controls.insertBefore(btn, controls.firstChild);
        }

        header.classList.add('events-manage-header--story-empty');
    }

    /**
     * Restore toolbar toggle into header and show header again.
     */
    _restoreStoryArchiveCompactChrome(eventsManagePanel) {
        const header = eventsManagePanel?.querySelector('.events-manage-header');
        const controls = document.getElementById('eventsManageControls');
        const btn = document.getElementById('eventsManageToolbarToggleBtn');
        if (!header || !controls || !btn) return;

        header.classList.remove('events-manage-header--story-empty');

        const titleRow = header.querySelector('.events-manage-title-row');
        if (titleRow && controls.contains(btn)) {
            titleRow.appendChild(btn);
        }
    }

    /**
     * Restore Add/Save/Export to header and pagination after #eventsList (Event Manager layout).
     */
    _teardownStoryArchiveBottomBar(eventsManagePanel) {
        const bottomBar = document.getElementById('storyArchiveBottomBar');
        const list = document.getElementById('eventsList');
        const header = eventsManagePanel?.querySelector('.events-manage-header');
        if (!bottomBar || !eventsManagePanel?.contains(bottomBar) || !list?.parentNode || !header) return;

        const secondary = eventsManagePanel.querySelector('.events-manage-search-row--secondary');
        const rightToolbar = document.getElementById('storyArchiveRightToolbar');
        if (secondary && rightToolbar) {
            const useFilter = document.getElementById('eventsUseFilterSelectionCheckbox')?.closest('label.events-search-checkbox');
            const perPage = document.getElementById('eventsPerPageInput')?.closest('.events-per-page-group');
            const showAllLabel = document.getElementById('eventsShowAllCheckbox')?.closest('label.events-search-checkbox');
            const clearBtn = document.getElementById('eventsSearchClear');
            [showAllLabel, perPage].forEach((el) => el?.classList.remove('story-viewer-bottom-bar-control'));

            const ordered = [useFilter, perPage, showAllLabel, clearBtn].filter(Boolean);
            ordered.forEach((el) => secondary.appendChild(el));
            rightToolbar.remove();
        }

        const pag = document.getElementById('eventsPagination');
        const actions = bottomBar.querySelector('.events-manage-actions');
        if (pag && bottomBar.contains(pag)) {
            list.parentNode.insertBefore(pag, bottomBar);
        }
        if (actions) {
            header.appendChild(actions);
        }
        bottomBar.remove();
    }

    /**
     * Create the Data Archive shell: category hub first; events list mounts after user taps **Story**.
     * Uses the same `#eventsManagePanel` flow as before, deferred until `_enterStoryArchiveEventsView()`.
     */
    async createStoryViewerPanel() {
        let storyContainer = document.getElementById('storyViewerContainer');
        const eventsManagePanel = document.getElementById('eventsManagePanel');

        if (this._storyArchiveEventsPanelMounted()) {
            storyContainer.style.display = 'flex';
            if (eventsManagePanel) {
                this._setupStoryArchiveBottomBar(eventsManagePanel);
                this._setupStoryArchiveCompactChrome(eventsManagePanel);
                this._hideStoryArchiveEventManagerClose(eventsManagePanel);
                applyStoryArchiveGridSquishFromDefaults(eventsManagePanel);
                this._ensureStoryArchiveBackToCategoriesButton(eventsManagePanel);
                const curArchive =
                    window.eventManager?.dataService?.getArchiveSource?.() || 'story';
                this._updateStoryArchiveCategoryStripActive(curArchive);
            }
            requestAnimationFrame(() => {
                storyContainer.classList.add('active');
            });
            return;
        }

        if (storyContainer?.querySelector('#storyArchiveCategoryHub')) {
            storyContainer.style.display = 'flex';
            this._attachStoryArchiveHubDismissChrome();
            requestAnimationFrame(() => {
                storyContainer.classList.add('active');
            });
            return;
        }

        this._prepareStoryArchiveShell();

        if (!eventsManagePanel) {
            updateStatus('⚠ Event Manager panel not found', 'error');
            return;
        }

        if (!storyContainer) {
            storyContainer = document.createElement('div');
            storyContainer.id = 'storyViewerContainer';
            storyContainer.className = 'story-viewer-container story-viewer-container--hub';
            storyContainer.appendChild(this._buildStoryArchiveCategoryHub());

            const content = document.getElementById('content');
            if (content) {
                content.appendChild(storyContainer);
            } else {
                document.body.appendChild(storyContainer);
            }

            requestAnimationFrame(() => {
                storyContainer.classList.add('active');
            });

            this._attachStoryArchiveHubDismissChrome();
            updateStatus('✓ Data Archive — choose a category', 'success');
            return;
        }
    }

    /**
     * Wire up event handlers for Data Archive - mirrors Event Manager
     */
    wireStoryViewerHandlers() {
        const self = this;

        // Search input
        const searchInput = document.getElementById('storyViewerSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterStoryViewerEvents();
            });
        }

        // Filters input with suggestions
        const filtersInput = document.getElementById('storyViewerSearchFilters');
        if (filtersInput) {
            filtersInput.addEventListener('input', (e) => {
                this.updateStoryViewerFilterPredictions();
                this.filterStoryViewerEvents();
            });
            filtersInput.addEventListener('focus', () => {
                this.updateStoryViewerFilterPredictions();
            });
        }

        // Country input with suggestions
        const countryInput = document.getElementById('storyViewerSearchCountry');
        if (countryInput) {
            countryInput.addEventListener('input', (e) => {
                this.updateStoryViewerCountryPredictions();
                this.filterStoryViewerEvents();
            });
            countryInput.addEventListener('focus', () => {
                this.updateStoryViewerCountryPredictions();
            });
        }

        // Clear button
        const clearBtn = document.getElementById('storyViewerSearchClear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearStoryViewerSearch();
            });
        }

        // Per page input
        const perPageInput = document.getElementById('storyViewerPerPageInput');
        if (perPageInput) {
            perPageInput.addEventListener('change', () => {
                this.renderStoryViewerEvents(window.eventManager.events);
            });
        }

        // Show all checkbox
        const showAllCheckbox = document.getElementById('storyViewerShowAllCheckbox');
        if (showAllCheckbox) {
            showAllCheckbox.addEventListener('change', () => {
                this.renderStoryViewerEvents(window.eventManager.events);
            });
        }

        // Use filter selection checkbox
        const useFilterCheckbox = document.getElementById('storyViewerUseFilterSelectionCheckbox');
        if (useFilterCheckbox) {
            useFilterCheckbox.addEventListener('change', () => {
                this.filterStoryViewerEvents();
            });
        }

        // Toolbar toggle
        const toolbarToggle = document.getElementById('storyViewerToolbarToggleBtn');
        if (toolbarToggle) {
            toolbarToggle.addEventListener('click', () => {
                const controls = document.getElementById('storyViewerControls');
                if (controls) {
                    controls.classList.toggle('collapsed');
                    toolbarToggle.textContent = controls.classList.contains('collapsed') ? 'Show controls' : 'Hide controls';
                    toolbarToggle.setAttribute('aria-pressed', !controls.classList.contains('collapsed'));
                }
            });
        }

        updateStatus('✓ Data Archive handlers wired', 'success');
    }

    /**
     * Filter events in Data Archive - mirrors Event Manager logic
     */
    filterStoryViewerEvents() {
        if (!window.eventManager || !window.eventManager.events) return;

        const searchInput = document.getElementById('storyViewerSearchInput');
        const filtersInput = document.getElementById('storyViewerSearchFilters');
        const countryInput = document.getElementById('storyViewerSearchCountry');
        const useFilterCheckbox = document.getElementById('storyViewerUseFilterSelectionCheckbox');

        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const filterTerms = filtersInput ? filtersInput.value.toLowerCase().split(',').map(s => s.trim()).filter(s => s) : [];
        const countryTerms = countryInput ? countryInput.value.toLowerCase().split(',').map(s => s.trim()).filter(s => s) : [];
        const useFilterSelection = useFilterCheckbox ? useFilterCheckbox.checked : true;

        // Get active filters from Filter panel if checkbox is checked
        let activeFilterSet = new Set();
        if (useFilterSelection && window.standaloneActiveFilters) {
            activeFilterSet = window.standaloneActiveFilters;
        }

        // Filter events
        const filtered = window.eventManager.events.filter(event => {
            // Title search
            if (searchTerm && !event.name.toLowerCase().includes(searchTerm)) {
                return false;
            }

            // Filter tags (heroes, factions, NPCs)
            if (filterTerms.length > 0) {
                const S = window.StoryFilterPlacesSync;
                const eventTags = [
                    ...(S?.getStoryEventHeroTokens?.(event) || event.heroes || []),
                    ...(S?.getStoryEventFactionTokens?.(event) || event.factions || []),
                    ...(S?.getStoryEventNpcTokens?.(event) || event.npcs || [])
                ].map(t => t.toLowerCase());
                
                const hasMatch = filterTerms.some(term => 
                    eventTags.some(tag => tag.includes(term))
                );
                if (!hasMatch) return false;
            }

            // Filter panel selection
            if (useFilterSelection && activeFilterSet.size > 0) {
                const S = window.StoryFilterPlacesSync;
                const eventTags = [
                    ...(S?.getStoryEventHeroTokens?.(event) || event.heroes || []),
                    ...(S?.getStoryEventFactionTokens?.(event) || event.factions || []),
                    ...(S?.getStoryEventNpcTokens?.(event) || event.npcs || [])
                ].map(t => t.toLowerCase());
                
                const hasMatch = Array.from(activeFilterSet).some(filter => 
                    eventTags.some(tag => tag.includes(filter.toLowerCase()))
                );
                if (!hasMatch) return false;
            }

            // Country search
            if (countryTerms.length > 0) {
                const eventCountries = (event.countries || []).map(c => c.toLowerCase());
                const hasMatch = countryTerms.some(term =>
                    eventCountries.some(country => country.includes(term))
                );
                if (!hasMatch) return false;
            }

            return true;
        });

        this.renderStoryViewerEvents(filtered);
        
        // DEV ONLY: Re-apply red styling after filter
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setTimeout(() => {
                applyStoryArchiveOverlapDevStyling(document.getElementById('eventsManagePanel'));
            }, 250);
        }
    }

    /**
     * Render events in Data Archive - mirrors Event Manager rendering
     */
    renderStoryViewerEvents(events) {
        console.log('[ComponentOrchestrator] renderStoryViewerEvents called with', events.length, 'events');
        const list = document.getElementById('storyViewerList');
        const countDisplay = document.getElementById('storyViewerCount');
        if (!list) {
            console.log('[ComponentOrchestrator] storyViewerList not found');
            return;
        }

        // Update count
        if (countDisplay) {
            countDisplay.textContent = `${events.length} Event${events.length !== 1 ? 's' : ''}`;
        }

        // Get pagination settings
        const perPageInput = document.getElementById('storyViewerPerPageInput');
        const showAllCheckbox = document.getElementById('storyViewerShowAllCheckbox');
        
        const showAll = showAllCheckbox ? showAllCheckbox.checked : false;
        const perPage = showAll ? events.length : (perPageInput ? parseInt(perPageInput.value) || 50 : 50);

        console.log('[ComponentOrchestrator] Using EventRenderService:', !!window.eventRenderService);

        // Use EventRenderService for consistent rendering with overlap detection
        if (window.eventRenderService) {
            const fullList = window.eventManager?.events || events;
            const eventsToShow = events.slice(0, perPage);
            
            console.log('[ComponentOrchestrator] Rendering', eventsToShow.length, 'events via EventRenderService');
            
            // Render using EventRenderService to get overlap styling
            window.eventRenderService.renderEvents(
                eventsToShow,
                list,
                1,
                perPage,
                () => {}, // No drag/drop needed for Data Archive
                false // Don't show pagination controls in Data Archive
            );
            
            // Add click handlers for opening events
            const items = list.querySelectorAll('.event-item');
            items.forEach((item, index) => {
                item.addEventListener('click', () => {
                    const event = eventsToShow[index];
                    this.openStoryEvent(event, index);
                });
            });
            
            // DEV ONLY: Apply red styling after render
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                setTimeout(() => {
                    const overlapBadges = list.querySelectorAll('.event-number-badge--overlap');
                    console.log('[ComponentOrchestrator] renderStoryViewerEvents: Found', overlapBadges.length, 'overlap badges, applying red styling');
                    overlapBadges.forEach((badge) => {
                        badge.style.setProperty('color', '#ff4444', 'important');
                        badge.style.setProperty('text-shadow', '0 1px 3px rgba(0, 0, 0, 0.85), 0 2px 12px rgba(0, 0, 0, 0.45)', 'important');
                    });
                }, 150);
            }
            
            return;
        }

        // Fallback to simple render if EventRenderService not available
        console.log('[ComponentOrchestrator] EventRenderService not available, using fallback render');
        list.innerHTML = '';
        
        const eventsToShow = events.slice(0, perPage);
        
        eventsToShow.forEach((event, index) => {
            const item = document.createElement('div');
            item.className = 'event-item';
            item.dataset.eventId = event.id;
            item.innerHTML = `
                <div class="event-item-preview-image">
                    <img src="${event.image || 'src/assets/images/Archive/Events/default.png'}" alt="${event.name}" />
                </div>
                <div class="event-item-info">
                    <h3 class="event-item-title">${event.name}</h3>
                    <div class="event-item-meta">
                        <span class="event-item-year">${event.year || ''}</span>
                        <span class="event-item-location">${event.location || ''}</span>
                    </div>
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.openStoryEvent(event, index);
            });
            
            list.appendChild(item);
        });

        // Render pagination if needed
        if (!showAll && events.length > perPage) {
            this.renderStoryViewerPagination(events.length, perPage);
        }
    }

    /**
     * Render pagination for Data Archive
     */
    renderStoryViewerPagination(total, perPage) {
        const pagination = document.getElementById('storyViewerPagination');
        if (!pagination) return;

        const totalPages = Math.ceil(total / perPage);
        pagination.innerHTML = '';

        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.className = 'story-viewer-pagination-btn';
            btn.textContent = i;
            btn.addEventListener('click', () => {
                this.goToStoryViewerPage(i, perPage);
            });
            pagination.appendChild(btn);
        }
    }

    /**
     * Go to specific page in Data Archive
     */
    goToStoryViewerPage(page, perPage) {
        // Implementation would track current page and re-render
        updateStatus(`Data Archive: Page ${page} selected`, 'info');
        
        // DEV ONLY: Re-apply red styling after page change
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setTimeout(() => {
                applyStoryArchiveOverlapDevStyling(document.getElementById('eventsManagePanel'));
            }, 250);
        }
    }

    /**
     * Update filter predictions dropdown
     */
    updateStoryViewerFilterPredictions() {
        // Mirror the filter predictions from EventListenerService
        if (window.EventListenerService && window.EventListenerService._updateFilterPredictions) {
            // Reuse existing logic
        }
    }

    /**
     * Update country predictions dropdown
     */
    updateStoryViewerCountryPredictions() {
        // Mirror the country predictions from EventListenerService
    }

    /**
     * Clear all search filters in Data Archive
     */
    clearStoryViewerSearch() {
        const searchInput = document.getElementById('storyViewerSearchInput');
        const filtersInput = document.getElementById('storyViewerSearchFilters');
        const countryInput = document.getElementById('storyViewerSearchCountry');

        if (searchInput) searchInput.value = '';
        if (filtersInput) filtersInput.value = '';
        if (countryInput) countryInput.value = '';

        this.renderStoryViewerEvents(window.eventManager.events);
    }

    /**
     * Open a specific event in story mode
     */
    openStoryEvent(event, index) {
        const ss = window.standaloneEventSlide;
        if (ss) {
            ss._presentationFromDockTimeline = true;
        }
        // Use the existing event slide system but in story context
        if (ss?.showStandaloneEventSlide) {
            ss.showStandaloneEventSlide(event, index);
        } else if (window.MenuHelpers && window.MenuHelpers.showStandaloneEventSlide) {
            window.MenuHelpers.showStandaloneEventSlide(event, index);
        } else if (window.MenuServiceHelpers && window.MenuServiceHelpers.showStandaloneEventSlide) {
            window.MenuServiceHelpers.showStandaloneEventSlide(event, index);
        }
    }

    /**
     * Kill all Menu Components
     */
    async killMenuComponents() {
        updateStatus('Killing all Menu Components...', 'info');
        
        if (this.loadedComponents.menu) {
            await this.unloaders.menu();
        }
        
        updateStatus('✓ All Menu Components killed!', 'success');
    }

    /**
     * Kill all Universal Features
     */
    async killUniversalFeatures() {
        updateStatus('Killing all Universal Features...', 'info');
        
        if (this.loadedComponents.palette) {
            await this.unloaders.palette();
        }
        
        if (this.loadedComponents.music) {
            await this.unloaders.music();
        }
        
        updateStatus('✓ All Universal Features killed!', 'success');
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
     * Kill all Globe Components
     */
    async killGlobeComponents() {
        updateStatus('Killing all Globe Components...', 'info');
        
        // Check if Event System Load Out is active
        const eventSystemActive = this.isEventSystemLoadOutActive();
        
        // Unload in reverse order (dependencies first)
        // Only unload events if Event System is NOT active
        if (this.loadedComponents.events && !eventSystemActive) {
            await this.unloaders.events();
        } else if (eventSystemActive) {
            updateStatus('→ Event System active, preserving events UI', 'info');
        }
        
        if (this.loadedComponents.controls) {
            await this.unloaders.controls();
        }
        
        if (this.loadedComponents.transport) {
            await this.unloaders.transport();
        }
        
        if (this.loadedComponents.globeBase) {
            // Preserve events UI if Event System is still active
            if (this.unloaders.globeBase && typeof this.unloaders.globeBase === 'function') {
                await this.unloaders.globeBase({ preserveEventsUi: eventSystemActive });
            }
        }
        
        // Restore the menu (test-container) when killing globe components
        // This will also load menu if not already loaded
        // Preserve news ticker when switching to other modes (not actually returning to menu)
        await this.restoreMainMenu(true);

        // Clear globeEventMarkerManager to ensure markers are recreated on reload
        window.globeEventMarkerManager = null;

        // Clear mode from localStorage (consistent with other modes)
        clearCurrentMode();

        updateStatus('✓ All Globe Components killed!', 'success');
    }

    /**
     * Kill all Glossary Components
     * Exits Codex mode and restores main menu
     */
    async killGlossaryComponents() {
        updateStatus('Killing all Glossary Components...', 'info');

        // Exit Codex mode via globe container unload (preserves events UI if needed)
        if (window.unloadGlobeBase && typeof window.unloadGlobeBase === 'function') {
            try {
                await window.unloadGlobeBase({ preserveEventsUi: false });
            } catch (err) {
                console.warn('Error unloading globe base during glossary kill:', err);
            }
        }

        // Clear codex shell if present
        if (window.CodexModeService && typeof window.CodexModeService.clearCodexShellForGlobeInit === 'function') {
            window.CodexModeService.clearCodexShellForGlobeInit();
        }

        // Restore the menu (test-container) - consistent with other modes
        await this.restoreMainMenu();

        clearCurrentMode();
        this.loadedComponents.glossary = false;

        updateStatus('✓ All Glossary Components killed!', 'success');
    }

    /**
     * Kill all Biography Components (Data Archive)
     * @param {boolean} [restoreMenu=true] - Whether to restore main menu (false when switching to another mode)
     */
    async killBiographyComponents(restoreMenu = true) {
        updateStatus('Exiting Data Archive...', 'info');

        this._detachStoryArchiveHubDismissChrome();

        const eventsManagePanel = document.getElementById('eventsManagePanel');
        if (eventsManagePanel && this._originalEventsPanelParent) {
            this._detachEventsManagePanelFromStoryArchive(eventsManagePanel);
        }

        if (window.eventManager?.dataService?.setArchiveSource) {
            window.eventManager.dataService.setArchiveSource('story');
        }
        try {
            if (window.eventManager?.loadEvents) {
                await window.eventManager.loadEvents();
            }
        } catch (e) {
            console.warn('[ComponentOrchestrator] Restoring main timeline after Data Archive failed:', e);
        }
        if (window.eventManager?.renderEvents) {
            window.eventManager.renderEvents();
        }

        const eventManagerBtnRestore = document.getElementById('eventsManageToggle');
        if (eventManagerBtnRestore) {
            eventManagerBtnRestore.style.removeProperty('display');
        }

        this._disconnectStoryArchiveOverlapObserver();
        
        // Remove data archive viewer container
        const storyContainer = document.getElementById('storyViewerContainer');
        if (storyContainer) {
            storyContainer.classList.remove('active');
            setTimeout(() => {
                storyContainer.remove();
            }, 300);
        }

        // Restore the menu (test-container) only if not switching to another mode
        if (restoreMenu) {
            await this.restoreMainMenu();
        }

        clearCurrentMode();
        this.loadedComponents.biography = false;
        
        updateStatus('✓ Data Archive exited!', 'success');
    }
}
