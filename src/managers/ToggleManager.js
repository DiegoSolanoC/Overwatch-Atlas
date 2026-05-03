/**
 * ToggleManager - Manages toggle button setup for auto-rotate and hyperloop
 */

export class ToggleManager {
    constructor(sceneModel) {
        this.sceneModel = sceneModel;
    }

    /**
     * Flash a button with a temporary color feedback
     * @param {HTMLElement} element 
     * @param {string} flashClass ('flash-green', 'flash-red', 'flash-orange')
     */
    flashButton(element, flashClass) {
        if (!element) return;
        
        // Remove existing flash classes to restart animation if clicked rapidly
        element.classList.remove('flash-green', 'flash-red', 'flash-orange');
        
        // Use a tiny delay to ensure DOM recognizes the class removal
        requestAnimationFrame(() => {
            element.classList.add(flashClass);
            setTimeout(() => {
                element.classList.remove(flashClass);
            }, 600);
        });
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
            rotateIcon.innerHTML = '<img src="assets/images/icons/Rotation Icon.png" alt="Rotate" style="width: 100%; height: 100%; object-fit: contain;">';
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
                rotateIcon.innerHTML = '<img src="assets/images/icons/Rotation Icon.png" alt="Rotate" style="width: 100%; height: 100%; object-fit: contain;">';
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
            hyperloopIcon.innerHTML = '<img src="assets/images/icons/Train Icon.png" alt="Transport" style="width: 100%; height: 100%; object-fit: contain;">';
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
                console.log('⏸️ Transport systems DISABLED — simulation paused, vehicle meshes hidden, trails cleared, no new spawns');
            }
            
            // Always keep the icon as an image, never change to emoji
            if (hyperloopIcon) {
                hyperloopIcon.innerHTML = '<img src="assets/images/icons/Train Icon.png" alt="Transport" style="width: 100%; height: 100%; object-fit: contain;">';
            }

            console.log(`[ToggleManager hyperloop] Transport ${visible ? 'ENABLED' : 'DISABLED'}, refreshing markers...`);
            
            // Use Event System's EventMarkerManager if available
            const markerManager = window.globeEventMarkerManager || gc?.eventMarkerManager;
            const refreshP = markerManager?.refreshEventMarkers?.(false);
            
