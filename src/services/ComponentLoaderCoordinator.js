/**
 * ComponentLoaderCoordinator - Coordinates all component loading services
 * Replaces the monolithic component-loader.js
 */
class ComponentLoaderCoordinator {
    constructor() {
        // Initialize services
        this.overlayService = new window.LoadingOverlayService();
        this.statusService = new window.StatusService();
        this.progressService = new window.ProgressService();
        this.buttonStateService = new window.ButtonStateService();
        this.paletteService = new window.PaletteService();
        this.loaderService = new window.ComponentLoaderService(
            this.overlayService,
            this.statusService,
            this.buttonStateService,
            this.paletteService
        );
        this.runnerService = new window.ComponentRunnerService(
            this.loaderService,
            this.overlayService,
            this.statusService,
            this.progressService
        );
        this.killerService = new window.ComponentKillerService(
            this.loaderService,
            this.statusService
        );
        
        // Make services available globally for backward compatibility
        window.loadedComponents = this.loaderService.loadedComponents;
        window.isRunOperation = () => this.overlayService.isRunOperation;
        window.showLoadingOverlay = () => this.overlayService.show();
        window.hideLoadingOverlay = () => this.overlayService.hide();
        window.updateStatus = (msg, type) => this.statusService.update(msg, type);
        window.updateGlobeComponentsProgress = (completed) => this.progressService.updateGlobeComponentsProgress(completed);
        window.resetGlobeComponentsProgress = () => this.progressService.resetGlobeComponentsProgress();
        window.setButtonState = (id, state) => this.buttonStateService.setState(id, state);
        window.setupPaletteToggle = () => this.paletteService.setupToggle();
        window.loadPalette = () => this.loaderService.loadPalette();
        window.unloadPalette = () => this.loaderService.unloadPalette();
        window.loadGlobeBase = () => this.loaderService.loadGlobeBase();
        window.unloadGlobeBase = (opts) => this.loaderService.unloadGlobeBase(opts);
        window.loadTransport = () => this.loaderService.loadTransport();
        window.unloadTransport = () => this.loaderService.unloadTransport();
        window.loadControls = () => this.loaderService.loadControls();
        window.unloadControls = () => this.loaderService.unloadControls();
        window.loadMusic = () => this.loaderService.loadMusic();
        window.unloadMusic = () => this.loaderService.unloadMusic();
        window.loadEvents = () => this.loaderService.loadEvents();
        window.unloadEvents = () => this.loaderService.unloadEvents();
        window.loadMenu = () => this.loaderService.loadMenu();
        window.unloadMenu = () => this.loaderService.unloadMenu();
        window.runUniversalFeatures = () => this.runnerService.runUniversalFeatures();
        window.runGlobeComponents = (isAutoLoad) => this.runnerService.runGlobeComponents(isAutoLoad);
        window.runMenuComponents = () => this.runnerService.runMenuComponents();
        window.runGlossaryComponents = (isAutoLoad) => this.runnerService.runGlossaryComponents(isAutoLoad);
        window.runBiographyComponents = (isAutoLoad) => this.runnerService.runBiographyComponents(isAutoLoad);
        window.killUniversalFeatures = () => this.killerService.killUniversalFeatures();
        window.killGlobeComponents = () => this.killerService.killGlobeComponents();
        window.killMenuComponents = () => this.killerService.killMenuComponents();
        window.killGlossaryComponents = () => this.killerService.killGlossaryComponents();
        window.killBiographyComponents = () => this.killerService.killBiographyComponents();
        window.setupMenuButtonListeners = () => this.setupMenuButtonListeners();
    }

