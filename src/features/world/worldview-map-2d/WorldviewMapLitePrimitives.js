import { shouldEventBeLocked } from '../../system-interface/interface-globe-markers/filtering/shouldEventBeLocked.js';
import { getMarkerColor } from '../../system-interface/interface-globe-markers/styling/markerColors.js';

export function readPaletteKey() {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('colorPalette') : null;
    if (saved === 'gray') return 'gray';
    if (saved === 'crimson') return 'crimson';
    if (saved === 'nulled') return 'nulled';
    return 'blue';
}

export function texturePathForPalette(key) {
    if (key === 'gray') return 'src/assets/images/Maps/Earth%20Textures/MAP Black.png';
    if (key === 'crimson') return 'src/assets/images/Maps/Earth%20Textures/MAP Crimson.png';
    if (key === 'nulled') return 'src/assets/images/Maps/Earth%20Textures/MAP Nulled.png';
    return 'src/assets/images/Maps/Earth%20Textures/MAP Blue.png';
}

export function resolveEventImagePath(displayEvent, eventName) {
    if (window.eventManager && typeof window.eventManager.getEventImagePath === 'function') {
        return window.eventManager.getEventImagePath(displayEvent.name, displayEvent.image);
    }
    let eventImage = displayEvent.image || null;
    if (!eventImage || !String(eventImage).trim()) {
        const normalizedName = eventName.replace(/\s+/g, ' ').trim();
        return `src/assets/images/Archive/Events/${encodeURIComponent(normalizedName)}.png`;
    }
    return String(eventImage).trim();
}

export function hexToCss(hex) {
    const n = hex >>> 0;
    return `#${n.toString(16).padStart(6, '0')}`;
}

export function hexToRgb(hex) {
    const n = (hex >>> 0) & 0xffffff;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Match WorldviewMarkerInteraction.checkEventMarkerHover: no hover pulse on touch devices. */
export function isTouchHoverDisabled() {
    if (typeof window === 'undefined') return true;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/** Same test as WorldviewMarkerPulse.isAwakeningEventMarker (root event name). */
export function isMap2dLiteAwakeningEvent(event) {
    const name = event?.name;
    return typeof name === 'string' && name.trim().toLowerCase() === 'the awakening';
}

/**
 * Max CSS scale for a filled disk to reach farthest map corner from (u,v), x1.18 like WebGL overshoot.
 */
export function awakeningWaveMaxScale(u, v, baseW, baseH, markerDiameterPx) {
    const cx = u * baseW;
    const cy = v * baseH;
    const corners = [[0, 0], [baseW, 0], [0, baseH], [baseW, baseH]];
    let maxDist = 0;
    for (let i = 0; i < corners.length; i++) {
        const d = Math.hypot(corners[i][0] - cx, corners[i][1] - cy);
        if (d > maxDist) maxDist = d;
    }
    const r = Math.max(markerDiameterPx / 2, 4);
    return Math.max(16, (maxDist * 1.18) / r);
}

/** Matches WorldviewMarkerPulse: 1200+300 and 2600+300 between radiate plays. */
export const DOM_LITE_RADIATE_INTERVAL_NORMAL_MS = 1500;
export const DOM_LITE_RADIATE_INTERVAL_AWAKENING_MS = 2900;
export const DOM_LITE_MARKER_TRANSITION_MS = 300;
export const MAP2D_LOCK_TRANSITION_MS = 300;
export const CELESTIAL_PLANE_WORLD = 0.4;
export const CELESTIAL_DOM_PANEL_VISUAL_SCALE = 1.12;
export const MAP2D_CELESTIAL_PANEL_MAX_ZOOM_MULT = 3;
export const MAP_VIEW_CELESTIAL_Z_OFFSET = 0.18;
export const MAP2D_CELESTIAL_IMG_OPACITY = 0.55;
export const MAP2D_CELESTIAL_DOM_EDGE_PX = 12;
export const MAP2D_CELESTIAL_STACK_GAP_PX = 10;

export function map2dLiteCelestialMobileSizeFactor() {
    if (typeof window === 'undefined') return 1;
    const w = window.innerWidth;
    if (w <= 480) return 0.52;
    if (w <= 768) return 0.66;
    return 1;
}

export function countRenderableEarthMarkers(events) {
    let n = 0;
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const displayEvent = event.variants && event.variants.length > 0 ? event.variants[0] : event;
        const lt = displayEvent.locationType || event.locationType || 'earth';
        if (lt !== 'earth') continue;
        const lat = displayEvent.lat !== undefined ? displayEvent.lat : event.lat;
        const lon = displayEvent.lon !== undefined ? displayEvent.lon : event.lon;
        if (lat != null && lon != null) n++;
    }
    return n;
}

export function currentPageCelestialFlags(dataModel) {
    let hasMoon = false;
    let hasMars = false;
    let hasOrbit = false;

    let currentPageEvents = [];
    if (window.eventManager?.events && window.standaloneEventSlide?.currentPage) {
        const allEvents = window.eventManager.events;
        const currentPage = window.standaloneEventSlide.currentPage;
        const startIndex = (currentPage - 1) * 10;
        currentPageEvents = allEvents.slice(startIndex, startIndex + 10);
    } else if (dataModel?.getEventsForCurrentPage) {
        currentPageEvents = dataModel.getEventsForCurrentPage();
    }

    for (let i = 0; i < currentPageEvents.length; i++) {
        const event = currentPageEvents[i];
        const rootLt = event.locationType || 'earth';
        const visit = (loc) => {
            if (loc === 'moon') hasMoon = true;
            if (loc === 'mars') hasMars = true;
            if (loc === 'station' || loc === 'marsShip') hasOrbit = true;
        };
        visit(rootLt);
        if (event.variants && event.variants.length > 0) {
            for (let v = 0; v < event.variants.length; v++) {
                visit(event.variants[v].locationType || rootLt);
            }
        }
    }
    return { hasMoon, hasMars, hasOrbit };
}

export function computeCelestialDomPanelSizePx(camera, renderer, squashY = 1) {
    if (!camera || !renderer?.domElement) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const viewportW = Math.max(1, rect.width);
    const viewportH = Math.max(1, rect.height);
    const aspect = viewportW / viewportH;
    const fovRad = (camera.fov * Math.PI) / 180;
    const distance = Math.max(0.01, camera.position.z - MAP_VIEW_CELESTIAL_Z_OFFSET);
    const halfViewH = Math.tan(fovRad / 2) * distance;
    const halfViewW = halfViewH * aspect;
    const sy = squashY;
    return {
        width: Math.max(4, CELESTIAL_PLANE_WORLD * viewportW / (2 * halfViewW)),
        height: Math.max(4, CELESTIAL_PLANE_WORLD * viewportH / (2 * halfViewH) * Math.max(sy, 0.02))
    };
}

export function createMap2dLiteNavigationStub(fullEvent, displayEvent, variantIndex, sceneModel) {
    const filters = window.standaloneActiveFilters || new Set();
    const locked = shouldEventBeLocked(fullEvent, filters);
    const isMainVariant = variantIndex == null || variantIndex === 0;
    const originalColor = getMarkerColor(isMainVariant);
    return {
        userData: {
            isEventMarker: true,
            isInteractive: isMainVariant,
            isLocked: locked,
            event: fullEvent,
            eventName: displayEvent.name || fullEvent.name,
            locationType: displayEvent.locationType || fullEvent.locationType || 'earth',
            variantIndex: variantIndex ?? 0,
            isMainVariant,
            originalColor,
            isMap2dLiteProxy: true
        }
    };
}
