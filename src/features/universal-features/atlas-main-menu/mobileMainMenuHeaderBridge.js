/**
 * Mobile main-menu ↔ header bridge.
 *
 * While the portrait slide deck is visible:
 *   - first tap on a header mode icon slides to that mode
 *   - second tap (already on that slide) selects it (hover preview → launch)
 */

/**
 * @returns {boolean}
 */
export function isMobileSlideMenuActive() {
    const deck = document.querySelector('.main-menu-mobile-deck');
    const menu = document.querySelector('.main-menu-buttons');
    const host = document.querySelector('.test-container');
    if (!deck || !menu || !host) return false;
    if (host.style.display === 'none' || menu.style.display === 'none') return false;

    const hostCs = window.getComputedStyle(host);
    if (hostCs.display === 'none' || hostCs.visibility === 'hidden') return false;

    if (typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 768px) and (orientation: portrait)').matches;
}

/**
 * @returns {ReturnType<import('./MenuMobileSlides.js').createMenuMobileSlides>['mobileSlidesApi'] | null}
 */
export function getMobileMenuSlidesApi() {
    const deck = document.querySelector('.main-menu-mobile-deck');
    return deck?.mobileSlidesApi || null;
}

/**
 * Intercept a header mode tap while the mobile slide menu is up.
 * @param {string} modeId
 * @param {Function} launchFn
 * @returns {boolean} true if the tap was handled (caller must not launch immediately)
 */
export function tryMobileMenuHeaderTap(modeId, launchFn) {
    if (!isMobileSlideMenuActive()) return false;
    const api = getMobileMenuSlidesApi();
    if (!api) return false;

    const current = api.getMode?.();
    if (!current || current.id !== modeId) {
        api.goToModeId?.(modeId);
        return true;
    }

    void api.selectWithHoverPreview?.(launchFn);
    return true;
}
