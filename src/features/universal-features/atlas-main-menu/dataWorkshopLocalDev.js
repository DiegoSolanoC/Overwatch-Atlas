/**
 * Data Workshop is available only when running on loopback (local dev server).
 */

/**
 * @returns {boolean}
 */
export function isDataWorkshopLocalDev() {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1';
}
