/**
 * WorldviewMapLiteLayer — DOM/CSS flat Earth map for map view (no WebGL render).
 * Earth markers on the equirectangular layer. Moon/Mars/Orbit panels are laid out in DOM from camera frustum math
 * and each rig’s local Y scale (squash animation only); map mode does not depend on WebGL rig world positions.
 */
import { shouldEventBeLocked } from '../../system-interface/interface-globe-markers/filtering/shouldEventBeLocked.js';
import { getMarkerColor, EVENT_MARKER_LOCKED_HEX } from '../../system-interface/interface-globe-markers/styling/markerColors.js';
import { getMap2dLiteMarkerDiameterPx } from '../../system-interface/interface-globe-markers/styling/markerSizes.js';
import { getMoonTexturePath, getMarsTexturePath, getOrbitTexturePath } from '../worldview-globe-3d/views/helpers/WorldviewGlobePlanes.js';
import {
    CELESTIAL_DOM_PANEL_VISUAL_SCALE,
    DOM_LITE_MARKER_TRANSITION_MS,
    DOM_LITE_RADIATE_INTERVAL_AWAKENING_MS,
    DOM_LITE_RADIATE_INTERVAL_NORMAL_MS,
    MAP2D_CELESTIAL_DOM_EDGE_PX,
    MAP2D_CELESTIAL_IMG_OPACITY,
    MAP2D_CELESTIAL_PANEL_MAX_ZOOM_MULT,
    MAP2D_CELESTIAL_STACK_GAP_PX,
    MAP2D_LOCK_TRANSITION_MS,
    awakeningWaveMaxScale,
    computeCelestialDomPanelSizePx,
    countRenderableEarthMarkers,
    createMap2dLiteNavigationStub,
    currentPageCelestialFlags,
    hexToCss,
    hexToRgb,
    isMap2dLiteAwakeningEvent,
    isTouchHoverDisabled,
    map2dLiteCelestialMobileSizeFactor,
    readPaletteKey,
    resolveEventImagePath,
    texturePathForPalette
} from './WorldviewMapLitePrimitives.js';

export class WorldviewMapLiteLayer {
    /**
     * @param {{ container: HTMLElement, sceneModel: import('../../worldview-domain-state/models/WorldviewSceneState.js').WorldviewSceneState, dataModel: import('../../worldview-domain-state/models/WorldviewLocationCatalog.js').WorldviewLocationCatalog }} opts
     */
    constructor({ container, sceneModel, dataModel }) {
        this.overlapCycleInterval = null;
        this.overlapGroups = [];
        this.overlapCyclingPaused = false;
        this.container = container;
        this.sceneModel = sceneModel;
        this.dataModel = dataModel;
        this.root = null;
        this.viewport = null;
        this.world = null;
        this.img = null;
        this.markersEl = null;
        this._moonHost = null;
        this._moonImg = null;
        this._moonMarkersEl = null;
        this._marsHost = null;
        this._marsImg = null;
        this._marsMarkersEl = null;
        this._orbitHost = null;
        this._orbitImg = null;
        this._orbitMarkersEl = null;
        /** Fixed 2:1 logical size (equirectangular); markers use % of this box. */
        this._MAP_BASE_W = 1000;
        this._MAP_BASE_H = 500;
        this._baseW = this._MAP_BASE_W;
        this._baseH = this._MAP_BASE_H;
        this._scale = 1;
        this._tx = 0;
        this._ty = 0;
        /** Minimum scale = “cover” viewport (no letterboxing); updated on resize. */
        this._minScale = 1;
        this._maxScale = 14;
        /** Max zoom relative to cover scale */
        this._maxZoomFactor = 14;
        this._lastVw = -1;
        this._lastVh = -1;
        this._dragging = false;
        this._dragPid = null;
        this._lastClientX = 0;
        this._lastClientY = 0;
        this._moved = false;
        this._moonImg = null;
        this._marsImg = null;
        this._moonHost = null;
        this._marsHost = null;
        this._orbitImg = null;
        this._orbitHost = null;
        this._onResize = () => {
            if (this.isVisible()) this._syncCoverScaleToViewport();
        };
        this._wheelHandler = (e) => this._onWheel(e);
        this._boundUp = (e) => this._onPointerUp(e);
        this._boundMove = (e) => this._onPointerMove(e);
        /** Store sound interval for continuous radiate sound on marker hover */
        this._hoverSoundInterval = null;
    }

