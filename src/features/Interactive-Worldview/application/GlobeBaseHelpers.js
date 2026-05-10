/**
 * GlobeBaseHelpers - Utilities for loading and unloading GlobeBase components
 * Extracted from component-loader.js to reduce size
 */

import { updateStatus } from '../../universal-features/runtime/statusFeed.js';
import { setButtonState } from '../../universal-features/ComponentSetUp/setButtonState.js';
import { clearCodexShellForGlobeInit } from '../../connection-codex/application/CodexModeService.js';

/**
 * Sets up globe container for initialization (invisible but functional)
 * @param {HTMLElement} container - Globe container element
 */
export function setupGlobeContainer(container) {
    if (!container) return;

    clearCodexShellForGlobeInit(container);
    
    // Make it invisible but still allow rendering (opacity 0, not display none)
    // This allows Three.js to properly initialize the renderer
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    container.style.position = 'absolute';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.display = 'block'; // Must be block for Three.js to work
    // Don't add 'loaded' class yet - will be added after all loading is complete
}

/**
 * Makes globe container visible after loading
 * @param {HTMLElement} container - Globe container element
 */
export function makeGlobeContainerVisible(container) {
    if (!container) return;
    
    container.style.opacity = '1';
    container.style.pointerEvents = 'auto';
    container.style.display = 'block';
    container.classList.add('loaded');
    updateStatus('✓ Globe container made visible', 'success');
}

/**
 * Hides globe container during unload
 * @param {HTMLElement} container - Globe container element
 */
export function hideGlobeContainer(container) {
    if (!container) return;
    
    container.style.display = 'none';
    container.classList.remove('loaded');
    
    // Clear canvas
    const canvas = container.querySelector('canvas');
    if (canvas) {
        const ctx = canvas.getContext('webgl') || canvas.getContext('webgl2');
        if (ctx) {
            ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);
        }
    }
}

/**
 * Stops globe animation loops
 */
export function stopGlobeAnimations() {
    if (!window.globeController) return;

    const gc = window.globeController;
    if (gc._mapLiteSyncRafId != null) {
        cancelAnimationFrame(gc._mapLiteSyncRafId);
        gc._mapLiteSyncRafId = null;
    }
    if (gc.map2dLite && typeof gc.map2dLite.hide === 'function') {
        gc.map2dLite.hide();
    }
    
    if (gc.animationId) {
        cancelAnimationFrame(gc.animationId);
        gc.animationId = null;
    }
    
    // Stop any ongoing animations
    if (gc.globeController) {
        gc.globeController.stopAutoRotate();
    }
}

/**
 * Disposes of Three.js resources
 */
export function disposeThreeJSResources() {
    if (!window.globeController) return;
    
    const scene = window.globeController.sceneModel?.getScene();
    const renderer = window.globeController.sceneModel?.getRenderer();
    
    if (scene) {
        // Dispose of all objects in scene
        scene.traverse((object) => {
            if (object.geometry) {
                object.geometry.dispose();
            }
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(mat => {
                        if (mat.map) mat.map.dispose();
                        mat.dispose();
                    });
                } else {
                    if (object.material.map) object.material.map.dispose();
                    object.material.dispose();
                }
            }
        });
        while(scene.children.length > 0) {
            scene.remove(scene.children[0]);
        }
    }
    
    if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
        // Clear the renderer's DOM element
        if (renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
    }
    
    window.globeController = null;
}

/**
 * Imports and validates GlobeController module
 * @returns {Promise<Function>} - GlobeController class
 */
export async function importGlobeController() {
    updateStatus('Loading GlobeController module...', 'info');
    
    try {
        const module = await import('../presentation/controllers/GlobeController.js');
        const GlobeController = module.GlobeController;
        
        if (!GlobeController) {
            throw new Error('GlobeController not found in module. Available exports: ' + Object.keys(module).join(', '));
        }
        
        return GlobeController;
    } catch (importError) {
        console.error('Failed to import GlobeController:', importError);
        console.error('Import error stack:', importError.stack);
        throw new Error(`Failed to import GlobeController: ${importError.message}. Original error: ${importError}`);
    }
}

/**
 * Initializes GlobeController instance
 * @param {Function} GlobeController - GlobeController class
 * @returns {Object} - Initialized controller instance
 */
export async function initializeGlobeController(GlobeController) {
    updateStatus('Initializing GlobeController...', 'info');
    const controller = new GlobeController();
    window.globeController = controller;
    try {
        delete window.__codexEventSlideBridge;
    } catch (_) { /* ignore */ }
    
    updateStatus('Initializing globe scene...', 'info');
    await controller.init();
    
    return controller;
}

/**
 * Removes event markers from globe (if events aren't loaded yet)
 * @param {Object} controller - GlobeController instance
 * @param {boolean} eventsLoaded - Whether events are loaded
 */
export function removeEventMarkersIfNeeded(controller, eventsLoaded) {
    if (eventsLoaded || !controller.globeView) return;
    
    updateStatus('Removing event markers (will load with Event Markers)...', 'info');
    const markers = controller.sceneModel.getMarkers();
    const scene = controller.sceneModel.getScene();
    
    // Remove event markers from scene
    markers.forEach(marker => {
        if (marker.userData && marker.userData.isEventMarker) {
            scene.remove(marker);
            const index = controller.sceneModel.getMarkers().indexOf(marker);
            if (index > -1) {
                controller.sceneModel.getMarkers().splice(index, 1);
            }
        }
    });
    
    // Also remove event markers from globe children
    const globe = controller.sceneModel.getGlobe();
    if (globe) {
        const toRemove = [];
        globe.traverse((child) => {
            if (child.userData && child.userData.isEventMarker) {
                toRemove.push(child);
            }
        });
        toRemove.forEach(child => {
            if (child.parent) {
                child.parent.remove(child);
            }
        });
    }
    
    updateStatus('✓ Event markers removed', 'success');
}
