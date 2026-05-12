/**
 * Body scale + badge anchor math: pins the passive badge under #musicToggle,
 * clamped against the #content region when present.
 */

export function getBodyScale() {
    try {
        const t = window.getComputedStyle(document.body).transform;
        if (!t || t === 'none') return 1;
        const m = t.match(/^matrix\(([^)]+)\)$/);
        if (!m) return 1;
        const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
        const a = parts[0];
        return (Number.isFinite(a) && a > 0) ? a : 1;
    } catch (_) {
        return 1;
    }
}

/**
 * @param {HTMLElement} musicButtonEl
 * @param {HTMLElement} badgeEl
 */
export function positionNowPlayingBadge(musicButtonEl, badgeEl) {
    const scale = getBodyScale();
    const musicRect = musicButtonEl.getBoundingClientRect();
    const gap = 2;

    const contentRect = document.getElementById('content')?.getBoundingClientRect() || null;
    const leftPos = contentRect
        ? ((contentRect.left + (contentRect.width * 0.8)) / scale)
        : (Math.max(1, (window.innerWidth || 1) / scale) * 0.7);

    badgeEl.style.left = `${leftPos}px`;
    badgeEl.style.right = '';
    badgeEl.style.top = `${(musicRect.bottom + gap) / scale}px`;
}
