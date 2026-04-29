/**
 * ComponentLoaderFallbackHelpers - Fallback implementations for ComponentLoaderService
 * Extracted to reduce ComponentLoaderService.js file size
 */

// Use global helpers if available (for script tag loading), otherwise use fallback implementations
export const createGlobeControlButton = (typeof window !== 'undefined' && window.ServiceLoadHelpers?.createGlobeControlButton) 
    ? window.ServiceLoadHelpers.createGlobeControlButton 
    : (config, statusService) => {
        if (document.getElementById(config.id)) {
            return document.getElementById(config.id);
        }
        const button = document.createElement('button');
        button.id = config.id;
        button.className = `globe-control-btn ${config.className || ''}`;
        button.title = config.title;
        button.innerHTML = `<span id="${config.id}Icon"><img src="${config.iconPath}" alt="${config.iconAlt}" style="width: 100%; height: 100%; object-fit: contain;"></span>`;
        const parent = document.getElementById(config.parentId || 'content');
        if (parent) {
            parent.appendChild(button);
            if (statusService) statusService.update(`✓ ${config.title} button added`, 'success');
        }
        return button;
    };

export const loadSoundEffect = (typeof window !== 'undefined' && window.ServiceLoadHelpers?.loadSoundEffect)
    ? window.ServiceLoadHelpers.loadSoundEffect
    : (soundName, soundPath, statusService) => {
        if (window.SoundEffectsManager) {
            if (statusService) statusService.update(`Loading ${soundName} sound effect...`, 'info');
            window.SoundEffectsManager.loadSound(soundName, soundPath);
            if (statusService) statusService.update(`✓ ${soundName} sound effect loaded`, 'success');
            return true;
        }
        return false;
    };

export const requireGlobeBase = (typeof window !== 'undefined' && window.ServiceLoadHelpers?.requireGlobeBase)
    ? window.ServiceLoadHelpers.requireGlobeBase
    : (loadedComponents, buttonId, statusService, buttonStateService) => {
        if (!loadedComponents?.globeBase || !window.globeController) {
            if (statusService) statusService.update('⚠ Globe base must be loaded first!', 'error');
            if (buttonId && buttonStateService) buttonStateService.setState(buttonId, 'error');
            return false;
        }
        return true;
    };

export const removeElementById = (typeof window !== 'undefined' && window.ServiceUnloadHelpers?.removeElementById)
    ? window.ServiceUnloadHelpers.removeElementById
    : (elementId, statusMessage, statusService, checkParent = false) => {
        const element = document.getElementById(elementId);
        if (!element || (checkParent && !element.parentElement)) return false;
        element.remove();
        if (statusMessage && statusService) statusService.update(`✓ ${statusMessage}`, 'success');
        return true;
    };

export const removeElementsByIds = (typeof window !== 'undefined' && window.ServiceUnloadHelpers?.removeElementsByIds)
    ? window.ServiceUnloadHelpers.removeElementsByIds
    : (elements, statusService) => {
        let count = 0;
        elements.forEach(({ id, message, checkParent = false }) => {
            if (removeElementById(id, message, statusService, checkParent)) count++;
        });
        return count;
    };

// Panel creation helpers
export const createMusicPanel = (typeof window !== 'undefined' && window.ServicePanelHelpers?.createMusicPanel)
    ? window.ServicePanelHelpers.createMusicPanel
    : (statusService) => {
        if (document.getElementById('musicPanel')) return document.getElementById('musicPanel');
        return null;
    };

export const createFiltersPanel = (typeof window !== 'undefined' && window.ServicePanelHelpers?.createFiltersPanel)
    ? window.ServicePanelHelpers.createFiltersPanel
    : (statusService) => {
        if (document.getElementById('filtersPanel')) return document.getElementById('filtersPanel');
        return null;
    };

export const createEventPagination = (typeof window !== 'undefined' && window.ServicePanelHelpers?.createEventPagination)
    ? window.ServicePanelHelpers.createEventPagination
    : (statusService) => {
        // Check if pagination already exists
        if (document.getElementById('eventPagination')) {
            return document.getElementById('eventPagination');
        }
        // Also check if pagination buttons already exist (they may have been moved to dock rails)
        const existingButtons = ['prevPageBtn', 'prevEventBtn', 'nextEventBtn', 'nextPageBtn'].filter(
            id => document.getElementById(id)
        );
        if (existingButtons.length > 0) {
            // Buttons exist somewhere, don't create duplicates
            return document.getElementById('eventPagination');
        }
        return null;
    };

