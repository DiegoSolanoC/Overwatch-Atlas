/**
 * Test Loader - Modular component loading for testing
 * Allows loading individual components (Globe, Music, Events) on demand
 * Note: Loading overlay, status, and button state management are now handled by managers
 */

import { showLoadingOverlay, hideLoadingOverlay, setRunOperation, getRunOperation } from '../managers/LoadingOverlayManager.js';
import { updateStatus, updateGlobeComponentsProgress, resetGlobeComponentsProgress } from '../managers/StatusManager.js';
import { setButtonState } from '../managers/ButtonStateManager.js';
import { setupPaletteToggle, resetPaletteToggleSetup } from '../managers/PaletteManager.js';
import { ComponentOrchestrator } from '../managers/ComponentOrchestrator.js';
import { withLoadWrapper, withUnloadWrapper, checkAlreadyLoaded, loadSoundEffect, loadSoundEffects, createGlobeControlButton } from './helpers/ComponentLoadHelpers.js';
import { getOrCreateElement, createMusicPanel, createFiltersPanel, createEventPagination } from './helpers/ComponentDOMHelpers.js';
import { initializeEventManager, setupEventManagerListeners, syncEventsWithGlobe, verifyEventPanels } from './helpers/EventManagerHelpers.js';
import { createMenuButtons, getOrCreateTestContainer } from './helpers/MenuHelpers.js';
import { setupAllEventListeners, createRunOperationHandler, setupButtonListener } from './helpers/EventListenerHelpers.js';
import { setupGlobeContainer, makeGlobeContainerVisible, hideGlobeContainer, stopGlobeAnimations, disposeThreeJSResources, importGlobeController, initializeGlobeController, removeEventMarkersIfNeeded } from './helpers/GlobeBaseHelpers.js';
import { requireGlobeBase } from './helpers/ComponentDependencyHelpers.js';
import { createExitButton } from './helpers/ControlsHelpers.js';
import { initializeMusicManager, createBackgroundMusicElement } from './helpers/MusicHelpers.js';
import { clearEventManager, removeAllEventMarkers } from './helpers/EventCleanupHelpers.js';
import { removeElementById, removeElementBySelector, removeElementsByIds } from './helpers/ComponentUnloadHelpers.js';
import { setupEventUIComponents, loadEventSoundEffects, initializeFilterPanel, setupEventListenersDelayed } from './helpers/EventsLoadHelpers.js';
import { createOrchestratorDelegations } from './helpers/ComponentOrchestratorDelegationHelpers.js';
import { openGlobeMapLaunchChoice } from '../utils/GlobeMapLaunchChoice.js';

// Track which components are loaded
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

// Local variable for isRunOperation (delegates to LoadingOverlayManager)
// We keep a local variable for direct access but sync with the manager
let isRunOperation = false;

// Helper function to sync isRunOperation with manager
function setIsRunOperation(value) {
    isRunOperation = value;
    setRunOperation(value);
}

/** Unload Palette (button, bg/texture switching, sound). */
async function unloadPalette() {
    if (!loadedComponents.palette) {
        updateStatus('Palette not loaded', 'info');
        return;
    }
    
    await withUnloadWrapper(async () => {
        // Remove palette button
        removeElementById('colorPaletteToggle', 'Palette button removed');
        
        // Reset palette toggle setup flag
        resetPaletteToggleSetup();
        
        loadedComponents.palette = false;
    }, 'Palette', 'loadPaletteBtn');
}

async function loadPalette() {
    if (checkAlreadyLoaded(loadedComponents.palette, 'Palette')) {
        return;
    }
    
    await withLoadWrapper(async () => {
        // Add palette button (if not already present)
        createGlobeControlButton({
            id: 'colorPaletteToggle',
            className: '',
            title: 'Toggle Color Palette',
            label: 'Palette',
            iconPath: 'assets/images/icons/Palette Icon.png',
            iconAlt: 'Color Palette',
            parentId: 'headerHubRight',
            baseClass: 'header-hub-btn header-hub-btn--icon',
            iconSpanId: 'colorPaletteIcon',
            headerOrder: 50
        });
        
        // Load palette sound effect
        loadSoundEffect('colorChange', 'assets/audio/sfx/Color Change.mp3', 'Loading palette sound effect...');
        
        // Setup palette toggle functionality
        setupPaletteToggle();
        
        loadedComponents.palette = true;
    }, 'Palette', 'loadPaletteBtn', getRunOperation());
}

