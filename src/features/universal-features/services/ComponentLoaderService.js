/**
 * ComponentLoaderService - Handles loading and unloading of individual components
 */
// Get helpers from global window or fallback module
const getHelper = (name, fallbackFn) => {
    // Try global window helpers first (for script tag loading)
    if (typeof window !== 'undefined') {
        const fb = window.ComponentLoaderFallbackHelpers;
        if (fb && fb[name]) return fb[name];
    }
    // Fallback to provided function
    return fallbackFn;
};

// Helper getters - use global if available, otherwise use fallback
const createGlobeControlButton = getHelper('createGlobeControlButton', (config, statusService) => {
    if (document.getElementById(config.id)) return document.getElementById(config.id);
    const button = document.createElement('button');
    button.id = config.id;
    button.className = `globe-control-btn ${config.className || ''}`;
    button.title = config.title;
    if (config.mode) {
        button.dataset.mode = config.mode;
    }
    button.innerHTML = `<span id="${config.id}Icon"><img src="${config.iconPath}" alt="${config.iconAlt}" style="width: 100%; height: 100%; object-fit: contain;"></span>`;
    const parent = document.getElementById(config.parentId || 'content');
    if (parent) {
        parent.appendChild(button);
        if (statusService) statusService.update(`✓ ${config.title} button added`, 'success');
    }
    return button;
});

const loadSoundEffect = getHelper('loadSoundEffect', (soundName, soundPath, statusService) => {
    if (window.SoundEffectsManager) {
        if (statusService) statusService.update(`Loading ${soundName} sound effect...`, 'info');
        window.SoundEffectsManager.loadSound(soundName, soundPath);
        if (statusService) statusService.update(`✓ ${soundName} sound effect loaded`, 'success');
        return true;
    }
    return false;
});

const requireGlobeBase = getHelper('requireGlobeBase', (loadedComponents, buttonId, statusService, buttonStateService) => {
    if (!loadedComponents?.globeBase || !window.globeController) {
        if (statusService) statusService.update('⚠ Globe base must be loaded first!', 'error');
        if (buttonId && buttonStateService) buttonStateService.setState(buttonId, 'error');
        return false;
    }
    return true;
});

const removeElementById = getHelper('removeElementById', (elementId, statusMessage, statusService, checkParent = false) => {
    const element = document.getElementById(elementId);
    if (!element || (checkParent && !element.parentElement)) return false;
    element.remove();
    if (statusMessage && statusService) statusService.update(`✓ ${statusMessage}`, 'success');
    return true;
});

const removeElementsByIds = getHelper('removeElementsByIds', (elements, statusService) => {
    let count = 0;
    elements.forEach(({ id, message, checkParent = false }) => {
        if (removeElementById(id, message, statusService, checkParent)) count++;
    });
    return count;
});

const createMusicPanel = getHelper('createMusicPanel', () => document.getElementById('musicPanel'));
const createFiltersPanel = getHelper('createFiltersPanel', () => document.getElementById('filtersPanel'));
const createEventPagination = getHelper('createEventPagination', () => document.getElementById('eventPagination'));
const createBackgroundMusicElement = getHelper('createBackgroundMusicElement', (statusService) => {
    if (document.getElementById('backgroundMusic')) return document.getElementById('backgroundMusic');
    const audio = document.createElement('audio');
    audio.id = 'backgroundMusic';
    audio.preload = 'auto';
    audio.loop = true;
    document.body.appendChild(audio);
    if (statusService) statusService.update('✓ Audio element added', 'success');
    return audio;
});

const initializeEventManager = getHelper('initializeEventManager', async (statusService) => {
    if (typeof EventManager === 'undefined') throw new Error('EventManager class not available');
    const eventManager = new EventManager();
    await eventManager.init();
    window.eventManager = eventManager;
    return eventManager;
});