export const createBackgroundMusicElement = (typeof window !== 'undefined' && window.ServicePanelHelpers?.createBackgroundMusicElement)
    ? window.ServicePanelHelpers.createBackgroundMusicElement
    : (statusService) => {
        if (document.getElementById('backgroundMusic')) return document.getElementById('backgroundMusic');
        const audio = document.createElement('audio');
        audio.id = 'backgroundMusic';
        audio.preload = 'auto';
        audio.loop = true;
        document.body.appendChild(audio);
        if (statusService) statusService.update('✓ Audio element added', 'success');
        return audio;
    };

// EventManager initialization helper
export const initializeEventManager = (typeof window !== 'undefined' && window.ServiceEventManagerHelpers?.initializeEventManager)
    ? window.ServiceEventManagerHelpers.initializeEventManager
    : async (statusService) => {
        if (typeof EventManager === 'undefined') {
            throw new Error('EventManager class not available');
        }
        const eventManager = new EventManager();
        await eventManager.init();
        window.eventManager = eventManager;
        return eventManager;
    };

// Wrapper helpers
export const withLoadWrapper = (typeof window !== 'undefined' && window.ServiceWrapperHelpers?.withLoadWrapper)
    ? window.ServiceWrapperHelpers.withLoadWrapper
    : async (loadFn, params) => {
        await loadFn();
    };

export const withUnloadWrapper = (typeof window !== 'undefined' && window.ServiceWrapperHelpers?.withUnloadWrapper)
    ? window.ServiceWrapperHelpers.withUnloadWrapper
    : async (unloadFn, params) => {
        await unloadFn();
    };

export const checkAlreadyLoaded = (typeof window !== 'undefined' && window.ServiceWrapperHelpers?.checkAlreadyLoaded)
    ? window.ServiceWrapperHelpers.checkAlreadyLoaded
    : (isLoaded, componentName, statusService) => {
        if (isLoaded) {
            if (statusService) statusService.update(`→ ${componentName} already loaded!`, 'info');
            return true;
        }
        return false;
    };

// Exit button helper
export const createExitButton = (typeof window !== 'undefined' && window.ServiceExitButtonHelpers?.createExitButton)
    ? window.ServiceExitButtonHelpers.createExitButton
    : ({ overlayService, statusService }) => {
        if (document.getElementById('exitButton')) return document.getElementById('exitButton');
        return null;
    };

// Globe base helpers
export const setupGlobeContainer = (typeof window !== 'undefined' && window.ServiceGlobeBaseHelpers?.setupGlobeContainer)
    ? window.ServiceGlobeBaseHelpers.setupGlobeContainer
    : (statusService) => document.getElementById('globe-container');

export const makeGlobeContainerVisible = (typeof window !== 'undefined' && window.ServiceGlobeBaseHelpers?.makeGlobeContainerVisible)
    ? window.ServiceGlobeBaseHelpers.makeGlobeContainerVisible
    : (container, statusService) => {
        if (container) {
            container.style.opacity = '1';
            container.style.pointerEvents = 'auto';
            container.style.display = 'block';
            container.classList.add('loaded');
        }
    };

export const removeEventMarkersIfNeeded = (typeof window !== 'undefined' && window.ServiceGlobeBaseHelpers?.removeEventMarkersIfNeeded)
    ? window.ServiceGlobeBaseHelpers.removeEventMarkersIfNeeded
    : (controller, eventsLoaded, statusService) => {
        // Fallback - do nothing
    };

export const disposeGlobeResources = (typeof window !== 'undefined' && window.ServiceGlobeBaseHelpers?.disposeGlobeResources)
    ? window.ServiceGlobeBaseHelpers.disposeGlobeResources
    : (statusService) => {
        if (window.globeController) {
            if (window.globeController.animationId) {
                cancelAnimationFrame(window.globeController.animationId);
            }
            window.globeController = null;
        }
    };

// Event panel helpers
export const verifyEventPanels = (typeof window !== 'undefined' && window.ServiceEventPanelHelpers?.verifyEventPanels)
    ? window.ServiceEventPanelHelpers.verifyEventPanels
    : (statusService) => {
        // Fallback - do nothing
    };