    ensureDom() {
        if (this.root) return;

        this.root = document.createElement('div');
        this.root.className = 'map-2d-lite';
        this.viewport = document.createElement('div');
        this.viewport.className = 'map-2d-lite__viewport';
        this.world = document.createElement('div');
        this.world.className = 'map-2d-lite__world';
        this.img = document.createElement('img');
        this.img.className = 'map-2d-lite__map-img';
        this.img.alt = '';
        this.img.draggable = false;

        const celest = document.createElement('div');
        celest.className = 'map-2d-lite__celestials';

        this._moonHost = document.createElement('div');
        this._moonHost.className = 'map-2d-lite__celestial-host map-2d-lite__celestial-host--moon';
        this._moonImg = document.createElement('img');
        this._moonImg.className = 'map-2d-lite__celestial-img';
        this._moonImg.alt = '';
        this._moonImg.draggable = false;
        this._moonMarkersEl = document.createElement('div');
        this._moonMarkersEl.className = 'map-2d-lite__markers map-2d-lite__markers--moon';
        this._moonHost.appendChild(this._moonImg);
        this._moonHost.appendChild(this._moonMarkersEl);

        this._marsHost = document.createElement('div');
        this._marsHost.className = 'map-2d-lite__celestial-host map-2d-lite__celestial-host--mars';
        this._marsImg = document.createElement('img');
        this._marsImg.className = 'map-2d-lite__celestial-img';
        this._marsImg.alt = '';
        this._marsImg.draggable = false;
        this._marsMarkersEl = document.createElement('div');
        this._marsMarkersEl.className = 'map-2d-lite__markers map-2d-lite__markers--mars';
        this._marsHost.appendChild(this._marsImg);
        this._marsHost.appendChild(this._marsMarkersEl);

        this._orbitHost = document.createElement('div');
        this._orbitHost.className = 'map-2d-lite__celestial-host map-2d-lite__celestial-host--orbit';
        this._orbitImg = document.createElement('img');
        this._orbitImg.className = 'map-2d-lite__celestial-img';
        this._orbitImg.alt = '';
        this._orbitImg.draggable = false;
        this._orbitMarkersEl = document.createElement('div');
        this._orbitMarkersEl.className = 'map-2d-lite__markers map-2d-lite__markers--orbit';
        this._orbitHost.appendChild(this._orbitImg);
        this._orbitHost.appendChild(this._orbitMarkersEl);

        celest.appendChild(this._moonHost);
        celest.appendChild(this._marsHost);
        celest.appendChild(this._orbitHost);

        this.markersEl = document.createElement('div');
        this.markersEl.className = 'map-2d-lite__markers';

        this.world.appendChild(this.img);
        this.world.appendChild(this.markersEl);
        this.viewport.appendChild(this.world);
        this.root.appendChild(this.viewport);
        this.root.appendChild(celest);
        this.container.appendChild(this.root);

        this.viewport.addEventListener('pointerdown', (e) => this._onPointerDown(e));
        this.viewport.addEventListener('wheel', this._wheelHandler, { passive: false });
        this.viewport.addEventListener('click', (e) => this._onClick(e));
    }

    _mapTexturePath() {
        const p = this.sceneModel.getEarthMapTextureUrl?.() || texturePathForPalette(readPaletteKey());
        return p;
    }

    /**
     * Get current page events - uses Event System data when available, falls back to Globe dataModel
     * @returns {Array} Events for the current page
     */
    _getCurrentPageEvents() {
        // Try Event System data first
        if (window.eventManager?.events && window.standaloneEventSlide?.currentPage) {
            const allEvents = window.eventManager.events;
            const currentPage = window.standaloneEventSlide.currentPage;
            const eventsPerPage = 10;
            const startIndex = (currentPage - 1) * eventsPerPage;
            const endIndex = startIndex + eventsPerPage;
            return allEvents.slice(startIndex, endIndex);
        }
        // Fall back to Globe's dataModel
        return this.dataModel?.getEventsForCurrentPage?.() || [];
    }

