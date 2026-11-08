/**
 * Gallery hub — placeholder shell (distinct from Intel / entity browser).
 */

import {
    mountEmptyModeShell,
    unmountEmptyModeShell,
} from '../../universal-features/atlas-mode-shell/EmptyModeShell.js';

export async function mountGalleryHubMode() {
    mountEmptyModeShell({
        title: 'Gallery',
        lead: 'Gallery — content coming soon.',
    });
}

export async function unmountGalleryHubMode() {
    unmountEmptyModeShell();
}
