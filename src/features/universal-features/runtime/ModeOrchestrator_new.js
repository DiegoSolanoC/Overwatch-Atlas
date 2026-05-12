/**
 * ModeOrchestrator - Runtime that owns lifecycle coordination for different modes.
 * 
 * Manages the lifecycle of different application modes (Menu, Globe, Codex, Data Archive, etc.)
 * with proper loading, unloading, and mutual exclusion between heavy modes.
 */

import { setRunOperation, hideLoadingOverlay } from './loadingOverlayState.js';

/**
 * ModeOrchestrator class
 * @param {Object} loadedComponents - Shared state for tracking loaded components
 * @param {Object} loaders - Component loading functions
 * @param {Object} unloaders - Component unloading functions
 */
export class ModeOrchestrator {
    constructor(loadedComponents, loaders, unloaders) {
        this.loadedComponents = loadedComponents;
        this.loaders = loaders;
        this.unloaders = unloaders;
        this.currentMode = null;
    }

    /**
     * Run menu components
     * @param {Object} options - Options for menu loading
     */
    async runMenuComponents(options = {}) {
        if (this.loaders.menu) {
            return await this.loaders.menu(options);
        }
    }

    /**
     * Run universal features
     * @param {Object} options - Options for universal features loading
     */
    async runUniversalFeatures(options = {}) {
        // Load palette button
        if (this.loaders.palette) {
            await this.loaders.palette();
        }
        
        // Load music button
        if (this.loaders.music) {
            await this.loaders.music();
        }
        
        // Load header navigation (mode buttons: Worldview, Codex, Data Archive, Home)
        if (this.loaders.headerNav) {
            await this.loaders.headerNav();
        }
        
        if (this.loaders.universalFeatures) {
            return await this.loaders.universalFeatures(options);
        }
    }

    /**
     * Run globe components
     * @param {boolean} isAutoLoad - Whether this is an auto-load
     */
    async runGlobeComponents(isAutoLoad = false) {
        if (this.loaders.globeBase) {
            try {
                return await this.loaders.globeBase(isAutoLoad);
            } finally {
                // Reset the run operation flag so the overlay can be hidden
                setRunOperation(false);
                hideLoadingOverlay();
            }
        }
    }

    /**
     * Kill menu components
     */
    async killMenuComponents() {
        if (this.unloaders.menu) {
            return await this.unloaders.menu();
        }
    }

    /**
     * Kill universal features
     */
    async killUniversalFeatures() {
        if (this.unloaders.universalFeatures) {
            return await this.unloaders.universalFeatures();
        }
    }

    /**
     * Restore main menu
     */
    async restoreMainMenu() {
        if (this.unloaders.globeBase) {
            return await this.unloaders.globeBase();
        }
    }

    /**
     * Kill globe components
     */
    async killGlobeComponents() {
        if (this.unloaders.globeBase) {
            return await this.unloaders.globeBase();
        }
    }

    /**
     * Run glossary components
     * @param {boolean} isAutoLoad - Whether this is an auto-load
     */
    async runGlossaryComponents(isAutoLoad = false) {
        if (this.loaders.glossary) {
            return await this.loaders.glossary(isAutoLoad);
        }
    }

    /**
     * Kill glossary components
     */
    async killGlossaryComponents() {
        if (this.unloaders.glossary) {
            return await this.unloaders.glossary();
        }
    }

    /**
     * Run biography components
     * @param {boolean} isAutoLoad - Whether this is an auto-load
     */
    async runBiographyComponents(isAutoLoad = false) {
        if (this.loaders.biography) {
            return await this.loaders.biography(isAutoLoad);
        }
    }

    /**
     * Kill biography components
     */
    async killBiographyComponents() {
        if (this.unloaders.biography) {
            return await this.unloaders.biography();
        }
    }

    /**
     * Open Data Archive events view (for Data Archive integration)
     * @param {string} archiveSource - Archive source to open
     */
    async openDataArchiveEventsView(archiveSource = 'story') {
        // This method is called by keyboard shortcuts and other parts of the app
        // It should delegate to the Data Archive mode orchestrator
        if (window.modeOrchestrator && typeof window.modeOrchestrator.runBiographyComponents === 'function') {
            return await window.modeOrchestrator.runBiographyComponents(false);
        }
    }
}