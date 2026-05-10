/**
 * ToggleService - Handles toggle button setup (auto-rotate, hyperloop)
 */
class ToggleService {
    constructor(sceneModel) {
        this.sceneModel = sceneModel;
    }

    setupAutoRotateToggle() {
        const toggleBtn = document.getElementById('autoRotateToggle');
        if (!toggleBtn) return;
        
        const rotateIcon = document.getElementById('rotateIcon');
        const sceneModel = this.sceneModel;
        
        // Set initial state
        if (sceneModel.getAutoRotateEnabled()) {
            toggleBtn.classList.add('active');
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
            
            // Play rotation toggle sound
            if (window.SoundEffectsManager) {
                window.SoundEffectsManager.play('rotationToggle');
            }
            
            const enabled = !sceneModel.getAutoRotateEnabled();
            sceneModel.setAutoRotateEnabled(enabled);
            
            if (enabled) {
                toggleBtn.classList.add('active');
                sceneModel.setAutoRotate(true);
                // Clear any pending timeout
                const timeout = sceneModel.autoRotateTimeout;
                if (timeout) {
                    clearTimeout(timeout);
                    sceneModel.autoRotateTimeout = null;
                }
            } else {
                toggleBtn.classList.remove('active');
                sceneModel.setAutoRotate(false);
                // Clear any pending timeout
                const timeout = sceneModel.autoRotateTimeout;
                if (timeout) {
                    clearTimeout(timeout);
                    sceneModel.autoRotateTimeout = null;
                }
            }
            
            // Always keep the icon as an image, never change to emoji
            if (rotateIcon) {
                rotateIcon.innerHTML = '<img src="src/assets/images/Icons/Worldview%20Icons/Rotation%20Icon.png" alt="Rotate" style="width: 100%; height: 100%; object-fit: contain;">';
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

    setupHyperloopToggle(onToggle) {
        const toggleBtn = document.getElementById('hyperloopToggle');
        if (!toggleBtn) return;
        
        const hyperloopIcon = document.getElementById('hyperloopIcon');
        const sceneModel = this.sceneModel;
        
        // Set initial state
        if (sceneModel.getHyperloopVisible()) {
            toggleBtn.classList.add('active');
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

            const gc = window.globeController;
            if (gc?.transportView && typeof gc.transportView.updateHyperloopVisibility === 'function') {
                gc.transportView.updateHyperloopVisibility();
            }
            if (gc?.sceneModel?.getMapViewEnabled?.() && gc.transportController?.setSatellitesMapViewEnabled) {
                gc.transportController.setSatellitesMapViewEnabled(true);
            }

            if (visible) {
                toggleBtn.classList.add('active');
                console.log('🚄 Transport systems ENABLED (Trains, Planes)');
            } else {
                toggleBtn.classList.remove('active');
                console.log('⏸️ Transport systems DISABLED — simulation paused, vehicle meshes hidden, trails cleared, no new spawns');
            }
            
            // Always keep the icon as an image, never change to emoji
            if (hyperloopIcon) {
                hyperloopIcon.innerHTML = '<img src="src/assets/images/Icons/Worldview%20Icons/Train%20Icon.png" alt="Transport" style="width: 100%; height: 100%; object-fit: contain;">';
            }

            console.log(`[hyperloopToggle] Transport ${visible ? 'ENABLED' : 'DISABLED'}, refreshing markers...`);
            
            // Use Event System's EventMarkerManager if available
            const markerManager = window.globeEventMarkerManager || gc?.eventMarkerManager;
            const managerType = window.globeEventMarkerManager ? 'EventSystem' : (gc?.eventMarkerManager ? 'Globe' : 'None');
            console.log(`[hyperloopToggle] Using ${managerType} marker manager:`, markerManager ? 'found' : 'NOT FOUND');
            
            const refreshP = markerManager?.refreshEventMarkers?.(false);
            
            const finishTransportSurfaceSwitch = () => {
                console.log('[hyperloopToggle] Finishing transport surface switch...');
                gc?.transportView?.updateHyperloopVisibility?.();
                if (!gc?.sceneModel?.getMapViewEnabled?.()) {
                    gc?.transportController?.updateSatellites?.();
                }
                gc?.rebindOpenEventMarkerAfterRefresh?.();
                gc?.requestMapLiteSync?.();
                if (onToggle) {
                    onToggle();
                }
                console.log('[hyperloopToggle] Toggle complete');
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
     * @param {Function} [onToggle]
     */
    setupWeatherEffectsToggle(onToggle) {
        const toggleBtn = document.getElementById('weatherEffectsToggle');
        if (!toggleBtn) return;

        const weatherIcon = document.getElementById('weatherEffectsIcon');
        const sceneModel = this.sceneModel;

        if (sceneModel.getGlobeWeatherEffectsVisible()) {
            toggleBtn.classList.add('active');
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

            toggleBtn.classList.toggle('active', visible);

            if (weatherIcon) {
                weatherIcon.innerHTML = weatherImg;
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

// Make available globally
if (typeof window !== 'undefined') {
    window.ToggleService = ToggleService;
}
