/**
 * ComponentLoadLogicHelpers - Component-specific loading/unloading logic
 * Extracted from ComponentLoaderService to reduce file size
 */

/**
 * Load palette component
 */
export async function loadPaletteLogic({ paletteService, createGlobeControlButton, loadSoundEffect, statusService }) {
    // Add palette button using helper
    createGlobeControlButton({
        id: 'colorPaletteToggle',
        className: '',
        title: 'Toggle Color Palette',
        label: 'Palette',
        iconPath: 'assets/images/icons/Palette Icon.png',
        iconAlt: 'Color Palette',
        parentId: 'headerHubRightButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        headerOrder: 50,
        iconSpanId: 'colorPaletteIcon'
    }, statusService);
    
    // Load palette sound effect using helper
    loadSoundEffect('colorChange', 'assets/audio/sfx/Color Change.mp3', statusService);
    
    paletteService.setupToggle();
}

/**
 * Unload palette component
 */
export async function unloadPaletteLogic({ removeElementById, paletteService, statusService }) {
    // Remove palette button using helper
    removeElementById('colorPaletteToggle', 'Palette button removed', statusService);
    
    paletteService.paletteToggleSetup = false;
}

/**
 * Load globe base component
 */
export async function loadGlobeBaseLogic({ setupGlobeContainer, removeEventMarkersIfNeeded, makeGlobeContainerVisible, statusService, isRunOperation, loadedComponents }) {
    // Setup container using helper
    const container = setupGlobeContainer(statusService);

    if (typeof window !== 'undefined' && window.TimelineInlineLoad?.isTimelineInlineLoadActive?.() && container) {
        window.TimelineInlineLoad.showGlobeInlineLoader(container);
    }
    
    statusService.update('Loading GlobeController module...', 'info');
    const { GlobeController } = await import('../../controllers/GlobeController.js');
    
    statusService.update('Initializing GlobeController...', 'info');
    const controller = new GlobeController();
    window.globeController = controller;
    
    statusService.update('Initializing globe scene...', 'info');
    await controller.init();
    
    // Remove event markers if needed using helper
    removeEventMarkersIfNeeded(controller, loadedComponents.events, statusService);
    
    // Make container visible if not in run operation
    if (!isRunOperation() && container) {
        makeGlobeContainerVisible(container, statusService);
    }
}

/**
 * Unload globe base component
 */
export async function unloadGlobeBaseLogic({ disposeGlobeResources, unloadTransport, unloadControls, unloadEvents, statusService, loadedComponents, preserveEventsUi = false }) {
    // Dispose Three.js resources using helper
    disposeGlobeResources(statusService);
    
    // Unload dependent components
    if (loadedComponents.transport) {
        await unloadTransport();
    }
    if (loadedComponents.controls) {
        if (!preserveEventsUi) {
            await unloadControls();
        } else {
            // Keep Map/Globe, rotation, and exit in the DOM (Codex) but force controls to reload
            // when the timeline is restored so listeners bind to the new GlobeController.
            loadedComponents.controls = false;
        }
    }
    if (!preserveEventsUi && loadedComponents.events) {
        await unloadEvents();
    }
}

/**
 * Load transport component
 */