    show() {
        this.ensureDom();
        const palette = readPaletteKey();
        this.img.src = this._mapTexturePath();
        this._moonImg.src = getMoonTexturePath(palette);
        this._marsImg.src = getMarsTexturePath(palette);
        if (this._orbitImg) this._orbitImg.src = getOrbitTexturePath();
        this.root.classList.add('map-2d-lite--visible');
        requestAnimationFrame(() => {
            this._fitAndCenter();
            this.layoutCelestialPanelsFromCamera();
            this.syncMarkers({ mode: 'instant' });
        });
        window.addEventListener('resize', this._onResize);
    }

    /** Update map + celestial images when palette or {@link WorldviewSceneState} earth URL changes. */
    refreshTexturesFromScene() {
        if (!this.isVisible() || !this.img) return;
        const palette = readPaletteKey();
        this.img.src = this._mapTexturePath();
        if (this._moonImg) this._moonImg.src = getMoonTexturePath(palette);
        if (this._marsImg) this._marsImg.src = getMarsTexturePath(palette);
        if (this._orbitImg) this._orbitImg.src = getOrbitTexturePath();
    }

    hide() {
        // Stop overlap cycling when hiding map
        this.stopOverlapCycling();
        
        window.removeEventListener('resize', this._onResize);
        this._lastVw = -1;
        this._lastVh = -1;
        if (this.root) {
            this.root.classList.remove('map-2d-lite--visible');
        }
        this._dragging = false;
        if (this._dragPid != null) {
            try {
                this.viewport.releasePointerCapture(this._dragPid);
            } catch (_) { /* ignore */ }
            this._dragPid = null;
        }
    }

    isVisible() {
        return !!(this.root && this.root.classList.contains('map-2d-lite--visible'));
    }

    onContainerResize() {
        if (!this.isVisible() || !this.viewport) return;
        const w = Math.max(1, this.viewport.clientWidth);
        const h = Math.max(1, this.viewport.clientHeight);
        if (w !== this._lastVw || h !== this._lastVh) {
            this._lastVw = w;
            this._lastVh = h;
            this._syncCoverScaleToViewport();
        }
        this.layoutCelestialPanelsFromCamera();
    }

    _coverScaleForViewport(vw, vh) {
        return Math.max(vw / this._MAP_BASE_W, vh / this._MAP_BASE_H);
    }

    /**
     * Recompute min zoom (cover) after a real viewport size change; keep pan/zoom in valid range.
     */
    _syncCoverScaleToViewport() {
        if (!this.viewport) return;
        const w = Math.max(1, this.viewport.clientWidth);
        const h = Math.max(1, this.viewport.clientHeight);
        const cover = this._coverScaleForViewport(w, h);
        this._minScale = cover;
        this._maxScale = cover * this._maxZoomFactor;
        if (this._scale < this._minScale) {
            this._scale = this._minScale;
        }
        if (this._scale > this._maxScale) {
            this._scale = this._maxScale;
        }
        this._clampPan();
        this._applyTransform();
        this._lastVw = w;
        this._lastVh = h;
    }

    _fitAndCenter() {
        if (!this.viewport) return;
        const w = Math.max(1, this.viewport.clientWidth);
        const h = Math.max(1, this.viewport.clientHeight);
        this._lastVw = w;
        this._lastVh = h;

        this._baseW = this._MAP_BASE_W;
        this._baseH = this._MAP_BASE_H;
        this.world.style.width = `${this._baseW}px`;
        this.world.style.height = `${this._baseH}px`;

        const cover = this._coverScaleForViewport(w, h);
        this._minScale = cover;
        this._maxScale = cover * this._maxZoomFactor;
        this._scale = cover;

        const sw = this._baseW * this._scale;
        const sh = this._baseH * this._scale;
        this._tx = (w - sw) / 2;
        this._ty = (h - sh) / 2;
        this._clampPan();
        this._applyTransform();
    }

