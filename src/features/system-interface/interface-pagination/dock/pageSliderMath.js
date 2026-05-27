/**
 * pageSliderMath — pure math for the dock page slider.
 *
 * The slider uses a high-resolution range input (0..EVENT_PAGE_SLIDER_RESOLUTION)
 * so the thumb moves smoothly while the discrete page only switches when
 * crossing interval boundaries.
 *
 *   - normalizedProgressFromSliderValue(rawValue): clamp+scale slider value -> [0..1].
 *   - pageFromSliderProgress(t, totalPages): map [0..1] -> 1-based page index.
 *   - sliderValueForPageCenter(page1Based, totalPages): inverse — center of a
 *     page's segment on the track (used when prev/next/input drives the slider).
 */

/** Range input max; thumb moves smoothly, pages switch at interval boundaries. */
export const EVENT_PAGE_SLIDER_RESOLUTION = 10000;

export function normalizedProgressFromSliderValue(rawValue) {
    const v = Number(rawValue);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(1, v / EVENT_PAGE_SLIDER_RESOLUTION));
}

/** @param {number} t - Progress 0..1 across all pages */
export function pageFromSliderProgress(t, totalPages) {
    const N = Math.max(1, totalPages | 0);
    if (N <= 1) return 1;
    const x = Math.max(0, Math.min(1, t));
    if (x >= 1) return N;
    return Math.min(N, Math.floor(x * N) + 1);
}

/** Center of the page’s segment on the track (for sync from prev/next/input). */
export function sliderValueForPageCenter(page1Based, totalPages) {
    const N = Math.max(1, totalPages | 0);
    const p = Math.min(Math.max(1, page1Based | 0), N);
    if (N <= 1) return 0;
    const segT = (p - 0.5) / N;
    return Math.round(segT * EVENT_PAGE_SLIDER_RESOLUTION);
}