export async function loadTransportLogic({ createGlobeControlButton, loadSoundEffect, statusService }) {
    const controller = window.globeController;
    
    // Initialize FlashButtonHelper for transport controls
    if (!window.flashButton) {
        await import('../../utils/FlashButtonHelper.js');
    }
    
    // Add transport toggle using helper
    createGlobeControlButton({
        id: 'hyperloopToggle',
        className: 'active hyperloop-btn dock-globe-rail__btn',
        headerOrder: 40,
        mobileParentId: 'dockGlobeRailLeft',
        mobileBaseClass: 'globe-control-btn',
        mobileClassName: 'hyperloop-btn dock-globe-rail__btn'
    }, statusService);

    createGlobeControlButton({
        id: 'weatherEffectsToggle',
        className: 'active weather-effects-btn dock-globe-rail__btn',
        headerOrder: 45,
        mobileParentId: 'dockGlobeRailLeft',
        mobileBaseClass: 'globe-control-btn',
        mobileClassName: 'weather-effects-btn dock-globe-rail__btn'
    }, statusService);

    createGlobeControlButton({
        id: 'lightingToggle',
        className: 'active lighting-btn dock-globe-rail__btn',
        headerOrder: 48,
        mobileParentId: 'dockGlobeRailLeft',
        mobileBaseClass: 'globe-control-btn',
        mobileClassName: 'lighting-btn dock-globe-rail__btn'
    }, statusService);
    
    if (controller.uiView) {
        controller.uiView.setupHyperloopToggle(() => {
            if (typeof controller.onHyperloopToggled === 'function') {
                controller.onHyperloopToggled();
            } else {
                controller.transportView.updateHyperloopVisibility();
            }
        });
        controller.uiView.setupWeatherEffectsToggle(() => {
            if (controller.globeView) {
                controller.globeView.setWeatherEffectsVisible(controller.sceneModel.getGlobeWeatherEffectsVisible());
            }
        });
        controller.uiView.setupLightingToggle(() => {
            if (controller.globeView) {
                controller.globeView.setGlobeLightingVisible(controller.sceneModel.getGlobeLightingVisible());
            }
        });
        statusService.update('✓ Transport & weather toggles initialized', 'success');
    }
    
    // Load transport sound effect using helper
    loadSoundEffect('transportToggle', 'assets/audio/sfx/Transport Toggle.mp3', statusService);
    loadSoundEffect('weather', 'assets/audio/sfx/Weather.mp3', statusService);
    
    if (controller.transportView) {
        controller.transportView.updateHyperloopVisibility();
    }
}

/**
 * Unload transport component
 */
export async function unloadTransportLogic({ removeElementById, statusService }) {
    removeElementById('hyperloopToggle', 'Transport toggle removed', statusService);
    removeElementById('weatherEffectsToggle', 'Weather toggle removed', statusService);
    removeElementById('lightingToggle', 'Lighting toggle removed', statusService);
}

/**
 * Load controls component
 */
export async function loadControlsLogic({ createGlobeControlButton, createExitButton, loadSoundEffect, overlayService, statusService }) {
    const controller = window.globeController;
    
    // Initialize FlashButtonHelper for Globe controls
    if (!window.flashButton) {
        await import('../../utils/FlashButtonHelper.js');
    }
    
    // Add map view toggle using helper
    createGlobeControlButton({
        id: 'mapViewToggle',
        className: '',
        title: 'Toggle Map View',
        label: 'Map',
        iconPath: 'assets/images/icons/Switch to Globe Icon.png',
        iconAlt: 'Globe',
        iconSpanId: 'mapViewToggleIcon',
        parentId: 'dockGlobeRailLeft',
        baseClass: 'globe-control-btn',
        className: 'dock-globe-rail__btn',
        headerOrder: 30,
        mobileParentId: 'dockGlobeRailRight',
        mobileBaseClass: 'globe-control-btn',
        mobileClassName: 'dock-globe-rail__btn'
    }, statusService);

    // Add rotation toggle using helper
    createGlobeControlButton({
        id: 'autoRotateToggle',
        className: 'header-subbar-btn',
        title: 'Toggle Auto-Rotation',
        label: 'Rotation',
        iconPath: 'assets/images/icons/Rotation Icon.png',
        iconAlt: 'Rotate',
        iconSpanId: 'rotateIcon',
        parentId: 'dockGlobeRailLeft',
        baseClass: 'globe-control-btn',
        className: 'dock-globe-rail__btn'
    }, statusService);
    
    // Add exit button using helper
    createExitButton({
        overlayService: overlayService,
        statusService: statusService
    });
    
    if (controller.uiView) {
        controller.uiView.setupAutoRotateToggle();
        if (typeof controller.uiView.setupMapViewToggle === 'function') {
            controller.uiView.setupMapViewToggle();
        }
        statusService.update('✓ Rotation toggle initialized', 'success');
    }
    
    // Load rotation sound effect using helper
    loadSoundEffect('rotationToggle', 'assets/audio/sfx/Rotation Toggle.mp3', statusService);
    // Load map switch sound effect using helper
    loadSoundEffect('switchMap', 'assets/audio/sfx/Switch Map.mp3', statusService);
}

