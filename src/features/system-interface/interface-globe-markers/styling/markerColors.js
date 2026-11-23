import { normalizeSavedPalette } from '../../../universal-features/atlas-palette/PaletteConstants.js';

/** Main event marker accent per palette (globe + map 2D). */
export const MARKER_COLOR_MAIN_BY_PALETTE = {
    blue: 0xff6600,
    gray: 0x64b5f6,
    /* Warm coral — white looked cold/blue against the crimson globe */
    crimson: 0xff8a65,
    nulled: 0xffca28,
};

/** Secondary / multi-variant markers use the same accent as main (labels differentiate variants). */
export const MARKER_COLOR_SECONDARY_BY_PALETTE = {
    blue: 0xff6600,
    gray: 0x64b5f6,
    crimson: 0xff8a65,
    nulled: 0xffca28,
};

/** Locked / filtered-out marker color (paired with markerLockUnlock animations). */
export const EVENT_MARKER_LOCKED_HEX = 0x331100;

/**
 * Prefer live body classes (same source as CSS) so markers never lag a frame behind localStorage.
 * @returns {'blue'|'gray'|'crimson'|'nulled'}
 */
export function getCurrentPaletteKey() {
    if (typeof document !== 'undefined' && document.body) {
        const cl = document.body.classList;
        if (cl.contains('color-palette-crimson')) return 'crimson';
        if (cl.contains('color-palette-gray')) return 'gray';
        if (cl.contains('color-palette-nulled')) return 'nulled';
        // No class = blue default (body classes only add non-blue keys)
        if (!cl.contains('color-palette-gray') && !cl.contains('color-palette-crimson') && !cl.contains('color-palette-nulled')) {
            const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('colorPalette') : null;
            return normalizeSavedPalette(saved);
        }
    }
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('colorPalette') : null;
    return normalizeSavedPalette(saved);
}

/**
 * Marker accent colors (main variant vs secondary), keyed to the active color palette.
 * @param {boolean} isMainVariant
 * @returns {number} hex
 */
export function getMarkerColor(isMainVariant) {
    const palette = getCurrentPaletteKey();
    if (isMainVariant) {
        return MARKER_COLOR_MAIN_BY_PALETTE[palette] ?? MARKER_COLOR_MAIN_BY_PALETTE.blue;
    }
    return MARKER_COLOR_SECONDARY_BY_PALETTE[palette] ?? MARKER_COLOR_SECONDARY_BY_PALETTE.blue;
}

/**
 * Default restore color when userData.originalColor was never set.
 * @param {{ isInteractive?: boolean, isMainVariant?: boolean }} userData
 * @returns {number}
 */
export function getDefaultMarkerOriginalHex(userData) {
    if (!userData || userData.isInteractive === false) {
        return getMarkerColor(false);
    }
    return getMarkerColor(userData.isMainVariant !== false);
}

/**
 * Soft-lerp a THREE.Color (and optional pin) toward a target hex.
 * @param {THREE.Color} color
 * @param {number} targetHex
 * @param {number} ms
 * @param {THREE.Color} [pinColor]
 */
function lerpColorToHex(color, targetHex, ms, pinColor = null) {
    if (!color || typeof color.lerp !== 'function') return;
    const THREE = window.THREE;
    if (!THREE) {
        color.setHex(targetHex);
        if (pinColor) pinColor.setHex(targetHex);
        return;
    }
    const from = color.clone();
    const to = new THREE.Color(targetHex);
    const pinFrom = pinColor ? pinColor.clone() : null;
    const t0 = performance.now();
    const step = (now) => {
        const u = Math.min(1, (now - t0) / Math.max(1, ms));
        const e = u * u * (3 - 2 * u);
        color.copy(from).lerp(to, e);
        if (pinColor && pinFrom) pinColor.copy(pinFrom).lerp(to, e);
        if (u < 1) requestAnimationFrame(step);
        else {
            color.setHex(targetHex);
            if (pinColor) pinColor.setHex(targetHex);
        }
    };
    requestAnimationFrame(step);
}

/**
 * When the color palette changes, ease unlocked event markers + pin lines to the new accent
 * (instead of snapping, which reads as “slapped on” over the globe crossfade).
 * @param {*} sceneModel
 */
export function applyPaletteToExistingEventMarkers(sceneModel) {
    const gc = typeof window !== 'undefined' ? window.globeController : null;
    if (sceneModel?.getMapViewEnabled?.() && gc?.map2dLite) {
        gc.map2dLite.refreshTexturesFromScene?.();
        gc.map2dLite.syncMarkers?.({ mode: 'instant' });
    }
    if (!sceneModel || typeof sceneModel.getMarkers !== 'function') return;
    const markers = sceneModel.getMarkers();
    if (!markers || !markers.length) return;

    for (let i = 0; i < markers.length; i++) {
        const marker = markers[i];
        const ud = marker.userData;
        if (!ud || !ud.isEventMarker || ud.isLocked) continue;

        const isInteractive = ud.isInteractive !== false;
        const isMainVariant = ud.isMainVariant !== false;
        const hex = isInteractive && isMainVariant ? getMarkerColor(true) : getMarkerColor(false);

        ud.originalColor = hex;
        // Overlap cycling caches the old accent; drop it so restores match the new palette
        delete ud._trueOriginalColor;
        delete ud._hoverGlowBase;

        const pin = ud.pinLine;
        const pinColor = pin?.material?.color || null;
        if (marker.material && marker.material.color && typeof marker.material.color.setHex === 'function') {
            lerpColorToHex(marker.material.color, hex, 160, pinColor);
        } else if (pinColor && typeof pinColor.setHex === 'function') {
            lerpColorToHex(pinColor, hex, 160);
        }
    }
}
