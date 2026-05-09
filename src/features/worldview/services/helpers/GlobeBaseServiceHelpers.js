/**
 * GlobeBaseServiceHelpers - Utilities for globe base setup/teardown in ComponentLoaderService
 * Extracted to reduce complexity
 */

import { clearCodexShellForGlobeInit } from '../../../connection-codex/application/CodexModeService.js';

/**
 * Sets up the globe container for initialization
 * @param {Object} statusService - Status service for updates
 * @returns {HTMLElement|null} - The container element or null
 */
export function setupGlobeContainer(statusService) {
    const container = document.getElementById('globe-container');
    clearCodexShellForGlobeInit(container);
    if (container) {
        container.style.opacity = '0';
        container.style.pointerEvents = 'none';
        container.style.position = 'absolute';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.display = 'block';
    }
    return container;
}

/**
 * Makes the globe container visible
 * @param {HTMLElement} container - The container element
 * @param {Object} statusService - Status service for updates
 */
export function makeGlobeContainerVisible(container, statusService) {
    if (container) {
        container.style.opacity = '1';
        container.style.pointerEvents = 'auto';
        container.style.display = 'block';
        container.classList.add('loaded');
        if (statusService) {
            statusService.update('✓ Globe container made visible', 'success');
        }
    }
}

/**
 * Removes event markers from globe if events aren't loaded
 * @param {Object} controller - GlobeController instance
 * @param {boolean} eventsLoaded - Whether events are loaded
 * @param {Object} statusService - Status service for updates
 */
export function removeEventMarkersIfNeeded(controller, eventsLoaded, statusService) {
    if (eventsLoaded || !controller.globeView) {
        return;
    }
    
    if (statusService) {
        statusService.update('Removing event markers (will load with Event Markers)...', 'info');
    }
    
    const markers = controller.sceneModel.getMarkers();
    const scene = controller.sceneModel.getScene();
    
    markers.forEach(marker => {
        if (marker.userData && marker.userData.isEventMarker) {
            scene.remove(marker);
            const index = controller.sceneModel.getMarkers().indexOf(marker);
            if (index > -1) {
                controller.sceneModel.getMarkers().splice(index, 1);
            }
        }
    });
    
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
    
    if (statusService) {
        statusService.update('✓ Event markers removed', 'success');
    }
}

/**
 * Disposes Three.js resources from globe controller
 * @param {Object} statusService - Status service for updates (optional)
 */
export function disposeGlobeResources(statusService) {
    if (!window.globeController) {
        return;
    }

    const gc = window.globeController;
    if (gc._mapLiteSyncRafId != null) {
        cancelAnimationFrame(gc._mapLiteSyncRafId);
        gc._mapLiteSyncRafId = null;
    }
    if (gc.map2dLite && typeof gc.map2dLite.hide === 'function') {
        gc.map2dLite.hide();
    }
    
    // Stop animations
    if (gc.animationId) {
        cancelAnimationFrame(gc.animationId);
        gc.animationId = null;
    }
    
    if (gc.globeController) {
        gc.globeController.stopAutoRotate();
    }
    
    // Hide container
    const container = document.getElementById('globe-container');
    if (container) {
        container.style.display = 'none';
        container.classList.remove('loaded');
        
        const canvas = container.querySelector('canvas');
        if (canvas) {
            const ctx = canvas.getContext('webgl') || canvas.getContext('webgl2');
            if (ctx) {
                ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);
            }
        }
    }
    
    // Dispose Three.js resources
    const scene = window.globeController.sceneModel?.getScene();
    const renderer = window.globeController.sceneModel?.getRenderer();
    
    if (scene) {
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
        if (renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
    }
    
    window.globeController = null;
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.ServiceGlobeBaseHelpers) {
        window.ServiceGlobeBaseHelpers = {};
    }
    window.ServiceGlobeBaseHelpers.setupGlobeContainer = setupGlobeContainer;
    window.ServiceGlobeBaseHelpers.makeGlobeContainerVisible = makeGlobeContainerVisible;
    window.ServiceGlobeBaseHelpers.removeEventMarkersIfNeeded = removeEventMarkersIfNeeded;
    window.ServiceGlobeBaseHelpers.disposeGlobeResources = disposeGlobeResources;
}