const withLoadWrapper = getHelper('withLoadWrapper', async (loadFn) => await loadFn());
const withUnloadWrapper = getHelper('withUnloadWrapper', async (unloadFn) => await unloadFn());
const checkAlreadyLoaded = getHelper('checkAlreadyLoaded', (isLoaded, componentName, statusService) => {
    if (isLoaded && statusService) {
        statusService.update(`→ ${componentName} already loaded!`, 'info');
        return true;
    }
    return false;
});

const createExitButton = getHelper('createExitButton', () => document.getElementById('exitButton'));
const setupGlobeContainer = getHelper('setupGlobeContainer', () => document.getElementById('globe-container'));
const makeGlobeContainerVisible = getHelper('makeGlobeContainerVisible', (container) => {
    if (container) {
        container.style.opacity = '1';
        container.style.pointerEvents = 'auto';
        container.style.display = 'block';
        container.classList.add('loaded');
    }
});
const removeEventMarkersIfNeeded = getHelper('removeEventMarkersIfNeeded', () => {});
const disposeGlobeResources = getHelper('disposeGlobeResources', () => {
    if (window.globeController?.animationId) cancelAnimationFrame(window.globeController.animationId);
    window.globeController = null;
});

const verifyEventPanels = getHelper('verifyEventPanels', () => {});
const setupEventManagerListeners = getHelper('setupEventManagerListeners', () => {});
const syncEventsWithGlobe = getHelper('syncEventsWithGlobe', (globeController, eventManager) => {
    if (globeController && eventManager) globeController.dataModel.events = [...eventManager.events];
});

const isGitHubPages = getHelper('isGitHubPages', () => {
    const hostname = window.location.hostname;
    return hostname.includes('github.io') || hostname.includes('github.com') || (hostname === 'localhost' && window.location.port === '');
});
const removeOldTestButtons = getHelper('removeOldTestButtons', () => {});
const createMenuButtonsContainer = getHelper('createMenuButtonsContainer', () => {
    const menuButtons = document.createElement('div');
    menuButtons.className = 'main-menu-buttons';
    return menuButtons;
});
const appendMenuButtons = getHelper('appendMenuButtons', (menuButtons) => document.body.appendChild(menuButtons));
const isTestPage = getHelper('isTestPage', () => {
    const existingGlobeBtn = document.getElementById('runGlobeBtn');
    return existingGlobeBtn && existingGlobeBtn.classList.contains('test-run-button');
});

const loadEventSoundEffects = getHelper('loadEventSoundEffects', () => {});
const initializeFilterPanel = getHelper('initializeFilterPanel', () => {});
const initializeMusicManager = getHelper('initializeMusicManager', () => {});

const checkMenuAlreadyLoaded = getHelper('checkMenuAlreadyLoaded', (isLoaded, isRunOperation, overlayService, statusService) => {
    if (isLoaded && statusService) {
        statusService.update('✓ Menu components already loaded!', 'success');
        return true;
    }
    return false;
});
const handleExistingMenuButtons = getHelper('handleExistingMenuButtons', () => false);
const finalizeMenuLoad = getHelper('finalizeMenuLoad', (setLoaded) => setLoaded(true));

const createLoadParams = getHelper('createLoadParams', (service, componentName, buttonId, setLoaded) => ({
    componentName, buttonId, isRunOperation: service.isRunOperation(),
    overlayService: service.overlayService, buttonStateService: service.buttonStateService,
    statusService: service.statusService, setLoaded
}));

const createUnloadParams = getHelper('createUnloadParams', (service, componentName, buttonId, setLoaded) => ({
    componentName, buttonId, buttonStateService: service.buttonStateService,
    statusService: service.statusService, setLoaded
}));

