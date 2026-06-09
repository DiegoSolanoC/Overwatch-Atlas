const MENU_FOLDER = '/Menu/';
const MENU_HOVER_FOLDER = '/Menu%20Hover/';

/**
 * @param {string} normalPath
 * @returns {string | null}
 */
export function menuHoverImagePath(normalPath) {
    if (typeof normalPath !== 'string' || !normalPath) return null;
    if (normalPath.includes(MENU_HOVER_FOLDER)) return null;
    if (!normalPath.includes(MENU_FOLDER)) return null;
    return normalPath.replace(MENU_FOLDER, MENU_HOVER_FOLDER);
}

/**
 * @param {string} url
 * @returns {Promise<boolean>}
 */
function probeImageUrl(url) {
    return new Promise((resolve) => {
        const probe = new Image();
        probe.onload = () => resolve(true);
        probe.onerror = () => resolve(false);
        probe.src = url;
    });
}

/**
 * Swaps a main-menu tile icon to `Menu Hover/` on hover when a matching variant exists.
 *
 * @param {HTMLImageElement | null | undefined} img
 * @param {{ normalPath?: string, hoverTarget?: HTMLElement | null }} [options]
 */
export function wireMenuHoverIcon(img, options = {}) {
    if (!(img instanceof HTMLImageElement)) return;

    const normalSrc = options.normalPath || img.getAttribute('src') || '';
    const hoverSrc = menuHoverImagePath(normalSrc);
    if (!hoverSrc) return;

    const hoverTarget = options.hoverTarget
        || img.closest('.main-menu-btn, .main-menu-side-btn');
    if (!hoverTarget) return;

    void probeImageUrl(hoverSrc).then((ok) => {
        if (!ok || !img.isConnected || !hoverTarget.isConnected) return;

        const showHover = () => {
            img.src = hoverSrc;
        };
        const showNormal = () => {
            img.src = normalSrc;
        };

        hoverTarget.addEventListener('mouseenter', showHover);
        hoverTarget.addEventListener('mouseleave', showNormal);
        hoverTarget.addEventListener('focusin', showHover);
        hoverTarget.addEventListener('focusout', (event) => {
            if (hoverTarget.contains(event.relatedTarget)) return;
            showNormal();
        });
    });
}