/**
 * Unload controls component
 */
export async function unloadControlsLogic({ removeElementsByIds, statusService }) {
    // Remove control buttons using helper
    removeElementsByIds([
        { id: 'autoRotateToggle', message: 'Rotation toggle removed' },
        { id: 'mapViewToggle', message: 'Map view toggle removed' },
        { id: 'exitButton', message: 'Exit button removed' }
    ], statusService);
}

/**
 * Load music component
 */
export async function loadMusicLogic({ createGlobeControlButton, createMusicPanel, createBackgroundMusicElement, loadSoundEffect, initializeMusicManager, statusService }) {
    // Add music toggle button using helper
    createGlobeControlButton({
        id: 'musicToggle',
        className: '',
        title: 'Music Options',
        label: 'Music',
        iconPath: 'assets/images/icons/Music Icon.png',
        iconAlt: 'Music',
        parentId: 'headerHubRightButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        headerOrder: 60
    }, statusService);
    
    // Create music panel using helper
    createMusicPanel(statusService);
    
    // Create audio element using helper
    createBackgroundMusicElement(statusService);
    
    // Load music sound effect using helper
    loadSoundEffect('music', 'assets/audio/sfx/Music.mp3', statusService);
    
    // Initialize MusicManager using helper
    initializeMusicManager(statusService);
}

/**
 * Unload music component
 */
export async function unloadMusicLogic({ removeElementsByIds, statusService }) {
    // Remove music components using helper
    removeElementsByIds([
        { id: 'musicToggle', message: 'Music button removed' },
        { id: 'musicPanel', message: 'Music panel removed' }
    ], statusService);
    
    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio = null;
    }
}

/**
 * Check if Event System Load Out is already active
 * This determines if we can rely on its initialization instead of duplicating
 */
function isEventSystemLoadOutActive() {
    const testBtn = document.getElementById('testBtn');
    const isLoaded = testBtn?.dataset.loaded === 'true';
    const hasEventManager = window.eventManager?.events?.length > 0;
    const hasListeners = window.eventManager?.listenersSetup === true;
    // Additional check: verify the UI elements were actually created by Event System
    const hasFiltersPanel = !!document.getElementById('filtersPanel');
    const hasPagination = !!document.getElementById('paginationDock');
    const hasFilterButton = !!document.getElementById('filtersToggle');
    return isLoaded && hasEventManager && hasListeners && (hasFiltersPanel || hasPagination || hasFilterButton);
}

/**
 * Load events component
 * If Event System Load Out is already loaded, skip duplicate UI initialization
 * and only do Globe-specific setup (codex toggle, 3D sync)
 */