/**
 * Load header navigation buttons as universal features.
 * These appear on startup regardless of whether the globe or events are loaded.
 * createGlobeControlButton is idempotent — it skips if the ID already exists.
 */
function loadHeaderNavButtons() {
    // NOTE: Events Manager and Filters buttons are now created by
    // standalone Event System Load Out only (via testBtn click)
    // Globe no longer creates these buttons

    // Interactive timeline (header) — same globe vs map chooser as main menu
    createGlobeControlButton({
        id: 'headerInteractiveGlobeBtn',
        className: '',
        title: 'Interactive Worldview',
        label: 'Interactive Worldview',
        iconPath: 'assets/images/icons/Timeline Icon.png',
        iconAlt: 'Interactive Worldview',
        parentId: 'headerHub',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'headerInteractiveGlobeIcon',
        headerOrder: 15
    });

    // Bootstrap handler: chooser then runGlobeComponents (with loading overlay)
    const headerGlobeBtn = document.getElementById('headerInteractiveGlobeBtn');
    if (headerGlobeBtn) {
        headerGlobeBtn.addEventListener('click', function bootstrapGlobe(e) {
            e.stopPropagation();
            e.preventDefault();
            const launchGlobe = createRunOperationHandler(runGlobeComponents, setIsRunOperation);
            void openGlobeMapLaunchChoice({ launchGlobe });
        }, true);
    }

    // Connection Codex button - launches codex/glossary mode
    createGlobeControlButton({
        id: 'headerWorldCodexBtn',
        className: '',
        title: 'Connection Codex',
        label: 'Connection Codex',
        iconPath: 'assets/images/icons/Codex%20Icon.png',
        iconAlt: 'Connection Codex',
        parentId: 'headerHub',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'headerWorldCodexIcon',
        headerOrder: 16
    });

    // Bootstrap handler: clicking Connection Codex launches glossary/codex components
    const headerCodexBtn = document.getElementById('headerWorldCodexBtn');
    if (headerCodexBtn) {
        headerCodexBtn.addEventListener('click', function bootstrapCodex(e) {
            e.stopPropagation();
            e.preventDefault();
            if (typeof window.runGlossaryComponents === 'function') {
                void window.runGlossaryComponents(false);
            }
        }, true);
    }

    // Story Archive button - launches story mode
    createGlobeControlButton({
        id: 'headerStoryViewerBtn',
        className: '',
        title: 'Story Archive',
        label: 'Story Archive',
        iconPath: 'assets/images/icons/Story%20Icon.png',
        iconAlt: 'Story Archive',
        parentId: 'headerHub',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'headerStoryViewerIcon',
        headerOrder: 17
    });

    // Bootstrap handler: clicking Story Archive launches story mode
    const headerStoryBtn = document.getElementById('headerStoryViewerBtn');
    if (headerStoryBtn) {
        headerStoryBtn.addEventListener('click', function bootstrapStory(e) {
            e.stopPropagation();
            e.preventDefault();
            if (typeof window.runBiographyComponents === 'function') {
                void window.runBiographyComponents(false);
            }
        }, true);
    }

    // Home button — right hub, after Music (order 60), returns to blank startup state
    createGlobeControlButton({
        id: 'homeBtn',
        className: '',
        title: 'Return to Home',
        label: 'Home',
        iconPath: 'assets/images/icons/Home Button.png',
        iconAlt: 'Home',
        parentId: 'headerHubRight',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'homeBtnIcon',
        headerOrder: 70
    });

    // Wire up Home button click — unloads globe, glossary/codex, or story archive, returns to clean state
    const homeButton = document.getElementById('homeBtn');
    if (homeButton) {
        homeButton.addEventListener('click', async function(e) {
            e.stopPropagation();
            e.preventDefault();

            // Play mode switch sound (same as other mode buttons)
            if (window.SoundEffectsManager) {
                if (window.SoundEffectsManager.sounds && window.SoundEffectsManager.sounds['modeSwitch']) {
                    window.SoundEffectsManager.play('modeSwitch');
                } else {
                    window.SoundEffectsManager.loadSound('modeSwitch', 'assets/audio/sfx/Mode Switch.mp3');
                    setTimeout(() => {
                        window.SoundEffectsManager.play('modeSwitch');
                    }, 100);
                }
            }

            const currentMode = (localStorage.getItem('currentMode') || 'menu').toLowerCase();

            // Show loading overlay to mask the unload process
            showLoadingOverlay();
            updateStatus('Returning to Home...', 'info');

            // Close event slide panel if open (both EventSlideManager and standalone event system)
            if (window.EventSlideManager?.instance?.hideEventSlide) {
                window.EventSlideManager.instance.hideEventSlide();
            }
            if (window.standaloneEventSlide?.hideEventSlide) {
                window.standaloneEventSlide.hideEventSlide();
            }

            // Close image overlay if open
            if (window.imageOverlay?.hide) {
                window.imageOverlay.hide();
            }

            // Unload Event System if loaded
            const testBtn = document.getElementById('testBtn');
            if (testBtn && testBtn.dataset.loaded === 'true') {
                console.log('[Home Button] Unloading Event System...');
                testBtn.click(); // Click to unload
                // Wait for unload to complete
                await new Promise(r => setTimeout(r, 500));
            }

            // Kill Story Archive if active
            if (currentMode === 'biography') {
                if (typeof window.killBiographyComponents === 'function') {
                    await window.killBiographyComponents();
                }
            }

            // Kill Glossary/Codex if active
            if (currentMode === 'glossary' || document.body.classList.contains('codex-mode-active')) {
                if (typeof window.killGlossaryComponents === 'function') {
                    await window.killGlossaryComponents();
                }
            }

            // Kill globe if loaded
            if (window.globeController && typeof window.killGlobeComponents === 'function') {
                await window.killGlobeComponents();
            }

            // Restore main menu
            if (typeof window.restoreMainMenu === 'function') {
                await window.restoreMainMenu();
            }

            // Clear stored mode so a refresh also starts clean
            localStorage.removeItem('currentMode');

            // Hide loading overlay
            hideLoadingOverlay();
            updateStatus('✓ Returned to Home', 'success');
        });
    }

    updateStatus('✓ Header nav buttons loaded', 'success');
}

