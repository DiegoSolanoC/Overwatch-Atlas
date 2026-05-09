/**
 * ComponentKillerService - Handles killing (unloading) groups of components
 */
class ComponentKillerService {
    constructor(loaderService, statusService) {
        this.loaderService = loaderService;
        this.statusService = statusService;
    }

    async killUniversalFeatures() {
        this.statusService.update('Killing all Universal Features...', 'info');
        
        if (this.loaderService.isLoaded('palette')) {
            await this.loaderService.unloadPalette();
        }
        
        if (this.loaderService.isLoaded('music')) {
            await this.loaderService.unloadMusic();
        }
        
        this.statusService.update('✓ All Universal Features killed!', 'success');
    }

    async killGlobeComponents() {
        this.statusService.update('Killing all Globe Components...', 'info');
        
        // Check if Event System Load Out is active
        const testBtn = document.getElementById('testBtn');
        const eventSystemActive = testBtn?.dataset.loaded === 'true' && 
                                  window.eventManager?.listenersSetup === true;
        
        // Only unload events if Event System is NOT active
        // Globe no longer owns event loading - it relies on Event System
        if (this.loaderService.isLoaded('events') && !eventSystemActive) {
            await this.loaderService.unloadEvents();
        } else if (eventSystemActive) {
            this.statusService.update('→ Event System active, preserving events', 'info');
        }
        
        if (this.loaderService.isLoaded('controls')) {
            await this.loaderService.unloadControls();
        }
        
        if (this.loaderService.isLoaded('transport')) {
            await this.loaderService.unloadTransport();
        }
        
        if (this.loaderService.isLoaded('globeBase')) {
            // Preserve events UI if Event System is still active
            await this.loaderService.unloadGlobeBase({ preserveEventsUi: eventSystemActive });
        }
        
        const testContainer = document.querySelector('.test-container');
        if (testContainer) {
            testContainer.style.display = 'block';
        }
        
        // Show main menu buttons again (timeline app / index.html)
        const mainMenuButtons = document.querySelector('.main-menu-buttons');
        if (mainMenuButtons) {
            mainMenuButtons.style.display = '';
            this.statusService.update('→ Showing main menu buttons...', 'info');
        }
        
        this.statusService.update('✓ All Globe Components killed!', 'success');
    }

    async killMenuComponents() {
        this.statusService.update('Killing all Menu Components...', 'info');
        
        if (this.loaderService.isLoaded('menu')) {
            await this.loaderService.unloadMenu();
        }
        
        this.statusService.update('✓ All Menu Components killed!', 'success');
    }

    async killGlossaryComponents() {
        this.statusService.update('Killing all Glossary Components...', 'info');
        
        this.loaderService.setLoaded('glossary', false);
        
        this.statusService.update('✓ All Glossary Components killed!', 'success');
    }

    async killBiographyComponents() {
        this.statusService.update('Killing all Biography Components...', 'info');
        
        this.loaderService.setLoaded('biography', false);
        
        this.statusService.update('✓ All Biography Components killed!', 'success');
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ComponentKillerService = ComponentKillerService;
}