export async function loadEventsLogic({ initializeEventManager, createGlobeControlButton, createEventPagination, createFiltersPanel, verifyEventPanels, loadEventSoundEffects, initializeFilterPanel, setupEventManagerListeners, syncEventsWithGlobe, loadSoundEffect, statusService }) {

    // Clear dock rails first to prevent duplicates from previous loads
    const centerRail = document.getElementById('dockGlobeRailCenter');
    const rightRail = document.getElementById('dockGlobeRailRight');
    const paginationElements = ['prevPageBtn', 'prevEventBtn', 'nextEventBtn', 'nextPageBtn', 'globalImageToggle', 'filtersToggle', 'eventsManageToggle', 'pageInput', 'pageTotal'];
    paginationElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
    const pageInputContainer = document.querySelector('.page-input-container');
    if (pageInputContainer) pageInputContainer.remove();

    // Check if Event System Load Out already did the heavy lifting
    const eventSystemActive = isEventSystemLoadOutActive();
    
    if (eventSystemActive) {
        // Event System already loaded - just ensure buttons are visible
        if (statusService) {
            statusService.update('→ Event System already loaded, reusing...', 'info');
        }
        
        // Make sure dock buttons are visible (they may have been hidden)
        const filtersToggle = document.getElementById('filtersToggle');

        if (filtersToggle) {
            filtersToggle.style.setProperty('display', 'flex', 'important');
        }
        
        // Ensure filter panel exists (create if missing, though Event System should have done this)
        const filtersPanel = document.getElementById('filtersPanel');
        if (!filtersPanel && createFiltersPanel) {
            createFiltersPanel(statusService);
        }
        
        // Ensure pagination exists (create if missing)
        const paginationDock = document.getElementById('paginationDock');
        if (!paginationDock && createEventPagination) {
            createEventPagination(statusService);
        }
        
    } else {
        // Event System NOT loaded - Globe cannot load events without standalone
        // Standalone Event System must be loaded first via testBtn click
        if (statusService) {
            statusService.update('→ Event System not loaded - globe will have no events', 'warning');
        }
    }
    
    // === GLOBE-SPECIFIC SETUP (always runs regardless of Event System state) ===
    
    // Codex toggle - this is Globe-only feature
    createGlobeControlButton({
        id: 'codexToggle',
        className: '',
        title: 'Open Codex',
        label: 'Codex',
        iconPath: 'assets/images/icons/Codex%20Icon.png',
        iconAlt: 'Codex',
        parentId: 'headerHubButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        headerOrder: 15
    }, statusService);
    
    // Load event sound effects (only if not already loaded by Event System)
    if (!window.ServiceEventSoundHelpers?.loadEventSoundEffects) {
        loadEventSoundEffects(loadSoundEffect, statusService);
    }
    
    // Final sync with globe (after all UI is set up) using helper
    if (window.globeController && window.eventManager) {
        syncEventsWithGlobe(window.globeController, window.eventManager, statusService);
    }
    
    // === FILTER STATE SYNC ===
    // If Event System is active, apply filters to Globe markers via EventMarkerManager
    if (eventSystemActive && window.globeEventMarkerManager) {
        if (statusService) {
            const standaloneFilters = window.standaloneActiveFilters || new Set();
            statusService.update(`→ Applying ${standaloneFilters.size} filters to Globe markers`, 'info');
        }
        // Apply filters to lock/unlock markers
        window.globeEventMarkerManager.applyFilters();
    }
}

/**
 * Unload events component
 * If Event System Load Out is active, preserve its UI and only clean up Globe-specific elements
 */