/** Unload Globe Base (earth, starfield, scene, markers). */
async function unloadGlobeBase(options = {}) {
    const preserveEventsUi = options && options.preserveEventsUi === true;

    if (!loadedComponents.globeBase) {
        updateStatus('Globe base not loaded', 'info');
        return;
    }
    
    updateStatus('Unloading Globe Base...', 'info');
    
    try {
        // Stop animations and dispose resources using helpers
        stopGlobeAnimations();
        
        const container = document.getElementById('globe-container');
        if (container) {
            hideGlobeContainer(container);
        }
        
        disposeThreeJSResources();
        
        // Also unload dependent components
        if (loadedComponents.transport) {
            await unloadToggles();
        }
        if (loadedComponents.controls) {
            if (!preserveEventsUi) {
                await unloadControls();
            } else {
                loadedComponents.controls = false;
            }
        }
        if (!preserveEventsUi && loadedComponents.events) {
            await unloadEvents();
        }
        
        loadedComponents.globeBase = false;
        setButtonState('loadGlobeBaseBtn', 'default');
        updateStatus('✓ Globe base components unloaded!', 'success');
    } catch (error) {
        console.error('Error unloading Globe Base:', error);
        updateStatus(`✗ Error unloading Globe Base: ${error.message}`, 'error');
    }
}