            const finishTransportSurfaceSwitch = () => {
                console.log('[ToggleManager hyperloop] Finishing transport surface switch...');
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
                console.log('[ToggleManager hyperloop] Toggle complete');
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
            '<img src="assets/images/icons/Weather Icon.png" alt="Weather" style="width: 100%; height: 100%; object-fit: contain;">';
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
            '<img src="assets/images/icons/Lighting Icon.png" alt="Lighting" style="width: 100%; height: 100%; object-fit: contain;">';
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
                import('../dev/DevSunYawControl.js').then(module => {
                    module.updateSunSliderVisibility(window.globeController);
                }).catch(() => {});
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
     * Setup map view toggle (Earth globe <-> flat map)
     */
    setupMapViewToggle() {
        const toggleBtn = document.getElementById('mapViewToggle');
        const headerToggleBtn = document.getElementById('headerMapViewToggle');
        if (!toggleBtn && !headerToggleBtn) return;

        const mapIcon = toggleBtn ? document.getElementById('mapViewToggleIcon') : null;
        const headerMapIcon = headerToggleBtn ? document.getElementById('headerMapViewToggleIcon') : null;
        const sceneModel = this.sceneModel;
        const rotateBar = document.getElementById('headerRotateSubBar');

        const isMobileGlobeControls = () => (
            typeof window !== 'undefined'
            && window.matchMedia
            && window.matchMedia('(max-width: 768px)').matches
        );

        const getBodyScale = () => {
            try {
                const t = window.getComputedStyle(document.body).transform;
                if (!t || t === 'none') return 1;
                const m = t.match(/^matrix\(([^)]+)\)$/);
                if (!m) return 1;
                const parts = m[1].split(',').map(s => parseFloat(s.trim()));
                const a = parts[0];
                return (Number.isFinite(a) && a > 0) ? a : 1;
            } catch (_) {
                return 1;
            }
        };

        const positionRotateBarUnderToggle = () => {
            if (isMobileGlobeControls() || !rotateBar) return;
            try {
                const gap = 0;
                const scale = getBodyScale();
                const rect = toggleBtn.getBoundingClientRect();
                const margin = 8;
                const vw = Math.max(1, (window.innerWidth || 1) / scale);
                const width = rect.width / scale;
                const top = ((rect.bottom + gap) / scale) - 1;
                let left = rect.left / scale;
                if (left + width > vw - margin) left = Math.max(margin, vw - margin - width);
                if (left < margin) left = margin;
                rotateBar.style.left = `${left}px`;
                rotateBar.style.top = `${top}px`;
                rotateBar.style.width = `${width}px`;
                rotateBar.style.right = 'auto';
                rotateBar.style.bottom = 'auto';
            } catch (_) {
                // no-op
            }
        };

        const bumpRotateBarLayout = () => {
            positionRotateBarUnderToggle();
            requestAnimationFrame(() => {
                positionRotateBarUnderToggle();
                requestAnimationFrame(positionRotateBarUnderToggle);
            });
        };

        const stopRotateBarFollow = () => {
            if (!rotateBar) return;
            try {
                if (rotateBar._followCleanup) {
                    rotateBar._followCleanup();
                    rotateBar._followCleanup = null;
                }
            } catch (_) { /* ignore */ }
        };

        const startRotateBarFollow = () => {
            if (isMobileGlobeControls() || !rotateBar) return;
            stopRotateBarFollow();
            bumpRotateBarLayout();

            let pendingRaf = null;
            const schedule = () => {
                if (pendingRaf != null) return;
                pendingRaf = requestAnimationFrame(() => {
                    pendingRaf = null;
                    if (!document.body.classList.contains('rotate-subbar-open')) return;
                    positionRotateBarUnderToggle();
                });
            };

            const onScroll = () => schedule();
            const onResize = () => schedule();
            window.addEventListener('scroll', onScroll, true);
            window.addEventListener('resize', onResize);

            const headerHub = toggleBtn.closest('.header-hub');
            if (headerHub) headerHub.addEventListener('scroll', onScroll);

            rotateBar._followCleanup = () => {
                window.removeEventListener('scroll', onScroll, true);
                window.removeEventListener('resize', onResize);
                if (headerHub) headerHub.removeEventListener('scroll', onScroll);
                if (pendingRaf != null) {
                    cancelAnimationFrame(pendingRaf);
                    pendingRaf = null;
                }
            };
        };

        if (typeof toggleBtn._mapToggleTeardown === 'function') {
            try {
                toggleBtn._mapToggleTeardown();
            } catch (_) { /* ignore */ }
        }

        const mapToggleAbort = new AbortController();
        const mapSignal = mapToggleAbort.signal;

        if (toggleBtn._mapToggleResizeObserver) {
            try {
                toggleBtn._mapToggleResizeObserver.disconnect();
            } catch (_) { /* ignore */ }
            toggleBtn._mapToggleResizeObserver = null;
        }

        stopRotateBarFollow();

        toggleBtn._mapToggleTeardown = () => {
            mapToggleAbort.abort();
            stopRotateBarFollow();
            if (toggleBtn._mapToggleResizeObserver) {
                try {
                    toggleBtn._mapToggleResizeObserver.disconnect();
                } catch (_) { /* ignore */ }
                toggleBtn._mapToggleResizeObserver = null;
            }
            toggleBtn._mapToggleTeardown = null;
        };

        if (sceneModel.getMapViewEnabled && sceneModel.getMapViewEnabled()) {
            // No class logic
        }

        const getIconPath = (enabled) => enabled
            ? 'assets/images/icons/Switch to Flat Icon.png'
            : 'assets/images/icons/Switch to Globe Icon.png';

        const renderState = () => {
            const enabled = (sceneModel.getMapViewEnabled ? sceneModel.getMapViewEnabled() : !!sceneModel.isMapView);
            const src = getIconPath(enabled);
            const alt = enabled ? 'Map' : 'Globe';
            const imgHtml = `<img src="${src}" alt="${alt}" style="width: 100%; height: 100%; object-fit: contain;">`;

            if (mapIcon) mapIcon.innerHTML = imgHtml;
            if (headerMapIcon) headerMapIcon.innerHTML = imgHtml;

            const setupImgLoad = (iconWrapper) => {
                const img = iconWrapper.querySelector('img');
                if (img && !isMobileGlobeControls()) {
                    const onImgReady = () => {
                        if (!document.body.classList.contains('rotate-subbar-open')) return;
                        bumpRotateBarLayout();
                    };
                    if (img.complete) {
                        requestAnimationFrame(onImgReady);
                    } else {
                        img.addEventListener('load', onImgReady, { once: true });
                    }
                }
            };

            if (mapIcon) setupImgLoad(mapIcon);

            if (toggleBtn) {
                const labelEl = toggleBtn.querySelector('.header-hub-btn-label') || toggleBtn.querySelector('.globe-control-btn__label');
                if (labelEl) labelEl.textContent = enabled ? 'Map' : 'Globe';
                toggleBtn.title = enabled ? 'Click to switch to Globe' : 'Click to switch to Map';
            }

            if (headerToggleBtn) {
                const labelEl = headerToggleBtn.querySelector('.header-hub-btn-label') || headerToggleBtn.querySelector('.globe-control-btn__label');
                if (labelEl) labelEl.textContent = enabled ? 'Map' : 'Globe';
                headerToggleBtn.title = enabled ? 'Click to switch to Globe' : 'Click to switch to Map';
            }

            // Sync globe feature locks when map state changes (do this before mobile check)
            this.syncGlobeLocks();

            if (isMobileGlobeControls()) {
                document.body.classList.remove('rotate-subbar-open');
                stopRotateBarFollow();
                return;
            }

            document.body.classList.toggle('rotate-subbar-open', !enabled);
            bumpRotateBarLayout();
            if (!enabled) {
                startRotateBarFollow();
            } else {
                stopRotateBarFollow();
            }
        };

        renderState();

        try {
            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(() => {
                    if (!isMobileGlobeControls() && document.body.classList.contains('rotate-subbar-open')) {
                        bumpRotateBarLayout();
                    }
                }).catch(() => {});
            }
        } catch (_) { /* ignore */ }