    setupMenuButtonListeners() {
        // Set up listeners for dynamically created menu buttons
        const runGlobeBtn = document.getElementById('runGlobeBtn');
        const runGlossaryBtn = document.getElementById('runGlossaryBtn');
        const runBiographyBtn = document.getElementById('runBiographyBtn');
        
        if (runGlobeBtn && !runGlobeBtn.hasAttribute('data-listener-attached')) {
            runGlobeBtn.setAttribute('data-listener-attached', 'true');
            const launchGlobe = async () => {
                this.overlayService.setRunOperation(true);
                this.overlayService.show();
                try {
                    await window.runGlobeComponents();
                } catch (error) {
                    console.error('Error in runGlobeComponents:', error);
                    this.statusService.update(`✗ Error: ${error.message}`, 'error');
                    this.overlayService.setRunOperation(false);
                    this.overlayService.hide();
                }
            };
            runGlobeBtn.addEventListener('click', () => {
                if (typeof window.openGlobeMapLaunchChoice === 'function') {
                    void window.openGlobeMapLaunchChoice({ launchGlobe });
                } else {
                    void launchGlobe();
                }
            });
        }
        
        if (runGlossaryBtn && !runGlossaryBtn.hasAttribute('data-listener-attached')) {
            runGlossaryBtn.setAttribute('data-listener-attached', 'true');
            runGlossaryBtn.addEventListener('click', async () => {
                this.overlayService.setRunOperation(true);
                this.overlayService.show();
                try {
                    await window.runGlossaryComponents();
                } catch (error) {
                    console.error('Error in runGlossaryComponents:', error);
                    this.statusService.update(`✗ Error: ${error.message}`, 'error');
                    this.overlayService.setRunOperation(false);
                    this.overlayService.hide();
                }
            });
        }
        
        if (runBiographyBtn && !runBiographyBtn.hasAttribute('data-listener-attached')) {
            runBiographyBtn.setAttribute('data-listener-attached', 'true');
            runBiographyBtn.addEventListener('click', async () => {
                this.overlayService.setRunOperation(true);
                this.overlayService.show();
                try {
                    await window.runBiographyComponents();
                } catch (error) {
                    console.error('Error in runBiographyComponents:', error);
                    this.statusService.update(`✗ Error: ${error.message}`, 'error');
                    this.overlayService.setRunOperation(false);
                    this.overlayService.hide();
                }
            });
        }
    }

    setupEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('test-loader.js: DOMContentLoaded fired, setting up button listeners...');
            
            // Universal features
            const loadPaletteBtn = document.getElementById('loadPaletteBtn');
            const loadMusicBtn = document.getElementById('loadMusicBtn');
            const runUniversalBtn = document.getElementById('runUniversalBtn');
            const killUniversalBtn = document.getElementById('killUniversalBtn');
            
            // Globe components
            const loadGlobeBaseBtn = document.getElementById('loadGlobeBaseBtn');
            const loadTransportBtn = document.getElementById('loadTransportBtn');
            const loadControlsBtn = document.getElementById('loadControlsBtn');
            const loadEventsBtn = document.getElementById('loadEventsBtn');
            const runGlobeBtn = document.getElementById('runGlobeBtn');
            const killGlobeBtn = document.getElementById('killGlobeBtn');
            
            // Menu components
            const loadMenuBtn = document.getElementById('loadMenuBtn');
            const runMenuBtn = document.getElementById('runMenuBtn');
            const killMenuBtn = document.getElementById('killMenuBtn');
            
            // Glossary components
            const runGlossaryBtn = document.getElementById('runGlossaryBtn');
            const killGlossaryBtn = document.getElementById('killGlossaryBtn');
            
            // Biography components
            const runBiographyBtn = document.getElementById('runBiographyBtn');
            const killBiographyBtn = document.getElementById('killBiographyBtn');
            
            if (loadPaletteBtn) {
                loadPaletteBtn.addEventListener('click', window.loadPalette);
            }
            
            if (loadMusicBtn) {
                loadMusicBtn.addEventListener('click', window.loadMusic);
            }
            
            if (runUniversalBtn) {
                runUniversalBtn.addEventListener('click', async () => {
                    this.overlayService.setRunOperation(true);
                    this.overlayService.show();
                    try {
                        await window.runUniversalFeatures();
                    } catch (error) {
                        console.error('Error in runUniversalFeatures:', error);
                        this.overlayService.setRunOperation(false);
                        this.overlayService.hide();
                    }
                });
            }
            
            if (killUniversalBtn) {
                killUniversalBtn.addEventListener('click', window.killUniversalFeatures);
            }
            
            if (loadMenuBtn) {
                loadMenuBtn.addEventListener('click', window.loadMenu);
            }
            
