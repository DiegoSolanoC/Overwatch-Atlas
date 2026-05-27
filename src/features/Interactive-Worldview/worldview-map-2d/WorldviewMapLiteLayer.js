/**
 * WorldviewMapLiteLayer — DOM/CSS flat Earth map for map view (no WebGL render).
 * Earth markers on the equirectangular layer. Moon/Mars/Orbit panels are laid out in DOM from camera frustum math
 * and each rig’s local Y scale (squash animation only); map mode does not depend on WebGL rig world positions.
 */
import { getMoonTexturePath, getMarsTexturePath, getOrbitTexturePath } from '../worldview-globe-3d/views/helpers/WorldviewGlobePlanes.js';
import { readPaletteKey, texturePathForPalette } from './WorldviewMapLitePrimitives.js';
import { mixin as mapLiteMarkersMixin } from './modules/WorldviewMapLiteLayerMarkersMixin.js';
import { mixin as mapLiteInputMixin } from './modules/WorldviewMapLiteLayerInputMixin.js';

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
}

Object.assign(WorldviewMapLiteLayer.prototype, mapLiteMarkersMixin, mapLiteInputMixin);
