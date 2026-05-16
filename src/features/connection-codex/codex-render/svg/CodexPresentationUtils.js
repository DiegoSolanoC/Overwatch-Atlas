/**
 * Small HTML/CSS string helpers for Codex UI (single module — avoids one-liner micro-files).
 */

/** Escape text for safe insertion into HTML attribute or text nodes (Codex preview overlays). */
export function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Hex → rgba for Codex node backgrounds and toolbar color wells.
 * @param {string} hex - Hex color (e.g., "#ff0000" or "ff0000")
 * @param {number} opacity - Opacity value (0-1)
 */
export function hexToRgba(hex, opacity = 0.3) {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