class ComponentLoaderService {
    constructor(overlayService, statusService, buttonStateService, paletteService) {
        this.overlayService = overlayService;
        this.statusService = statusService;
        this.buttonStateService = buttonStateService;
        this.paletteService = paletteService;
        this.loadedComponents = {
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
        
        // Expose loadedComponents globally for backward compatibility
        if (typeof window !== 'undefined') {
            window.loadedComponents = this.loadedComponents;
        }
    }

    isRunOperation() {
        return this.overlayService.isRunOperation;
    }

    isLoaded(component) {
        return this.loadedComponents[component] || false;
    }

    setLoaded(component, value) {
        this.loadedComponents[component] = value;
    }

    async loadPalette() {
        if (checkAlreadyLoaded(this.loadedComponents.palette, 'Palette', this.statusService)) {
            return;
        }
        
        const loadPaletteLogic = window.ComponentLoadLogicHelpers?.loadPaletteLogic || 
            (await import('./helpers/ComponentLoadLogicHelpers.js')).loadPaletteLogic;
        
        await withLoadWrapper(async () => {
            await loadPaletteLogic({
                paletteService: this.paletteService,
                createGlobeControlButton,
                loadSoundEffect,
                statusService: this.statusService
            });
        }, createLoadParams(this, 'Palette', 'loadPaletteBtn', (value) => { this.loadedComponents.palette = value; }));
    }

    async unloadPalette() {
        if (!this.loadedComponents.palette) {
            this.statusService.update('Palette not loaded', 'info');
            return;
        }
        
        const unloadPaletteLogic = window.ComponentLoadLogicHelpers?.unloadPaletteLogic || 
            (await import('./helpers/ComponentLoadLogicHelpers.js')).unloadPaletteLogic;
        
        await withUnloadWrapper(async () => {
            await unloadPaletteLogic({
                removeElementById,
                paletteService: this.paletteService,
                statusService: this.statusService
            });
        }, createUnloadParams(this, 'Palette', 'loadPaletteBtn', (value) => { this.loadedComponents.palette = value; }));
    }

    async loadGlobeBase() {
        if (this.loadedComponents.globeBase) {
            await this.unloadGlobeBase();
            return;
        }
        
        const loadGlobeBaseLogic = window.ComponentLoadLogicHelpers?.loadGlobeBaseLogic || 
            (await import('./helpers/ComponentLoadLogicHelpers.js')).loadGlobeBaseLogic;
        
        await withLoadWrapper(async () => {
            await loadGlobeBaseLogic({
                setupGlobeContainer,
                removeEventMarkersIfNeeded,
                makeGlobeContainerVisible,
                statusService: this.statusService,
                isRunOperation: () => this.isRunOperation(),
                loadedComponents: this.loadedComponents
            });
        }, {
            componentName: 'Globe Base',
            buttonId: 'loadGlobeBaseBtn',
            isRunOperation: this.isRunOperation(),
            overlayService: this.overlayService,
            buttonStateService: this.buttonStateService,
            statusService: this.statusService,
            setLoaded: (value) => { this.loadedComponents.globeBase = value; }
        });
    }

    async unloadGlobeBase(options = {}) {
        const preserveEventsUi = options && options.preserveEventsUi === true;

        if (!this.loadedComponents.globeBase) {
            this.statusService.update('Globe base not loaded', 'info');
            return;
        }
        
        const unloadGlobeBaseLogic = window.ComponentLoadLogicHelpers?.unloadGlobeBaseLogic || 
            (await import('./helpers/ComponentLoadLogicHelpers.js')).unloadGlobeBaseLogic;
        
        await withUnloadWrapper(async () => {
            await unloadGlobeBaseLogic({
                disposeGlobeResources,
                unloadTransport: () => this.unloadTransport(),
                unloadControls: () => this.unloadControls(),
                unloadEvents: () => this.unloadEvents(),
                statusService: this.statusService,
                loadedComponents: this.loadedComponents,
                preserveEventsUi
            });
        }, createUnloadParams(this, 'Globe Base', 'loadGlobeBaseBtn', (value) => { this.loadedComponents.globeBase = value; }));
    }

    async loadTransport() {
        if (checkAlreadyLoaded(this.loadedComponents.transport, 'Transport', this.statusService)) {
            return;
        }
        
        // Check globe base dependency using helper
        if (!requireGlobeBase(this.loadedComponents, 'loadTransportBtn', this.statusService, this.buttonStateService)) {
            return;
        }
        
        const loadTransportLogic = window.ComponentLoadLogicHelpers?.loadTransportLogic || 
            (await import('./helpers/ComponentLoadLogicHelpers.js')).loadTransportLogic;
        
        await withLoadWrapper(async () => {
            await loadTransportLogic({
                createGlobeControlButton,
                loadSoundEffect,
                statusService: this.statusService
            });
        }, {
            componentName: 'Transport',
            buttonId: 'loadTransportBtn',
            isRunOperation: this.isRunOperation(),
            overlayService: this.overlayService,
            buttonStateService: this.buttonStateService,
            statusService: this.statusService,
            setLoaded: (value) => { this.loadedComponents.transport = value; }
        });
    }

    async unloadTransport() {
        if (!this.loadedComponents.transport) {
            this.statusService.update('Transport not loaded', 'info');
            return;
        }
        
        const unloadTransportLogic = window.ComponentLoadLogicHelpers?.unloadTransportLogic || 
            (await import('./helpers/ComponentLoadLogicHelpers.js')).unloadTransportLogic;
        
        await withUnloadWrapper(async () => {
            await unloadTransportLogic({
                removeElementById,
                statusService: this.statusService
            });
        }, createUnloadParams(this, 'Transport', 'loadTransportBtn', (value) => { this.loadedComponents.transport = value; }));
    }

    async loadControls() {
        if (checkAlreadyLoaded(this.loadedComponents.controls, 'Controls', this.statusService)) {
            return;
        }
        
        // Check globe base dependency using helper
        if (!requireGlobeBase(this.loadedComponents, 'loadControlsBtn', this.statusService, this.buttonStateService)) {
            return;
        }
        
        const loadControlsLogic = window.ComponentLoadLogicHelpers?.loadControlsLogic || 
            (await import('./helpers/ComponentLoadLogicHelpers.js')).loadControlsLogic;
        
        await withLoadWrapper(async () => {
            await loadControlsLogic({
                createGlobeControlButton,
                createExitButton,
                loadSoundEffect,
                overlayService: this.overlayService,
                statusService: this.statusService
            });
        }, createLoadParams(this, 'Controls', 'loadControlsBtn', (value) => { this.loadedComponents.controls = value; }));
    }

    async unloadControls() {
        if (!this.loadedComponents.controls) {
            this.statusService.update('Controls not loaded', 'info');
            return;
        }
        
        const unloadControlsLogic = window.ComponentLoadLogicHelpers?.unloadControlsLogic || 
            (await import('./helpers/ComponentLoadLogicHelpers.js')).unloadControlsLogic;
        
        await withUnloadWrapper(async () => {
            await unloadControlsLogic({
                removeElementsByIds,
                statusService: this.statusService
            });
        }, createUnloadParams(this, 'Controls', 'loadControlsBtn', (value) => { this.loadedComponents.controls = value; }));
    }

    async loadMusic() {
        if (checkAlreadyLoaded(this.loadedComponents.music, 'Music', this.statusService)) {
            return;
        }
        
        const loadMusicLogic = window.ComponentLoadLogicHelpers?.loadMusicLogic || 
            (await import('./helpers/ComponentLoadLogicHelpers.js')).loadMusicLogic;
        
        await withLoadWrapper(async () => {
            await loadMusicLogic({
                createGlobeControlButton,
                createMusicPanel,
                createBackgroundMusicElement,
                loadSoundEffect,
                initializeMusicManager,
                statusService: this.statusService
            });
        }, createLoadParams(this, 'Music', 'loadMusicBtn', (value) => { this.loadedComponents.music = value; }));
    }

    async unloadMusic() {
        if (!this.loadedComponents.music) {
            this.statusService.update('Music not loaded', 'info');
            return;
        }
        
        const unloadMusicLogic = window.ComponentLoadLogicHelpers?.unloadMusicLogic || 
            (await import('./helpers/ComponentLoadLogicHelpers.js')).unloadMusicLogic;
        
        await withUnloadWrapper(async () => {
            await unloadMusicLogic({
                removeElementsByIds,
                statusService: this.statusService
            });
        }, createUnloadParams(this, 'Music', 'loadMusicBtn', (value) => { this.loadedComponents.music = value; }));
    }

    async loadEvents() {
        if (checkAlreadyLoaded(this.loadedComponents.events, 'Events', this.statusService)) {
            return;
        }
        
        // Check globe base dependency using helper
        if (!requireGlobeBase(this.loadedComponents, 'loadEventsBtn', this.statusService, this.buttonStateService)) {
            return;
        }
        
        const loadEventsLogic = window.ComponentLoadLogicHelpers?.loadEventsLogic || 
            (await import('./helpers/ComponentLoadLogicHelpers.js')).loadEventsLogic;
        
        await withLoadWrapper(async () => {
            await loadEventsLogic({
                initializeEventManager,
                createGlobeControlButton,
                createEventPagination,
                createFiltersPanel,
                verifyEventPanels,
                loadEventSoundEffects,
                initializeFilterPanel,
                setupEventManagerListeners,
                syncEventsWithGlobe,
                loadSoundEffect,
                statusService: this.statusService
            });
        }, createLoadParams(this, 'Events', 'loadEventsBtn', (value) => { this.loadedComponents.events = value; }));
    }

    async unloadEvents() {
        if (!this.loadedComponents.events) {
            this.statusService.update('Events not loaded', 'info');
            return;
        }
        
        const unloadEventsLogic = window.ComponentLoadLogicHelpers?.unloadEventsLogic || 
            (await import('./helpers/ComponentLoadLogicHelpers.js')).unloadEventsLogic;
        
        await withUnloadWrapper(async () => {
            await unloadEventsLogic({
                removeElementsByIds,
                statusService: this.statusService
            });
        }, createUnloadParams(this, 'Events', 'loadEventsBtn', (value) => { this.loadedComponents.events = value; }));
    }

    async loadMenu() {
        if (checkMenuAlreadyLoaded(this.loadedComponents.menu, this.isRunOperation(), this.overlayService, this.statusService)) {
            return;
        }
        
        // Check if menu buttons container already exists
        if (handleExistingMenuButtons(this.statusService, this.buttonStateService, (value) => { this.loadedComponents.menu = value; })) {
            return;
        }
        
        const loadMenuLogic = window.ComponentLoadLogicHelpers?.loadMenuLogic || 
            (await import('./helpers/ComponentLoadLogicHelpers.js')).loadMenuLogic;
        
        await loadMenuLogic({
            isTestPage,
            removeOldTestButtons,
            createMenuButtonsContainer,
            appendMenuButtons,
            finalizeMenuLoad,
            statusService: this.statusService,
            buttonStateService: this.buttonStateService,
            setLoaded: (value) => { this.loadedComponents.menu = value; }
        });
    }

    async unloadMenu() {
        if (!this.loadedComponents.menu) {
            this.statusService.update('Menu not loaded', 'info');
            return;
        }
        
        const unloadMenuLogic = window.ComponentLoadLogicHelpers?.unloadMenuLogic || 
            (await import('./helpers/ComponentLoadLogicHelpers.js')).unloadMenuLogic;
        
        await withUnloadWrapper(async () => {
            await unloadMenuLogic({
                statusService: this.statusService
            });
        }, createUnloadParams(this, 'Menu', 'loadMenuBtn', (value) => { this.loadedComponents.menu = value; }));
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ComponentLoaderService = ComponentLoaderService;
}