        if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver(() => {
                if (!isMobileGlobeControls() && document.body.classList.contains('rotate-subbar-open')) {
                    positionRotateBarUnderToggle();
                }
            });
            ro.observe(toggleBtn);
            toggleBtn._mapToggleResizeObserver = ro;
        }

        window.addEventListener('load', () => {
            if (!isMobileGlobeControls() && document.body.classList.contains('rotate-subbar-open')) {
                bumpRotateBarLayout();
            }
        }, { signal: mapSignal });

        window.addEventListener('resize', () => {
            renderState();
        }, { signal: mapSignal });

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
                window.SoundEffectsManager.play('switchMap');
            }

            const enabled = !(sceneModel.getMapViewEnabled ? sceneModel.getMapViewEnabled() : !!sceneModel.isMapView);
            
            // Flash feedback (Orange for state switch)
            if (window.flashButton) {
                if (toggleBtn && event.currentTarget === toggleBtn) window.flashButton(toggleBtn, 'flash-orange');
                if (headerToggleBtn && event.currentTarget === headerToggleBtn) window.flashButton(headerToggleBtn, 'flash-orange');
            }

            if (sceneModel.setMapViewEnabled) {
                sceneModel.setMapViewEnabled(enabled);
            } else {
                sceneModel.isMapView = enabled;
            }

            // Apply mode switch via controller (also refreshes markers)
            if (window.globeController && typeof window.globeController.setMapViewEnabled === 'function') {
                window.globeController.setMapViewEnabled(enabled);
            }

            // Update main menu toggle preference to match
            const newStartOnMap = enabled;
            localStorage.setItem('mapGlobePreToggle', newStartOnMap.toString());
            
            // Update main menu UI elements
            const mapGlobeIcon = document.getElementById('mapGlobePreToggleIcon');
            const mapGlobeLabel = document.getElementById('mapGlobePreToggleLabel');
            if (mapGlobeIcon) {
                const iconImg = mapGlobeIcon.querySelector('img');
                if (iconImg) {
                    iconImg.src = newStartOnMap ? 'assets/images/icons/Switch to Flat Icon.png' : 'assets/images/icons/Switch to Globe Icon.png';
                }
            }
            if (mapGlobeLabel) {
                mapGlobeLabel.textContent = newStartOnMap ? 'Starts on Map' : 'Starts on Globe';
            }
            
            if (typeof window.syncGlobeMapLaunchLabels === 'function') {
                window.syncGlobeMapLaunchLabels(newStartOnMap);
            }

            // Keep icon as image (stateful)
            renderState();
        };

        const attachListeners = (btn) => {
            if (!btn) return;
            btn.addEventListener('mousedown', (event) => event.stopPropagation(), { signal: mapSignal });
            btn.addEventListener('mouseup', (event) => event.stopPropagation(), { signal: mapSignal });

            let touchStartTime = 0;
            btn.addEventListener('touchstart', (event) => {
                event.stopPropagation();
                touchStartTime = Date.now();
            }, { signal: mapSignal });
            btn.addEventListener('touchend', (event) => {
                event.stopPropagation();
                event.preventDefault();
                if (Date.now() - touchStartTime < 300) {
                    handleToggle(event);
                }
            }, { signal: mapSignal });

            btn.addEventListener('click', handleToggle, { signal: mapSignal });
        };

        if (toggleBtn) attachListeners(toggleBtn);
        if (headerToggleBtn) attachListeners(headerToggleBtn);
    }

    /**
     * Sync the locked state of globe-only features based on Map View
     */
    syncGlobeLocks() {
        if (!this.sceneModel) return;
        
        const isMap = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const globeButtons = [
            document.getElementById('hyperloopToggle'),
            document.getElementById('weatherEffectsToggle'),
            document.getElementById('lightingToggle'),
            document.getElementById('autoRotateToggle')
        ];

        globeButtons.forEach(btn => {
            if (!btn) return;
            if (isMap) {
                btn.classList.add('globe-locked');
                btn.disabled = true;
                btn.style.pointerEvents = 'none';
                btn.style.opacity = '0.25';
            } else {
                btn.classList.remove('globe-locked');
                btn.disabled = false;
                btn.style.pointerEvents = 'auto';
                btn.style.opacity = '';
            }
        });
    }
}
