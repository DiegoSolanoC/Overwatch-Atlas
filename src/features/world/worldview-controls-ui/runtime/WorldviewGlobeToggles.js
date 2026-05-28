/**
 * WorldviewGlobeToggles - Manages toggle button setup for auto-rotate and hyperloop
 */

import { updateSunSliderVisibility } from '../../worldview-shared-assets/debug/WorldviewDevSunControl.js';
import { mixin as globeMapViewToggleMixin } from './WorldviewGlobeMapViewToggleMixin.js';

export class WorldviewGlobeToggles {
    constructor(sceneModel) {
        this.sceneModel = sceneModel;
    }
    
    /**
     * Setup auto-rotate toggle
     */
    setupAutoRotateToggle() {
        const toggleBtn = document.getElementById('autoRotateToggle');
        if (!toggleBtn) return;

        if (typeof toggleBtn._rotateToggleTeardown === 'function') {
            try {
                toggleBtn._rotateToggleTeardown();
            } catch (_) { /* ignore */ }
        }
        const rotateAc = new AbortController();
        const rotateSignal = rotateAc.signal;
        toggleBtn._rotateToggleTeardown = () => {
            rotateAc.abort();
            toggleBtn._rotateToggleTeardown = null;
        };
        
        const rotateIcon = document.getElementById('rotateIcon');
        const sceneModel = this.sceneModel;
        
        // Set initial state
        if (!sceneModel.getAutoRotateEnabled()) {
            toggleBtn.classList.add('toggle-off');
        } else {
            toggleBtn.classList.remove('toggle-off');
        }
        
        // Ensure rotation icon always uses local image file
        if (rotateIcon) {
            rotateIcon.innerHTML = '<img src="src/assets/images/Icons/Worldview%20Icons/Rotation%20Icon.png" alt="Rotate" style="width: 100%; height: 100%; object-fit: contain;">';
        }
        
        // Handle button click/touch - unified handler
        const handleToggle = (event) => {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }

            const inCodex = typeof document !== 'undefined' && document.body.classList.contains('codex-mode-active');
            const noGlobe = typeof window !== 'undefined' && !window.globeController;
            if (inCodex || noGlobe) {
                if (typeof window.runGlobeComponents === 'function') {
                    void window.runGlobeComponents(false);
                }
                return;
            }
            
            if (window.SoundEffectsManager) {
                window.SoundEffectsManager.play('rotationToggle');
            }
            
            const enabled = !sceneModel.getAutoRotateEnabled();
            sceneModel.setAutoRotateEnabled(enabled);
            
            // Flash feedback
            if (window.flashButton) {
                window.flashButton(toggleBtn, enabled ? 'flash-green' : 'flash-red');
            }

            if (enabled) {
                toggleBtn.classList.remove('toggle-off');
                sceneModel.setAutoRotate(true);
            } else {
                toggleBtn.classList.add('toggle-off');
                sceneModel.setAutoRotate(false);
            }
            
            // Always keep the icon as an image, never change to emoji
            if (rotateIcon) {
                rotateIcon.innerHTML = '<img src="src/assets/images/Icons/Worldview%20Icons/Rotation%20Icon.png" alt="Rotate" style="width: 100%; height: 100%; object-fit: contain;">';
            }
        };
        
        toggleBtn.addEventListener('mousedown', (event) => {
            event.stopPropagation();
        }, { signal: rotateSignal });
        
        toggleBtn.addEventListener('mouseup', (event) => {
            event.stopPropagation();
        }, { signal: rotateSignal });
        
        let touchStartTime = 0;
        toggleBtn.addEventListener('touchstart', (event) => {
            event.stopPropagation();
            touchStartTime = Date.now();
        }, { signal: rotateSignal });
        
        toggleBtn.addEventListener('touchend', (event) => {
            event.stopPropagation();
            event.preventDefault();
            if (Date.now() - touchStartTime < 300) {
                handleToggle(event);
            }
        }, { signal: rotateSignal });
        