async function loadGlobeBase() {
    // If already loaded, unload it instead
    if (loadedComponents.globeBase) {
        await unloadGlobeBase();
        return;
    }
    
    // Use LoadingOverlayManager (not the module-local flag): orchestrator sets this during runGlobeComponents.
    if (!getRunOperation()) {
        showLoadingOverlay();
    }
    setButtonState('loadGlobeBaseBtn', 'loading');
    updateStatus('Starting Globe Base load...', 'info');
    
    try {
        // Setup container for initialization using helper
        const container = document.getElementById('globe-container');
        if (container) {
            setupGlobeContainer(container);
        }
        
        // Import and initialize GlobeController using helpers
        const GlobeController = await importGlobeController();
        const controller = await initializeGlobeController(GlobeController);
        
        // Remove event markers if needed using helper
        removeEventMarkersIfNeeded(controller, loadedComponents.events);
        
        // Make globe container visible now that it's loaded (unless in a run operation)
        if (!getRunOperation() && container) {
            makeGlobeContainerVisible(container);
        }
        
        loadedComponents.globeBase = true;
        setButtonState('loadGlobeBaseBtn', 'loaded');
        updateStatus('✓ Globe base components fully loaded!', 'success');
        
    } catch (error) {
        console.error('Error loading Globe Base:', error);
        updateStatus(`✗ Error loading Globe Base: ${error.message}`, 'error');
        setButtonState('loadGlobeBaseBtn', 'error');
    } finally {
        hideLoadingOverlay();
    }
}

/** Unload Toggles (vehicles, weather, lighting, map toggles). */
async function unloadToggles() {
    if (!loadedComponents.transport) {
        updateStatus('Toggles not loaded', 'info');
        return;
    }

    await withUnloadWrapper(async () => {
        // Remove toggle buttons
        ['hyperloopToggle', 'weatherEffectsToggle', 'lightingToggle'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
        updateStatus('✓ Toggles removed', 'success');

        loadedComponents.transport = false;
    }, 'Toggles', 'loadTogglesBtn');
}

async function loadToggles() {
    if (checkAlreadyLoaded(loadedComponents.transport, 'Toggles')) {
        return;
    }
    
    // Globe base must be loaded first
    if (!requireGlobeBase('loadTogglesBtn', loadedComponents)) {
        return;
    }
    
    await withLoadWrapper(async () => {
        const controller = window.globeController;

        // Add toggle buttons (if not already present)
        createGlobeControlButton({
            id: 'mapViewToggle',
            className: 'dock-globe-rail__btn',
            title: 'Toggle Map View',
            label: 'Map',
            iconPath: 'assets/images/icons/Switch to Globe Icon.png',
            iconAlt: 'Globe',
            parentId: 'dockGlobeRailLeft',
            baseClass: 'globe-control-btn',
            iconSpanId: 'mapViewToggleIcon',
            headerOrder: 10,
            mobileParentId: 'dockGlobeRailLeft',
            mobileBaseClass: 'globe-control-btn',
            mobileClassName: 'dock-globe-rail__btn'
        });

        createGlobeControlButton({
            id: 'hyperloopToggle',
            className: 'hyperloop-btn dock-globe-rail__btn',
            title: 'Toggle hyperloop',
            label: 'Vehicles',
            iconPath: 'assets/images/icons/Train Icon.png',
            iconAlt: 'Transport',
            parentId: 'dockGlobeRailLeft',
            baseClass: 'globe-control-btn',
            iconSpanId: 'hyperloopIcon',
            headerOrder: 20,
            mobileParentId: 'dockGlobeRailLeft',
            mobileBaseClass: 'globe-control-btn',
            mobileClassName: 'hyperloop-btn dock-globe-rail__btn'
        });

        createGlobeControlButton({
            id: 'weatherEffectsToggle',
            className: 'weather-effects-btn dock-globe-rail__btn',
            title: 'Toggle weather',
            label: 'Weather',
            iconPath: 'assets/images/icons/Weather Icon.png',
            iconAlt: 'Weather',
            parentId: 'dockGlobeRailLeft',
            baseClass: 'globe-control-btn',
            iconSpanId: 'weatherEffectsIcon',
            headerOrder: 30,
            mobileClassName: 'weather-effects-btn dock-globe-rail__btn'
        });

        createGlobeControlButton({
            id: 'lightingToggle',
            className: 'lighting-btn dock-globe-rail__btn',
            title: 'Toggle Lighting',
            label: 'Lighting',
            iconPath: 'assets/images/icons/Lighting Icon.png',
            iconAlt: 'Lighting',
            parentId: 'dockGlobeRailLeft',
            baseClass: 'globe-control-btn',
            iconSpanId: 'lightingIcon',
            headerOrder: 40,
            mobileParentId: 'dockGlobeRailLeft',
            mobileBaseClass: 'globe-control-btn',
            mobileClassName: 'lighting-btn dock-globe-rail__btn'
        });

        createGlobeControlButton({
            id: 'autoRotateToggle',
            className: 'dock-globe-rail__btn',
            title: 'Toggle Auto-Rotation',
            label: 'Rotation',
            iconPath: 'assets/images/icons/Rotation Icon.png',
            iconAlt: 'Rotate',
            parentId: 'dockGlobeRailLeft',
            baseClass: 'globe-control-btn',
            iconSpanId: 'rotateIcon',
            headerOrder: 50,
            mobileParentId: 'dockGlobeRailLeft',
            mobileBaseClass: 'globe-control-btn',
            mobileClassName: 'dock-globe-rail__btn'
        });
        
        // Setup toggle handlers
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
            updateStatus('✓ Toggles initialized', 'success');
        }

        // Load toggle sound effects
        loadSoundEffect('transportToggle', 'assets/audio/sfx/Transport Toggle.mp3', 'Loading toggle sound effect...');
        loadSoundEffect('weather', 'assets/audio/sfx/Weather.mp3', 'Loading weather sound effect...');
        loadSoundEffect('light', 'assets/audio/sfx/light.mp3', 'Loading lighting sound effect...');

        // Ensure systems are visible
        if (controller.transportView) {
            controller.transportView.updateHyperloopVisibility();
        }

        loadedComponents.transport = true;
    }, 'Toggles', 'loadTogglesBtn', getRunOperation());
}