    /**
     * Moon / Mars / Orbit DOM panels: vertical stack center-right, inset from the right edge.
     * Uses camera + canvas frustum only for pixel size; reads each rig’s scale.y for squash/opacity (same as WebGL panels).
     * Does not use rig world matrices — map sync no longer runs {@link PlaneManager#updatePlanePositions}.
     */
    layoutCelestialPanelsFromCamera() {
        if (!this.isVisible() || !this._moonHost || !this._marsHost || !this._orbitHost || !this.container) return;

        const camera = this.sceneModel?.getCamera?.();
        const renderer = this.sceneModel?.getRenderer?.();
        if (!camera || !renderer?.domElement) return;

        console.log('[layoutCelestialPanelsFromCamera] Updating map celestial panels...');
        
        const moonRig = this.sceneModel?.getMoonRig?.() || this.sceneModel?.moonRig;
        const marsRig = this.sceneModel?.getMarsRig?.() || this.sceneModel?.marsRig;
        const orbitRig = this.sceneModel?.getOrbitRig?.() || this.sceneModel?.orbitRig;
        const moonSy = moonRig?.scale?.y ?? 1;
        const marsSy = marsRig?.scale?.y ?? 1;
        const orbitSy = orbitRig?.scale?.y ?? 1;

        const { hasMoon, hasMars, hasOrbit } = currentPageCelestialFlags(this.dataModel);
        
        console.log(`[layoutCelestialPanelsFromCamera] Panel visibility: Moon=${hasMoon}, Mars=${hasMars}, Orbit=${hasOrbit}`);

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
    }

    /**
     * Rebuild Earth and celestial markers for the current page (matches globe marker behavior).
     * @param {{ mode?: 'pageTurn' | 'instant' }} [opts] - `pageTurn` = exit+grow; `instant` = replace.
     * @returns {Promise<void>}
     */
    async syncMarkers(opts = {}) {
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
            const stub = makeStubMarker(fullEvent, displayEvent, variantIndex, this.sceneModel);
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
    }

    resetView() {
        this._fitAndCenter();
        this.layoutCelestialPanelsFromCamera();
    }

