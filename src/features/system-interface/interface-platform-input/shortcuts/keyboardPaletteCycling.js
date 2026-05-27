/**
 * Palette menu input:
 *   - Digit 1..4 while the palette menu is open: jump straight to that palette.
 *   - Mouse wheel while pointer is over the palette menu: rotate through
 *     `PALETTE_ORDER`, wrapping at both ends.
 *
 * Both paths apply the palette by clicking the underlying option button, so
 * sound effects + persistence wired to `.palette-option-btn` fire as normal.
 */

export const PALETTE_ORDER = ['blue', 'gray', 'crimson', 'nulled'];

export function isPaletteMenuOpen() {
    const m = document.getElementById('paletteMenu');
    return !!(m && m.classList.contains('open'));
}

export function normalizeStoredPalette() {
    try {
        const s = localStorage.getItem('colorPalette');
        if (s === 'gray') return 'gray';
        if (s === 'crimson') return 'crimson';
        if (s === 'nulled') return 'nulled';
        return 'blue';
    } catch (_) {
        return 'blue';
    }
}

export function applyPaletteByName(name) {
    const btn = document.querySelector('#paletteMenu .palette-option-btn[data-palette="' + name + '"]');
    if (btn) btn.click();
}

/** Wheel-over-palette-menu cycler. Wired in installAppKeyboardShortcuts. */
export function onPaletteWheel(e, { modifiersActive, isTypingContext }) {
    if (modifiersActive(e)) return;
    if (isTypingContext(e.target)) return;
    if (!isPaletteMenuOpen()) return;
    const t = e.target;
    if (!t || !t.closest || !t.closest('#paletteMenu')) return;

    const cur = normalizeStoredPalette();
    let i = PALETTE_ORDER.indexOf(cur);
    if (i < 0) i = 0;
    if (e.deltaY > 0) {
        i = (i + 1) % PALETTE_ORDER.length;
    } else {
        i = (i - 1 + PALETTE_ORDER.length) % PALETTE_ORDER.length;
    }
    applyPaletteByName(PALETTE_ORDER[i]);
    e.preventDefault();
    e.stopPropagation();
}
