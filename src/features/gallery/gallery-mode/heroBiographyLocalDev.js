/**
 * Gallery bio editing — localhost always; GitHub Pages when Gallery is open.
 */

import { isStaticDeployHost } from '../../system-interface/interface-info-display/isEventSlideEditDevHost.js';

/**
 * @returns {boolean}
 */
export function isHeroBiographyLocalDev() {
    const h = window.location.hostname || '';
    if (h === 'localhost' || h === '127.0.0.1') return true;
    if (isStaticDeployHost() && document.getElementById('atlasGalleryHost')) return true;
    return false;
}