    /**
     * Center map on lat/lon (equirectangular), with a modest zoom — used from event slide "zoom to location".
     */
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
    }

    /**
     * Detect overlapping coordinates and set up cycling for overlapping DOM markers
     * @param {Array} markers - Array of created marker objects
     */
    setupOverlapCycling(markers) {
        console.log('[Map Overlap Cycling] setupOverlapCycling called with', markers.length, 'markers');
        
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
            
            console.log('[Map Overlap Cycling] Checking marker:', marker.stub.userData.eventName, 'coords:', lat, lon);
            
            // Only group events with valid coordinates
            if (lat == null || lon == null) return;
            
            const key = `${lat},${lon}`;
            if (!coordinateGroups.has(key)) {
                coordinateGroups.set(key, []);
            }
            coordinateGroups.get(key).push(marker);
        });

        console.log('[Map Overlap Cycling] Coordinate groups:', coordinateGroups.size);

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
            console.log(`[Map Overlap Cycling] Starting cycling for ${this.overlapGroups.length} coordinate groups`);
            this.overlapCycleInterval = setInterval(() => {
                console.log('[Map Overlap Cycling] Cycling...');
                this.cycleOverlaps();
            }, 5000); // 5 second interval
        } else {
            console.log('[Map Overlap Cycling] No overlap groups found, cycling not started');
        }
    }

    /**
     * Cycle visibility of overlapping DOM markers
     */
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
    }

    /**
     * Pause overlap cycling (called when hovering over a cycling marker)
     */
    pauseOverlapCycling() {
        if (!this.overlapCyclingPaused && this.overlapGroups.length > 0) {
            this.overlapCyclingPaused = true;
            console.log('[Map Overlap Cycling] Paused due to hover');
        }
    }

    /**
     * Resume overlap cycling (called when hover ends)
     */
    resumeOverlapCycling() {
        if (this.overlapCyclingPaused) {
            this.overlapCyclingPaused = false;
            console.log('[Map Overlap Cycling] Resumed after hover');
        }
    }

    /**
     * Stop overlap cycling (call when hiding map or changing pages)
     */
    stopOverlapCycling() {
        if (this.overlapCycleInterval) {
            clearInterval(this.overlapCycleInterval);
            this.overlapCycleInterval = null;
        }
        this.overlapGroups = [];
    }

    /**
     * Force cycle to a specific marker in an overlap group by event
     * @param {Object} event - The event to show
     * @returns {Object|null} - The target marker that was switched to, or null
     */
    forceCycleToEvent(event) {
        if (!event) return null;
        
        console.log('[Map Overlap Cycling] forceCycleToEvent called for:', event.name);
        
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
            console.log('[Map Overlap Cycling] Event not in any overlap group');
            return null; // Not in an overlap group
        }
        
        console.log('[Map Overlap Cycling] Found overlap group with', group.markers.length, 'markers');
        
        // Find the index of the marker for this event
        const targetIndex = group.markers.findIndex(m => {
            const markerEvent = m.stub.userData.event;
            if (!markerEvent) return false;
            return markerEvent.name === event.name &&
                   markerEvent.lat === event.lat &&
                   markerEvent.lon === event.lon;
        });
        
        if (targetIndex === -1) {
            console.log('[Map Overlap Cycling] Could not find marker index for event');
            return null;
        }
        
        console.log('[Map Overlap Cycling] Switching to index:', targetIndex, 'from current:', group.currentIndex);
        
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
                console.log('[Map Overlap Cycling] Cycling...');
                this.cycleOverlaps();
            }, 5000);
        }
        
        return targetMarker;
    }

    /**
     * Force cycle to the next marker for a specific marker (right-click)
     * @param {Object} marker - The marker object that was right-clicked
     */
    forceCycleMarker(marker) {
        // Find which overlap group this marker belongs to
        const group = this.overlapGroups.find(g => g.markers.includes(marker));
        if (!group) return;

        console.log('[Map Overlap Cycling] Force cycling marker:', marker.stub.userData.eventName);

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
                console.log('[Map Overlap Cycling] Cycling...');
                this.cycleOverlaps();
            }, 5000);
        }
    }

    zoomIn() {
        this._zoomAtViewportCenter(1.12);
    }

    zoomOut() {
        this._zoomAtViewportCenter(1 / 1.12);
    }

    _zoomAtViewportCenter(factor) {
        if (!this.viewport) return;
        const w = this.viewport.clientWidth;
        const h = this.viewport.clientHeight;
        const mx = w / 2;
        const my = h / 2;
        this._zoomAt(mx, my, factor);
    }

    _zoomAt(mx, my, factor) {
        const next = Math.max(this._minScale, Math.min(this._maxScale, this._scale * factor));
        if (Math.abs(next - this._scale) < 1e-6) return;
        const wx = (mx - this._tx) / this._scale;
        const wy = (my - this._ty) / this._scale;
        this._scale = next;
        this._tx = mx - wx * this._scale;
        this._ty = my - wy * this._scale;
        this._clampPan();
        this._applyTransform();
    }

    _applyTransform() {
        if (!this.world) return;
        this.world.style.transform = `translate(${this._tx}px, ${this._ty}px) scale(${this._scale})`;
        if (typeof window !== 'undefined' && window.globeController?.requestMapLiteSync) {
            window.globeController.requestMapLiteSync();
        }
    }

    _clampPan() {
        if (!this.viewport) return;
        const vw = this.viewport.clientWidth;
        const vh = this.viewport.clientHeight;
        const sw = this._baseW * this._scale;
        const sh = this._baseH * this._scale;
        const minX = Math.min(0, vw - sw);
        const maxX = Math.max(0, vw - sw);
        const minY = Math.min(0, vh - sh);
        const maxY = Math.max(0, vh - sh);
        this._tx = Math.max(minX, Math.min(maxX, this._tx));
        this._ty = Math.max(minY, Math.min(maxY, this._ty));
    }

    _onWheel(e) {
        if (!this.isVisible()) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = this.viewport.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const delta = e.deltaY * 0.001;
        const factor = Math.exp(-delta * 0.15);
        this._zoomAt(mx, my, factor);
    }

    _onPointerDown(e) {
        if (e.button !== 0) return;
        if (e.target.closest('.map-2d-lite__marker')) return;
        this._dragging = true;
        this._moved = false;
        this._lastClientX = e.clientX;
        this._lastClientY = e.clientY;
        this._dragPid = e.pointerId;
        this.viewport.setPointerCapture(e.pointerId);
        window.addEventListener('pointermove', this._boundMove);
        window.addEventListener('pointerup', this._boundUp);
        window.addEventListener('pointercancel', this._boundUp);
    }

    _onPointerMove(e) {
        if (!this._dragging) return;
        const dx = e.clientX - this._lastClientX;
        const dy = e.clientY - this._lastClientY;
        if (Math.abs(dx) + Math.abs(dy) > 3) this._moved = true;
        this._lastClientX = e.clientX;
        this._lastClientY = e.clientY;
        this._tx += dx;
        this._ty += dy;
        this._clampPan();
        this._applyTransform();
    }

    _onPointerUp(e) {
        if (!this._dragging) return;
        this._dragging = false;
        window.removeEventListener('pointermove', this._boundMove);
        window.removeEventListener('pointerup', this._boundUp);
        window.removeEventListener('pointercancel', this._boundUp);
        if (this._dragPid != null) {
            try {
                this.viewport.releasePointerCapture(this._dragPid);
            } catch (_) { /* ignore */ }
            this._dragPid = null;
        }
    }

    /**
     * Squash celestial panel hosts out (pairs with WebGL {@link PlaneManager#animatePlaneScale} hide timing feel).
     * @returns {Promise<void>}
     */
    _animateCelestialHostsExitIfVisible() {
        const hosts = [this._moonHost, this._marsHost, this._orbitHost].filter(Boolean);
        const visible = hosts.filter((h) => {
            try {
                return window.getComputedStyle(h).display !== 'none';
            } catch (_) {
                return false;
            }
        });
        if (visible.length === 0) return Promise.resolve();
        return Promise.all(
            visible.map(
                (host) =>
                    new Promise((resolve) => {
                        host.classList.remove('map-2d-lite__celestial-host--enter');
                        host.style.transition = `transform ${DOM_LITE_MARKER_TRANSITION_MS}ms cubic-bezier(0.32, 0, 0.67, 1)`;
                        host.style.transformOrigin = '50% 50%';
                        host.style.transform = 'scaleY(0)';
                        window.setTimeout(() => {
                            host.style.transition = '';
                            host.style.transform = '';
                            resolve();
                        }, DOM_LITE_MARKER_TRANSITION_MS + 50);
                    })
            )
        ).then(() => {});
    }

    /**
     * Shrink-out Earth + moon/mars marker bodies (matches {@link animateMarkersShrink} timing).
     * @returns {Promise<void>}
     */
    _animateDomMarkersExit() {
        const earth = [...this.markersEl.querySelectorAll('.map-2d-lite__marker-body')];
        const moon = this._moonMarkersEl
            ? [...this._moonMarkersEl.querySelectorAll('.map-2d-lite__marker-body')]
            : [];
        const mars = this._marsMarkersEl
            ? [...this._marsMarkersEl.querySelectorAll('.map-2d-lite__marker-body')]
            : [];
        const orbit = this._orbitMarkersEl
            ? [...this._orbitMarkersEl.querySelectorAll('.map-2d-lite__marker-body')]
            : [];
        const bodies = [...earth, ...moon, ...mars, ...orbit];
        if (bodies.length === 0) return Promise.resolve();
        bodies.forEach((body) => {
            body.querySelector('.map-2d-lite__marker-disk')?.classList.remove('map-2d-lite__marker-disk--pulse');
        });
        return Promise.all(
            bodies.map(
                (body) =>
                    new Promise((resolve) => {
                        let settled = false;
                        const finish = () => {
                            if (settled) return;
                            settled = true;
                            body.removeEventListener('animationend', onEnd);
                            resolve();
                        };
                        const onEnd = (e) => {
                            const n = e.animationName || '';
                            if (n.includes('map2d-lite-marker-exit')) finish();
                        };
                        body.addEventListener('animationend', onEnd);
                        body.classList.add('map-2d-lite__marker-body--exit');
                        window.setTimeout(finish, DOM_LITE_MARKER_TRANSITION_MS + 80);
                    })
            )
        ).then(() => {});
    }

    _onClick(e) {
        if (this._moved) return;
        if (e.target.closest('.map-2d-lite__marker')) return;
        const ui = window.globeController?.uiView;
        if (ui?.currentEventMarker) {
            ui.hideEventSlide();
        }
        if (typeof window.closeTimelineMusicFiltersPanelsIfOpen === 'function') {
            window.closeTimelineMusicFiltersPanelsIfOpen();
        }
    }

    /**
     * Animate one marker to locked state (scale → 0.75, dark color) like {@link animateMarkerLock} — no shrink-to-zero.
     * @returns {Promise<void>}
     */
    _animateDomMarkerToLocked(btn, stub) {
        return new Promise((resolve) => {
            if (!btn || !stub?.userData) {
                resolve();
                return;
            }
            stub.userData.isLocked = true;
            const disk = btn.querySelector('.map-2d-lite__marker-disk');
            const wave = btn.querySelector('.map-2d-lite__marker-wave');
            disk?.classList.remove('map-2d-lite__marker-disk--pulse');
            btn.classList.remove('map-2d-lite__marker--awakening');
            btn.style.removeProperty('--map2d-wave-max-scale');

            btn.style.transition = `transform ${MAP2D_LOCK_TRANSITION_MS}ms cubic-bezier(0.32, 0, 0.67, 1)`;
            if (disk) {
                disk.style.transition = `background-color ${MAP2D_LOCK_TRANSITION_MS}ms cubic-bezier(0.32, 0, 0.67, 1)`;
                disk.style.backgroundColor = hexToCss(EVENT_MARKER_LOCKED_HEX);
            }
            if (wave) {
                wave.style.transition = `opacity ${Math.min(200, MAP2D_LOCK_TRANSITION_MS)}ms ease-out`;
                wave.style.opacity = '0';
            }
            btn.classList.add('map-2d-lite__marker--locked');
            btn.disabled = true;
            btn.setAttribute('aria-disabled', 'true');
            const fr = hexToRgb(EVENT_MARKER_LOCKED_HEX);
            btn.style.setProperty('--map2d-fill-rgb', `${fr.r},${fr.g},${fr.b}`);

            window.setTimeout(() => {
                btn.style.transition = '';
                if (disk) disk.style.transition = '';
                if (wave?.parentNode) wave.remove();
                resolve();
            }, MAP2D_LOCK_TRANSITION_MS + 40);
        });
    }

    /**
     * Animate one marker to unlocked state like {@link animateMarkerUnlock}.
     * @returns {Promise<void>}
     */
    _animateDomMarkerToUnlocked(btn, stub) {
        return new Promise((resolve) => {
            if (!btn || !stub?.userData) {
                resolve();
                return;
            }
            stub.userData.isLocked = false;
            const id = btn.__map2dLiteIdentity;
            const fullEvent = id?.event;
            if (!fullEvent) {
                resolve();
                return;
            }

            const body = btn.querySelector('.map-2d-lite__marker-body');
            const disk = btn.querySelector('.map-2d-lite__marker-disk');
            const isMain = true;
            const fillHex = getMarkerColor(isMain);

            btn.style.transition = `transform ${MAP2D_LOCK_TRANSITION_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`;
            if (disk) {
                disk.style.transition = `background-color ${MAP2D_LOCK_TRANSITION_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`;
                disk.style.backgroundColor = hexToCss(fillHex);
            }
            btn.classList.remove('map-2d-lite__marker--locked');
            btn.disabled = false;
            btn.removeAttribute('aria-disabled');

            if (body && disk && !body.querySelector('.map-2d-lite__marker-wave')) {
                const wv = document.createElement('span');
                wv.className = 'map-2d-lite__marker-wave';
                wv.setAttribute('aria-hidden', 'true');
                body.insertBefore(wv, disk);
            }

            const waveHex = Number.isFinite(stub.userData.originalColor)
                ? stub.userData.originalColor
                : 0xffaa00;
            const wr = hexToRgb(waveHex);
            btn.style.setProperty('--map2d-pulse-rgb', `${wr.r},${wr.g},${wr.b}`);
            const fr = hexToRgb(fillHex);
            btn.style.setProperty('--map2d-fill-rgb', `${fr.r},${fr.g},${fr.b}`);

            const awakening = isMap2dLiteAwakeningEvent(fullEvent);
            if (awakening) {
                btn.classList.add('map-2d-lite__marker--awakening');
                const u = parseFloat(btn.style.left) / 100;
                const v = parseFloat(btn.style.top) / 100;
                const d = parseFloat(btn.style.width) || getMap2dLiteMarkerDiameterPx(this._baseW, isMain);
                btn.style.setProperty(
                    '--map2d-wave-max-scale',
                    String(awakeningWaveMaxScale(u, v, this._baseW, this._baseH, d))
                );
            } else {
                btn.classList.remove('map-2d-lite__marker--awakening');
                btn.style.removeProperty('--map2d-wave-max-scale');
            }

            window.setTimeout(() => {
                btn.style.transition = '';
                if (disk) disk.style.transition = '';
                disk?.classList.add('map-2d-lite__marker-disk--pulse');
                resolve();
            }, MAP2D_LOCK_TRANSITION_MS + 40);
        });
    }

    _onClick(e) {
        if (this._moved) return;
        if (e.target.closest('.map-2d-lite__marker')) return;
        const ui = window.globeController?.uiView;
        if (ui?.currentEventMarker) {
            ui.hideEventSlide();
        }
        if (typeof window.closeTimelineMusicFiltersPanelsIfOpen === 'function') {
            window.closeTimelineMusicFiltersPanelsIfOpen();
        }
    }

    /**
     * Squash celestial panel hosts out (pairs with WebGL {@link PlaneManager#animatePlaneScale} hide timing feel).
     * @returns {Promise<void>}
     */
    _animateCelestialHostsExitIfVisible() {
        const hosts = [this._moonHost, this._marsHost, this._orbitHost].filter(Boolean);
        const visible = hosts.filter((h) => {
            try {
                return window.getComputedStyle(h).display !== 'none';
            } catch (_) {
                return false;
            }
        });
        if (visible.length === 0) return Promise.resolve();
        return Promise.all(
            visible.map(
                (host) =>
                    new Promise((resolve) => {
                        host.classList.remove('map-2d-lite__celestial-host--enter');
                        host.style.transition = `transform ${DOM_LITE_MARKER_TRANSITION_MS}ms cubic-bezier(0.32, 0, 0.67, 1)`;
                        host.style.transformOrigin = '50% 50%';
                        host.style.transform = 'scaleY(0)';
                        window.setTimeout(() => {
                            host.style.transition = '';
                            host.style.transform = '';
                            resolve();
                        }, DOM_LITE_MARKER_TRANSITION_MS + 50);
                    })
            )
        ).then(() => {});
    }

    /**
     * Shrink-out Earth + moon/mars marker bodies (matches {@link animateMarkersShrink} timing).
     * @returns {Promise<void>}
     */
    _animateDomMarkersExit() {
        const earth = [...this.markersEl.querySelectorAll('.map-2d-lite__marker-body')];
        const moon = this._moonMarkersEl
            ? [...this._moonMarkersEl.querySelectorAll('.map-2d-lite__marker-body')]
            : [];
        const mars = this._marsMarkersEl
            ? [...this._marsMarkersEl.querySelectorAll('.map-2d-lite__marker-body')]
            : [];
        const orbit = this._orbitMarkersEl
            ? [...this._orbitMarkersEl.querySelectorAll('.map-2d-lite__marker-body')]
            : [];
        const bodies = [...earth, ...moon, ...mars, ...orbit];
        if (bodies.length === 0) return Promise.resolve();
        bodies.forEach((body) => {
            body.querySelector('.map-2d-lite__marker-disk')?.classList.remove('map-2d-lite__marker-disk--pulse');
        });
        return Promise.all(
            bodies.map(
                (body) =>
                    new Promise((resolve) => {
                        let settled = false;
                        const finish = () => {
                            if (settled) return;
                            settled = true;
                            body.removeEventListener('animationend', onEnd);
                            resolve();
                        };
                        const onEnd = (e) => {
                            const n = e.animationName || '';
                            if (n.includes('map2d-lite-marker-exit')) finish();
                        };
                        body.addEventListener('animationend', onEnd);
                        body.classList.add('map-2d-lite__marker-body--exit');
                        window.setTimeout(finish, DOM_LITE_MARKER_TRANSITION_MS + 80);
                    })
            )
        ).then(() => {});
    }
}
