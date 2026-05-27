/**
 * Markers, celestial layout, and overlap cycling for {@link WorldviewMapLiteLayer}.
 */
import { getMarkerColor, EVENT_MARKER_LOCKED_HEX } from '../../../system-interface/interface-globe-markers/styling/markerColors.js';
import { getMap2dLiteMarkerDiameterPx } from '../../../system-interface/interface-globe-markers/styling/markerSizes.js';
import {
    CELESTIAL_DOM_PANEL_VISUAL_SCALE,
    DOM_LITE_MARKER_TRANSITION_MS,
    MAP2D_CELESTIAL_DOM_EDGE_PX,
    MAP2D_CELESTIAL_IMG_OPACITY,
    MAP2D_CELESTIAL_PANEL_MAX_ZOOM_MULT,
    MAP2D_CELESTIAL_STACK_GAP_PX,
    awakeningWaveMaxScale,
    computeCelestialDomPanelSizePx,
    createMap2dLiteNavigationStub,
    currentPageCelestialFlags,
    hexToCss,
    hexToRgb,
    isMap2dLiteAwakeningEvent,
    isTouchHoverDisabled,
    map2dLiteCelestialMobileSizeFactor
} from '../WorldviewMapLitePrimitives.js';

export const mixin = {
    layoutCelestialPanelsFromCamera() {
        if (!this.isVisible() || !this._moonHost || !this._marsHost || !this._orbitHost || !this.container) return;

        const camera = this.sceneModel?.getCamera?.();
        const renderer = this.sceneModel?.getRenderer?.();
        if (!camera || !renderer?.domElement) return;

        const moonRig = this.sceneModel?.getMoonRig?.() || this.sceneModel?.moonRig;
        const marsRig = this.sceneModel?.getMarsRig?.() || this.sceneModel?.marsRig;
        const orbitRig = this.sceneModel?.getOrbitRig?.() || this.sceneModel?.orbitRig;
        const moonSy = moonRig?.scale?.y ?? 1;
        const marsSy = marsRig?.scale?.y ?? 1;
        const orbitSy = orbitRig?.scale?.y ?? 1;

        const { hasMoon, hasMars, hasOrbit } = currentPageCelestialFlags(this.dataModel);

        const edge = MAP2D_CELESTIAL_DOM_EDGE_PX;
        const gap = MAP2D_CELESTIAL_STACK_GAP_PX;

        const moonSizeRaw = computeCelestialDomPanelSizePx(camera, renderer, moonSy);
        const marsSizeRaw = computeCelestialDomPanelSizePx(camera, renderer, marsSy);
        const orbitSizeRaw = computeCelestialDomPanelSizePx(camera, renderer, orbitSy);
        if (!moonSizeRaw || !marsSizeRaw || !orbitSizeRaw) return;

        const minS = Math.max(1e-6, this._minScale);
        /* Match marker sizing: dots use diameter × _scale; panels are not inside scaled world, so × min(_scale, cap·min). */
        const panelMapScale = Math.min(this._scale, minS * MAP2D_CELESTIAL_PANEL_MAX_ZOOM_MULT);
        const mobileFac = map2dLiteCelestialMobileSizeFactor();
        const applyMapScaleToPanel = (raw) => ({
            width: Math.max(4, Math.round(raw.width * panelMapScale * CELESTIAL_DOM_PANEL_VISUAL_SCALE * mobileFac)),
            height: Math.max(4, Math.round(raw.height * panelMapScale * CELESTIAL_DOM_PANEL_VISUAL_SCALE * mobileFac))
        });
        const moonSize = applyMapScaleToPanel(moonSizeRaw);
        const marsSize = applyMapScaleToPanel(marsSizeRaw);
        const orbitSize = applyMapScaleToPanel(orbitSizeRaw);

        const showMoon = hasMoon && moonSy > 0.02;
        const showMars = hasMars && marsSy > 0.02;
        const showOrbit = hasOrbit && orbitSy > 0.02;

        let stackH = 0;
        const rows = [];
        if (showMoon) rows.push(moonSize.height);
        if (showMars) rows.push(marsSize.height);
        if (showOrbit) rows.push(orbitSize.height);
        for (let i = 0; i < rows.length; i++) {
            stackH += rows[i];
            if (i < rows.length - 1) stackH += gap;
        }

        const vh = Math.max(1, this.root.clientHeight);
        let stackTop = (vh - stackH) / 2;
        if (stackTop < edge) stackTop = edge;
        if (stackTop + stackH > vh - edge) {
            stackTop = Math.max(edge, vh - stackH - edge);
        }

        const place = (host, squashY, show, size, topPx) => {
            host.style.left = 'auto';
            host.style.right = `${edge}px`;
            host.style.bottom = 'auto';
            const sy = squashY ?? 1;
            if (!show) {
                host.style.display = 'none';
                host.classList.remove('map-2d-lite__celestial-host--enter');
                return;
            }
            host.style.display = 'block';
            host.style.width = `${size.width}px`;
            host.style.height = `${size.height}px`;
            host.style.top = `${Math.round(topPx)}px`;
            const opacity = MAP2D_CELESTIAL_IMG_OPACITY * Math.min(1, Math.max(sy, 0.08));
            host.style.setProperty('--map2d-celestial-img-opacity', String(opacity));
            if (this._domLiteCelestialEnterMode === 'pageTurn') {
                host.classList.remove('map-2d-lite__celestial-host--enter');
                void host.offsetWidth;
                host.classList.add('map-2d-lite__celestial-host--enter');
                window.setTimeout(() => {
                    host.classList.remove('map-2d-lite__celestial-host--enter');
                }, DOM_LITE_MARKER_TRANSITION_MS + 80);
            }
        };

        let y = stackTop;
        place(this._moonHost, moonSy, showMoon, moonSize, y);
        if (showMoon) y += moonSize.height + (showMars || showOrbit ? gap : 0);
        place(this._marsHost, marsSy, showMars, marsSize, y);
        if (showMars) y += marsSize.height + (showOrbit ? gap : 0);
        place(this._orbitHost, orbitSy, showOrbit, orbitSize, y);

        const mw = this._moonHost.style.display === 'none' ? -1 : Math.round(this._moonHost.clientWidth);
        const mrsw = this._marsHost.style.display === 'none' ? -1 : Math.round(this._marsHost.clientWidth);
        const orw = this._orbitHost.style.display === 'none' ? -1 : Math.round(this._orbitHost.clientWidth);
        const mapScale = this._scale;
        const sizeChanged =
            mw !== this._lastCelMoonW
            || mrsw !== this._lastCelMarsW
            || orw !== this._lastCelOrbitW
            || mapScale !== this._lastCelMapScale
            || this._celMarkersDirty;
        if (sizeChanged) {
            this._lastCelMoonW = mw;
            this._lastCelMarsW = mrsw;
            this._lastCelOrbitW = orw;
            this._lastCelMapScale = mapScale;
            this._celMarkersDirty = false;
        }
    },

    syncMarkers(opts = {}) {
        const mode = opts.mode || 'instant';
        if (!this.markersEl || !this.isVisible()) return;

        this.markersEl.replaceChildren();
        this._moonMarkersEl?.replaceChildren();
        this._marsMarkersEl?.replaceChildren();
        this._orbitMarkersEl?.replaceChildren();
        const events = this._getCurrentPageEvents();

        // Track created marker buttons for overlap cycling
        const createdMarkers = [];

        const addMarkerEl = (fullEvent, displayEvent, variantIndex) => {
            const lt = displayEvent.locationType || fullEvent.locationType || 'earth';
            let host, markersContainer;

            if (lt === 'moon') {
                host = this._moonHost;
                markersContainer = this._moonMarkersEl;
            } else if (lt === 'mars') {
                host = this._marsHost;
                markersContainer = this._marsMarkersEl;
            } else if (lt === 'station' || lt === 'marsShip') {
                host = this._orbitHost;
                markersContainer = this._orbitMarkersEl;
            } else {
                // Earth marker
                host = null;
                markersContainer = this.markersEl;
            }

            if (!markersContainer) return;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'map-2d-lite__marker';
            if (lt !== 'earth') {
                btn.classList.add('map-2d-lite__marker--celestial');
            }
            const stub = createMap2dLiteNavigationStub(fullEvent, displayEvent, variantIndex, this.sceneModel);
            btn.__map2dLiteIdentity = {
                event: fullEvent,
                displayEvent,
                variantIndex: variantIndex ?? 0
            };
            btn.__map2dLiteStub = stub;
            // Store marker reference for overlap cycling right-click
            btn.__map2dLiteMarkerRef = null; // Will be set after push to createdMarkers

            const isMain = stub.userData.isMainVariant;
            // Use larger size for celestial markers since panels are smaller
            const baseWidth = (lt === 'earth') ? this._baseW : (this._baseW * 2.5);
            const d = getMap2dLiteMarkerDiameterPx(baseWidth, isMain);
            btn.style.width = `${d}px`;
            btn.style.height = `${d}px`;

            if (lt === 'earth') {
                const lat = displayEvent.lat !== undefined ? displayEvent.lat : fullEvent.lat;
                const lon = displayEvent.lon !== undefined ? displayEvent.lon : fullEvent.lon;
                if (lat == null || lon == null) return;
                const u = (lon + 180) / 360;
                const v = (90 - lat) / 180;
                btn.style.left = `${u * 100}%`;
                btn.style.top = `${v * 100}%`;
            } else {
                const x = displayEvent.x !== undefined ? displayEvent.x : fullEvent.x;
                const y = displayEvent.y !== undefined ? displayEvent.y : fullEvent.y;
                if (x == null || y == null) return;
                btn.style.left = `${x}%`;
                btn.style.top = `${y}%`;
            }

            const fillHex = stub.userData.isLocked ? EVENT_MARKER_LOCKED_HEX : getMarkerColor(isMain);
            const fr = hexToRgb(fillHex);
            btn.style.setProperty('--map2d-fill-rgb', `${fr.r},${fr.g},${fr.b}`);
            const waveHex = Number.isFinite(stub.userData.originalColor)
                ? stub.userData.originalColor
                : 0xffaa00;
            const wr = hexToRgb(waveHex);
            btn.style.setProperty('--map2d-pulse-rgb', `${wr.r},${wr.g},${wr.b}`);

            const awakening = isMap2dLiteAwakeningEvent(fullEvent);

            const body = document.createElement('span');
            body.className = 'map-2d-lite__marker-body';

            const disk = document.createElement('span');
            disk.className = 'map-2d-lite__marker-disk';

            if (stub.userData.isLocked) {
                btn.classList.add('map-2d-lite__marker--locked');
                disk.style.backgroundColor = hexToCss(EVENT_MARKER_LOCKED_HEX);
                btn.disabled = true;
                btn.setAttribute('aria-disabled', 'true');
            } else {
                if (awakening && lt === 'earth') {
                    btn.classList.add('map-2d-lite__marker--awakening');
                    const u = parseFloat(btn.style.left) / 100;
                    const v = parseFloat(btn.style.top) / 100;
                    btn.style.setProperty(
                        '--map2d-wave-max-scale',
                        String(awakeningWaveMaxScale(u, v, this._baseW, this._baseH, d))
                    );
                }
                disk.style.backgroundColor = hexToCss(getMarkerColor(isMain));
                const wave = document.createElement('span');
                wave.className = 'map-2d-lite__marker-wave';
                wave.setAttribute('aria-hidden', 'true');
                body.appendChild(wave);
            }
            body.appendChild(disk);
            btn.appendChild(body);

            // Hover handler - match globe marker behavior
            if (!isTouchHoverDisabled()) {
                btn.addEventListener('mouseenter', () => {
                    if (stub.userData.isLocked) return;
                    const ms = window.globeController?.interactionController?.markerService;
                    ms?.setDomLiteMarkerHover?.(stub);
                    // Play hover radiate sound and start continuous loop
                    if (window.SoundEffectsManager?.play) {
                        window.SoundEffectsManager.play('radiate');
                        // Clear any existing sound loop
                        if (this._hoverSoundInterval) {
                            clearInterval(this._hoverSoundInterval);
                        }
                        // Start continuous sound loop (every 1.2s matches wave animation)
                        this._hoverSoundInterval = setInterval(() => {
                            if (window.SoundEffectsManager?.play) {
                                window.SoundEffectsManager.play('radiate');
                            }
                        }, 1200);
                    }
                    // Pause overlap cycling when hovering
                    this.pauseOverlapCycling();
                });
                btn.addEventListener('mouseleave', () => {
                    const ms = window.globeController?.interactionController?.markerService;
                    ms?.clearDomLiteMarkerHoverIf?.(stub);
                    // Clear continuous sound loop
                    if (this._hoverSoundInterval) {
                        clearInterval(this._hoverSoundInterval);
                        this._hoverSoundInterval = null;
                    }
                    // Resume overlap cycling when hover ends
                    this.resumeOverlapCycling();
                });
            }

            // Click handler - match globe marker behavior exactly
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();

                // Match globe marker logic - only allow clicks on interactive markers
                if (stub.userData.isInteractive === false) {
                    return;
                }

                if (stub.userData.isLocked) {
                    return;
                }

                // Don't allow event marker clicks when image overlay is visible
                const eventImageOverlay = document.getElementById('eventImageOverlay');
                if (eventImageOverlay && eventImageOverlay.classList.contains('open')) {
                    const opacity = parseFloat(window.getComputedStyle(eventImageOverlay).opacity);
                    if (opacity > 0.1) {
                        return;
                    }
                }

                // Find event index in Event System (match globe marker logic)
                const events = window.eventManager?.getDockTimelineEvents?.() || [];
                const eventData = stub.userData.event;
                let eventIndex = events.findIndex(e => e === eventData);
                if (eventIndex < 0) {
                    const name = eventData?.name;
                    eventIndex = events.findIndex(e => (e.name || '').trim() === (name || '').trim());
                }

                // Check if same event is already open (match globe marker logic)
                const currentIndex = window.standaloneEventSlide?.currentEventIndex;
                const eventSlide = document.getElementById('eventSlide');
                if (eventIndex >= 0 && eventIndex === currentIndex && eventSlide && eventSlide.classList.contains('open')) {
                    // Same event and slide is open - close it
                    eventSlide.classList.remove('open');
                    return;
                }

                // Open event slide with viewport-based routing
                if (eventIndex >= 0) {
                    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                    const isMobilePortrait = isTouchDevice && window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
                    if (isMobilePortrait && window.standaloneEventSlide) {
                        // Mobile portrait: use standalone implementation
                        window.standaloneEventSlide.showEvent(eventIndex);
                    } else if (window.globeController?.uiView) {
                        // Desktop / mobile landscape: use simple dock-like implementation
                        const eventData = events[eventIndex];
                        const eventName = eventData?.name || 'Event';
                        const eventDescription = eventData?.description || '';
                        const imagePath = window.eventManager?.getEventImagePath
                            ? window.eventManager.getEventImagePath(eventData.name, eventData.image, 'story')
                            : null;
                        window.globeController.uiView.showEventSlide(eventName, imagePath, eventDescription, stub, eventData);
                    }
                    if (window.SoundEffectsManager?.play) {
                        window.SoundEffectsManager.play('eventClick');
                    }
                }
            });

            // Right-click handler to force cycle overlapping markers
            btn.addEventListener('contextmenu', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                
                // Use the stored marker reference
                const markerObj = btn.__map2dLiteMarkerRef;
                if (markerObj) {
                    this.forceCycleMarker(markerObj);
                }
            });

            markersContainer.appendChild(btn);

            if (!stub.userData.isLocked) {
                disk.classList.add('map-2d-lite__marker-disk--pulse');
            }
            
            // Track marker for overlap cycling
            const markerObj = {
                btn,
                disk,
                stub,
                lat: displayEvent.lat !== undefined ? displayEvent.lat : fullEvent.lat,
                lon: displayEvent.lon !== undefined ? displayEvent.lon : fullEvent.lon,
                locationType: lt
            };
            createdMarkers.push(markerObj);
            // Set reference on button for right-click handler
            btn.__map2dLiteMarkerRef = markerObj;
        };

        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            if (event.variants && event.variants.length > 0) {
                addMarkerEl(event, event.variants[0], 0);
            } else {
                addMarkerEl(event, event, null);
            }
        }
        
        // Set up overlap cycling for Earth markers
        this.setupOverlapCycling(createdMarkers);
    },

    resetView() {
        this._fitAndCenter();
        this.layoutCelestialPanelsFromCamera();
    },

    flyToLatLon(lat, lon) {
        if (!this.viewport || !this.world) return;
        const u = (lon + 180) / 360;
        const v = (90 - lat) / 180;
        const wx = u * this._baseW;
        const wy = v * this._baseH;
        const vw = this.viewport.clientWidth;
        const vh = this.viewport.clientHeight;
        this._scale = Math.min(this._maxScale, Math.max(this._scale, this._minScale * 1.85));
        this._tx = vw / 2 - wx * this._scale;
        this._ty = vh / 2 - wy * this._scale;
        this._clampPan();
        this._applyTransform();
    },

    setupOverlapCycling(markers) {
        
        // Clear any existing interval
        if (this.overlapCycleInterval) {
            clearInterval(this.overlapCycleInterval);
            this.overlapCycleInterval = null;
        }
        this.overlapGroups = [];

        // Group Earth markers by coordinate
        const coordinateGroups = new Map();
        
        markers.forEach(marker => {
            // Only Earth markers
            if (marker.locationType !== 'earth') return;
            
            const lat = marker.lat;
            const lon = marker.lon;
            
            // Only group events with valid coordinates
            if (lat == null || lon == null) return;
            
            const key = `${lat},${lon}`;
            if (!coordinateGroups.has(key)) {
                coordinateGroups.set(key, []);
            }
            coordinateGroups.get(key).push(marker);
        });

        // Create overlap groups for coordinates with multiple markers
        coordinateGroups.forEach((groupMarkers, key) => {
            if (groupMarkers.length > 1) {
                console.log(`[Map Overlap Cycling] Found ${groupMarkers.length} markers at coordinate ${key}:`, groupMarkers.map(m => m.stub.userData.eventName));
                this.overlapGroups.push({
                    markers: groupMarkers,
                    currentIndex: 0
                });
                
                // Initially hide all except the first, and set colors
                groupMarkers.forEach((marker, index) => {
                    marker.btn.style.display = (index === 0) ? '' : 'none';
                    
                    // Set color based on index: first = orange, second = pink
                    if (index === 0) {
                        // First marker: regular orange
                        const fillHex = marker.stub.userData.isLocked ? EVENT_MARKER_LOCKED_HEX : getMarkerColor(marker.stub.userData.isMainVariant);
                        marker.disk.style.backgroundColor = hexToCss(fillHex);
                        const fr = hexToRgb(fillHex);
                        marker.btn.style.setProperty('--map2d-fill-rgb', `${fr.r},${fr.g},${fr.b}`);
                        marker.btn.style.setProperty('--map2d-pulse-rgb', `${fr.r},${fr.g},${fr.b}`);
                    } else if (index === 1) {
                        // Second marker: pink
                        const pinkHex = 0xff69b4;
                        marker.disk.style.backgroundColor = hexToCss(pinkHex);
                        const pr = hexToRgb(pinkHex);
                        marker.btn.style.setProperty('--map2d-fill-rgb', `${pr.r},${pr.g},${pr.b}`);
                        marker.btn.style.setProperty('--map2d-pulse-rgb', `${pr.r},${pr.g},${pr.b}`);
                    }
                });
            }
        });

        // If there are overlap groups, start cycling
        if (this.overlapGroups.length > 0) {
            this.overlapCycleInterval = setInterval(() => {
                this.cycleOverlaps();
            }, 5000); // 5 second interval
        } else {
        }
    },

    cycleOverlaps() {
        // Skip cycling if paused (hovering)
        if (this.overlapCyclingPaused) {
            return;
        }
        
        this.overlapGroups.forEach(group => {
            // Hide current marker
            const currentMarker = group.markers[group.currentIndex];
            if (currentMarker) {
                currentMarker.btn.style.display = 'none';
            }

            // Move to next marker (loop back to start)
            group.currentIndex = (group.currentIndex + 1) % group.markers.length;

            // Show next marker
            const nextMarker = group.markers[group.currentIndex];
            if (nextMarker) {
                nextMarker.btn.style.display = '';
                
                // Update color based on which marker is now visible
                if (group.currentIndex === 0) {
                    // First marker: regular orange
                    const fillHex = nextMarker.stub.userData.isLocked ? EVENT_MARKER_LOCKED_HEX : getMarkerColor(nextMarker.stub.userData.isMainVariant);
                    nextMarker.disk.style.backgroundColor = hexToCss(fillHex);
                    // Update wave color to match
                    const fr = hexToRgb(fillHex);
                    nextMarker.btn.style.setProperty('--map2d-fill-rgb', `${fr.r},${fr.g},${fr.b}`);
                    nextMarker.btn.style.setProperty('--map2d-pulse-rgb', `${fr.r},${fr.g},${fr.b}`);
                } else if (group.currentIndex === 1) {
                    // Second marker: pink
                    const pinkHex = 0xff69b4;
                    nextMarker.disk.style.backgroundColor = hexToCss(pinkHex);
                    // Update wave color to match
                    const pr = hexToRgb(pinkHex);
                    nextMarker.btn.style.setProperty('--map2d-fill-rgb', `${pr.r},${pr.g},${pr.b}`);
                    nextMarker.btn.style.setProperty('--map2d-pulse-rgb', `${pr.r},${pr.g},${pr.b}`);
                }
            }
        });
    },

    pauseOverlapCycling() {
        if (!this.overlapCyclingPaused && this.overlapGroups.length > 0) {
            this.overlapCyclingPaused = true;
        }
    },

    resumeOverlapCycling() {
        if (this.overlapCyclingPaused) {
            this.overlapCyclingPaused = false;
        }
    },

    stopOverlapCycling() {
        if (this.overlapCycleInterval) {
            clearInterval(this.overlapCycleInterval);
            this.overlapCycleInterval = null;
        }
        this.overlapGroups = [];
    },

    forceCycleToEvent(event) {
        if (!event) return null;
        
        // Find the overlap group that contains this event
        const group = this.overlapGroups.find(g => 
            g.markers.some(m => {
                const markerEvent = m.stub.userData.event;
                if (!markerEvent) return false;
                // Compare by name and location since event objects might be different references
                return markerEvent.name === event.name &&
                       markerEvent.lat === event.lat &&
                       markerEvent.lon === event.lon;
            })
        );
        
        if (!group) {
            return null; // Not in an overlap group
        }
        
        // Find the index of the marker for this event
        const targetIndex = group.markers.findIndex(m => {
            const markerEvent = m.stub.userData.event;
            if (!markerEvent) return false;
            return markerEvent.name === event.name &&
                   markerEvent.lat === event.lat &&
                   markerEvent.lon === event.lon;
        });
        
        if (targetIndex === -1) {
            return null;
        }
        
        // Hide current marker
        const currentMarker = group.markers[group.currentIndex];
        if (currentMarker) {
            currentMarker.btn.style.display = 'none';
        }
        
        // Set to target index
        group.currentIndex = targetIndex;
        
        // Show target marker
        const targetMarker = group.markers[targetIndex];
        if (targetMarker) {
            targetMarker.btn.style.display = '';
            
            // Update color based on index
            if (targetIndex === 0) {
                // First marker: regular orange
                const fillHex = targetMarker.stub.userData.isLocked ? EVENT_MARKER_LOCKED_HEX : getMarkerColor(targetMarker.stub.userData.isMainVariant);
                targetMarker.disk.style.backgroundColor = hexToCss(fillHex);
                const fr = hexToRgb(fillHex);
                targetMarker.btn.style.setProperty('--map2d-fill-rgb', `${fr.r},${fr.g},${fr.b}`);
                targetMarker.btn.style.setProperty('--map2d-pulse-rgb', `${fr.r},${fr.g},${fr.b}`);
            } else if (targetIndex === 1) {
                // Second marker: pink
                const pinkHex = 0xff69b4;
                targetMarker.disk.style.backgroundColor = hexToCss(pinkHex);
                const pr = hexToRgb(pinkHex);
                targetMarker.btn.style.setProperty('--map2d-fill-rgb', `${pr.r},${pr.g},${pr.b}`);
                targetMarker.btn.style.setProperty('--map2d-pulse-rgb', `${pr.r},${pr.g},${pr.b}`);
                
                // Ensure wave element exists for the target marker
                const body = targetMarker.btn.querySelector('.map-2d-lite__marker-body');
                if (body && !body.querySelector('.map-2d-lite__marker-wave')) {
                    const wave = document.createElement('span');
                    wave.className = 'map-2d-lite__marker-wave';
                    wave.setAttribute('aria-hidden', 'true');
                    const disk = body.querySelector('.map-2d-lite__marker-disk');
                    if (disk) {
                        body.insertBefore(wave, disk);
                    } else {
                        body.appendChild(wave);
                    }
                }
            }
        }
        
        // Reset the interval timer
        if (this.overlapCycleInterval) {
            clearInterval(this.overlapCycleInterval);
            this.overlapCycleInterval = setInterval(() => {
                this.cycleOverlaps();
            }, 5000);
        }
        
        return targetMarker;
    },

    forceCycleMarker(marker) {
        // Find which overlap group this marker belongs to
        const group = this.overlapGroups.find(g => g.markers.includes(marker));
        if (!group) return;

        // Hide current marker
        const currentMarker = group.markers[group.currentIndex];
        if (currentMarker) {
            currentMarker.btn.style.display = 'none';
        }

        // Move to next marker
        group.currentIndex = (group.currentIndex + 1) % group.markers.length;

        // Show next marker
        const nextMarker = group.markers[group.currentIndex];
        if (nextMarker) {
            nextMarker.btn.style.display = '';
            
            // Update color based on which marker is now visible
            if (group.currentIndex === 0) {
                // First marker: regular orange
                const fillHex = nextMarker.stub.userData.isLocked ? EVENT_MARKER_LOCKED_HEX : getMarkerColor(nextMarker.stub.userData.isMainVariant);
                nextMarker.disk.style.backgroundColor = hexToCss(fillHex);
                const fr = hexToRgb(fillHex);
                nextMarker.btn.style.setProperty('--map2d-fill-rgb', `${fr.r},${fr.g},${fr.b}`);
                nextMarker.btn.style.setProperty('--map2d-pulse-rgb', `${fr.r},${fr.g},${fr.b}`);
            } else if (group.currentIndex === 1) {
                // Second marker: pink
                const pinkHex = 0xff69b4;
                nextMarker.disk.style.backgroundColor = hexToCss(pinkHex);
                const pr = hexToRgb(pinkHex);
                nextMarker.btn.style.setProperty('--map2d-fill-rgb', `${pr.r},${pr.g},${pr.b}`);
                nextMarker.btn.style.setProperty('--map2d-pulse-rgb', `${pr.r},${pr.g},${pr.b}`);
            }
        }

        // Reset the interval timer
        if (this.overlapCycleInterval) {
            clearInterval(this.overlapCycleInterval);
            this.overlapCycleInterval = setInterval(() => {
                this.cycleOverlaps();
            }, 5000);
        }
    },

};