            if (runMenuBtn) {
                console.log('test-loader.js: Wiring up runMenuBtn');
                runMenuBtn.addEventListener('click', async () => {
                    this.overlayService.setRunOperation(true);
                    this.overlayService.show();
                    try {
                        await window.runMenuComponents();
                    } catch (error) {
                        console.error('Error in runMenuComponents:', error);
                        this.statusService.update(`✗ Error: ${error.message}`, 'error');
                        this.overlayService.setRunOperation(false);
                        this.overlayService.hide();
                    }
                });
            } else {
                console.warn('test-loader.js: runMenuBtn not found!');
            }
            
            if (killMenuBtn) {
                killMenuBtn.addEventListener('click', async () => {
                    try {
                        await window.killMenuComponents();
                    } catch (error) {
                        console.error('Error in killMenuComponents:', error);
                        this.statusService.update(`✗ Error: ${error.message}`, 'error');
                    }
                });
            }
            
            if (loadGlobeBaseBtn) {
                console.log('test-loader.js: Wiring up loadGlobeBaseBtn');
                loadGlobeBaseBtn.addEventListener('click', async () => {
                    try {
                        await window.loadGlobeBase();
                    } catch (error) {
                        console.error('Error in loadGlobeBase:', error);
                        this.statusService.update(`✗ Error: ${error.message}`, 'error');
                    }
                });
            } else {
                console.warn('test-loader.js: loadGlobeBaseBtn not found!');
            }
            
            if (loadTransportBtn) {
                console.log('test-loader.js: Wiring up loadTransportBtn');
                loadTransportBtn.addEventListener('click', async () => {
                    try {
                        await window.loadTransport();
                    } catch (error) {
                        console.error('Error in loadTransport:', error);
                        this.statusService.update(`✗ Error: ${error.message}`, 'error');
                    }
                });
            } else {
                console.warn('test-loader.js: loadTransportBtn not found!');
            }
            
            if (loadControlsBtn) {
                console.log('test-loader.js: Wiring up loadControlsBtn');
                loadControlsBtn.addEventListener('click', async () => {
                    try {
                        await window.loadControls();
                    } catch (error) {
                        console.error('Error in loadControls:', error);
                        this.statusService.update(`✗ Error: ${error.message}`, 'error');
                    }
                });
            } else {
                console.warn('test-loader.js: loadControlsBtn not found!');
            }
            
            if (loadEventsBtn) {
                console.log('test-loader.js: Wiring up loadEventsBtn');
                loadEventsBtn.addEventListener('click', async () => {
                    try {
                        await window.loadEvents();
                    } catch (error) {
                        console.error('Error in loadEvents:', error);
                        this.statusService.update(`✗ Error: ${error.message}`, 'error');
                    }
                });
            } else {
                console.warn('test-loader.js: loadEventsBtn not found!');
            }
            
            // Set up menu button listeners if they exist (for test.html)
            if (runGlobeBtn && !runGlobeBtn.hasAttribute('data-listener-attached')) {
                this.setupMenuButtonListeners();
            }
            
            if (killGlobeBtn) {
                killGlobeBtn.addEventListener('click', async () => {
                    try {
                        await window.killGlobeComponents();
                    } catch (error) {
                        console.error('Error in killGlobeComponents:', error);
                        this.statusService.update(`✗ Error: ${error.message}`, 'error');
                    }
                });
            }
            
            if (killGlossaryBtn) {
                killGlossaryBtn.addEventListener('click', async () => {
                    try {
                        await window.killGlossaryComponents();
                    } catch (error) {
                        console.error('Error in killGlossaryComponents:', error);
                        this.statusService.update(`✗ Error: ${error.message}`, 'error');
                    }
                });
            }
            
            if (killBiographyBtn) {
                killBiographyBtn.addEventListener('click', async () => {
                    try {
                        await window.killBiographyComponents();
                    } catch (error) {
                        console.error('Error in killBiographyComponents:', error);
                        this.statusService.update(`✗ Error: ${error.message}`, 'error');
                    }
                });
            }
            
            this.statusService.update('Test loader ready. Click buttons to load components.', 'info');
        });
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ComponentLoaderCoordinator = ComponentLoaderCoordinator;
}