export async function unloadEventsLogic({ removeElementsByIds, statusService }) {
    // Check if Event System Load Out is still active - if so, DON'T destroy its UI
    const eventSystemActive = isEventSystemLoadOutActive();
    
    if (eventSystemActive) {
        // Event System is still loaded - only remove Globe-specific elements
        // The filters/events buttons, pagination, and filter panel should stay for Event System
        if (statusService) {
            statusService.update('→ Event System still active, preserving UI', 'info');
        }
        
        // Only remove Globe-specific buttons (codex toggle is Globe-only)
        removeElementsByIds([
            { id: 'codexToggle', message: 'Codex button removed' }
        ], statusService);
        
        // Note: filtersToggle, eventsManageToggle, pagination, filtersPanel are preserved
        // because Event System Load Out is still active and needs them
        
        return;
    }
    
    // Event System NOT active - do FULL cleanup
    // Remove event UI components using helper
    // Note: headerGlobalTimelineBtn, headerConceptGlossaryBtn, and homeBtn are universal
    // header features and persist across mode switches

    // First remove pagination buttons and elements from dock rails/center rail (they may have been moved by moveElements)
    const paginationElements = ['prevPageBtn', 'prevEventBtn', 'nextEventBtn', 'nextPageBtn', 'globalImageToggle', 'filtersToggle', 'pageInput', 'pageTotal'];
    paginationElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.remove();
        }
    });

    // Also remove page input container if it exists (it may have been moved from eventPagination)
    const pageInputContainer = document.querySelector('.page-input-container');
    if (pageInputContainer) {
        pageInputContainer.remove();
    }

    removeElementsByIds([
        { id: 'eventsManageToggle', message: 'Event manager button removed' },
        { id: 'codexToggle', message: 'Codex button removed' },
        { id: 'eventPagination', message: 'Event pagination removed' },
        { id: 'filtersPanel', message: null, checkParent: true },
        { id: 'paginationDock', message: 'Pagination dock removed' },
        { id: 'paginationDockCollapseStrip', message: 'Pagination dock collapse strip removed' }
    ], statusService);

    if (window.eventManager) {
        window.eventManager.listenersSetup = false;
    }
}

/**
 * Load menu component
 */
export async function loadMenuLogic({ isTestPage, removeOldTestButtons, createMenuButtonsContainer, appendMenuButtons, finalizeMenuLoad, statusService, buttonStateService, setLoaded }) {
    // Check if we're on test page and remove old test buttons
    const testPage = isTestPage();
    if (testPage) {
        removeOldTestButtons(statusService);
    }
    
    // Create menu buttons using helper
    const menuButtons = createMenuButtonsContainer(statusService);
    
    // Append menu buttons using helper
    appendMenuButtons(menuButtons, testPage, statusService);
    
    // Finalize menu load
    finalizeMenuLoad(setLoaded, buttonStateService, statusService);
}

/**
 * Unload menu component
 */
export async function unloadMenuLogic({ statusService }) {
    // Try to find menu buttons in test-container, content, or body
    const testContainer = document.querySelector('.test-container');
    const contentContainer = document.getElementById('content');
    const searchContainer = testContainer || contentContainer || document.body;
    
    if (searchContainer) {
        const menuButtons = searchContainer.querySelector('.main-menu-buttons');
        if (menuButtons) {
            menuButtons.remove();
            statusService.update('✓ Menu buttons removed', 'success');
        }
    }
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.ComponentLoadLogicHelpers) {
        window.ComponentLoadLogicHelpers = {};
    }
    window.ComponentLoadLogicHelpers.loadPaletteLogic = loadPaletteLogic;
    window.ComponentLoadLogicHelpers.unloadPaletteLogic = unloadPaletteLogic;
    window.ComponentLoadLogicHelpers.loadGlobeBaseLogic = loadGlobeBaseLogic;
    window.ComponentLoadLogicHelpers.unloadGlobeBaseLogic = unloadGlobeBaseLogic;
    window.ComponentLoadLogicHelpers.loadTransportLogic = loadTransportLogic;
    window.ComponentLoadLogicHelpers.unloadTransportLogic = unloadTransportLogic;
    window.ComponentLoadLogicHelpers.loadControlsLogic = loadControlsLogic;
    window.ComponentLoadLogicHelpers.unloadControlsLogic = unloadControlsLogic;
    window.ComponentLoadLogicHelpers.loadMusicLogic = loadMusicLogic;
    window.ComponentLoadLogicHelpers.unloadMusicLogic = unloadMusicLogic;
    window.ComponentLoadLogicHelpers.loadEventsLogic = loadEventsLogic;
    window.ComponentLoadLogicHelpers.unloadEventsLogic = unloadEventsLogic;
    window.ComponentLoadLogicHelpers.loadMenuLogic = loadMenuLogic;
    window.ComponentLoadLogicHelpers.unloadMenuLogic = unloadMenuLogic;
}