export const setupEventManagerListeners = (typeof window !== 'undefined' && window.ServiceEventPanelHelpers?.setupEventManagerListeners)
    ? window.ServiceEventPanelHelpers.setupEventManagerListeners
    : (eventManager, statusService) => {
        // Fallback - do nothing
    };

export const syncEventsWithGlobe = (typeof window !== 'undefined' && window.ServiceEventPanelHelpers?.syncEventsWithGlobe)
    ? window.ServiceEventPanelHelpers.syncEventsWithGlobe
    : (globeController, eventManager, statusService) => {
        if (globeController && eventManager) {
            globeController.dataModel.events = [...eventManager.events];
        }
    };

// Menu helpers
export const isGitHubPages = (typeof window !== 'undefined' && window.ServiceMenuHelpers?.isGitHubPages)
    ? window.ServiceMenuHelpers.isGitHubPages
    : () => {
        const hostname = window.location.hostname;
        return hostname.includes('github.io') || hostname.includes('github.com') || (hostname === 'localhost' && window.location.port === '');
    };

export const removeOldTestButtons = (typeof window !== 'undefined' && window.ServiceMenuHelpers?.removeOldTestButtons)
    ? window.ServiceMenuHelpers.removeOldTestButtons
    : (statusService) => {
        // Fallback - do nothing
    };

export const createMenuButtonsContainer = (typeof window !== 'undefined' && window.ServiceMenuHelpers?.createMenuButtonsContainer)
    ? window.ServiceMenuHelpers.createMenuButtonsContainer
    : (statusService) => {
        const menuButtons = document.createElement('div');
        menuButtons.className = 'main-menu-buttons';
        return menuButtons;
    };

export const appendMenuButtons = (typeof window !== 'undefined' && window.ServiceMenuHelpers?.appendMenuButtons)
    ? window.ServiceMenuHelpers.appendMenuButtons
    : (menuButtons, isTestPage, statusService) => {
        document.body.appendChild(menuButtons);
    };

export const isTestPage = (typeof window !== 'undefined' && window.ServiceMenuHelpers?.isTestPage)
    ? window.ServiceMenuHelpers.isTestPage
    : () => {
        const existingGlobeBtn = document.getElementById('runGlobeBtn');
        return existingGlobeBtn && existingGlobeBtn.classList.contains('test-run-button');
    };

// Event sound helpers
export const loadEventSoundEffects = (typeof window !== 'undefined' && window.ServiceEventSoundHelpers?.loadEventSoundEffects)
    ? window.ServiceEventSoundHelpers.loadEventSoundEffects
    : (loadSoundEffect, statusService) => {
        // Fallback - do nothing
    };

export const initializeFilterPanel = (typeof window !== 'undefined' && window.ServiceEventSoundHelpers?.initializeFilterPanel)
    ? window.ServiceEventSoundHelpers.initializeFilterPanel
    : (statusService) => {
        // Fallback - do nothing
    };

// Music manager helpers
export const initializeMusicManager = (typeof window !== 'undefined' && window.ServiceMusicManagerHelpers?.initializeMusicManager)
    ? window.ServiceMusicManagerHelpers.initializeMusicManager
    : (statusService) => {
        // Fallback - do nothing
    };

// Menu load helpers
export const checkMenuAlreadyLoaded = (typeof window !== 'undefined' && window.ServiceMenuLoadHelpers?.checkMenuAlreadyLoaded)
    ? window.ServiceMenuLoadHelpers.checkMenuAlreadyLoaded
    : (isLoaded, isRunOperation, overlayService, statusService) => {
        if (isLoaded) {
            if (statusService) statusService.update('✓ Menu components already loaded!', 'success');
            return true;
        }
        return false;
    };

export const handleExistingMenuButtons = (typeof window !== 'undefined' && window.ServiceMenuLoadHelpers?.handleExistingMenuButtons)
    ? window.ServiceMenuLoadHelpers.handleExistingMenuButtons
    : (statusService, buttonStateService, setLoaded) => {
        return false;
    };

export const finalizeMenuLoad = (typeof window !== 'undefined' && window.ServiceMenuLoadHelpers?.finalizeMenuLoad)
    ? window.ServiceMenuLoadHelpers.finalizeMenuLoad
    : (setLoaded, buttonStateService, statusService) => {
        setLoaded(true);
    };

