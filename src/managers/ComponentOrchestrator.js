/**
 * ComponentOrchestrator - Handles orchestration of component loading/unloading (run/kill operations)
 * Extracted from component-loader.js to improve maintainability
 */

import { showLoadingOverlay, hideLoadingOverlay, setRunOperation, getRunOperation } from './LoadingOverlayManager.js';
import { updateStatus, updateGlobeComponentsProgress, resetGlobeComponentsProgress } from './StatusManager.js';

/**
 * ComponentOrchestrator class
 * Orchestrates loading and unloading of component groups
 */
export class ComponentOrchestrator {
    constructor(loadedComponents, loaders, unloaders) {
        this.loadedComponents = loadedComponents;
        this.loaders = loaders; // Object with load functions: { palette: loadPalette, music: loadMusic, ... }
        this.unloaders = unloaders; // Object with unload functions: { palette: unloadPalette, music: unloadMusic, ... }
        /** @type {HTMLElement|null} Event Manager × removed from DOM while Story Archive is open */
        this._storyArchiveDetachedClose = null;
    }

    dispatchAppModeChange(mode) {
        try {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('appmodechange', { detail: { mode } }));
            }
        } catch (e) {
            // Non-fatal; mode switching should still work even if CustomEvent is unavailable.
            console.warn('dispatchAppModeChange failed:', e);
        }
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
                window.SoundEffectsManager.loadSound('modeSwitch', 'assets/audio/sfx/Mode Switch.mp3');
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
        const isRunOperation = getRunOperation();
        // Note: isRunOperation and overlay should already be set by the button click handler
        // But if called directly (not from button), set them here
        if (!isRunOperation) {
            setRunOperation(true);
            showLoadingOverlay();
        }
        updateStatus('🚀 Running Menu Components...', 'info');
        
        try {
            // If menu is not loaded, load it first
            if (!this.loadedComponents.menu) {
                updateStatus('→ Menu not loaded, loading now...', 'info');
                await this.loaders.menu();
            } else {
                updateStatus('→ Menu already loaded', 'info');
            }
            
            // Ensure menu is visible
            const testContainer = document.querySelector('.test-container');
            const menuButtons = testContainer ? testContainer.querySelector('.main-menu-buttons') : null;
            
            if (menuButtons) {
                menuButtons.style.display = 'flex';
                updateStatus('✓ Menu Components are running!', 'success');
                this.dispatchAppModeChange('menu');
            } else {
                updateStatus('⚠ Menu buttons not found', 'error');
            }
        } catch (error) {
            console.error('Error running Menu Components:', error);
            updateStatus(`✗ Error running Menu Components: ${error.message}`, 'error');
        } finally {
            setRunOperation(false);
            hideLoadingOverlay();
        }
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

            // Always ensure header nav buttons exist (Interactive Globe, Connection Codex, Story Archive, Home)
            // NOTE: Events and Filters buttons are now created by standalone Event System Load Out only
            if (this.loaders.headerNav) {
                this.loaders.headerNav();
            }
            
            updateStatus('✓ Universal Features auto-load complete!', 'success');
        } catch (error) {
            console.error('Error in Universal Features auto-load:', error);
            updateStatus(`✗ Error in Universal Features auto-load: ${error.message}`, 'error');
        } finally {
            // If we're in a boot chain (e.g., page-init), keep the overlay up
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
     * Run all Globe Components sequentially
     * Loads: Globe Base, then Transport, then Controls, then Events
     */
    async runGlobeComponents(isAutoLoad = false) {
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

        // Kill other modes first (mutual exclusion)
        const currentMode = localStorage.getItem('currentMode');
        if (currentMode === 'biography' && this.loadedComponents.biography) {
            await this.killBiographyComponents(false); // Don't restore menu when switching to Globe
        }
        if (currentMode === 'glossary' && this.loadedComponents.glossary) {
            await this.killGlossaryComponents();
        }

        // Save current mode to localStorage
        localStorage.setItem('currentMode', 'globe');

        const runBtn = document.getElementById('runGlobeBtn');
        if (runBtn) {
            runBtn.disabled = true;
        }

        // Reset progress
        resetGlobeComponentsProgress();

        // Hide the test-container completely (which contains the main menu buttons)
        const testContainer = document.querySelector('.test-container');
        if (testContainer) {
            testContainer.style.display = 'none';
            updateStatus('→ Hiding menu container...', 'info');
        }

        const globeContainer = document.getElementById('globe-container');
        if (globeContainer) {
            globeContainer.style.width = '100%';
            globeContainer.style.height = '100%';
            globeContainer.style.display = 'none';
            updateStatus('→ Preparing globe container...', 'info');
        }

        updateStatus('🚀 Starting Globe Components auto-load...', 'info');

        const isRunOperation = getRunOperation();
        // Note: isRunOperation and overlay should already be set by the button click handler
        // But if called directly (not from button), set them here
        if (!isRunOperation) {
            setRunOperation(true);
            showLoadingOverlay();
            await new Promise(r => setTimeout(r, 50));
        }
        
        try {
            // Load Globe Base
            if (!this.loadedComponents.globeBase) {
                updateStatus('→ Loading Globe Base...', 'info');
                await this.loaders.globeBase();
                // Show globe container immediately after Globe Base loads
                if (globeContainer) {
                    globeContainer.style.opacity = '1';
                    globeContainer.style.pointerEvents = 'auto';
                    globeContainer.style.display = 'block';
                    globeContainer.classList.add('loaded');
                }
                updateGlobeComponentsProgress(1);
                // Small delay between loads
                await new Promise(r => setTimeout(r, 300));
            } else {
                updateStatus('→ Globe Base already loaded, skipping...', 'info');
                // If already loaded, make sure globe is visible
                if (globeContainer) {
                    globeContainer.style.opacity = '1';
                    globeContainer.style.pointerEvents = 'auto';
                    globeContainer.style.display = 'block';
                    globeContainer.classList.add('loaded');
                }
                updateGlobeComponentsProgress(1);
            }
            
            // Load Transport
            if (!this.loadedComponents.transport) {
                updateStatus('→ Loading Transport...', 'info');
                await this.loaders.transport();
                updateGlobeComponentsProgress(2);
                await new Promise(r => setTimeout(r, 300));
            } else {
                updateStatus('→ Transport already loaded, skipping...', 'info');
                updateGlobeComponentsProgress(2);
            }
            
            // Load Controls (always reload to ensure rotation slider is repositioned)
            updateStatus('→ Loading Controls...', 'info');
            // Check localStorage for map/globe pre-toggle preference
            const startOnMap = localStorage.getItem('mapGlobePreToggle') === 'true';
            // Set sceneModel to the preferred view BEFORE loading controls so setupMapViewToggle uses correct state
            if (window.globeController?.sceneModel) {
                if (window.globeController.sceneModel.setMapViewEnabled) {
                    window.globeController.sceneModel.setMapViewEnabled(startOnMap);
                } else {
                    window.globeController.sceneModel.isMapView = startOnMap;
                }
            }
            // Also call controller's setMapViewEnabled to actually trigger the view switch
            if (window.globeController && typeof window.globeController.setMapViewEnabled === 'function') {
                window.globeController.setMapViewEnabled(startOnMap);
            }
            await this.loaders.controls();
            // Call setupMapViewToggle again after loading controls to ensure correct state
            if (window.globeController?.uiView?.setupMapViewToggle) {
                window.globeController.uiView.setupMapViewToggle();
            }
            // Ensure rotate-subbar-open class is set on body (shows rotation slider) - do this AFTER setupMapViewToggle
            document.body.classList.add('rotate-subbar-open');
            // Show rotation subbar and reset position
            const rotateSubBar = document.getElementById('headerRotateSubBar');
            if (rotateSubBar) {
                rotateSubBar.style.display = 'block';
                rotateSubBar.style.top = '0';
                rotateSubBar.style.left = '0';
            }
            updateGlobeComponentsProgress(3);
            await new Promise(r => setTimeout(r, 300));
            
            // NOTE: Footer styling removed - Event System Load Out handles this when it loads
            
            // If Event System is already loaded, create EventMarkerManager for Globe markers
            console.log(`[ComponentOrchestrator] Checking marker creation: eventSystemActive=${this.isEventSystemLoadOutActive()}, globeController=${!!window.globeController?.sceneModel}, markerManager=${!!window.globeEventMarkerManager}`);
            if (this.isEventSystemLoadOutActive() && window.globeController?.sceneModel && !window.globeEventMarkerManager) {
                console.log('[ComponentOrchestrator] Creating EventMarkerManager for Globe...');
                updateStatus('→ Event System detected, creating event markers...', 'info');
                const { EventMarkerManager } = await import('../managers/EventMarkerManager.js');
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
            
            // Ensure header hub state updates even when globe is started from the main menu button
            // (which runs loaders directly and doesn't go through appModeSwitch()).
            this.dispatchAppModeChange('globe');
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

        // Kill other modes first (mutual exclusion)
        const currentMode = localStorage.getItem('currentMode');
        if (currentMode === 'biography' && this.loadedComponents.biography) {
            await this.killBiographyComponents();
        }
        if (currentMode === 'globe' && this.loadedComponents.globeBase) {
            await this.killGlobeComponents();
        }

        // Save current mode to localStorage
        localStorage.setItem('currentMode', 'glossary');

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
            // Hide test-container (consistent with other modes)
            const testContainer = document.querySelector('.test-container');
            if (testContainer) {
                testContainer.style.display = 'none';
                updateStatus('→ Hiding menu container...', 'info');
            }

            // Enter Codex mode via CodexModeService
            if (window.CodexModeService && typeof window.CodexModeService.enterCodexMode === 'function') {
                await window.CodexModeService.enterCodexMode();
            } else {
                updateStatus('→ CodexModeService not available', 'error');
            }

            // Ensure header hub state updates
            this.dispatchAppModeChange('glossary');

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
     * Story Archive mode - displays events in a centered panel
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

        // Kill other modes first (mutual exclusion)
        const currentMode = localStorage.getItem('currentMode');
        if (currentMode === 'glossary' && this.loadedComponents.glossary) {
            await this.killGlossaryComponents();
        }
        if (currentMode === 'globe' && this.loadedComponents.globeBase) {
            await this.killGlobeComponents();
        }

        // Save current mode to localStorage
        localStorage.setItem('currentMode', 'biography');
        
        const runBtn = document.getElementById('runBiographyBtn');
        if (runBtn) {
            runBtn.disabled = true;
        }
        
        const isRunOperation = getRunOperation();
        if (!isRunOperation) {
            setRunOperation(true);
            showLoadingOverlay();
        }
        updateStatus('🚀 Starting Story Archive...', 'info');
        
        try {
            // Hide test-container (consistent with other modes)
            const testContainer = document.querySelector('.test-container');
            if (testContainer) {
                testContainer.style.display = 'none';
                updateStatus('→ Hiding menu container...', 'info');
            }
            
            // Create and show the Story Archive panel
            await this.createStoryViewerPanel();
            
            // Minimum loading time for visual consistency (800ms)
            await new Promise(r => setTimeout(r, 800));

            // Ensure header hub state updates
            this.dispatchAppModeChange('biography');
            
            this.loadedComponents.biography = true;
            updateStatus('✓ Story Archive loaded!', 'success');
        } catch (error) {
            console.error('Error in Story Archive load:', error);
            updateStatus(`✗ Error in Story Archive load: ${error.message}`, 'error');
        } finally {
            setRunOperation(false);
            hideLoadingOverlay();
            if (runBtn) {
                runBtn.disabled = false;
            }
        }
    }

    /** 0 = widest grid, 100 = most inset (narrower column + larger gutters). */
    _storyArchiveSquishToLayout(squish0to100) {
        const t = Math.min(100, Math.max(0, squish0to100)) / 100;
        const gutter = 10 + t * 70;
        const maxW = Math.round(3000 - t * 1900);
        return { gutter, maxW };
    }

    _applyStoryArchiveGridSquish(eventsManagePanel, squish0to100) {
        if (!eventsManagePanel) return;
        const { gutter, maxW } = this._storyArchiveSquishToLayout(squish0to100);
        eventsManagePanel.style.setProperty('--story-archive-list-gutter', `${gutter}px`);
        eventsManagePanel.style.setProperty('--story-archive-list-max-width', `${maxW}px`);
    }

    /**
     * Apply grid inset from localStorage key storyArchiveGridSquish, else default (5).
     * No UI — values were tuned with the removed slider; optional override remains in localStorage.
     */
    _applyStoryArchiveGridSquishFromPreferences(eventsManagePanel) {
        if (!eventsManagePanel || !eventsManagePanel.classList.contains('story-viewer-panel-embedded')) {
            return;
        }
        const LS_KEY = 'storyArchiveGridSquish';
        const DEFAULT_SQUISH = 5;
        const n = parseInt(window.localStorage.getItem(LS_KEY), 10);
        const squishVal = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : DEFAULT_SQUISH;
        this._applyStoryArchiveGridSquish(eventsManagePanel, squishVal);
    }

    /** Event Manager × — removed from DOM in Story Archive (never use getElementById: wrong node if duplicate ids). */
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
     * Move Show all, Per page, Clear into bottom bar (right column), matching Add/Save/Export row.
     */
    _populateStoryArchiveRightToolbar(eventsManagePanel, bottomBar) {
        if (!bottomBar || document.getElementById('storyArchiveRightToolbar')) return;

        const secondary = eventsManagePanel.querySelector('.events-manage-search-row--secondary');
        if (!secondary) return;

        const showAllLabel = document.getElementById('eventsShowAllCheckbox')?.closest('label.events-search-checkbox');
        const perPage = document.getElementById('eventsPerPageInput')?.closest('.events-per-page-group');
        const clearBtn = document.getElementById('eventsSearchClear');

        const wrap = document.createElement('div');
        wrap.id = 'storyArchiveRightToolbar';
        wrap.className = 'story-archive-right-toolbar';

        const addControlClass = (el) => {
            if (!el) return;
            el.classList.add('story-viewer-bottom-bar-control');
        };

        if (showAllLabel && secondary.contains(showAllLabel)) {
            addControlClass(showAllLabel);
            wrap.appendChild(showAllLabel);
        }
        if (perPage && secondary.contains(perPage)) {
            addControlClass(perPage);
            wrap.appendChild(perPage);
        }
        if (clearBtn && secondary.contains(clearBtn)) {
            clearBtn.classList.add('story-viewer-action-btn');
            wrap.appendChild(clearBtn);
        }

        if (wrap.childNodes.length === 0) {
            return;
        }

        bottomBar.appendChild(wrap);
    }

    /**
     * Story Archive: hide header (title + count). Only “Show controls” moves above Search & filters.
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
            clearBtn?.classList.remove('story-viewer-action-btn');
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
     * Create the Story Archive - takes over center space like Globe/Codex
     * Uses actual Event Manager panel but displayed in center
     */
    async createStoryViewerPanel() {
        // Check if already exists
        let storyContainer = document.getElementById('storyViewerContainer');
        if (storyContainer) {
            storyContainer.style.display = 'flex';
            storyContainer.classList.add('active');
            const emp = document.getElementById('eventsManagePanel');
            if (emp) {
                this._setupStoryArchiveBottomBar(emp);
                this._setupStoryArchiveCompactChrome(emp);
                this._hideStoryArchiveEventManagerClose(emp);
                this._applyStoryArchiveGridSquishFromPreferences(emp);
            }
            return;
        }

        // Hide the test-container (main menu buttons)
        const testContainer = document.querySelector('.test-container');
        if (testContainer) {
            testContainer.style.display = 'none';
        }

        // Hide the Event Manager button since Story Archive uses the panel
        const eventManagerBtn = document.getElementById('eventsManageToggle');
        if (eventManagerBtn) {
            eventManagerBtn.style.setProperty('display', 'none', 'important');
        }

        // Get the actual eventsManagePanel and move it to center
        const eventsManagePanel = document.getElementById('eventsManagePanel');
        if (!eventsManagePanel) {
            updateStatus('⚠ Event Manager panel not found', 'error');
            return;
        }

        // Create story archive container
        storyContainer = document.createElement('div');
        storyContainer.id = 'storyViewerContainer';
        storyContainer.className = 'story-viewer-container';
        
        // Move the eventsManagePanel into story archive container
        // Store original parent to restore later
        this._originalEventsPanelParent = eventsManagePanel.parentNode;
        this._originalEventsPanelClasses = eventsManagePanel.className;
        
        // Change panel to be centered instead of side panel
        eventsManagePanel.classList.remove('events-manage-panel');
        eventsManagePanel.classList.add('story-viewer-panel-embedded');
        eventsManagePanel.style.right = 'auto';
        eventsManagePanel.style.position = 'relative';
        eventsManagePanel.style.width = '100%';
        eventsManagePanel.style.height = '100%';
        eventsManagePanel.style.top = 'auto';
        eventsManagePanel.style.bottom = 'auto';
        
        // Move panel into story container
        storyContainer.appendChild(eventsManagePanel);
        
        // Add story-viewer-header class to the header
        const header = eventsManagePanel.querySelector('.events-manage-header');
        if (header) {
            header.classList.add('story-viewer-header');
        }
        
        // Add/Save/Export styling; DOM row is built in _setupStoryArchiveBottomBar (with pagination)
        const addBtn = document.getElementById('addEventBtn');
        const saveBtn = document.getElementById('saveEventsBtn');
        const exportBtn = document.getElementById('exportEventsBtn');
        if (addBtn) addBtn.classList.add('story-viewer-action-btn');
        if (saveBtn) saveBtn.classList.add('story-viewer-action-btn');
        if (exportBtn) exportBtn.classList.add('story-viewer-action-btn');

        // Insert into main content area
        const content = document.getElementById('content');
        if (content) {
            content.appendChild(storyContainer);
        } else {
            document.body.appendChild(storyContainer);
        }

        // Open the panel
        eventsManagePanel.classList.add('open');

        this._setupStoryArchiveBottomBar(eventsManagePanel);
        this._setupStoryArchiveCompactChrome(eventsManagePanel);

        // Ensure EventManager renders to this panel
        if (window.eventManager) {
            window.eventManager.renderEvents();
        }

        this._hideStoryArchiveEventManagerClose(eventsManagePanel);
        this._applyStoryArchiveGridSquishFromPreferences(eventsManagePanel);

        // DEV ONLY: Debug - inspect actual DOM structure
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setTimeout(() => {
                console.log('[ComponentOrchestrator] Story Archive DOM inspection:');
                console.log('[ComponentOrchestrator] eventsManagePanel:', eventsManagePanel);
                console.log('[ComponentOrchestrator] eventsManagePanel.innerHTML length:', eventsManagePanel.innerHTML.length);
                
                const allBadges = eventsManagePanel.querySelectorAll('[class*="badge"], [class*="number"]');
                console.log('[ComponentOrchestrator] All badge/number elements:', allBadges.length);
                allBadges.forEach((el, i) => {
                    if (i < 5) {
                        console.log('[ComponentOrchestrator] Badge', i, ':', el.className, 'textContent:', el.textContent.trim());
                    }
                });
                
                const eventItems = eventsManagePanel.querySelectorAll('.event-item');
                console.log('[ComponentOrchestrator] Event items found:', eventItems.length);
                if (eventItems.length > 0) {
                    const firstItem = eventItems[0];
                    console.log('[ComponentOrchestrator] First event item HTML:', firstItem.innerHTML.substring(0, 500));
                }
            }, 300);
        }

        // DEV ONLY: Apply red styling to overlap badges in Story Archive
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setTimeout(() => {
                this._applyStoryArchiveOverlapStyling();
                
                // Set up MutationObserver to re-apply styling when DOM changes
                if (!this._storyArchiveObserver) {
                    this._storyArchiveObserver = new MutationObserver(() => {
                        this._applyStoryArchiveOverlapStyling();
                    });
                    this._storyArchiveObserver.observe(eventsManagePanel, {
                        childList: true,
                        subtree: true
                    });
                }
            }, 400);
        }

        // Show with animation
        requestAnimationFrame(() => {
            storyContainer.classList.add('active');
        });

        updateStatus('✓ Story Archive loaded with full Event Manager functionality', 'success');
    }

    /**
     * Wire up event handlers for Story Archive - mirrors Event Manager
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

        updateStatus('✓ Story Archive handlers wired', 'success');
    }

    /**
     * Filter events in Story Archive - mirrors Event Manager logic
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
                const eventTags = [
                    ...(event.heroes || []),
                    ...(event.factions || []),
                    ...(event.npcs || [])
                ].map(t => t.toLowerCase());
                
                const hasMatch = filterTerms.some(term => 
                    eventTags.some(tag => tag.includes(term))
                );
                if (!hasMatch) return false;
            }

            // Filter panel selection
            if (useFilterSelection && activeFilterSet.size > 0) {
                const eventTags = [
                    ...(event.heroes || []),
                    ...(event.factions || []),
                    ...(event.npcs || [])
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
                this._applyStoryArchiveOverlapStyling();
            }, 250);
        }
    }

    /**
     * Render events in Story Archive - mirrors Event Manager rendering
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
                () => {}, // No drag/drop needed for Story Archive
                false // Don't show pagination controls in Story Archive
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
                    <img src="${event.image || 'assets/images/events/default.png'}" alt="${event.name}" />
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
     * Render pagination for Story Archive
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
     * Go to specific page in Story Archive
     */
    goToStoryViewerPage(page, perPage) {
        // Implementation would track current page and re-render
        updateStatus(`Story Archive: Page ${page} selected`, 'info');
        
        // DEV ONLY: Re-apply red styling after page change
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setTimeout(() => {
                this._applyStoryArchiveOverlapStyling();
            }, 250);
        }
    }

    /**
     * DEV ONLY: Apply red styling to overlap badges in Story Archive
     */
    _applyStoryArchiveOverlapStyling() {
        const eventsManagePanel = document.getElementById('eventsManagePanel');
        if (!eventsManagePanel) return;
        
        const overlapBadges = eventsManagePanel.querySelectorAll('.event-number-badge--overlap');
        console.log('[ComponentOrchestrator] Story Archive: Found', overlapBadges.length, 'overlap badges, applying red styling');
        overlapBadges.forEach((badge) => {
            badge.style.setProperty('color', '#ff4444', 'important');
            badge.style.setProperty('text-shadow', '0 1px 3px rgba(0, 0, 0, 0.85), 0 2px 12px rgba(0, 0, 0, 0.45)', 'important');
        });
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
     * Clear all search filters in Story Archive
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
        // Use the existing event slide system but in story context
        if (window.MenuHelpers && window.MenuHelpers.showStandaloneEventSlide) {
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
        const testContainer = document.querySelector('.test-container');
        const globeContainer = document.getElementById('globe-container');
        
        // Ensure menu is loaded (reload if it was killed)
        if (!this.loadedComponents.menu) {
            updateStatus('Loading menu components...', 'info');
            await this.loaders.menu();
        }
        
        // Restore menu visibility - ensure it's fully visible
        const menuButtons = testContainer ? testContainer.querySelector('.main-menu-buttons') : null;
        if (testContainer) {
            testContainer.style.display = 'flex';
            testContainer.classList.remove('fading');
            testContainer.style.opacity = '1';
            testContainer.style.visibility = 'visible';
        }
        
        // Restore menu buttons visibility
        if (menuButtons) {
            menuButtons.style.display = 'flex';
            menuButtons.style.visibility = 'visible';
            menuButtons.style.opacity = '1';
        }
        
        // Hide globe and reset its positioning
        if (globeContainer) {
            globeContainer.style.display = 'none';
            globeContainer.classList.remove('loaded');
            globeContainer.style.position = '';
            globeContainer.style.top = '';
            globeContainer.style.left = '';
        }

        // Hide rotation subbar when returning to menu
        const rotateSubBar = document.getElementById('headerRotateSubBar');
        if (rotateSubBar) {
            rotateSubBar.style.display = 'none';
        }
        
        // Restore footer to dark blue with text when returning to main menu (unless preserving for mode switch)
        const footer = document.querySelector('footer');
        if (footer && !preserveNewsTicker) {
            footer.classList.remove('timeline-loaded');
        }

        // Clear/hide headlines ticker when returning to main menu (unless preserving for mode switch)
        if (!preserveNewsTicker) {
            if (window.newsTickerService && typeof window.newsTickerService.clear === 'function') {
                window.newsTickerService.clear();
            }
        }
        
        // Close any open panels
        const eventSlide = document.getElementById('eventSlide');
        const eventsManagePanel = document.getElementById('eventsManagePanel');
        const filtersPanel = document.getElementById('filtersPanel');
        
        if (eventSlide) eventSlide.classList.remove('open');
        if (eventsManagePanel) eventsManagePanel.classList.remove('open');
        if (filtersPanel) filtersPanel.classList.remove('open');
        
        // Remove active states from buttons
        const eventsManageToggle = document.getElementById('eventsManageToggle');
        const filtersToggle = document.getElementById('filtersToggle');
        if (eventsManageToggle) eventsManageToggle.classList.remove('active');
        if (filtersToggle) filtersToggle.classList.remove('active');

        // Keep header hub (and Home button visibility) in sync with the actual loaded state.
        this.dispatchAppModeChange('menu');
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
        localStorage.removeItem('currentMode');

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

        localStorage.removeItem('currentMode');
        this.loadedComponents.glossary = false;

        updateStatus('✓ All Glossary Components killed!', 'success');
    }

    /**
     * Kill all Biography Components (Story Archive)
     * @param {boolean} [restoreMenu=true] - Whether to restore main menu (false when switching to another mode)
     */
    async killBiographyComponents(restoreMenu = true) {
        updateStatus('Exiting Story Archive...', 'info');
        
        // Restore Event Manager panel to its original location (from story archive)
        const eventsManagePanel = document.getElementById('eventsManagePanel');
        if (eventsManagePanel && this._originalEventsPanelParent) {
            this._restoreStoryArchiveEventManagerClose();
            this._restoreStoryArchiveCompactChrome(eventsManagePanel);
            this._teardownStoryArchiveBottomBar(eventsManagePanel);

            // Restore original classes
            eventsManagePanel.className = this._originalEventsPanelClasses || 'events-manage-panel';
            
            // Restore original styles
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
            
            // Restore original title
            const title = eventsManagePanel.querySelector('.story-viewer-title');
            if (title) {
                title.textContent = 'Event Management';
                title.classList.remove('story-viewer-title');
                title.classList.add('events-manage-title');
            }
            
            // Restore Add/Save/Export buttons to normal state
            const addBtn = document.getElementById('addEventBtn');
            const saveBtn = document.getElementById('saveEventsBtn');
            const exportBtn = document.getElementById('exportEventsBtn');
            if (addBtn) addBtn.classList.remove('story-viewer-action-btn');
            if (saveBtn) saveBtn.classList.remove('story-viewer-action-btn');
            if (exportBtn) exportBtn.classList.remove('story-viewer-action-btn');
            document.getElementById('eventsSearchClear')?.classList.remove('story-viewer-action-btn');
            document.getElementById('eventsShowAllCheckbox')?.closest('label.events-search-checkbox')?.classList.remove('story-viewer-bottom-bar-control');
            document.getElementById('eventsPerPageInput')?.closest('.events-per-page-group')?.classList.remove('story-viewer-bottom-bar-control');
            
            // Show Event Manager button again
            const eventManagerBtn = document.getElementById('eventsManageToggle');
            if (eventManagerBtn) {
                eventManagerBtn.style.display = '';
            }

            // Remove story-viewer-header class from header
            const header = eventsManagePanel.querySelector('.story-viewer-header');
            if (header) {
                header.classList.remove('story-viewer-header');
            }

            document.getElementById('storyArchiveLayoutControl')?.remove();
            document.getElementById('storyArchiveGridSquishBar')?.remove();

            // Move back to original parent
            this._originalEventsPanelParent.appendChild(eventsManagePanel);
        }
        
        // Remove story archive container
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

        localStorage.removeItem('currentMode');
        this.loadedComponents.biography = false;
        
        updateStatus('✓ Story Archive exited!', 'success');
    }
}
