/**
 * Wave the rendered event cards in on page-flip — matches the dock thumbnail page-turn cadence.
 *
 * Stagger params:
 *   `staggerMs = 58`    delay step between successive items (mirrors dock thumbs).
 *   `maxDelayMs = 800`  ceiling so very long pages don't have items still appearing seconds in.
 *   total animation duration ≈ 515ms (CSS transition) + min((n-1)*58, 800).
 *
 * `prefers-reduced-motion: reduce` short-circuits to instant reveal with classes stripped.
 *
 * Re-entrancy: every call increments `renderService._entranceAnimToken`; later rAFs and the
 * cleanup timeout bail when their captured token no longer matches, so a fast prev/next/click
 * sequence doesn't leave half-animated items behind.
 *
 * @param {{ _entranceAnimToken: number }} renderService  Owning EventRenderService.
 * @param {HTMLElement|null} eventsList
 */
export function runStaggeredEntranceAnimation(renderService, eventsList) {
    if (!eventsList) return;
    const items = Array.from(eventsList.querySelectorAll('.event-item'));
    if (items.length === 0) return;

    const token = ++renderService._entranceAnimToken;
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        items.forEach((el) => {
            el.classList.remove('event-item--enter', 'event-item--enter-active');
            el.style.transitionDelay = '';
        });
        return;
    }

    const staggerMs = 58;
    const maxDelayMs = 800;

    items.forEach((el, i) => {
        el.classList.remove('event-item--enter-active');
        el.classList.add('event-item--enter');
        const delay = Math.min(i * staggerMs, maxDelayMs);
        el.style.transitionDelay = `${delay}ms`;
    });

    requestAnimationFrame(() => {
        if (token !== renderService._entranceAnimToken) return;
        // One more frame improves reliability immediately after DOM insert.
        requestAnimationFrame(() => {
            if (token !== renderService._entranceAnimToken) return;
            items.forEach((el) => el.classList.add('event-item--enter-active'));
        });
    });

    // Cleanup: strip the entrance classes after the animation finishes.
    const totalMs = 515 + Math.min((items.length - 1) * staggerMs, maxDelayMs);
    window.setTimeout(() => {
        if (token !== renderService._entranceAnimToken) return;
        items.forEach((el) => {
            el.classList.remove('event-item--enter', 'event-item--enter-active');
            el.style.transitionDelay = '';
        });
    }, totalMs);
}