// Helper factory
export const createLoadParams = (typeof window !== 'undefined' && window.ServiceHelperFactory?.createLoadParams)
    ? window.ServiceHelperFactory.createLoadParams
    : (service, componentName, buttonId, setLoaded) => ({
        componentName,
        buttonId,
        isRunOperation: service.isRunOperation(),
        overlayService: service.overlayService,
        buttonStateService: service.buttonStateService,
        statusService: service.statusService,
        setLoaded
    });

export const createUnloadParams = (typeof window !== 'undefined' && window.ServiceHelperFactory?.createUnloadParams)
    ? window.ServiceHelperFactory.createUnloadParams
    : (service, componentName, buttonId, setLoaded) => ({
        componentName,
        buttonId,
        buttonStateService: service.buttonStateService,
        statusService: service.statusService,
        setLoaded
    });

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.ComponentLoaderFallbackHelpers) {
        window.ComponentLoaderFallbackHelpers = {};
    }
    window.ComponentLoaderFallbackHelpers.createGlobeControlButton = createGlobeControlButton;
    window.ComponentLoaderFallbackHelpers.loadSoundEffect = loadSoundEffect;
    window.ComponentLoaderFallbackHelpers.requireGlobeBase = requireGlobeBase;
    window.ComponentLoaderFallbackHelpers.removeElementById = removeElementById;
    window.ComponentLoaderFallbackHelpers.removeElementsByIds = removeElementsByIds;
    window.ComponentLoaderFallbackHelpers.createMusicPanel = createMusicPanel;
    window.ComponentLoaderFallbackHelpers.createFiltersPanel = createFiltersPanel;
    window.ComponentLoaderFallbackHelpers.createEventPagination = createEventPagination;
    window.ComponentLoaderFallbackHelpers.createBackgroundMusicElement = createBackgroundMusicElement;
    window.ComponentLoaderFallbackHelpers.initializeEventManager = initializeEventManager;
    window.ComponentLoaderFallbackHelpers.withLoadWrapper = withLoadWrapper;
    window.ComponentLoaderFallbackHelpers.withUnloadWrapper = withUnloadWrapper;
    window.ComponentLoaderFallbackHelpers.checkAlreadyLoaded = checkAlreadyLoaded;
    window.ComponentLoaderFallbackHelpers.createExitButton = createExitButton;
    window.ComponentLoaderFallbackHelpers.setupGlobeContainer = setupGlobeContainer;
    window.ComponentLoaderFallbackHelpers.makeGlobeContainerVisible = makeGlobeContainerVisible;
    window.ComponentLoaderFallbackHelpers.removeEventMarkersIfNeeded = removeEventMarkersIfNeeded;
    window.ComponentLoaderFallbackHelpers.disposeGlobeResources = disposeGlobeResources;
    window.ComponentLoaderFallbackHelpers.verifyEventPanels = verifyEventPanels;
    window.ComponentLoaderFallbackHelpers.setupEventManagerListeners = setupEventManagerListeners;
    window.ComponentLoaderFallbackHelpers.syncEventsWithGlobe = syncEventsWithGlobe;
    window.ComponentLoaderFallbackHelpers.isGitHubPages = isGitHubPages;
    window.ComponentLoaderFallbackHelpers.removeOldTestButtons = removeOldTestButtons;
    window.ComponentLoaderFallbackHelpers.createMenuButtonsContainer = createMenuButtonsContainer;
    window.ComponentLoaderFallbackHelpers.appendMenuButtons = appendMenuButtons;
    window.ComponentLoaderFallbackHelpers.isTestPage = isTestPage;
    window.ComponentLoaderFallbackHelpers.loadEventSoundEffects = loadEventSoundEffects;
    window.ComponentLoaderFallbackHelpers.initializeFilterPanel = initializeFilterPanel;
    window.ComponentLoaderFallbackHelpers.initializeMusicManager = initializeMusicManager;
    window.ComponentLoaderFallbackHelpers.checkMenuAlreadyLoaded = checkMenuAlreadyLoaded;
    window.ComponentLoaderFallbackHelpers.handleExistingMenuButtons = handleExistingMenuButtons;
    window.ComponentLoaderFallbackHelpers.finalizeMenuLoad = finalizeMenuLoad;
    window.ComponentLoaderFallbackHelpers.createLoadParams = createLoadParams;
    window.ComponentLoaderFallbackHelpers.createUnloadParams = createUnloadParams;
}