        toggleBtn.addEventListener('click', handleToggle, { signal: rotateSignal });
    }

    /**
     * Setup hyperloop toggle
     * @param {Function} onToggle - Callback when toggle changes
     */
    setupHyperloopToggle(onToggle) {
        const toggleBtn = document.getElementById('hyperloopToggle');
        if (!toggleBtn) return;
        
        const hyperloopIcon = document.getElementById('hyperloopIcon');
        const sceneModel = this.sceneModel;
        
        // Set initial state
        if (!sceneModel.getHyperloopVisible()) {
            toggleBtn.classList.add('toggle-off');
        } else {
            toggleBtn.classList.remove('toggle-off');
        }
        
        // Ensure hyperloop icon always uses local image file
        if (hyperloopIcon) {
            hyperloopIcon.innerHTML = '<img src="src/assets/images/Icons/Worldview%20Icons/Train%20Icon.png" alt="Transport" style="width: 100%; height: 100%; object-fit: contain;">';
        }
        
        // Handle button click/touch - unified handler
        const handleToggle = (event) => {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }
            
            // Play transport toggle sound
            if (window.SoundEffectsManager) {
                window.SoundEffectsManager.play('transportToggle');
            }
            
            const visible = !sceneModel.getHyperloopVisible();
            sceneModel.setHyperloopVisible(visible);

            // Flash feedback
            if (window.flashButton) {
                window.flashButton(toggleBtn, visible ? 'flash-green' : 'flash-red');
            }

            if (visible) {
                toggleBtn.classList.remove('toggle-off');
            } else {
                toggleBtn.classList.add('toggle-off');
            }

            const gc = window.globeController;
            if (gc?.transportView && typeof gc.transportView.updateHyperloopVisibility === 'function') {
                gc.transportView.updateHyperloopVisibility();
            }
            if (gc?.sceneModel?.getMapViewEnabled?.() && gc.transportController?.setSatellitesMapViewEnabled) {
                gc.transportController.setSatellitesMapViewEnabled(true);
            } else {
                // transport hidden in globe mode when hyperloop toggle is disabled
            }
            
            // Always keep the icon as an image, never change to emoji
            if (hyperloopIcon) {
                hyperloopIcon.innerHTML = '<img src="src/assets/images/Icons/Worldview%20Icons/Train%20Icon.png" alt="Transport" style="width: 100%; height: 100%; object-fit: contain;">';
            }

            // Use Event System's EventMarkerManager if available
            const markerManager = window.globeEventMarkerManager || gc?.eventMarkerManager;
            const refreshP = markerManager?.refreshEventMarkers?.(false);
            
            const finishTransportSurfaceSwitch = () => {
                // refreshEventMarkers already ends with updatePlaneVisibility + rebind; do not call
                // updatePlaneVisibility again here (would interrupt orbit panel squash animation).
                // updateHyperloopVisibility must run AFTER new markers exist so event dots + pin lines get visibility.
                // updateSatellites applies satellite.visible immediately (otherwise ISS stays false until next rAF and
                // station markers parented to ISS never draw).
                gc?.transportView?.updateHyperloopVisibility?.();
                if (!gc?.sceneModel?.getMapViewEnabled?.()) {
                    gc?.transportController?.updateSatellites?.();
                }
                gc?.rebindOpenEventMarkerAfterRefresh?.();
                gc?.requestMapLiteSync?.();
                if (onToggle) {
                    onToggle();
                }
            };
            if (refreshP && typeof refreshP.then === 'function') {
                refreshP.then(finishTransportSurfaceSwitch);
            } else {
                finishTransportSurfaceSwitch();
            }
        };
        
        // Prevent button from interfering with globe controls (mouse)
        toggleBtn.addEventListener('mousedown', (event) => {
            event.stopPropagation();
        });
        
        toggleBtn.addEventListener('mouseup', (event) => {
            event.stopPropagation();
        });
        
        // Handle touch events for mobile
        let touchStartTime = 0;
        toggleBtn.addEventListener('touchstart', (event) => {
            event.stopPropagation();
            touchStartTime = Date.now();
        });
        
        toggleBtn.addEventListener('touchend', (event) => {
            event.stopPropagation();
            event.preventDefault();
            // Only trigger if it was a quick tap (not a drag)
            if (Date.now() - touchStartTime < 300) {
                handleToggle(event);
            }
        });
        
        // Handle click events (desktop and fallback)
        toggleBtn.addEventListener('click', handleToggle);
    }

    /**
     * Toggle polar aurora + cloud layer; re-enabling randomizes like reload.
     * @param {Function} [onToggle] - Callback after state updates
     */
    setupWeatherEffectsToggle(onToggle) {
        const toggleBtn = document.getElementById('weatherEffectsToggle');
        if (!toggleBtn) return;

        const weatherIcon = document.getElementById('weatherEffectsIcon');
        const sceneModel = this.sceneModel;

        if (!sceneModel.getGlobeWeatherEffectsVisible()) {
            toggleBtn.classList.add('toggle-off');
        } else {
            toggleBtn.classList.remove('toggle-off');
        }

        const weatherImg =
            '<img src="src/assets/images/Icons/Worldview%20Icons/Weather%20Icon.png" alt="Weather" style="width: 100%; height: 100%; object-fit: contain;">';
        if (weatherIcon) {
            weatherIcon.innerHTML = weatherImg;
        }

        const handleToggle = (event) => {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }

            if (window.SoundEffectsManager) {
                window.SoundEffectsManager.play('weather');
            }

            const visible = !sceneModel.getGlobeWeatherEffectsVisible();
            sceneModel.setGlobeWeatherEffectsVisible(visible);

            // Flash feedback
            if (window.flashButton) {
                window.flashButton(toggleBtn, visible ? 'flash-green' : 'flash-red');
            }

            if (visible) {
                sceneModel.setGlobeWeatherEffectsVisible(true);
                toggleBtn.classList.remove('toggle-off');
            } else {
                sceneModel.setGlobeWeatherEffectsVisible(false);
                toggleBtn.classList.add('toggle-off');
            }

            if (onToggle) {
                onToggle();
            }
        };

        toggleBtn.addEventListener('mousedown', (event) => {
            event.stopPropagation();
        });

        toggleBtn.addEventListener('mouseup', (event) => {
            event.stopPropagation();
        });

        let touchStartTime = 0;
        toggleBtn.addEventListener('touchstart', (event) => {
            event.stopPropagation();
            touchStartTime = Date.now();
        });

        toggleBtn.addEventListener('touchend', (event) => {
            event.stopPropagation();
            event.preventDefault();
            if (Date.now() - touchStartTime < 300) {
                handleToggle(event);
            }
        });

        toggleBtn.addEventListener('click', handleToggle);
    }

    /**
     * Setup lighting toggle (Sun + City Lights + Ambient)
     * @param {Function} [onToggle] - Callback after state updates
     */
    setupLightingToggle(onToggle) {
        const toggleBtn = document.getElementById('lightingToggle');
        if (!toggleBtn) return;

        const lightingIcon = document.getElementById('lightingIcon');
        const sceneModel = this.sceneModel;

        if (!sceneModel.getGlobeLightingVisible()) {
            toggleBtn.classList.add('toggle-off');
        } else {
            toggleBtn.classList.remove('toggle-off');
        }

        const lightingImg =
            '<img src="src/assets/images/Icons/Worldview%20Icons/Lighting%20Icon.png" alt="Lighting" style="width: 100%; height: 100%; object-fit: contain;">';
        if (lightingIcon) {
            lightingIcon.innerHTML = lightingImg;
        }

        const handleToggle = (event) => {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }

            if (window.SoundEffectsManager) {
                window.SoundEffectsManager.play('light');
            }

            const visible = !sceneModel.getGlobeLightingVisible();
            sceneModel.setGlobeLightingVisible(visible);

            // Flash feedback
            if (window.flashButton) {
                window.flashButton(toggleBtn, visible ? 'flash-green' : 'flash-red');
            }

            if (visible) {
                sceneModel.setGlobeLightingVisible(true);
                toggleBtn.classList.remove('toggle-off');
            } else {
                sceneModel.setGlobeLightingVisible(false);
                toggleBtn.classList.add('toggle-off');
            }

            // Update sun slider visibility
            if (window.globeController) {
                updateSunSliderVisibility(window.globeController);
            }

            if (onToggle) {
                onToggle();
            }
        };

        toggleBtn.addEventListener('mousedown', (event) => {
            event.stopPropagation();
        });

        toggleBtn.addEventListener('mouseup', (event) => {
            event.stopPropagation();
        });

        let touchStartTime = 0;
        toggleBtn.addEventListener('touchstart', (event) => {
            event.stopPropagation();
            touchStartTime = Date.now();
        });

        toggleBtn.addEventListener('touchend', (event) => {
            event.stopPropagation();
            event.preventDefault();
            if (Date.now() - touchStartTime < 300) {
                handleToggle(event);
            }
        });

        toggleBtn.addEventListener('click', handleToggle);
    }
}

Object.assign(WorldviewGlobeToggles.prototype, globeMapViewToggleMixin);
