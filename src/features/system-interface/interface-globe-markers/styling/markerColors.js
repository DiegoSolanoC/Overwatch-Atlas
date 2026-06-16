import { normalizeSavedPalette } from '../../../universal-features/atlas-palette/PaletteConstants.js';

/** Main event marker accent per palette (globe + map 2D). */
export const MARKER_COLOR_MAIN_BY_PALETTE = {
    blue: 0xff6600,
    gray: 0x64b5f6,
    crimson: 0xffffff,
    nulled: 0xffca28,
};

/** Secondary / multi-variant markers use the same accent as main (labels differentiate variants). */
export const MARKER_COLOR_SECONDARY_BY_PALETTE = {
    blue: 0xff6600,
    gray: 0x64b5f6,
    crimson: 0xffffff,
    nulled: 0xffca28,
};

/** Locked / filtered-out marker color (paired with markerLockUnlock animations). */
export const EVENT_MARKER_LOCKED_HEX = 0x331100;

function getCurrentPaletteKey() {
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
 * When the color palette changes, update unlocked event markers + pin lines to match.
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
        if (marker.material && marker.material.color && typeof marker.material.color.setHex === 'function') {
            marker.material.color.setHex(hex);
        }

        const pin = ud.pinLine;
        if (isMainVariant && pin && pin.material && pin.material.color && typeof pin.material.color.setHex === 'function') {
            pin.material.color.setHex(hex);
        }

        delete ud._hoverGlowBase;
    }
}
