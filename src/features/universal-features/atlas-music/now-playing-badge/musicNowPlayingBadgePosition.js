/**
 * Body scale + badge anchor math: pins the passive now-playing badge under the
 * right header hub, mirrored against the summary badge under `#headerHub`.
 * Horizontal anchors are viewport-fixed so side panels do not shift them.
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
 * @param {HTMLElement} badgeEl
 */
export function positionNowPlayingBadge(badgeEl) {
    const headerHubRight = document.getElementById('headerHubRight');
    if (!badgeEl || !headerHubRight) return;

    const scale = getBodyScale();
    const rect = headerHubRight.getBoundingClientRect();
    const gap = 2;

    // Viewport-fixed mirror of SummaryInfoBadge (20% via `right` → 80% via `left`).
    const vw = Math.max(1, (window.innerWidth || 1) / scale);
    const leftPos = vw * 0.8;

    badgeEl.style.left = `${leftPos}px`;
    badgeEl.style.right = '';
    badgeEl.style.top = `${(rect.bottom + gap) / scale}px`;
}