/** Unload Controls (rotation toggle, interaction, sound). */
async function unloadControls() {
    if (!loadedComponents.controls) {
        updateStatus('Controls not loaded', 'info');
        return;
    }
    
    await withUnloadWrapper(async () => {
        // Remove control buttons
        removeElementsByIds([
            { id: 'autoRotateToggle', message: 'Rotation toggle removed' },
            { id: 'mapViewToggle', message: 'Map view toggle removed' },
            { id: 'exitButton', message: 'Exit button removed' }
        ]);
        
        loadedComponents.controls = false;
    }, 'Controls', 'loadControlsBtn');
}

async function loadControls() {
    if (checkAlreadyLoaded(loadedComponents.controls, 'Controls')) {
        return;
    }
    
    // Globe base must be loaded first
    if (!requireGlobeBase('loadControlsBtn', loadedComponents)) {
        return;
    }
    
    await withLoadWrapper(async () => {
        const controller = window.globeController;

        // Desktop: rotate in header subbar, map in #headerHubMapStack. Mobile: both on #dockGlobeRailRight (rotation left of map).
        createGlobeControlButton({
            id: 'mapViewToggle',
            className: 'dock-globe-rail__btn',
            title: 'Toggle Map View',
            label: 'Map',
            iconPath: 'assets/images/icons/Switch to Globe Icon.png',
            iconAlt: 'Globe',
            parentId: 'dockGlobeRailLeft',
            baseClass: 'globe-control-btn',
            iconSpanId: 'mapViewToggleIcon',
            headerOrder: 10,
            mobileParentId: 'dockGlobeRailLeft',
            mobileBaseClass: 'globe-control-btn',
            mobileClassName: 'dock-globe-rail__btn'
        });

        createGlobeControlButton({
            id: 'autoRotateToggle',
            className: 'dock-globe-rail__btn',
            title: 'Toggle Auto-Rotation',
            label: 'Rotation',
            iconPath: 'assets/images/icons/Rotation Icon.png',
            iconAlt: 'Rotate',
            parentId: 'dockGlobeRailLeft',
            baseClass: 'globe-control-btn',
            iconSpanId: 'rotateIcon',
            headerOrder: 50,
            mobileParentId: 'dockGlobeRailLeft',
            mobileBaseClass: 'globe-control-btn',
            mobileClassName: 'dock-globe-rail__btn'
        });
        
        // Add exit button (if not already present)
        // Use componentOrchestrator directly to avoid hoisting issues
        createExitButton(setIsRunOperation, () => componentOrchestrator.killGlobeComponents());
        
        // Setup rotation toggle
        if (controller.uiView) {
            controller.uiView.setupAutoRotateToggle();
            if (typeof controller.uiView.setupMapViewToggle === 'function') {
                controller.uiView.setupMapViewToggle();
            }
            updateStatus('✓ Rotation toggle initialized', 'success');
        }
        
        // Load rotation sound effect
        loadSoundEffect('rotationToggle', 'assets/audio/sfx/Rotation Toggle.mp3', 'Loading rotation sound effect...');
        
        loadedComponents.controls = true;
    }, 'Controls', 'loadControlsBtn', getRunOperation());
}

