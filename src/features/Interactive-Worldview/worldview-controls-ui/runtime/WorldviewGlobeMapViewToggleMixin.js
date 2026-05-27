/**
 * Map view toggle and globe-only control locks for {@link WorldviewGlobeToggles}.
 */
import { updateSunSliderVisibility } from '../../worldview-shared-assets/debug/WorldviewDevSunControl.js';

export const mixin = {
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
            ? 'src/assets/images/Icons/Worldview%20Icons/Switch%20to%20Flat%20Icon.png'
            : 'src/assets/images/Icons/Worldview%20Icons/Switch%20to%20Globe%20Icon.png';

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
                    iconImg.src = newStartOnMap ? 'src/assets/images/Icons/Worldview%20Icons/Switch%20to%20Flat%20Icon.png' : 'src/assets/images/Icons/Worldview%20Icons/Switch%20to%20Globe%20Icon.png';
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
    },

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
    },

};
