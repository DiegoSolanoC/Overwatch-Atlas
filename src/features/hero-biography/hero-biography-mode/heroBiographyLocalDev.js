/**
 * Local-only hero biography tooling (look range editor, etc.).
 */

/**
 * @returns {boolean}
 */
export function isHeroBiographyLocalDev() {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1';
}