/** Unload Music (toggle, panel, audio). */
async function unloadMusic() {
    if (!loadedComponents.music) {
        updateStatus('Music not loaded', 'info');
        return;
    }
    
    await withUnloadWrapper(async () => {
        // Remove music components
        removeElementsByIds([
            { id: 'musicToggle', message: 'Music button removed' },
            { id: 'musicPanel', message: 'Music panel removed' }
        ]);
        
        // Stop any playing music
        if (window.currentAudio) {
            window.currentAudio.pause();
            window.currentAudio = null;
        }
        
        loadedComponents.music = false;
    }, 'Music', 'loadMusicBtn');
}

/**
 * Load Music Components
 * - Music options button
 * - Music lists and images
 * - Related sound effects
 */
async function loadMusic() {
    if (checkAlreadyLoaded(loadedComponents.music, 'Music')) {
        return;
    }
    
    await withLoadWrapper(async () => {
        // Add music toggle button (if not already present)
        createGlobeControlButton({
            id: 'musicToggle',
            className: '',
            title: 'Music Options',
            label: 'Music',
            iconPath: 'assets/images/icons/Music Icon.png',
            iconAlt: 'Music',
            parentId: 'headerHubRight',
            baseClass: 'header-hub-btn header-hub-btn--icon',
            headerOrder: 60
        });
        
        // Add music panel HTML (if not already present)
        getOrCreateElement('musicPanel', () => {
            updateStatus('Adding music panel...', 'info');
            return createMusicPanel();
        }, 'Music panel');
        
        // Add audio element (if not already present)
        getOrCreateElement('backgroundMusic', () => {
            updateStatus('Adding audio element...', 'info');
            return createBackgroundMusicElement();
        }, 'Audio element');
        
        // Initialize MusicManager AFTER elements are created (immediate attempt)
        initializeMusicManager(true);
        
        // Load music sound effect
        loadSoundEffect('music', 'assets/audio/sfx/Music.mp3', 'Loading music sound effect...');
        
        // Initialize music panel again after delay (ensures all services are ready)
        initializeMusicManager(false, 50);
        
        loadedComponents.music = true;
    }, 'Music', 'loadMusicBtn', getRunOperation());
}

/**
 * Load Events Components
 * - EventManager initialization
 * - Event markers on the globe
 * - Filter button and panel
 * - Event manager button and panel
 * - Event pagination (arrows, page input, numbered buttons)
 * - Event slide panel, event image overlay, event edit modal
 * - Related sound effects
 */
async function unloadEvents() {
    if (!loadedComponents.events) {
        updateStatus('Events not loaded', 'info');
        return;
    }
    
    await withUnloadWrapper(async () => {
        // Remove event UI components
        // Note: headerGlobalTimelineBtn, headerConceptGlossaryBtn, and homeBtn are universal
        // header features and persist across mode switches
        removeElementsByIds([
            { id: 'filtersToggle', message: 'Filter button removed' },
            { id: 'eventsManageToggle', message: 'Event manager button removed' },
            { id: 'eventPagination', message: 'Event pagination removed' },
            { id: 'filtersPanel', message: null, checkParent: true },
            { id: 'paginationDock', message: 'Pagination dock removed' },
            { id: 'paginationDockCollapseStrip', message: 'Pagination dock collapse strip removed' }
        ]);
        
        // Clear event manager and remove markers using helpers
        clearEventManager();
        removeAllEventMarkers();
        
        loadedComponents.events = false;
    }, 'Events', 'loadEventsBtn');
}

async function loadEvents() {
    if (checkAlreadyLoaded(loadedComponents.events, 'Events')) {
        return;
    }
    
    // Globe base must be loaded first
    if (!requireGlobeBase('loadEventsBtn', loadedComponents)) {
        return;
    }
    
    await withLoadWrapper(async () => {
                        // Initialize EventManager
        window.eventManager = await initializeEventManager();

        // Pagination + header controls must exist before UIView binds number buttons / hover preview.
        setupEventUIComponents({ updateStatus });

        // Show filters toggle button for globe mode
        const filtersToggleBtn = document.getElementById('filtersToggle');
        if (filtersToggleBtn) {
            filtersToggleBtn.style.setProperty('display', 'flex', 'important');
        }

        // Sync events with globe and add markers (pagination DOM is present for this sync)
        syncEventsWithGlobe(window.globeController, window.eventManager);
        
        // Load all event-related sound effects using helper
        loadEventSoundEffects();
        
        // Initialize filter panel functionality using helper
        initializeFilterPanel(updateStatus);
        
        // Setup event listeners AFTER all buttons and panels are created using helper
        setupEventListenersDelayed(window.eventManager, setupEventManagerListeners);
        
        // Final sync with globe (after all UI is set up)
        syncEventsWithGlobe(window.globeController, window.eventManager);
        
        loadedComponents.events = true;
    }, 'Events', 'loadEventsBtn', getRunOperation());
}

/**
 * Unload Menu Components
 */
async function unloadMenu() {
    if (!loadedComponents.menu) {
        updateStatus('Menu not loaded', 'info');
        return;
    }
    
    await withUnloadWrapper(async () => {
        // Remove menu container if it exists
        const testContainer = document.querySelector('.test-container');
        if (testContainer) {
            removeElementBySelector('.main-menu-buttons', 'Menu buttons removed', testContainer);
        }
        
        loadedComponents.menu = false;
    }, 'Menu', 'loadMenuBtn');
}

/** Load Menu (Global Timeline, Glossary, Bios buttons). */
async function loadMenu() {
    if (checkAlreadyLoaded(loadedComponents.menu, 'Menu')) {
        return;
    }
    
    await withLoadWrapper(async () => {
        const testContainer = getOrCreateTestContainer();
        
        // Check if menu buttons already exist
        if (testContainer.querySelector('.main-menu-buttons')) {
            updateStatus('Menu buttons already exist', 'info');
            loadedComponents.menu = true;
            return;
        }
        
        // Create main menu buttons structure
        updateStatus('Creating main menu buttons...', 'info');
        
        const setupGlobeHandler = createRunOperationHandler(runGlobeComponents, setIsRunOperation);
        const setupGlossaryHandler = typeof runGlossaryComponents === 'function' 
            ? createRunOperationHandler(runGlossaryComponents, setIsRunOperation) 
            : null;
        const setupBiographyHandler = typeof runBiographyComponents === 'function' 
            ? createRunOperationHandler(runBiographyComponents, setIsRunOperation) 
            : null;
        
        const menuButtons = createMenuButtons(setupGlobeHandler, setupGlossaryHandler, setupBiographyHandler);
        testContainer.appendChild(menuButtons);
        setupButtonListener(
            'runGlobeBtn',
            () =>
                void openGlobeMapLaunchChoice({
                    launchGlobe: createRunOperationHandler(runGlobeComponents, setIsRunOperation)
                }),
            true
        );
        updateStatus('✓ Menu buttons created', 'success');
        
        updateStatus('✓ Menu button listeners set up', 'success');
        
        loadedComponents.menu = true;
    }, 'Menu', 'loadMenuBtn', getRunOperation());
}

// Initialize ComponentOrchestrator with loaders and unloaders
const componentOrchestrator = new ComponentOrchestrator(
    loadedComponents,
    {
        palette: loadPalette,
        music: loadMusic,
        headerNav: loadHeaderNavButtons,
        menu: loadMenu,
        globeBase: loadGlobeBase,
        transport: loadToggles,
        controls: loadControls,
        events: loadEvents
    },
    {
        palette: unloadPalette,
        music: unloadMusic,
        menu: unloadMenu,
        globeBase: unloadGlobeBase,
        transport: unloadToggles,
        controls: unloadControls,
        events: unloadEvents
    }
);

const {
    runMenuComponents,
    runUniversalFeatures,
    runGlobeComponents,
    killMenuComponents,
    killUniversalFeatures,
    restoreMainMenu,
    killGlobeComponents,
    runGlossaryComponents,
    killGlossaryComponents,
    runBiographyComponents,
    killBiographyComponents
} = createOrchestratorDelegations(componentOrchestrator);

window.restoreMainMenu = restoreMainMenu;

// Setup button event listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('test-loader.js: DOMContentLoaded fired, setting up button listeners...');
    
    setupAllEventListeners({
        loadPalette,
        loadMusic,
        runUniversalFeatures,
        killUniversalFeatures,
        loadMenu,
        runMenuComponents,
        killMenuComponents,
        loadGlobeBase,
        loadToggles,
        loadControls,
        loadEvents,
        runGlobeComponents,
        killGlobeComponents,
        runGlossaryComponents,
        killGlossaryComponents,
        runBiographyComponents,
        killBiographyComponents
    }, setIsRunOperation);
    
    updateStatus('Test loader ready. Click buttons to load components.', 'info');
});

// Make runUniversalFeatures, runMenuComponents, and runGlobeComponents available globally
// This must be at the end after all functions are defined
window.runUniversalFeatures = runUniversalFeatures;
window.runMenuComponents = runMenuComponents;
window.runGlobeComponents = runGlobeComponents;

// Expose kill operations for header hub mode switching
window.killGlobeComponents = killGlobeComponents;
window.killMenuComponents = killMenuComponents;
window.runGlossaryComponents = runGlossaryComponents;
window.killGlossaryComponents = killGlossaryComponents;
window.runBiographyComponents = runBiographyComponents;
window.killBiographyComponents = killBiographyComponents;

window.unloadGlobeBase = unloadGlobeBase;

// Header hub mode switch API
// - Switches between "globe", "glossary" (codex), and "menu" modes
// - Biography is not implemented yet; selecting it returns to main menu
window.appModeSwitch = async function appModeSwitch(targetMode) {
    const requested = (targetMode || '').toString().toLowerCase();
    const normalized = (requested === 'timeline') ? 'globe' : requested;
    const next = (normalized === 'globe' || normalized === 'glossary' || normalized === 'biography')
        ? normalized
        : 'menu';

    // Biography is still "coming soon"
    const effectiveNext = (next === 'biography') ? 'menu' : next;

    // Determine current mode. Globe orchestrator stores "globe" etc; menu uses absence.
    const current = (localStorage.getItem('currentMode') || 'menu').toString().toLowerCase();

    try {
        // Unload current mode assets (universal features stay loaded)
        if (current === 'globe') {
            await window.killGlobeComponents?.();
        } else if (current === 'codex' || current === 'glossary') {
            if (effectiveNext !== 'globe') {
                await window.killGlossaryComponents?.();
            }
        } else if (current === 'biography') {
            await window.killBiographyComponents?.();
            await window.restoreMainMenu?.();
        } else {
            // Already in menu; ensure menu visible
            await window.restoreMainMenu?.();
        }

        // Load target mode assets
        if (effectiveNext === 'globe') {
            await window.runGlobeComponents?.(false);
        } else if (effectiveNext === 'glossary') {
            await window.runGlossaryComponents?.(false);
        } else {
            await window.restoreMainMenu?.();
            localStorage.setItem('currentMode', 'menu');
            if (next === 'biography') {
                if (typeof window.updateStatus === 'function') {
                    window.updateStatus('Biography mode is coming soon — returning to main menu.', 'info');
                }
            }
        }

        window.dispatchEvent(new CustomEvent('appmodechange', { detail: { mode: effectiveNext } }));
    } catch (e) {
        console.error('appModeSwitch failed:', e);
        try {
            await window.restoreMainMenu?.();
        } catch (_) {}
        window.dispatchEvent(new CustomEvent('appmodechange', { detail: { mode: 'menu' } }));
    }
};